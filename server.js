const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const ROOT = __dirname;
const uploadsDir = path.join(ROOT, 'uploads');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

fs.mkdirSync(uploadsDir, { recursive: true });
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
app.use(express.static(ROOT, { extensions: ['html'] }));

const allowedStatuses = new Set(['new', 'contacted', 'qualified', 'closed']);
const allowedCategories = new Set(['youtube', 'instagram', 'news']);
const sessionCookie = 'sainand_admin_session';

function text(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function signedSession(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'development-session-secret')
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function sessionFromRequest(request) {
  const rawCookie = request.headers.cookie || '';
  const raw = rawCookie
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1);

  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'development-session-secret')
    .update(payload)
    .digest('base64url');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.username || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setSessionCookie(response, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${sessionCookie}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function passwordMatches(candidate) {
  const actual = Buffer.from(String(process.env.ADMIN_PASSWORD || ''));
  const supplied = Buffer.from(String(candidate || ''));
  return actual.length > 0 && actual.length === supplied.length && crypto.timingSafeEqual(actual, supplied);
}

function requireAdmin(request, response, next) {
  if (!sessionFromRequest(request)) {
    return response.status(401).json({ error: 'Please sign in as an administrator.' });
  }
  next();
}

function validId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function publicPost(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    mediaUrl: row.media_url,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

function adminPost(row) {
  return {
    ...publicPost(row),
    isPublished: row.is_published,
  };
}

function adminEnquiry(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    phone: row.phone,
    email: row.email,
    plan: row.plan,
    message: row.message,
    status: row.status,
    followUp1: row.follow_up_1,
    followUp2: row.follow_up_2,
    followUp3: row.follow_up_3,
    adminNotes: row.admin_notes,
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
      callback(null, `news-${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  },
});

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ ok: true });
  } catch (error) {
    console.error('Health check failed:', error);
    response.status(503).json({ ok: false });
  }
});

app.get('/api/news', async (_request, response) => {
  try {
    const result = await pool.query(
      'SELECT id, category, title, description, media_url, image_url, created_at FROM news_posts WHERE is_published = TRUE ORDER BY created_at DESC',
    );
    response.json({ posts: result.rows.map(publicPost) });
  } catch (error) {
    console.error('Public news error:', error);
    response.status(500).json({ error: 'Unable to load news right now.' });
  }
});

app.post('/api/enquiries', async (request, response) => {
  const name = text(request.body?.name, 120);
  const phone = text(request.body?.phone, 40);
  const email = text(request.body?.email, 254).toLowerCase();
  const plan = text(request.body?.plan, 180);
  const message = text(request.body?.message, 4000);

  if (!name || !phone || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Please provide a valid name, phone number, and email address.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO enquiries (name, phone, email, plan, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [name, phone, email, plan, message],
    );
    response.status(201).json({ success: true, enquiry: result.rows[0] });
  } catch (error) {
    console.error('Enquiry save error:', error);
    response.status(500).json({ error: 'Unable to save your enquiry right now. Please call us directly.' });
  }
});

app.post('/api/chat', async (request, response) => {
  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({ error: 'Chat service is not configured yet.' });
  }

  const incomingMessages = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const messages = incomingMessages
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .slice(-12)
    .map(message => ({ role: message.role, content: text(message.content, 2000) }));

  if (!messages.length) return response.status(400).json({ error: 'Please enter a message.' });

  const systemPrompt = `You are Sai, the helpful website assistant for Sainand Chits India Pvt. Ltd. Answer clearly and politely in short paragraphs.

Business details:
- Sainand Chits India Pvt. Ltd. operates from Nagpur, Maharashtra.
- Phone: +91 98765 43210.
- Email: info@sainandchitfund.com.
- Plans shown on the website include 5 Lakh, 10 Lakh, 15 Lakh, and 20 Lakh Bhisi plans.
- Exact eligibility, fees, bidding rules, documents, and availability must be confirmed by the company team.
- Do not promise approvals, returns, or financial outcomes.
- For account-specific or urgent questions, direct the visitor to the phone number or email above.
- Never claim to be a human or to have access to private customer records.`;

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 300,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });
    const result = await openAiResponse.json();
    if (!openAiResponse.ok) {
      console.error('OpenAI error:', result);
      return response.status(502).json({ error: 'The chat service is temporarily unavailable.' });
    }
    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) return response.status(502).json({ error: 'The chat service returned no answer.' });
    response.json({ answer });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    response.status(500).json({ error: 'Unable to process the chat message.' });
  }
});

app.post('/api/admin/login', (request, response) => {
  if (!isAdminConfigured()) {
    return response.status(503).json({ error: 'Admin access is not configured. Add the ADMIN_PASSWORD secret first.' });
  }

  const username = text(request.body?.username, 80);
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  if (username !== expectedUsername || !passwordMatches(request.body?.password)) {
    return response.status(401).json({ error: 'Incorrect username or password.' });
  }

  setSessionCookie(response, signedSession(username), 60 * 60 * 12);
  response.json({ success: true, username });
});

app.post('/api/admin/logout', (request, response) => {
  setSessionCookie(response, '', 0);
  response.json({ success: true });
});

app.get('/api/admin/session', (request, response) => {
  const session = sessionFromRequest(request);
  response.json({
    authenticated: Boolean(session),
    username: session?.username || null,
    configured: isAdminConfigured(),
  });
});

app.get('/api/admin/enquiries', requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM enquiries ORDER BY created_at DESC');
    response.json({ enquiries: result.rows.map(adminEnquiry) });
  } catch (error) {
    console.error('Admin enquiries error:', error);
    response.status(500).json({ error: 'Unable to load enquiries.' });
  }
});

app.patch('/api/admin/enquiries/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const status = text(request.body?.status, 30);
  if (!id || !allowedStatuses.has(status)) {
    return response.status(400).json({ error: 'Invalid enquiry update.' });
  }

  try {
    const result = await pool.query(
      `UPDATE enquiries
       SET status = $1, follow_up_1 = $2, follow_up_2 = $3, follow_up_3 = $4, admin_notes = $5
       WHERE id = $6
       RETURNING *`,
      [
        status,
        text(request.body?.followUp1, 1000),
        text(request.body?.followUp2, 1000),
        text(request.body?.followUp3, 1000),
        text(request.body?.adminNotes, 4000),
        id,
      ],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Enquiry not found.' });
    response.json({ enquiry: adminEnquiry(result.rows[0]) });
  } catch (error) {
    console.error('Enquiry update error:', error);
    response.status(500).json({ error: 'Unable to update the enquiry.' });
  }
});

app.delete('/api/admin/enquiries/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid enquiry.' });
  try {
    const result = await pool.query('DELETE FROM enquiries WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Enquiry not found.' });
    response.json({ success: true });
  } catch (error) {
    console.error('Enquiry delete error:', error);
    response.status(500).json({ error: 'Unable to delete the enquiry.' });
  }
});

app.get('/api/admin/news', requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM news_posts ORDER BY created_at DESC');
    response.json({ posts: result.rows.map(adminPost) });
  } catch (error) {
    console.error('Admin news error:', error);
    response.status(500).json({ error: 'Unable to load news posts.' });
  }
});

app.post('/api/admin/news', requireAdmin, async (request, response) => {
  const category = text(request.body?.category, 20);
  const title = text(request.body?.title, 180);
  if (!allowedCategories.has(category) || !title) {
    return response.status(400).json({ error: 'Choose a content type and enter a title.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO news_posts (category, title, description, media_url, image_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        category,
        title,
        text(request.body?.description, 4000),
        text(request.body?.mediaUrl, 1000),
        text(request.body?.imageUrl, 1000),
        request.body?.isPublished !== false,
      ],
    );
    response.status(201).json({ post: adminPost(result.rows[0]) });
  } catch (error) {
    console.error('News create error:', error);
    response.status(500).json({ error: 'Unable to save the post.' });
  }
});

app.patch('/api/admin/news/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const category = text(request.body?.category, 20);
  const title = text(request.body?.title, 180);
  if (!id || !allowedCategories.has(category) || !title) {
    return response.status(400).json({ error: 'Invalid post update.' });
  }
  try {
    const result = await pool.query(
      `UPDATE news_posts
       SET category = $1, title = $2, description = $3, media_url = $4, image_url = $5, is_published = $6
       WHERE id = $7
       RETURNING *`,
      [
        category,
        title,
        text(request.body?.description, 4000),
        text(request.body?.mediaUrl, 1000),
        text(request.body?.imageUrl, 1000),
        request.body?.isPublished !== false,
        id,
      ],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Post not found.' });
    response.json({ post: adminPost(result.rows[0]) });
  } catch (error) {
    console.error('News update error:', error);
    response.status(500).json({ error: 'Unable to update the post.' });
  }
});

app.delete('/api/admin/news/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid post.' });
  try {
    const result = await pool.query('DELETE FROM news_posts WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Post not found.' });
    response.json({ success: true });
  } catch (error) {
    console.error('News delete error:', error);
    response.status(500).json({ error: 'Unable to delete the post.' });
  }
});

app.post('/api/admin/uploads', requireAdmin, upload.single('image'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Please choose an image file.' });
  response.status(201).json({ url: `/uploads/${request.file.filename}` });
});

app.get('/news', (_request, response) => response.sendFile(path.join(ROOT, 'news.html')));
app.get('/admin', (_request, response) => response.sendFile(path.join(ROOT, 'admin.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sainand Chits server listening on port ${PORT}`);
});
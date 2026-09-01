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
const allowedSitePages = new Set([
  'faq',
  'contact-us',
  'support-center',
  'privacy-policy',
  'authorized-certificates',
  'terms-and-conditions',
]);
const sessionCookie = 'sainand_admin_session';

const defaultSitePages = {
  faq: {
    title: 'Frequently asked questions',
    intro: 'Clear answers about Bhisi savings, bidding, documents, and membership.',
    body: 'Have a question about how Sainand Chits works? Start with the answers below, or contact our team for help with your specific situation.',
  },
  'contact-us': {
    title: 'Contact Sainand Chits India',
    intro: 'Our team is here to answer your questions about Bhisi savings and membership.',
    body: 'Call us at +91 98765 43210 or email info@sainandchitfund.com. Our office is in Nagpur, Maharashtra, and our support team is available Monday to Saturday, 10:00 AM to 7:00 PM IST.',
  },
  'support-center': {
    title: 'Support Center',
    intro: 'Find the right way to get help with your enquiry, documents, or member support.',
    body: 'Choose a support option below and our team will guide you through the next step. For urgent assistance, call us directly during office hours.',
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    intro: 'How Sainand Chits India handles information shared through this website.',
    body: 'We use the information you submit through our enquiry forms to respond to your request, explain relevant Bhisi plans, and provide member support. We do not sell your personal information. You can contact us to ask about information associated with your enquiry or to request an update.',
  },
  'authorized-certificates': {
    title: 'Authorized Certificates',
    intro: 'Company certificates and documents published by Sainand Chits India.',
    body: 'The documents below are shared for transparency and reference. Please contact our office if you need help verifying a document or require a current copy.',
  },
  'terms-and-conditions': {
    title: 'Terms & Conditions',
    intro: 'The terms that apply when you use this website and submit an enquiry.',
    body: 'Information on this website is provided for general guidance and does not replace the written terms of a Bhisi group or a direct confirmation from Sainand Chits India. Plan availability, eligibility, fees, bidding rules, and documentation must be confirmed with our team before joining.',
  },
};

const defaultFaqs = [
  {
    question: 'What is a Bhisi?',
    answer: 'A Bhisi is a group savings arrangement where members contribute a fixed monthly instalment and one member receives the pooled amount each month through the agreed bidding process.',
  },
  {
    question: 'How do I choose a plan?',
    answer: 'Choose a plan based on the amount you need and the monthly instalment you can comfortably manage. Our team can explain current availability and eligibility before you decide.',
  },
  {
    question: 'How can I contact the Sainand Chits team?',
    answer: 'Call +91 98765 43210, email info@sainandchitfund.com, or send an enquiry through the website.',
  },
];

const defaultSupportItems = [
  {
    title: 'Plan and eligibility help',
    description: 'Ask about current Bhisi plans, monthly instalments, eligibility, and required documents.',
    linkUrl: '/#contact',
  },
  {
    title: 'Member support',
    description: 'Contact our team for help with bidding, statements, account questions, or follow-up.',
    linkUrl: 'tel:+919876543210',
  },
  {
    title: 'Office and document verification',
    description: 'Reach us directly if you need help verifying a certificate or visiting our Nagpur office.',
    linkUrl: '/contact-us',
  },
];

function text(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizedPhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-20);
}

function cleanChatTranscript(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .slice(-40)
    .map(message => ({
      role: message.role,
      content: text(message.content, 2000),
    }))
    .filter(message => message.content);
}

function enquiryDedupeKey(email, phoneKey, plan, message) {
  return crypto
    .createHash('sha256')
    .update([email, phoneKey, text(plan, 180).toLowerCase(), text(message, 4000).toLowerCase()].join('|'))
    .digest('hex');
}

function shouldOfferEnquiry(answer) {
  return /contact|call|email|phone|reach|write|eligibility|document|availability|more information|our team|confirm exact|share your details|form below|@/i.test(answer);
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

function publicSitePage(row, slug) {
  const fallback = defaultSitePages[slug];
  return {
    slug,
    title: row?.title || fallback.title,
    intro: row?.intro || fallback.intro,
    body: row?.body || fallback.body,
    updatedAt: row?.updated_at || null,
  };
}

function publicFaq(row) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
  };
}

function adminFaq(row) {
  return {
    ...publicFaq(row),
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  };
}

function publicSupportItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    linkUrl: row.link_url,
  };
}

function adminSupportItem(row) {
  return {
    ...publicSupportItem(row),
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  };
}

function publicCertificate(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fileUrl: row.file_url,
    fileName: row.file_name,
  };
}

function adminCertificate(row) {
  return {
    ...publicCertificate(row),
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    chatTranscript: cleanChatTranscript(row.chat_transcript),
    historyCount: Number(row.history_count || 1),
  };
}

function fallbackChatAnswer(messages) {
  const question = text(messages[messages.length - 1]?.content, 2000).toLowerCase();
  if (/plan|lakh|scheme|bhisi|monthly|installment|instalment/.test(question)) {
    return 'We currently show ₹5 Lakh, ₹10 Lakh, ₹15 Lakh, and ₹20 Lakh Bhisi plans. For current availability, exact instalments, eligibility, and documents, please share your details in the form below and our team will contact you.';
  }
  if (/contact|phone|call|email|office|address|location|nagpur/.test(question)) {
    return 'You can reach Sainand Chits India at +91 98765 43210 or info@sainandchitfund.com. Our office is in Nagpur, Maharashtra. If you would like a callback, please share your details in the form below.';
  }
  if (/bid|boli|auction|discount|dividend|how.*work/.test(question)) {
    return 'Each member pays the fixed instalment into a shared pool. Members who need the payout bid openly, and the winning discount is shared with the remaining members. For the exact rules, please share your details in the form below and our team will contact you.';
  }
  return 'I can share general information about our Bhisi plans and bidding process. For exact eligibility, fees, documents, availability, or account-specific help, please share your details in the form below and our team will contact you.';
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

const certificateUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || '.pdf';
      callback(null, `certificate-${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf');
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

app.get('/api/site/pages/:slug', async (request, response) => {
  const slug = text(request.params.slug, 60);
  if (!allowedSitePages.has(slug)) return response.status(404).json({ error: 'Page not found.' });

  try {
    const pageResult = await pool.query('SELECT * FROM site_pages WHERE slug = $1', [slug]);
    const page = publicSitePage(pageResult.rows[0], slug);
    const result = { page, faqs: [], supportItems: [], certificates: [] };

    if (slug === 'faq') {
      const faqResult = await pool.query(
        'SELECT id, question, answer FROM site_faqs WHERE is_published = TRUE ORDER BY sort_order ASC, id ASC',
      );
      result.faqs = faqResult.rows.map(publicFaq);
    }
    if (slug === 'support-center') {
      const supportResult = await pool.query(
        'SELECT id, title, description, link_url FROM support_items WHERE is_published = TRUE ORDER BY sort_order ASC, id ASC',
      );
      result.supportItems = supportResult.rows.map(publicSupportItem);
    }
    if (slug === 'authorized-certificates') {
      const certificateResult = await pool.query(
        'SELECT id, title, description, file_url, file_name FROM site_certificates WHERE is_published = TRUE ORDER BY sort_order ASC, id ASC',
      );
      result.certificates = certificateResult.rows.map(publicCertificate);
    }

    response.json(result);
  } catch (error) {
    console.error('Public site content error:', error);
    response.json({
      page: publicSitePage(null, slug),
      faqs: slug === 'faq' ? defaultFaqs : [],
      supportItems: slug === 'support-center' ? defaultSupportItems : [],
      certificates: [],
      storageAvailable: false,
    });
  }
});

app.post('/api/enquiries', async (request, response) => {
  const name = text(request.body?.name, 120);
  const phone = text(request.body?.phone, 40);
  const email = text(request.body?.email, 254).toLowerCase();
  const plan = text(request.body?.plan, 180);
  const message = text(request.body?.message, 4000);
  const phoneKey = normalizedPhone(phone);
  const chatTranscript = cleanChatTranscript(request.body?.chatTranscript);

  if (!name || !phone || phoneKey.length < 10 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Please provide a valid name, phone number, and email address.' });
  }

  try {
    const contactKey = email;
    const dedupeKey = enquiryDedupeKey(email, phoneKey, plan, message);
    const existing = await pool.query(
      'SELECT * FROM enquiries WHERE email = $1 AND phone_key = $2 AND dedupe_key = $3 ORDER BY created_at DESC LIMIT 1',
      [email, phoneKey, dedupeKey],
    );

    if (existing.rowCount) {
      const existingRow = existing.rows[0];
      const updated = chatTranscript.length
        ? await pool.query(
          'UPDATE enquiries SET chat_transcript = $1::jsonb WHERE id = $2 RETURNING *',
          [JSON.stringify(chatTranscript), existingRow.id],
        )
        : { rows: [existingRow] };
      return response.status(200).json({
        success: true,
        duplicate: true,
        enquiry: adminEnquiry(updated.rows[0]),
      });
    }

    const result = await pool.query(
      `INSERT INTO enquiries
        (name, phone, email, plan, message, contact_key, phone_key, dedupe_key, chat_transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [name, phone, email, plan, message, contactKey, phoneKey, dedupeKey, JSON.stringify(chatTranscript)],
    );
    response.status(201).json({ success: true, enquiry: adminEnquiry(result.rows[0]) });
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
- For account-specific questions or when a visitor wants more information or a callback, invite them to fill in the enquiry form below with their name, email, phone number, and interested plan.
- For urgent questions, also share the phone number or email above.
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
      if (
        openAiResponse.status === 401 ||
        result.error?.code === 'insufficient_quota' ||
        result.error?.code === 'credit_balance_exhausted' ||
        result.error?.code === 'token_invalidated' ||
        result.error?.code === 'invalid_api_key'
      ) {
        const answer = fallbackChatAnswer(messages);
        return response.json({ answer, fallback: true, showEnquiryForm: shouldOfferEnquiry(answer) });
      }
      return response.status(502).json({ error: 'The chat service is temporarily unavailable.' });
    }
    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) return response.status(502).json({ error: 'The chat service returned no answer.' });
    response.json({ answer, showEnquiryForm: shouldOfferEnquiry(answer) });
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
    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM enquiries history
         WHERE history.email = e.email OR history.phone_key = e.phone_key) AS history_count
       FROM enquiries e
       ORDER BY e.created_at DESC`,
    );
    response.json({ enquiries: result.rows.map(adminEnquiry) });
  } catch (error) {
    console.error('Admin enquiries error:', error);
    response.status(500).json({ error: 'Unable to load enquiries.' });
  }
});

app.get('/api/admin/enquiries/:id/history', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid enquiry.' });

  try {
    const selected = await pool.query('SELECT * FROM enquiries WHERE id = $1', [id]);
    if (!selected.rowCount) return response.status(404).json({ error: 'Enquiry not found.' });

    const enquiry = selected.rows[0];
    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM enquiries history
         WHERE history.email = e.email OR history.phone_key = e.phone_key) AS history_count
       FROM enquiries e
       WHERE e.email = $1 OR e.phone_key = $2
       ORDER BY e.created_at DESC`,
      [enquiry.email, enquiry.phone_key],
    );
    response.json({
      customer: {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
      },
      enquiries: result.rows.map(adminEnquiry),
    });
  } catch (error) {
    console.error('Enquiry history error:', error);
    response.status(500).json({ error: 'Unable to load enquiry history.' });
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

app.get('/api/admin/site-content', requireAdmin, async (_request, response) => {
  try {
    const [pages, faqs, supportItems, certificates] = await Promise.all([
      pool.query('SELECT * FROM site_pages ORDER BY slug ASC'),
      pool.query('SELECT * FROM site_faqs ORDER BY sort_order ASC, id ASC'),
      pool.query('SELECT * FROM support_items ORDER BY sort_order ASC, id ASC'),
      pool.query('SELECT * FROM site_certificates ORDER BY sort_order ASC, id ASC'),
    ]);
    const pageMap = new Map(pages.rows.map(row => [row.slug, row]));
    response.json({
      pages: [...allowedSitePages].map(slug => publicSitePage(pageMap.get(slug), slug)),
      faqs: faqs.rows.map(adminFaq),
      supportItems: supportItems.rows.map(adminSupportItem),
      certificates: certificates.rows.map(adminCertificate),
    });
  } catch (error) {
    console.error('Admin site content error:', error);
    response.status(500).json({ error: 'Unable to load site content. Please apply schema.sql first.' });
  }
});

app.put('/api/admin/site-pages/:slug', requireAdmin, async (request, response) => {
  const slug = text(request.params.slug, 60);
  const title = text(request.body?.title, 180);
  if (!allowedSitePages.has(slug) || !title) {
    return response.status(400).json({ error: 'Choose a valid page and enter a title.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO site_pages (slug, title, intro, body, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (slug) DO UPDATE
       SET title = EXCLUDED.title, intro = EXCLUDED.intro, body = EXCLUDED.body, updated_at = NOW()
       RETURNING *`,
      [slug, title, text(request.body?.intro, 500), text(request.body?.body, 12000)],
    );
    response.json({ page: publicSitePage(result.rows[0], slug) });
  } catch (error) {
    console.error('Site page update error:', error);
    response.status(500).json({ error: 'Unable to save this page.' });
  }
});

app.post('/api/admin/site-faqs', requireAdmin, async (request, response) => {
  const question = text(request.body?.question, 240);
  if (!question) return response.status(400).json({ error: 'Enter a question.' });
  try {
    const result = await pool.query(
      `INSERT INTO site_faqs (question, answer, sort_order, is_published, updated_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [
        question,
        text(request.body?.answer, 4000),
        Number.parseInt(request.body?.sortOrder, 10) || 0,
        request.body?.isPublished !== false,
      ],
    );
    response.status(201).json({ faq: adminFaq(result.rows[0]) });
  } catch (error) {
    console.error('FAQ create error:', error);
    response.status(500).json({ error: 'Unable to save the FAQ.' });
  }
});

app.patch('/api/admin/site-faqs/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const question = text(request.body?.question, 240);
  if (!id || !question) return response.status(400).json({ error: 'Enter a valid FAQ question.' });
  try {
    const result = await pool.query(
      `UPDATE site_faqs
       SET question = $1, answer = $2, sort_order = $3, is_published = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        question,
        text(request.body?.answer, 4000),
        Number.parseInt(request.body?.sortOrder, 10) || 0,
        request.body?.isPublished !== false,
        id,
      ],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'FAQ not found.' });
    response.json({ faq: adminFaq(result.rows[0]) });
  } catch (error) {
    console.error('FAQ update error:', error);
    response.status(500).json({ error: 'Unable to update the FAQ.' });
  }
});

app.delete('/api/admin/site-faqs/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid FAQ.' });
  try {
    const result = await pool.query('DELETE FROM site_faqs WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'FAQ not found.' });
    response.json({ success: true });
  } catch (error) {
    console.error('FAQ delete error:', error);
    response.status(500).json({ error: 'Unable to delete the FAQ.' });
  }
});

app.post('/api/admin/support-items', requireAdmin, async (request, response) => {
  const title = text(request.body?.title, 180);
  if (!title) return response.status(400).json({ error: 'Enter a support item title.' });
  try {
    const result = await pool.query(
      `INSERT INTO support_items (title, description, link_url, sort_order, is_published, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [
        title,
        text(request.body?.description, 4000),
        text(request.body?.linkUrl, 1000),
        Number.parseInt(request.body?.sortOrder, 10) || 0,
        request.body?.isPublished !== false,
      ],
    );
    response.status(201).json({ supportItem: adminSupportItem(result.rows[0]) });
  } catch (error) {
    console.error('Support item create error:', error);
    response.status(500).json({ error: 'Unable to save the support item.' });
  }
});

app.patch('/api/admin/support-items/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const title = text(request.body?.title, 180);
  if (!id || !title) return response.status(400).json({ error: 'Enter a valid support item title.' });
  try {
    const result = await pool.query(
      `UPDATE support_items
       SET title = $1, description = $2, link_url = $3, sort_order = $4, is_published = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        title,
        text(request.body?.description, 4000),
        text(request.body?.linkUrl, 1000),
        Number.parseInt(request.body?.sortOrder, 10) || 0,
        request.body?.isPublished !== false,
        id,
      ],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Support item not found.' });
    response.json({ supportItem: adminSupportItem(result.rows[0]) });
  } catch (error) {
    console.error('Support item update error:', error);
    response.status(500).json({ error: 'Unable to update the support item.' });
  }
});

app.delete('/api/admin/support-items/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid support item.' });
  try {
    const result = await pool.query('DELETE FROM support_items WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Support item not found.' });
    response.json({ success: true });
  } catch (error) {
    console.error('Support item delete error:', error);
    response.status(500).json({ error: 'Unable to delete the support item.' });
  }
});

app.post('/api/admin/certificates/upload', requireAdmin, certificateUpload.single('certificate'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Please choose an image or PDF certificate.' });
  response.status(201).json({
    url: `/uploads/${request.file.filename}`,
    fileName: request.file.originalname,
  });
});

app.post('/api/admin/certificates', requireAdmin, async (request, response) => {
  const title = text(request.body?.title, 180);
  const fileUrl = text(request.body?.fileUrl, 1000);
  if (!title || !fileUrl) return response.status(400).json({ error: 'Enter a certificate title and upload its file.' });
  try {
    const result = await pool.query(
      `INSERT INTO site_certificates
       (title, description, file_url, file_name, sort_order, is_published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [
        title,
        text(request.body?.description, 4000),
        fileUrl,
        text(request.body?.fileName, 255),
        Number.parseInt(request.body?.sortOrder, 10) || 0,
        request.body?.isPublished !== false,
      ],
    );
    response.status(201).json({ certificate: adminCertificate(result.rows[0]) });
  } catch (error) {
    console.error('Certificate create error:', error);
    response.status(500).json({ error: 'Unable to save the certificate.' });
  }
});

app.patch('/api/admin/certificates/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const title = text(request.body?.title, 180);
  if (!id || !title) return response.status(400).json({ error: 'Enter a valid certificate title.' });
  try {
    const result = await pool.query(
      `UPDATE site_certificates
       SET title = $1, description = $2, file_url = $3, file_name = $4, sort_order = $5, is_published = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        title,
        text(request.body?.description, 4000),
        text(request.body?.fileUrl, 1000),
        text(request.body?.fileName, 255),
        Number.parseInt(request.body?.sortOrder, 10) || 0,
        request.body?.isPublished !== false,
        id,
      ],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Certificate not found.' });
    response.json({ certificate: adminCertificate(result.rows[0]) });
  } catch (error) {
    console.error('Certificate update error:', error);
    response.status(500).json({ error: 'Unable to update the certificate.' });
  }
});

app.delete('/api/admin/certificates/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid certificate.' });
  try {
    const result = await pool.query('DELETE FROM site_certificates WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Certificate not found.' });
    response.json({ success: true });
  } catch (error) {
    console.error('Certificate delete error:', error);
    response.status(500).json({ error: 'Unable to delete the certificate.' });
  }
});

app.post('/api/admin/uploads', requireAdmin, upload.single('image'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Please choose an image file.' });
  response.status(201).json({ url: `/uploads/${request.file.filename}` });
});

app.get(['/news', '/news-announcements'], (_request, response) => response.sendFile(path.join(ROOT, 'news.html')));
app.get(
  ['/faq', '/contact', '/contact-us', '/support', '/support-center', '/privacy', '/privacy-policy', '/certificates', '/authorized-certificates', '/terms', '/terms-and-conditions'],
  (_request, response) => response.sendFile(path.join(ROOT, 'site-page.html')),
);
app.get('/admin', (_request, response) => response.sendFile(path.join(ROOT, 'admin.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sainand Chits server listening on port ${PORT}`);
});
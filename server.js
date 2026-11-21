require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const compression = require('compression');
const { Pool } = require('pg');
const mailer = require('./services/mailer');
const { sendJobApplicationEmails, sendAdminOtpEmail, sendEnquiryEmails } = mailer;
const { initCrm, registerCrmRoutes, phoneKey: crmPhoneKey } = require('./services/crm');
const { initSupport, registerSupportRoutes } = require('./services/support');
const { passwordProblem } = require('./services/password-policy');
const { createHumanCheck, hasConsent, CONSENT_TEXT, APPLICATION_CONSENT_TEXT } = require('./services/humancheck');
const { createDigest } = require('./services/digest');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const ROOT = __dirname;
const uploadsDir = path.join(ROOT, 'uploads');
const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' } } : {}),
});
// A dropped database connection is logged and replaced, instead of crashing the website.
pool.on('error', error => console.error('[db] Idle connection error:', error.message));

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password || ''), String(salt || ''), 100000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'admin@***.com';
  const [name, domain] = email.split('@');
  const visible = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
  return `${visible}***@${domain}`;
}

// Security: no built-in default passwords. Admin accounts only work when their
// passwords are supplied through environment variables (or were changed later
// from the admin panel). Known old defaults are always rejected.
const SUPERADMIN_USERNAME = String(process.env.ADMIN_USERNAME || 'rohan.kamble').trim().toLowerCase();
const KNOWN_DEFAULT_PASSWORDS = new Set(['Rohankamble', 'SystemAdmin@2026', 'your_admin_password_here']);
const SESSION_SECRET = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
  ? process.env.SESSION_SECRET
  : crypto.randomBytes(48).toString('hex');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.warn('[security] SESSION_SECRET is missing or shorter than 32 characters. Using a random per-process secret; admin sessions will reset when the server restarts.');
}
require('./services/config-check').reportAtStartup();
if (!process.env.ADMIN_PASSWORD) {
  console.warn('[security] ADMIN_PASSWORD is not set. Superadmin sign-in only works if a password was previously set from the admin panel.');
}

const initialSuperAdminSalt = generateSalt();
const initialSystemAdminSalt = generateSalt();

const memoryAdminUsers = [
  {
    username: SUPERADMIN_USERNAME,
    passwordSalt: initialSuperAdminSalt,
    // Random unguessable hash when no password is configured.
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || crypto.randomBytes(32).toString('hex'), initialSuperAdminSalt),
    email: (process.env.ADMIN_EMAIL || 'rohan@sainandchits.com').toLowerCase(),
    emailVerified: true,
    requireEmailOtp: false,
    role: 'superadmin',
    displayName: 'Rohan Kamble',
    avatarUrl: '',
  },
  {
    // Backup admin login. Its email is only used for "Forgot password" codes; it gets no alert emails.
    username: 'support',
    passwordSalt: initialSystemAdminSalt,
    passwordHash: hashPassword(process.env.SYSTEM_ADMIN_PASSWORD || crypto.randomBytes(32).toString('hex'), initialSystemAdminSalt),
    email: 'support@sainandchits.com',
    emailVerified: true,
    requireEmailOtp: false,
    role: 'systemadmin',
    displayName: 'Support Admin',
    avatarUrl: '',
  },
];

const memoryAdminSecurity = memoryAdminUsers[0];
const memoryAdminOtps = [];

// A brand-new database gets its tables and starter content from schema.sql automatically.
// Every statement in schema.sql is safe to run again on an existing database.
let schemaApplied = false;
async function applyBaseSchema() {
  if (schemaApplied) return;
  try {
    const exists = await pool.query("SELECT to_regclass('public.enquiries') AS t");
    if (!exists.rows[0].t) {
      await pool.query(fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'));
      console.log('Database was empty: created tables and starter content from schema.sql');
    }
    schemaApplied = true;
  } catch (err) {
    console.error('Could not apply schema.sql:', err.message);
  }
}

async function initDbExtensions() {
  await applyBaseSchema();
  try {
    await pool.query('ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS scheduled_call_at TIMESTAMPTZ DEFAULT NULL').catch(err => console.error('Column scheduled_call_at err:', err.message));
    await pool.query("ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS scheduled_call_note TEXT DEFAULT ''").catch(err => console.error('Column scheduled_call_note err:', err.message));
    await pool.query("ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS scheduled_call_status VARCHAR(30) DEFAULT 'pending'").catch(err => console.error('Column scheduled_call_status err:', err.message));
    await pool.query('CREATE INDEX IF NOT EXISTS enquiries_scheduled_call_idx ON enquiries (scheduled_call_at)').catch(() => {});

    await pool.query(`

      CREATE TABLE IF NOT EXISTS job_openings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        department VARCHAR(100) DEFAULT 'General',
        location VARCHAR(120) DEFAULT 'Nagpur, Maharashtra',
        job_type VARCHAR(50) DEFAULT 'Full Time',
        experience VARCHAR(50) DEFAULT '1-3 Years',
        description TEXT NOT NULL,
        requirements TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        job_opening_id INTEGER REFERENCES job_openings(id) ON DELETE SET NULL,
        position_name VARCHAR(180) NOT NULL,
        first_name VARCHAR(80) NOT NULL,
        last_name VARCHAR(80) NOT NULL,
        email VARCHAR(254) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        address VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',
        pincode VARCHAR(20),
        resume_url TEXT,
        resume_filename VARCHAR(255),
        notes TEXT,
        status VARCHAR(30) DEFAULT 'new',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS job_openings_active_idx ON job_openings (is_active, sort_order);
      CREATE INDEX IF NOT EXISTS job_applications_created_idx ON job_applications (created_at DESC);

      CREATE TABLE IF NOT EXISTS admin_security (
        id SERIAL PRIMARY KEY,
        username VARCHAR(80) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        email VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        require_email_otp BOOLEAN DEFAULT FALSE,
        role VARCHAR(30) DEFAULT 'superadmin',
        display_name VARCHAR(100) DEFAULT 'Administrator',
        avatar_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'superadmin';
      ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT 'Administrator';
      ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS admin_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        otp_type VARCHAR(30) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS admin_otps_idx ON admin_otps (email, otp_type, consumed, expires_at);
    `);

    // Seed default openings if table is empty
    const countCheck = await pool.query('SELECT COUNT(*) FROM job_openings');
    if (Number(countCheck.rows[0]?.count || 0) === 0) {
      await pool.query(`
        INSERT INTO job_openings (title, department, location, job_type, experience, description, requirements, is_active, sort_order)
        VALUES
        (
          'Chit Fund Relationship Officer',
          'Sales & Operations',
          'Nagpur, Maharashtra',
          'Full Time',
          '1-3 Years',
          'Guide prospective members through Bhisi savings plans, assist with documentation, and support monthly bidding cycles.',
          'Strong communication skills in Marathi/Hindi/English, basic understanding of chit funds or financial products, customer-focused approach.',
          TRUE,
          1
        ),
        (
          'Accounts & Compliance Executive',
          'Finance & Accounts',
          'Nagpur, Maharashtra',
          'Full Time',
          '2-4 Years',
          'Manage daily ledgers, member dividend records, bidding records, and assist with compliance filings under Chit Funds Act.',
          'B.Com / M.Com or equivalent, proficiency in Tally/accounting software, attention to detail and ledger accuracy.',
          TRUE,
          2
        );
      `);
    }

    // The backup admin login was renamed from "systemadmin" to "support" (email support@sainandchits.com,
    // so its password can be reset). Every record linked to the old name moves with it, in one step.
    {
      const old = await pool.query("SELECT 1 FROM admin_security WHERE LOWER(username) = 'systemadmin'");
      const taken = await pool.query("SELECT 1 FROM admin_security WHERE LOWER(username) = 'support'");
      if (old.rowCount && !taken.rowCount) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const links = [
            ['crm_contacts', 'owner'], ['crm_tasks', 'assignee'], ['crm_tasks', 'created_by'], ['crm_tasks', 'completed_by'],
            ['crm_activities', 'created_by'], ['crm_settings', 'updated_by'], ['support_requests', 'assigned_to'], ['support_request_notes', 'author'],
          ];
          for (const [table, column] of links) {
            const exists = await client.query('SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', [table, column]);
            if (exists.rowCount) await client.query(`UPDATE ${table} SET ${column} = 'support' WHERE LOWER(${column}) = 'systemadmin'`);
          }
          await client.query(`UPDATE admin_security SET username = 'support', display_name = CASE WHEN display_name IN ('', 'System Admin') THEN 'Support Admin' ELSE display_name END,
            email = CASE WHEN email = '' OR LOWER(email) LIKE 'systemadmin@%' THEN 'support@sainandchits.com' ELSE email END WHERE LOWER(username) = 'systemadmin'`);
          await client.query('COMMIT');
          console.log('[accounts] Backup admin login renamed from "systemadmin" to "support".');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          console.error('[accounts] Could not rename the backup admin login:', error.message);
        } finally {
          client.release();
        }
      }
    }
    await pool.query(
      "UPDATE admin_security SET email = $1 WHERE role = 'superadmin' AND LOWER(email) IN ('rohankamble103@gmail.com', 'support@sainandchits.com', 'support@sainandchitfund.com')",
      [(process.env.ADMIN_EMAIL || 'rohan@sainandchits.com').toLowerCase()],
    );

    // Seed or synchronize multi-user admin accounts in PostgreSQL
    for (const user of memoryAdminUsers) {
      const checkRes = await pool.query('SELECT * FROM admin_security WHERE LOWER(username) = $1 LIMIT 1', [user.username]);
      if (checkRes.rowCount === 0) {
        await pool.query(
          `INSERT INTO admin_security (username, password_hash, password_salt, email, email_verified, require_email_otp, role, display_name, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            user.username,
            user.passwordHash,
            user.passwordSalt,
            user.email,
            user.emailVerified,
            user.requireEmailOtp,
            user.role,
            user.displayName,
            user.avatarUrl || '',
          ],
        );
      } else {
        const row = checkRes.rows[0];
        user.username = row.username;
        user.passwordHash = row.password_hash;
        user.passwordSalt = row.password_salt;
        user.email = row.email;
        user.emailVerified = Boolean(row.email_verified);
        user.requireEmailOtp = Boolean(row.require_email_otp);
        user.role = row.role || user.role;
        user.displayName = row.display_name || user.displayName;
        user.avatarUrl = row.avatar_url || '';
      }
    }
  } catch (err) {
    console.error('initDbExtensions error:', err);
  }
  try {
    await initCrm(pool);
    await initSupport(pool);
    // Replace the old placeholder number (+91 98765 43210) in texts already saved in the database.
    {
      const site = siteRender.loadSite();
      const digitsOnly = String(site.phone).replace(/\D/g, '');
      const waDigits = String(site.whatsapp || site.phone).replace(/\D/g, '');
      const fix = col => `${col} = REPLACE(REPLACE(REPLACE(${col}, '+91 98765 43210', $1), 'tel:+919876543210', $2), 'wa.me/919876543210', $3)`;
      const args = [site.phone, `tel:+${digitsOnly}`, `wa.me/${waDigits}`];
      await pool.query(`UPDATE site_pages SET ${fix('body')}, ${fix('intro')} WHERE body LIKE '%98765%' OR intro LIKE '%98765%'`, args).catch(() => {});
      await pool.query(`UPDATE site_faqs SET ${fix('answer')} WHERE answer LIKE '%98765%'`, args).catch(() => {});
      await pool.query(`UPDATE support_items SET ${fix('description')}, ${fix('link_url')} WHERE description LIKE '%98765%' OR link_url LIKE '%9876543210%'`, args).catch(() => {});
    }
    // The website moved to sainandchits.com: update any saved text, links and the system admin's email.
    {
      const oldDomain = 'sainandchitfund.com';
      const newDomain = 'sainandchits.com';
      const swap = col => `${col} = REPLACE(${col}, '${oldDomain}', '${newDomain}')`;
      await pool.query(`UPDATE site_pages SET ${swap('body')}, ${swap('intro')} WHERE body LIKE '%${oldDomain}%' OR intro LIKE '%${oldDomain}%'`).catch(() => {});
      await pool.query(`UPDATE site_faqs SET ${swap('answer')} WHERE answer LIKE '%${oldDomain}%'`).catch(() => {});
      await pool.query(`UPDATE support_items SET ${swap('description')}, ${swap('link_url')} WHERE description LIKE '%${oldDomain}%' OR link_url LIKE '%${oldDomain}%'`).catch(() => {});
      await pool.query(`UPDATE admin_security SET ${swap('email')} WHERE email LIKE '%@${oldDomain}'`).catch(() => {});
      // The office mailbox is support@ (info@ does not exist).
      const mailSwap = col => `${col} = REPLACE(${col}, 'info@${newDomain}', 'support@${newDomain}')`;
      await pool.query(`UPDATE site_pages SET ${mailSwap('body')}, ${mailSwap('intro')} WHERE body LIKE '%info@${newDomain}%' OR intro LIKE '%info@${newDomain}%'`).catch(() => {});
      await pool.query(`UPDATE site_faqs SET ${mailSwap('answer')} WHERE answer LIKE '%info@${newDomain}%'`).catch(() => {});
      await pool.query(`UPDATE support_items SET ${mailSwap('description')}, ${mailSwap('link_url')} WHERE description LIKE '%info@${newDomain}%' OR link_url LIKE '%info@${newDomain}%'`).catch(() => {});
    }
    for (const [oldDescription, index] of OLD_SUPPORT_ITEMS) {
      const item = defaultSupportItems[index];
      await pool.query(
        'UPDATE support_items SET title = $2, description = $3, link_url = $4, updated_at = NOW() WHERE description = $1',
        [oldDescription, item.title, item.description, item.linkUrl],
      ).catch(() => {});
    }
    // New question-style FAQs (content/faqs.js): added once, so staff can still edit or delete them later.
    await pool.query('CREATE TABLE IF NOT EXISTS app_flags (name VARCHAR(80) PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const faqFlag = await pool.query("SELECT 1 FROM app_flags WHERE name = 'faqs-v2'");
    if (!faqFlag.rowCount) {
      for (const faq of require('./content/faqs')) {
        if (faq.replaces) {
          // Upgrade the original short answer only if nobody has edited it.
          await pool.query(
            'UPDATE site_faqs SET question = $3, answer = $4, updated_at = NOW() WHERE question = $1 AND answer = $2',
            [faq.replaces.question, faq.replaces.answer, faq.question, faq.answer],
          );
        }
        await pool.query(
          `INSERT INTO site_faqs (question, answer, sort_order, is_published, updated_at)
           SELECT $1::text, $2::text, $3::int, TRUE, NOW()
           WHERE NOT EXISTS (SELECT 1 FROM site_faqs WHERE question = $1::text OR (question = $4::text AND $4::text <> ''))`,
          [faq.question, faq.answer, faq.sort, faq.replaces?.question || ''],
        );
      }
      await pool.query("INSERT INTO app_flags (name) VALUES ('faqs-v2') ON CONFLICT DO NOTHING");
    }
    // Older setups stored the role inside the name ("Rohan Kamble (Super Admin)"); the role is shown separately now.
    await pool.query("UPDATE admin_security SET display_name = TRIM(REGEXP_REPLACE(display_name, '\\s*\\((Super Admin|System Admin)\\)\\s*$', '')) WHERE display_name ~ '\\((Super Admin|System Admin)\\)\\s*$'");
  } catch (err) {
    console.error('CRM init error:', err);
  }
}
const dbReady = initDbExtensions();

fs.mkdirSync(uploadsDir, { recursive: true });
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');
app.use(compression());
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Content-Security-Policy: only our own scripts run. Each page's small inline config script gets a
// one-time nonce in sendPage(); everything else (JSON, files) gets the strict default below.
function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com${nonce ? ` 'nonce-${nonce}'` : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    // Office map, and YouTube / Instagram posts on the News page.
    'frame-src https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com https://challenges.cloudflare.com',
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(IS_PRODUCTION ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
// Behind nginx in production: send plain-HTTP visitors to HTTPS (health checks are left alone).
app.use((request, response, next) => {
  if (IS_PRODUCTION && process.env.FORCE_HTTPS !== 'false' && !request.secure && request.path !== '/api/health') {
    const host = String(request.headers.host || '').replace(/[^\w.:-]/g, '');
    if (host) return response.redirect(301, `https://${host}${request.originalUrl}`);
  }
  next();
});
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Logo/images may be shown inside customers' email apps, so those stay loadable from other sites.
  response.setHeader('Cross-Origin-Resource-Policy', request.path.startsWith('/images/') ? 'cross-origin' : 'same-origin');
  response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  response.setHeader('Content-Security-Policy', contentSecurityPolicy());
  if (IS_PRODUCTION && request.secure) {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Admin and API answers can hold customer data: never keep them in a browser or proxy cache.
  if (request.path.startsWith('/api/') || request.path === '/crm' || request.path.startsWith('/crm/')) {
    response.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Simple in-memory rate limiter (per IP, per bucket). No extra dependency.
const rateBuckets = new Map();
function rateLimit(bucket, max, windowMs) {
  return (request, response, next) => {
    const key = `${bucket}:${request.ip}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || entry.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      response.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return response.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateBuckets) if (entry.resetAt <= now) rateBuckets.delete(key);
}, 10 * 60 * 1000).unref();

const loginLimiter = rateLimit('login', 10, 15 * 60 * 1000);
const otpLimiter = rateLimit('otp', 5, 15 * 60 * 1000);
const formLimiter = rateLimit('form', 10, 10 * 60 * 1000);
const chatLimiter = rateLimit('chat', 30, 10 * 60 * 1000);
const crmEmailLimiter = rateLimit('crm-email', 60, 60 * 60 * 1000);


// ---------- Activity log: who did what in the admin ----------
const AUDIT_RULES = [
  ['POST', /^\/api\/admin\/logout$/, 'Signed out'],
  ['POST', /^\/api\/admin\/forgot-password\/request$/, 'Requested password reset code'],
  ['POST', /^\/api\/admin\/forgot-password\/reset$/, 'Reset password with email code'],
  ['POST', /^\/api\/admin\/security\/change-password$/, 'Changed own password'],
  ['PATCH', /^\/api\/admin\/security\/profile$/, 'Changed sign-in security settings'],
  ['POST', /^\/api\/admin\/security\/verify-email$/, 'Verified own email'],
  ['PATCH', /^\/api\/admin\/profile$/, 'Updated own profile'],
  ['POST', /^\/api\/admin\/news$/, 'Created news post'],
  ['PATCH', /^\/api\/admin\/news\/(\d+)$/, 'Edited news post'],
  ['DELETE', /^\/api\/admin\/news\/(\d+)$/, 'Deleted news post'],
  ['PUT', /^\/api\/admin\/site-pages\/([\w-]+)$/, 'Edited website page'],
  ['POST', /^\/api\/admin\/site-faqs$/, 'Added FAQ'],
  ['PATCH', /^\/api\/admin\/site-faqs\/(\d+)$/, 'Edited FAQ'],
  ['DELETE', /^\/api\/admin\/site-faqs\/(\d+)$/, 'Deleted FAQ'],
  ['POST', /^\/api\/admin\/support-items$/, 'Added support item'],
  ['PATCH', /^\/api\/admin\/support-items\/(\d+)$/, 'Edited support item'],
  ['DELETE', /^\/api\/admin\/support-items\/(\d+)$/, 'Deleted support item'],
  ['POST', /^\/api\/admin\/certificates$/, 'Added certificate'],
  ['PATCH', /^\/api\/admin\/certificates\/(\d+)$/, 'Edited certificate'],
  ['DELETE', /^\/api\/admin\/certificates\/(\d+)$/, 'Deleted certificate'],
  ['POST', /^\/api\/admin\/openings$/, 'Added job opening'],
  ['PATCH', /^\/api\/admin\/openings\/(\d+)$/, 'Edited job opening'],
  ['DELETE', /^\/api\/admin\/openings\/(\d+)$/, 'Deleted job opening'],
  ['PATCH', /^\/api\/admin\/applications\/(\d+)$/, 'Updated job application'],
  ['DELETE', /^\/api\/admin\/applications\/(\d+)$/, 'Deleted job application'],
  ['POST', /^\/api\/crm\/contacts$/, 'Added customer'],
  ['PATCH', /^\/api\/crm\/contacts\/(\d+)$/, 'Updated customer'],
  ['DELETE', /^\/api\/crm\/contacts\/(\d+)$/, 'Deleted customer'],
  ['POST', /^\/api\/crm\/contacts\/bulk$/, 'Bulk-updated customers'],
  ['POST', /^\/api\/crm\/contacts\/merge$/, 'Merged duplicate customers'],
  ['POST', /^\/api\/crm\/contacts\/(\d+)\/activities$/, 'Logged call / note'],
  ['POST', /^\/api\/crm\/contacts\/(\d+)\/email$/, 'Emailed customer'],
  ['POST', /^\/api\/crm\/contacts\/(\d+)\/tasks$/, 'Added a schedule'],
  ['POST', /^\/api\/crm\/import$/, 'Imported customers'],
  ['GET', /^\/api\/crm\/export\.csv$/, 'Exported customers to Excel'],
  ['POST', /^\/api\/crm\/team$/, 'Added team member'],
  ['PATCH', /^\/api\/crm\/team\/([\w.@-]+)$/, 'Changed team member'],
  ['PUT', /^\/api\/crm\/settings$/, 'Changed CRM settings'],
  ['POST', /^\/api\/crm\/assign-unassigned$/, 'Shared unassigned customers with agents'],
];
const AUDIT_DETAIL_KEYS = ['stage', 'owner', 'role', 'isActive', 'receivesLeads', 'status', 'title', 'name', 'question', 'type', 'outcome', 'autoAssign', 'dailyDigest', 'username', 'displayName', 'subject', 'primaryId', 'mergeIds', 'ids', 'requireEmailOtp'];

function writeAudit(entry) {
  pool.query(
    'INSERT INTO audit_log (username, action, target, details, ip) VALUES ($1, $2, $3, $4::jsonb, $5)',
    [String(entry.username || '').slice(0, 80), entry.action.slice(0, 80), String(entry.target || '').slice(0, 200), JSON.stringify(entry.details || {}), String(entry.ip || '').slice(0, 64)],
  ).catch(error => console.error('Audit log error:', error.message));
}

app.use((request, response, next) => {
  const isLogin = request.method === 'POST' && request.path === '/api/admin/login';
  const rule = AUDIT_RULES.find(([method, pattern]) => method === request.method && pattern.test(request.path));
  if (!isLogin && !rule) return next();
  response.on('finish', () => {
    const ip = String(request.ip || '');
    if (isLogin) {
      const username = String(request.body?.username || '').slice(0, 80);
      if (response.statusCode === 200 && response.locals.requireOtp) return;
      if (response.statusCode === 200) writeAudit({ username, action: 'Signed in', ip });
      else if (response.statusCode === 401 || response.statusCode === 400) writeAudit({ username, action: 'Failed sign-in attempt', ip, details: { reason: response.statusCode === 400 ? 'wrong code' : 'wrong username or password' } });
      return;
    }
    if (response.statusCode >= 400) return;
    const session = sessionFromRequest(request);
    const [, pattern, action] = rule;
    const match = request.path.match(pattern);
    const details = {};
    for (const key of AUDIT_DETAIL_KEYS) if (request.body?.[key] !== undefined) details[key] = request.body[key];
    if (Array.isArray(details.ids)) details.ids = details.ids.length;
    if (action === 'Imported customers') details.rows = Array.isArray(request.body?.rows) ? request.body.rows.length : 0;
    if (action === 'Exported customers to Excel') Object.assign(details, request.query);
    if (request.body?.newPassword || request.body?.password) details.passwordChanged = true;
    Object.assign(details, response.locals.auditDetails || {});
    writeAudit({
      username: session?.username || (action.startsWith('Reset password') ? 'owner (via email code)' : ''),
      action,
      target: match?.[1] ? `${request.path.split('/')[3]}:${match[1]}` : '',
      details,
      ip,
    });
  });
  next();
});

// Sales agents use the CRM only; website content and job applications stay with managers.
const AGENT_ALLOWED_ADMIN_PATHS = [/^\/login/, /^\/logout/, /^\/session/, /^\/profile/, /^\/security/, /^\/forgot-password/];
app.use('/api/admin', (request, response, next) => {
  const session = sessionFromRequest(request);
  if (session && session.role === 'agent' && !AGENT_ALLOWED_ADMIN_PATHS.some(rule => rule.test(request.path))) {
    return response.status(403).json({ error: 'Your account has access to the CRM only.' });
  }
  next();
});

const crm = registerCrmRoutes(app, {
  pool,
  requireAdmin: (request, response, next) => requireAdmin(request, response, () => refreshCrmSession(request, response, next)),
  requireSuperAdmin: (request, response, next) => requireAdmin(request, response, () => refreshCrmSession(request, response, () => {
    if (!['superadmin', 'systemadmin'].includes(request.session.role)) return response.status(403).json({ error: 'Only an admin can do this.' });
    next();
  })),
  hashPassword,
  generateSalt,
  mailer,
  limiter: crmEmailLimiter,
});

// Re-check the team member on every CRM call so deactivated accounts and role
// changes take effect immediately, not only at their next sign-in.
async function refreshCrmSession(request, response, next) {
  try {
    const result = await pool.query(
      'SELECT username, role, display_name, COALESCE(is_active, TRUE) AS is_active FROM admin_security WHERE LOWER(username) = $1',
      [request.session.username.toLowerCase()],
    );
    const row = result.rows[0];
    if (row && !row.is_active) {
      setSessionCookie(response, '', 0);
      return response.status(401).json({ error: 'Your account has been deactivated.' });
    }
    if (row) {
      request.session.role = row.role || request.session.role;
      request.session.displayName = row.display_name || request.session.displayName;
    }
  } catch {
    // Database unavailable: fall back to the signed session.
  }
  next();
}

const humanCheck = createHumanCheck(SESSION_SECRET + (process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL || ''));
app.get('/api/form-challenge', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json(humanCheck.newChallenge());
});

function clientIp(request) {
  return String(request.ip || '').slice(0, 64);
}

function publicBaseUrl(request) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  if (!request) return `http://localhost:${PORT}`;
  return `${request.protocol}://${request.get('host')}`;
}

// ---------- Support requests (/support-center form + admin Support page) ----------
registerSupportRoutes(app, {
  pool,
  humanCheck,
  hasConsent,
  consentText: CONSENT_TEXT,
  formLimiter,
  requireAdmin: (request, response, next) => requireAdmin(request, response, () => refreshCrmSession(request, response, next)),
  crm,
  mailer,
  phoneKey: crmPhoneKey,
  enquiryDedupeKey: (...args) => enquiryDedupeKey(...args),
  clientIp,
  publicBaseUrl,
});

// ---------- Daily 9:30 AM follow-up emails ----------
const digest = createDigest({ pool, mailer, baseUrl: () => publicBaseUrl() });
app.post('/api/crm/digest/test', (request, response, next) => requireAdmin(request, response, next), async (request, response) => {
  try {
    const result = await digest.sendTest(request.session.username);
    if (!result.sent) return response.status(400).json({ error: result.error });
    response.json({ message: `Test email sent to ${result.email}` });
  } catch (error) {
    console.error('Digest test error:', error);
    response.status(500).json({ error: 'Unable to send the test email.' });
  }
});
// Called by Vercel Cron (see vercel.json). Protected by CRON_SECRET.
app.get('/api/cron/daily-digest', async (request, response) => {
  const secret = process.env.CRON_SECRET;
  const supplied = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || supplied.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await dbReady;
    response.json(await digest.runDaily());
  } catch (error) {
    console.error('Cron digest error:', error);
    response.status(500).json({ error: 'Digest failed' });
  }
});
dbReady.then(() => digest.startScheduler());

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), ms))]);
}

// Uploaded files: resumes contain personal data and are admin-only.
app.use('/uploads', (request, response, next) => {
  if (/^\/resume-/i.test(request.path)) {
    const session = sessionFromRequest(request);
    // Job applications are for managers only (not sales agents), and never cached.
    if (!session || session.role === 'agent') return response.status(404).end();
    response.setHeader('Cache-Control', 'private, no-store');
  }
  next();
});
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  dotfiles: 'deny',
  index: false,
  setHeaders: (response, filePath) => {
    if (/[\\/]resume-[^\\/]*$/i.test(filePath)) response.setHeader('Cache-Control', 'private, no-store');
    if (/\.(pdf|doc|docx)$/i.test(filePath)) {
      response.setHeader('Content-Disposition', 'attachment');
    }
  },
}));


// Serve HTML pages with versioned CSS/JS links (e.g. /css/crm.css?v=1a2b3c4d), so browsers
// always load the newest styles and scripts right after an update instead of a stale cached copy.
const assetVersions = new Map();
function assetVersion(relativePath) {
  const file = path.join(ROOT, relativePath);
  try {
    const stat = fs.statSync(file);
    const cached = assetVersions.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.version;
    const version = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
    assetVersions.set(file, { mtimeMs: stat.mtimeMs, version });
    return version;
  } catch {
    return '';
  }
}
const siteRender = require('./services/site-render');
const PUBLIC_PAGES = new Set(['index.html', 'news.html', 'careers.html', 'site-page.html', '404.html']);
// Address each public page should be known by (used for the canonical link and link previews).
const PAGE_PATHS = { 'index.html': '/', 'news.html': '/news', 'careers.html': '/careers' };
const PAGE_NAMES = { 'index.html': 'Home', 'news.html': 'News & updates', 'careers.html': 'Careers' };

// The FAQ list is written into the page itself (not only loaded by script), so search engines
// and AI tools that don't run JavaScript can read every question and answer.
function faqItemHtml(faq) {
  const esc = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const [first, ...rest] = String(faq.answer || '').split(/\n\s*\n/);
  return `
    <article class="faq-item">
      <h3>${esc(faq.question)}</h3>
      <p${rest.length ? ' class="faq-short"' : ''}>${esc(first)}</p>${rest.map(part => `\n      <p>${esc(part)}</p>`).join('')}
    </article>`;
}
function fillFaqList(html, faqs) {
  return html
    .replace('<section id="faqSection" class="site-page-section" hidden>', '<section id="faqSection" class="site-page-section">')
    .replace('<div id="faqList" class="faq-list"></div>', `<div id="faqList" class="faq-list">${faqs.map(faqItemHtml).join('')}\n          </div>`);
}

function sendPage(response, fileName, meta = {}) {
  try {
    let html = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
    // Public pages: shared menu/footer and company details from config/site.js.
    if (PUBLIC_PAGES.has(fileName)) {
      html = siteRender.renderPage(html);
      html = siteRender.seo(html, fileName === '404.html'
        ? { noindex: true }
        : {
          path: meta.path || PAGE_PATHS[fileName] || '/',
          title: meta.title,
          description: meta.description,
          structured: { name: meta.name || PAGE_NAMES[fileName], faqs: meta.faqs, team: fileName === 'index.html' },
        });
      if (meta.faqs?.length) html = fillFaqList(html, meta.faqs);
    }
    html = html.replace(
      /(href|src)="(\/?)((?:css|js)\/[\w.-]+\.(?:css|js))"/g,
      (match, attr, slash, asset) => {
        const version = assetVersion(asset);
        return version ? `${attr}="/${asset}?v=${version}"` : match;
      },
    );
    const nonce = crypto.randomBytes(16).toString('base64');
    html = html.replace(/<script(?![^>]*\bsrc=)([^>]*)>/g, `<script nonce="${nonce}"$1>`);
    response.setHeader('Content-Security-Policy', contentSecurityPolicy(nonce));
    response.setHeader('Cache-Control', fileName === 'crm.html' ? 'no-store' : 'no-cache');
    response.type('html').send(html);
  } catch (error) {
    console.error(`Unable to serve ${fileName}:`, error.message);
    response.status(404).send('Page not found');
  }
}

// Only the public website folders/pages are served. Source code, SQL, docs,
// archives, screenshots, and env files are never exposed.
// CSS/JS revalidate hourly so updates reach visitors quickly; images change rarely.
// Pages link to versioned URLs, so these files can be cached for a long time safely.
app.use('/css', express.static(path.join(ROOT, 'css'), { maxAge: '30d' }));
app.use('/js', express.static(path.join(ROOT, 'js'), { maxAge: '30d' }));
app.use('/images', express.static(path.join(ROOT, 'images'), { maxAge: '30d' }));
app.use('/fonts', express.static(path.join(ROOT, 'fonts'), { maxAge: '365d', immutable: true }));
// Search engines and AI assistants (ChatGPT, Claude, Perplexity, Gemini, Apple, Bing Copilot) may read the
// public website; the admin panel, API and job applications stay closed to all of them.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot',
];
app.get('/robots.txt', (_request, response) => {
  const rules = 'Allow: /\nDisallow: /admin\nDisallow: /crm\nDisallow: /api/\nDisallow: /uploads/resume-\n';
  const body = [
    `User-agent: *\n${rules}`,
    `${AI_CRAWLERS.map(bot => `User-agent: ${bot}`).join('\n')}\n${rules}`,
    `Sitemap: ${siteRender.siteBaseUrl()}/sitemap.xml\n`,
  ].join('\n');
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.type('text/plain').send(body);
});

// /llms.txt: a short, plain summary of the company for AI assistants (see llmstxt.org).
// Built from config/site.js and the published FAQs, so it never goes out of date.
app.get('/llms.txt', async (_request, response) => {
  const site = siteRender.loadSite();
  const base = siteRender.siteBaseUrl();
  const { lakhLabel } = require('./services/structured-data');
  let faqs = defaultFaqs;
  try {
    faqs = (await pool.query('SELECT question, answer FROM site_faqs WHERE is_published = TRUE ORDER BY sort_order ASC, id ASC')).rows;
  } catch {}
  const shortAnswer = answer => siteRender.refreshContactText(String(answer || '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim());
  const lines = [
    `# ${site.company}`,
    '',
    `> ${site.shortName} runs chit fund (Bhisi) savings groups in ${site.city}, India, under the ${site.registeredUnder}. Members pay an equal monthly instalment, and each month one member receives the pooled amount through open, transparent bidding (Boli). Serving families for over ${site.yearsOfService} years.`,
    '',
    '## Company details',
    `- Legal name: ${site.company}`,
    `- Registered under: ${site.registeredUnder}`,
    ...(site.registrationNo ? [`- Registration number: ${site.registrationNo}`] : []),
    `- Office: ${site.address.slice(1).join(', ')}`,
    `- Phone / WhatsApp: ${site.phone}`,
    `- Email: ${site.email}`,
    `- Office hours: ${site.hours} (IST)`,
    `- Grievance officer: ${site.grievanceOfficer.name}, ${site.grievanceOfficer.phone}`,
    `- Website: ${base}/`,
    '',
    '## Bhisi plans',
    ...site.plans.map(plan => `- ${lakhLabel(plan.amount)} Bhisi, ${plan.months} months`),
    'Exact monthly instalments depend on each month\'s bidding; the team explains them on a free call before anyone joins.',
    '',
    '## Leadership',
    ...site.team.filter(person => person.name).map(person => `- ${person.name}${person.role ? `, ${person.role}` : ''}`),
    '',
    '## Frequently asked questions',
    ...faqs.map(faq => `- **${faq.question}** ${shortAnswer(faq.answer)}`),
    '',
    '## Key pages',
    `- [Home: plans and how a Bhisi works](${base}/)`,
    `- [FAQ: full answers](${base}/faq)`,
    `- [News & updates](${base}/news)`,
    `- [Contact us: address, map, phone](${base}/contact-us)`,
    `- [Support Center](${base}/support-center)`,
    `- [Certificates](${base}/authorized-certificates)`,
    `- [Privacy Policy](${base}/privacy-policy)`,
    `- [Terms & Conditions](${base}/terms-and-conditions)`,
    '',
  ];
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.type('text/plain; charset=utf-8').send(lines.join('\n'));
});
app.get('/sitemap.xml', async (_request, response) => {
  // Always the live domain (PUBLIC_SITE_URL), never the address the request came in on.
  const base = siteRender.siteBaseUrl();
  const day = value => (value ? new Date(value).toISOString().slice(0, 10) : '');
  const fileDay = name => { try { return day(fs.statSync(path.join(ROOT, name)).mtime); } catch { return ''; } };
  const latest = async (sql, params = []) => { try { return day((await pool.query(sql, params)).rows[0]?.d); } catch { return ''; } };
  const newest = (...days) => days.filter(Boolean).sort().pop() || '';
  const pageDay = slug => latest('SELECT updated_at AS d FROM site_pages WHERE slug = $1', [slug]);
  const pages = [
    ['/', newest(fileDay('index.html'), fileDay('config/site.js'))],
    ['/news', newest(fileDay('news.html'), await latest('SELECT MAX(GREATEST(created_at, updated_at)) AS d FROM news_posts'))],
    ['/careers', newest(fileDay('careers.html'), await latest('SELECT MAX(updated_at) AS d FROM job_openings'))],
    ['/faq', newest(await pageDay('faq'), await latest('SELECT MAX(updated_at) AS d FROM site_faqs'))],
    ['/contact-us', await pageDay('contact-us')],
    ['/support-center', newest(await pageDay('support-center'), await latest('SELECT MAX(updated_at) AS d FROM support_items'))],
    ['/authorized-certificates', newest(await pageDay('authorized-certificates'), await latest('SELECT MAX(updated_at) AS d FROM site_certificates'))],
    ['/privacy-policy', newest(await pageDay('privacy-policy'), fileDay('content/privacy-policy.js'))],
    ['/terms-and-conditions', newest(await pageDay('terms-and-conditions'), fileDay('content/terms.js'))],
  ];
  const urls = pages.map(([page, lastmod]) => `  <url>\n    <loc>${base}${page}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`).join('\n');
  response.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});
// Old ".html" addresses go permanently to the proper page address (no duplicate pages for search engines).
const HTML_REDIRECTS = { '/index.html': '/', '/news.html': '/news', '/careers.html': '/careers', '/site-page.html': '/faq', '/crm.html': '/admin', '/admin.html': '/admin' };
for (const [from, to] of Object.entries(HTML_REDIRECTS)) app.get(from, (_request, response) => response.redirect(301, to));
app.get('/', (_request, response) => sendPage(response, 'index.html'));
app.get('/favicon.ico', (_request, response) => {
  response.setHeader('Cache-Control', 'public, max-age=604800');
  response.type('image/x-icon').sendFile(path.join(ROOT, 'images', 'favicon.ico'));
});
app.get('/site.webmanifest', (_request, response) => {
  response.setHeader('Cache-Control', 'public, max-age=86400');
  response.type('application/manifest+json').sendFile(path.join(ROOT, 'site.webmanifest'));
});

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
    body: 'Call us at +91 92724 60719 or email support@sainandchits.com. Our office is in Nagpur, Maharashtra, and our support team is available Monday to Saturday, 10:00 AM to 7:00 PM IST.',
  },
  'support-center': {
    title: 'Support Center',
    intro: 'Find the right way to get help with your enquiry, documents, or member support.',
    body: 'Use one of the quick options below, or raise a support request. You will get a request number, and our team will get back to you, usually within one working day.',
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

const defaultFaqs = require('./content/faqs').map(({ question, answer }) => ({ question, answer }));

const defaultSupportItems = [
  {
    title: 'Call our team',
    description: 'Speak to us directly during office hours, Monday to Saturday, 10 AM – 7 PM.',
    linkUrl: 'tel:+919272460719',
  },
  {
    title: 'WhatsApp us',
    description: 'Send us a message on WhatsApp and we will reply during office hours.',
    linkUrl: 'https://wa.me/919272460719',
  },
  {
    title: 'Visit our office',
    description: 'Meet us at our Nagpur office, or check our published company documents.',
    linkUrl: '/contact-us',
  },
];
// The first three support options the site was set up with, replaced by the ones above unless staff changed them.
const OLD_SUPPORT_ITEMS = [
  ['Ask about current Bhisi plans, monthly instalments, eligibility, and required documents.', 0],
  ['Contact our team for help with bidding, statements, account questions, or follow-up.', 1],
  ['Reach us directly if you need help verifying a certificate or visiting our Nagpur office.', 2],
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

// Sai chats like a person first. The call-back form appears only when the visitor wants it:
// they ask to be called / to join, or they say "yes" after Sai offers a call. After a longer chat
// (4+ questions) Sai may offer once, but the form still waits for the visitor's yes.
const CALL_OFFER = /(would you like|shall i|should i|can i|may i|want me to)[^?]{0,80}\b(call|call-back|callback|contact you|reach you|connect you)/i;
const WANTS_CALL = /\b(call me|callback|call back|call-back|contact me|reach me|reach out to me|ring me|phone me|i want to (join|apply|enrol|enroll|start|invest)|how (do|can) i (join|apply|start|enrol|enroll)|sign me up|i('m| am) interested|interested|want to join|join now|enquire|enquiry|book a call|speak to (someone|your team|an agent)|talk to (someone|your team|an agent)|share my (details|number)|send me details)\b/i;
const SAYS_YES = /^\s*(yes|yeah|yep|yup|ya|sure|ok|okay|okk?|please|yes please|go ahead|haan|ha|han|ho|hoy|theek hai|thik hai|chalega|definitely|of course|why not)\b/i;
function shouldOfferEnquiry(messages) {
  const userMessages = messages.filter(message => message.role === 'user');
  const latest = text(userMessages[userMessages.length - 1]?.content, 2000);
  if (WANTS_CALL.test(latest)) return true;
  // "yes" right after Sai offered a call
  const lastAssistant = [...messages].slice(0, -1).reverse().find(message => message.role === 'assistant');
  if (lastAssistant && CALL_OFFER.test(lastAssistant.content) && SAYS_YES.test(latest)) return true;
  return false;
}

const LOCAL_CHAT_RESPONSES = [
  {
    matches: question =>
      (/\b(what is|what are|meaning of|define|explain)\b.*\b(chit fund|chit|bhisi)\b/i.test(question)
        || /\b(chit fund|bhisi)\b.*\b(what|meaning)\b/i.test(question)),
    answer: 'A Bhisi (chit fund) is a group savings plan: everyone saves a fixed amount every month, and each month one member gets the whole pool — so you can get a big amount when you need it, without a loan. Are you saving for something in particular?',
  },
  {
    matches: question =>
      (/\bhow does it work\b/i.test(question)
        || /\b(how does|how do|how is|explain|describe)\b.*\b(chit|bhisi|fund|scheme)\b/i.test(question)
        || /\b(chit|bhisi|fund|scheme)\b.*\b(work|works|working|process)\b/i.test(question)),
    answer: 'Members pay a fixed amount every month into a common pool. Each month one member takes the pool through open bidding, and everything is recorded with a monthly statement. Would you like to know which plan sizes we have?',
  },
  {
    matches: question =>
      /\b(benefit|benefits|advantage|advantages)\b/i.test(question)
      && /\b(chit|bhisi|fund|scheme|it|this)\b/i.test(question),
    answer: 'It builds a steady saving habit, and when you need a large amount — for a home, a wedding or your business — you can bid for it without taking a loan. What would you be saving for?',
  },
];

function localChatAnswer(messages) {
  // Match only the visitor's latest question (not the whole chat), so each question gets its own answer.
  const latest = text([...messages].reverse().find(message => message.role === 'user')?.content, 2000).toLowerCase();
  const matchedResponse = LOCAL_CHAT_RESPONSES.find(response => response.matches(latest));
  return matchedResponse?.answer || null;
}

// Admin sign-in ends after this much inactivity (default 30 minutes), and always after 12 hours.
const ADMIN_IDLE_MS = Math.max(5, Number(process.env.ADMIN_IDLE_MINUTES) || 30) * 60 * 1000;

function signedSession(userOrUsername, roleArg) {
  const username = typeof userOrUsername === 'object' ? userOrUsername.username : String(userOrUsername || '');
  const role = typeof userOrUsername === 'object' ? (userOrUsername.role || 'superadmin') : (roleArg || 'superadmin');
  const displayName = typeof userOrUsername === 'object' ? (userOrUsername.displayName || username) : username;
  const avatarUrl = typeof userOrUsername === 'object' ? (userOrUsername.avatarUrl || '') : '';

  const payload = Buffer.from(JSON.stringify({
    username: username.toLowerCase(),
    role,
    displayName,
    avatarUrl,
    expiresAt: typeof userOrUsername === 'object' && userOrUsername.expiresAt ? userOrUsername.expiresAt : Date.now() + 1000 * 60 * 60 * 12,
    idleUntil: Date.now() + ADMIN_IDLE_MS,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function sessionFromRequest(request, { allowIdle = false } = {}) {
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
    .createHmac('sha256', SESSION_SECRET)
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
    if (!allowIdle && session.idleUntil && session.idleUntil < Date.now()) return null;
    session.role = session.role || 'superadmin';
    session.displayName = session.displayName || session.username;
    session.avatarUrl = session.avatarUrl || '';
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

/** Finds the active account for "Forgot password": by login name, or by email when only one account uses it. */
async function findAdminForReset(identifier) {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return null;
  try {
    const byName = await pool.query('SELECT username FROM admin_security WHERE LOWER(username) = $1 AND COALESCE(is_active, TRUE) LIMIT 1', [clean]);
    if (byName.rowCount) return getAdminUser(byName.rows[0].username);
    const byEmail = await pool.query("SELECT username FROM admin_security WHERE LOWER(email) = $1 AND email <> '' AND COALESCE(is_active, TRUE)", [clean]);
    return byEmail.rowCount === 1 ? getAdminUser(byEmail.rows[0].username) : null;
  } catch {
    const sec = await getAdminSecurity();
    return sec && [String(sec.username).toLowerCase(), String(sec.email).toLowerCase()].includes(clean) ? sec : null;
  }
}

async function getAdminUser(username) {
  const clean = String(username || '').trim().toLowerCase();
  try {
    const result = await pool.query('SELECT * FROM admin_security WHERE LOWER(username) = $1 LIMIT 1', [clean]);
    if (result.rowCount) {
      const row = result.rows[0];
      if (row.is_active === false) return null;
      const found = memoryAdminUsers.find(u => u.username === clean);
      const userObj = {
        username: row.username,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        email: row.email,
        emailVerified: Boolean(row.email_verified),
        requireEmailOtp: Boolean(row.require_email_otp),
        role: row.role || (['support', 'systemadmin'].includes(clean) ? 'systemadmin' : 'agent'),
        displayName: row.display_name || (['support', 'systemadmin'].includes(clean) ? 'Support Admin' : 'Rohan Kamble'),
        avatarUrl: row.avatar_url || '',
      };
      if (found) Object.assign(found, userObj);
      else memoryAdminUsers.push(userObj);
      return userObj;
    }
  } catch (err) {}
  return memoryAdminUsers.find(u => u.username === clean) || null;
}

async function getAdminSecurity() {
  return getAdminUser(SUPERADMIN_USERNAME);
}

async function updateAdminSecurity(fields, targetUsername) {
  const target = String(targetUsername || fields.username || memoryAdminSecurity.username).toLowerCase();
  const memoryUser = memoryAdminUsers.find(user => user.username === target);
  if (memoryUser) Object.assign(memoryUser, fields);
  try {
    await pool.query(
      `UPDATE admin_security SET
        username = COALESCE($1, username),
        password_hash = COALESCE($2, password_hash),
        password_salt = COALESCE($3, password_salt),
        email = COALESCE($4, email),
        email_verified = COALESCE($5, email_verified),
        require_email_otp = COALESCE($6, require_email_otp),
        role = COALESCE($7, role),
        display_name = COALESCE($8, display_name),
        avatar_url = COALESCE($9, avatar_url),
        updated_at = NOW()
       WHERE LOWER(username) = $10`,
      [
        fields.username !== undefined ? fields.username : null,
        fields.passwordHash !== undefined ? fields.passwordHash : null,
        fields.passwordSalt !== undefined ? fields.passwordSalt : null,
        fields.email !== undefined ? fields.email : null,
        fields.emailVerified !== undefined ? fields.emailVerified : null,
        fields.requireEmailOtp !== undefined ? fields.requireEmailOtp : null,
        fields.role !== undefined ? fields.role : null,
        fields.displayName !== undefined ? fields.displayName : null,
        fields.avatarUrl !== undefined ? fields.avatarUrl : null,
        target,
      ],
    );
  } catch (err) {
    console.error('Failed to update admin_security in db, memory updated:', err.message);
  }
}

async function createAdminOtp(email, otpCode, otpType, expiresMinutes = 15) {
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  const memoryItem = {
    id: Date.now() + Math.random(),
    email: email.toLowerCase(),
    otpCode,
    otpType,
    expiresAt,
    consumed: false,
  };
  memoryAdminOtps.push(memoryItem);

  try {
    await pool.query(
      `INSERT INTO admin_otps (email, otp_code, otp_type, expires_at, consumed)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [email.toLowerCase(), otpCode, otpType, expiresAt.toISOString()],
    );
  } catch (err) {
    console.error('Failed to insert admin_otps in db, memory updated:', err.message);
  }
  return memoryItem;
}

async function verifyAndConsumeOtp(email, otpCode, otpType) {
  const cleanCode = String(otpCode || '').trim();
  const cleanEmail = String(email || '').toLowerCase().trim();
  const now = new Date();

  // Try DB first
  try {
    const result = await pool.query(
      `SELECT * FROM admin_otps
       WHERE LOWER(email) = $1 AND otp_code = $2 AND otp_type = $3 AND consumed = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode, otpType],
    );
    if (result.rowCount) {
      await pool.query('UPDATE admin_otps SET consumed = TRUE WHERE id = $1', [result.rows[0].id]);
      return true;
    }
  } catch (err) {
    console.error('DB verifyAndConsumeOtp err, checking memory:', err.message);
  }

  // Fallback to memory
  const memIdx = memoryAdminOtps.findIndex(
    item =>
      item.email === cleanEmail &&
      item.otpCode === cleanCode &&
      item.otpType === otpType &&
      !item.consumed &&
      item.expiresAt > now,
  );
  if (memIdx !== -1) {
    memoryAdminOtps[memIdx].consumed = true;
    return true;
  }
  return false;
}

function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD || memoryAdminSecurity.passwordHash);
}

function envPasswordMatches(envValue, candidate) {
  const actual = Buffer.from(String(envValue || ''));
  const supplied = Buffer.from(String(candidate || ''));
  return actual.length > 0 && actual.length === supplied.length && crypto.timingSafeEqual(actual, supplied);
}

function passwordMatches(candidate) {
  const actual = Buffer.from(String(process.env.ADMIN_PASSWORD || ''));
  const supplied = Buffer.from(String(candidate || ''));
  return actual.length > 0 && actual.length === supplied.length && crypto.timingSafeEqual(actual, supplied);
}

async function verifyAdminCredentials(candidateUsername, candidatePassword) {
  const cleanUser = String(candidateUsername || '').trim().toLowerCase();
  const user = await getAdminUser(cleanUser);
  if (!user) return null;
  // Old built-in defaults are never accepted, even if still stored in the database.
  if (KNOWN_DEFAULT_PASSWORDS.has(String(candidatePassword || ''))) return null;

  // 1. Check PBKDF2 hash against DB/memory passwordSalt & passwordHash
  if (user.passwordSalt && user.passwordHash) {
    const computedHash = hashPassword(candidatePassword, user.passwordSalt);
    const hashBuf = Buffer.from(computedHash);
    const expectedBuf = Buffer.from(user.passwordHash);
    if (hashBuf.length === expectedBuf.length && crypto.timingSafeEqual(hashBuf, expectedBuf)) {
      return user;
    }
  }

  // 2. Fallback check for superadmin against .env ADMIN_PASSWORD
  // (only for the built-in accounts, never for other team members who happen to be admins)
  if (user.role === 'superadmin' && String(user.username).toLowerCase() === String(SUPERADMIN_USERNAME).toLowerCase() && passwordMatches(candidatePassword)) {
    return user;
  }
  if (user.role === 'systemadmin' && ['support', 'systemadmin'].includes(String(user.username).toLowerCase()) && envPasswordMatches(process.env.SYSTEM_ADMIN_PASSWORD, candidatePassword)) {
    return user;
  }

  return null;
}

// Checks the idle timer and slides it forward on real activity. Background polling
// (the CRM's 30-second alert check sends X-Background: 1) does not keep a session alive.
function activeSession(request, response) {
  const session = sessionFromRequest(request, { allowIdle: true });
  if (!session) return { error: 'Please sign in as an administrator.' };
  if (session.idleUntil && session.idleUntil < Date.now()) {
    setSessionCookie(response, '', 0);
    return { error: 'You were signed out after 30 minutes of inactivity. Please sign in again.', code: 'idle' };
  }
  const background = request.headers['x-background'] === '1';
  if (!background && (!session.idleUntil || session.idleUntil - Date.now() < ADMIN_IDLE_MS - 60 * 1000)) {
    const remaining = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000));
    setSessionCookie(response, signedSession({ ...session }), remaining);
  }
  return { session };
}

function requireAdmin(request, response, next) {
  const { session, error, code } = activeSession(request, response);
  if (!session) {
    return response.status(401).json({ error, code });
  }
  request.session = session;
  next();
}

function requireSuperAdmin(request, response, next) {
  const { session, error, code } = activeSession(request, response);
  if (!session) {
    return response.status(401).json({ error, code });
  }
  if (!['superadmin', 'systemadmin'].includes(session.role)) {
    return response.status(403).json({ error: 'Access denied: admin privilege required.' });
  }
  request.session = session;
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

const OLD_PRIVACY_BODY = 'We use the information you submit through our enquiry forms to respond to your request, explain relevant Bhisi plans, and provide member support. We do not sell your personal information. You can contact us to ask about information associated with your enquiry or to request an update.';
function publicSitePage(row, slug) {
  const fallback = { ...defaultSitePages[slug] };
  // The full Privacy Policy lives in content/privacy-policy.js (unless staff saved their own version in Admin).
  if (slug === 'privacy-policy') {
    fallback.intro = 'How Sainand Chits India collects, uses and protects your personal information.';
    fallback.body = require('./content/privacy-policy')(siteRender.loadSite());
    if (row && (!row.body || row.body.trim() === OLD_PRIVACY_BODY)) row = null;
  }
  if (slug === 'support-center' && row && (!row.body || row.body.trim().startsWith('Choose a support option below and our team will guide you'))) row = { ...row, body: '' };
  if (slug === 'terms-and-conditions') {
    fallback.intro = 'How our chits (Bhisi groups) work, and the terms for using this website.';
    fallback.body = require('./content/terms')(siteRender.loadSite());
    if (row && (!row.body || row.body.trim().startsWith('Information on this website is provided for general guidance and does not replace'))) row = null;
  }
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

const enquiryScheduleMemory = new Map();
let memoryEnquiries = [];

function syncMemoryEnquiry(enquiry) {
  if (!enquiry || !enquiry.id) return;
  const index = memoryEnquiries.findIndex(e => e.id === enquiry.id);
  if (index !== -1) {
    memoryEnquiries[index] = { ...memoryEnquiries[index], ...enquiry };
  } else {
    memoryEnquiries.unshift(enquiry);
  }
}

function deleteMemoryEnquiry(id) {
  memoryEnquiries = memoryEnquiries.filter(e => e.id !== id);
}

function adminEnquiry(row) {
  const mem = enquiryScheduleMemory.get(row.id) || {};
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
    scheduledCallAt: row.scheduled_call_at || mem.scheduledCallAt || null,
    scheduledCallNote: row.scheduled_call_note || mem.scheduledCallNote || '',
    scheduledCallStatus: row.scheduled_call_status || mem.scheduledCallStatus || 'pending',
  };
}

const defaultOpenings = [
  {
    id: 1,
    title: 'Chit Fund Relationship Officer',
    department: 'Sales & Operations',
    location: 'Nagpur, Maharashtra',
    jobType: 'Full Time',
    experience: '1-3 Years',
    description: 'Guide prospective members through Bhisi savings plans, assist with documentation, and support monthly bidding cycles.',
    requirements: 'Strong communication skills in Marathi/Hindi/English, basic understanding of chit funds or financial products, customer-focused approach.',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Accounts & Compliance Executive',
    department: 'Finance & Accounts',
    location: 'Nagpur, Maharashtra',
    jobType: 'Full Time',
    experience: '2-4 Years',
    description: 'Manage daily ledgers, member dividend records, bidding records, and assist with compliance filings under Chit Funds Act.',
    requirements: 'B.Com / M.Com or equivalent, proficiency in Tally/accounting software, attention to detail and ledger accuracy.',
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let memoryOpenings = [...defaultOpenings];

function syncMemoryOpening(opening) {
  const index = memoryOpenings.findIndex(o => o.id === opening.id);
  if (index !== -1) {
    memoryOpenings[index] = { ...memoryOpenings[index], ...opening };
  } else {
    memoryOpenings.unshift(opening);
  }
}

function deleteMemoryOpening(id) {
  memoryOpenings = memoryOpenings.filter(o => o.id !== id);
}

function publicOpening(row) {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    jobType: row.job_type || row.jobType,
    experience: row.experience,
    description: row.description,
    requirements: row.requirements,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function adminOpening(row) {
  return {
    ...publicOpening(row),
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : (row.isActive !== undefined ? Boolean(row.isActive) : true),
    sortOrder: Number(row.sort_order !== undefined ? row.sort_order : (row.sortOrder || 0)),
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

function adminApplication(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    jobOpeningId: row.job_opening_id,
    positionName: row.position_name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    resumeUrl: row.resume_url,
    resumeFilename: row.resume_filename,
    notes: row.notes,
    status: row.status,
  };
}

function fallbackChatAnswer(messages) {
  const question = text(messages[messages.length - 1]?.content, 2000).toLowerCase().trim();
  const site = siteRender.loadSite();
  const planList = site.plans.map(plan => siteRender.lakhLabel(plan.amount)).join(', ');
  const userCount = messages.filter(message => message.role === 'user').length;
  if (shouldOfferEnquiry(messages)) {
    return 'Wonderful! 😊 Please fill in your details below and our team will call you shortly.';
  }
  if (/^(hi|hii+|hello|hey|namaste|namaskar|good (morning|afternoon|evening))\b/.test(question)) {
    return /how are you/.test(question)
      ? 'I’m doing great, thanks for asking! 😊 How can I help you today — are you planning to save for something special?'
      : 'Hello! 👋 How can I help you today — are you planning to save for something special?';
  }
  if (/how are you|how r u/.test(question)) return 'I’m doing great, thank you! 😊 What brings you here today?';
  if (/thank|thanks|thx/.test(question)) return 'You’re welcome! 😊 Is there anything else you’d like to know?';
  if (/^(no|nope|not now|later|nahi|nako)\b/.test(question)) return 'No problem at all! I’m right here if you have any other questions. 😊';
  if (/home|house|flat|education|study|college|wedding|marriage|shaadi|business|shop|car|vehicle|gold|travel|medical/.test(question)) {
    return 'That’s a great goal! A Bhisi can help you save steadily and get a lump sum when you need it. Our team can suggest the plan that suits your budget — would you like them to give you a call?';
  }
  if (/contact|phone|number|email|office|address|location|nagpur|visit|timing|hours/.test(question)) {
    return `You can call us on ${site.phone} (${site.hours}) or visit our office in ${site.city}. Would you like our team to call you instead?`;
  }
  if (/commission|charges?|fees?|hidden|deduct/.test(question)) {
    return 'There are no hidden charges — every charge is written clearly in your agreement. Our team can explain each one for the plan you choose. Would you like them to give you a call?';
  }
  if (/guarantee|assured|fixed return|returns?\b|profit|interest rate|growth/.test(question)) {
    return 'Honestly, a Bhisi is a savings plan, not an investment with guaranteed returns. Its strength is disciplined saving and getting a big amount when you need it, through a transparent process. What are you hoping to save for?';
  }
  if (/\bbid|boli|auction|draw|how.*work|process/.test(question)) {
    return 'Each month the members who need money bid openly, and one member takes the pool — everything is recorded and shared in a monthly statement. Would you like to know which plan sizes we have?';
  }
  if (/plan|lakh|crore|scheme|amount|monthly|instal|emi|pay|cost|how much|price|rate/.test(question)) {
    return `We have Bhisi plans of ${planList}. The monthly amount depends on the plan and on each month’s bidding, so our team works out the exact figures with you. Would you like them to give you a call?`;
  }
  if (/company|about you|who are you|sainand|trust|safe|registered|genuine|legit/.test(question)) {
    return `Yes — Sainand Chits India is a registered chit fund in ${site.city}, backed by ${site.years || site.yearsOfService} years of service, with open bidding and a statement every month. Is there anything specific you’d like to know?`;
  }
  if (/document|kyc|eligib|age|who can/.test(question)) {
    return 'Anyone 18 or older can join, with basic ID and address proof. Our team will guide you through it step by step. Would you like them to call you?';
  }
  return userCount >= 4
    ? 'Our team can answer that properly for your situation. Would you like them to give you a quick call?'
    : 'Good question! Could you tell me a little more, so I can help you better?';
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];
function safeExtension(originalName, allowed, fallback) {
  const extension = path.extname(String(originalName || '')).toLowerCase();
  return allowed.includes(extension) ? extension : fallback;
}
function hasAllowedExtension(originalName, allowed) {
  return allowed.includes(path.extname(String(originalName || '')).toLowerCase());
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = safeExtension(file.originalname, IMAGE_EXTENSIONS, '.jpg');
      callback(null, `news-${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml' && hasAllowedExtension(file.originalname, IMAGE_EXTENSIONS));
  },
});

const certificateUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = safeExtension(file.originalname, [...IMAGE_EXTENSIONS, '.pdf'], '.pdf');
      callback(null, `certificate-${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const okType = (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') || file.mimetype === 'application/pdf';
    callback(null, okType && hasAllowedExtension(file.originalname, [...IMAGE_EXTENSIONS, '.pdf']));
  },
});

const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = safeExtension(file.originalname, RESUME_EXTENSIONS, '.pdf');
      callback(null, `resume-${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    // Both the declared type and the file extension must be a document type.
    callback(null, allowed.includes(file.mimetype) && hasAllowedExtension(file.originalname, RESUME_EXTENSIONS));
  },
});

app.get('/api/health', async (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    await pool.query('SELECT 1');
    response.json({ ok: true, database: 'up', uptimeSeconds: Math.round(process.uptime()) });
  } catch (error) {
    console.error('Health check failed:', error.message);
    response.status(503).json({ ok: false, database: 'down' });
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

    response.json(JSON.parse(siteRender.refreshContactText(JSON.stringify(result))));
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

app.post('/api/enquiries', formLimiter, async (request, response) => {
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
  const check = await humanCheck.verify(request.body, request.ip);
  if (check.bot) {
    // Pretend it worked so bots don't learn how they were caught.
    return response.status(201).json({ success: true });
  }
  if (!check.ok) return response.status(400).json({ error: check.error, refreshChallenge: true });
  if (!hasConsent(request.body)) {
    return response.status(400).json({ error: 'Please tick the box to agree to be contacted.', refreshChallenge: true });
  }

  try {
    const contactKey = email;
    const dedupeKey = enquiryDedupeKey(email, phoneKey, plan, message);
    const existing = await pool.query(
      // Identical form sent again within 30 minutes = accidental double submit. Later = a real repeat enquiry.
      "SELECT * FROM enquiries WHERE email = $1 AND phone_key = $2 AND dedupe_key = $3 AND created_at > NOW() - INTERVAL '30 minutes' AND (contact_id IS NULL OR contact_id = 0 OR EXISTS (SELECT 1 FROM crm_contacts c WHERE c.id = enquiries.contact_id)) ORDER BY created_at DESC LIMIT 1",
      [email, phoneKey, dedupeKey],
    );

    if (existing.rowCount) {
      const existingRow = existing.rows[0];
      await pool.query('UPDATE enquiries SET consent_at = NOW(), consent_text = $2 WHERE id = $1', [existingRow.id, CONSENT_TEXT]).catch(() => {});
      const updated = chatTranscript.length
        ? await pool.query(
          'UPDATE enquiries SET chat_transcript = $1::jsonb WHERE id = $2 RETURNING *',
          [JSON.stringify(chatTranscript), existingRow.id],
        )
        : { rows: [existingRow] };
      // Same form sent again within 30 minutes: don't save it twice or alert the team twice,
      // but always confirm to the customer that we have it.
      response.status(200).json({ success: true, duplicate: true, id: updated.rows[0].id, emailQueued: Boolean(updated.rows[0].email) });
      sendEnquiryEmails(updated.rows[0], { teamAlert: false })
        .catch(error => console.error('[Mailer Error] Repeat confirmation failed:', error.message));
      return undefined;
    }

    const result = await pool.query(
      `INSERT INTO enquiries
        (name, phone, email, plan, message, contact_key, phone_key, dedupe_key, chat_transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [name, phone, email, plan, message, contactKey, phoneKey, dedupeKey, JSON.stringify(chatTranscript)],
    );
    const saved = (await pool.query(
      'UPDATE enquiries SET consent_at = NOW(), consent_text = $2, ip = $3 WHERE id = $1 RETURNING *',
      [result.rows[0].id, CONSENT_TEXT, clientIp(request)],
    )).rows[0];
    let crmContact = null;
    let isRepeat = false;
    let assignedTo = null;
    try {
      await dbReady;
      const upserted = await crm.upsertContactFromEnquiry(saved);
      crmContact = upserted.contact;
      isRepeat = !upserted.created;
      const ownerUsername = crmContact.owner;
      if (ownerUsername) {
        const ownerRow = (await pool.query('SELECT display_name, email FROM admin_security WHERE LOWER(username) = LOWER($1)', [ownerUsername])).rows[0];
        if (ownerRow) assignedTo = { name: ownerRow.display_name || ownerUsername, email: ownerRow.email };
      }
    } catch (crmError) {
      console.error('CRM link error (enquiry still saved):', crmError);
    }
    // Nobody could be assigned (no sales agent available or sharing switched off): alert the managers too.
    let managerEmails = [];
    if (!assignedTo) {
      managerEmails = (await pool.query(
        "SELECT email FROM admin_security WHERE role = 'superadmin' AND COALESCE(is_active, TRUE) AND email <> ''",
      ).catch(() => ({ rows: [] }))).rows.map(row => row.email);
    }
    // Reply to the visitor straight away; the emails go out in the background.
    // Every enquiry gets its own confirmation email, including repeat enquiries from the same person.
    response.status(201).json({ success: true, id: saved.id, emailQueued: Boolean(saved.email) });
    sendEnquiryEmails(saved, {
      managerEmails,
      crmUrl: crmContact ? `${publicBaseUrl(request)}/admin#/customers/${crmContact.id}` : '',
      isRepeat,
      assignedTo,
    }).then(emailResult => {
      if (crmContact && emailResult?.customerSent) {
        return crm.addActivity(crmContact.id, 'system', { subject: `Automatic thank-you email sent to ${saved.email}` });
      }
      return null;
    }).catch(error => console.error('Enquiry email error (enquiry already saved):', error.message));
  } catch (error) {
    console.error('Enquiry save error:', error);
    response.status(500).json({ error: 'Unable to save your enquiry right now. Please call us directly.' });
  }
});

app.get('/api/careers/openings', async (_request, response) => {
  try {
    const result = await pool.query(
      'SELECT id, title, department, location, job_type, experience, description, requirements, created_at FROM job_openings WHERE is_active = TRUE ORDER BY sort_order ASC, created_at DESC',
    );
    const openings = result.rows.map(publicOpening);
    if (openings.length) {
      result.rows.forEach(r => syncMemoryOpening(adminOpening(r)));
      return response.json({ openings });
    }
    const active = memoryOpenings.filter(o => o.isActive !== false);
    response.json({ openings: active.map(publicOpening) });
  } catch (error) {
    console.error('Public openings error:', error.message);
    if (error.code === '42P01') {
      initDbExtensions().catch(() => {});
    }
    const active = memoryOpenings.filter(o => o.isActive !== false);
    response.json({ openings: active.map(publicOpening) });
  }
});

app.post('/api/careers/apply', formLimiter, resumeUpload.single('resume'), async (request, response) => {
  const firstName = text(request.body?.firstName, 80);
  const lastName = text(request.body?.lastName, 80);
  const email = text(request.body?.email, 254).toLowerCase();
  const phone = text(request.body?.phone, 40);
  const address = text(request.body?.address, 255);
  const city = text(request.body?.city, 100);
  const state = text(request.body?.state, 100);
  const country = text(request.body?.country || 'India', 100);
  const pincode = text(request.body?.pincode, 20);
  const positionName = text(request.body?.positionName || 'General Application', 180);
  const jobOpeningId = validId(request.body?.jobOpeningId);
  const notes = text(request.body?.notes, 2000);

  if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || normalizedPhone(phone).length < 10) {
    return response.status(400).json({ error: 'Please provide your first name, last name, valid email, and 10-digit phone number.' });
  }

  if (!city || !state || !pincode) {
    return response.status(400).json({ error: 'Please provide your city, state, and pincode.' });
  }

  const check = await humanCheck.verify(request.body, request.ip);
  const removeUpload = () => { if (request.file) fs.unlink(request.file.path, () => {}); };
  if (check.bot) { removeUpload(); return response.status(201).json({ success: true, message: 'Thank you! Your application has been submitted.' }); }
  if (!check.ok) { removeUpload(); return response.status(400).json({ error: check.error, refreshChallenge: true }); }
  if (!hasConsent(request.body)) {
    removeUpload();
    return response.status(400).json({ error: 'Please tick the box to agree to be contacted.', refreshChallenge: true });
  }

  if (!request.file) {
    return response.status(400).json({ error: 'Please upload your resume (PDF, DOC, or DOCX up to 10 MB).' });
  }

  const resumeUrl = `/uploads/${request.file.filename}`;
  const resumeFilename = request.file.originalname;

  try {
    const result = await pool.query(
      `INSERT INTO job_applications
        (job_opening_id, position_name, first_name, last_name, email, phone, address, city, state, country, pincode, resume_url, resume_filename, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'new')
       RETURNING *`,
      [
        jobOpeningId,
        positionName,
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        country,
        pincode,
        resumeUrl,
        resumeFilename,
        notes,
      ],
    );

    const saved = result.rows[0];
    await pool.query('UPDATE job_applications SET consent_at = NOW(), consent_text = $2 WHERE id = $1', [saved.id, APPLICATION_CONSENT_TEXT]).catch(() => {});

    // Trigger emails asynchronously (does not block response)
    const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
    const originUrl = `${protocol}://${request.get('host')}`;
    sendJobApplicationEmails(saved, originUrl).catch(err => console.error('Background email error:', err.message));

    response.status(201).json({
      success: true,
      message: 'Thank you! Your application and resume have been submitted successfully.',
      application: { id: saved.id },
    });
  } catch (error) {
    console.error('Job application save error:', error);
    response.status(500).json({ error: 'Unable to save your application right now. Please try again or email us directly at support@sainandchits.com.' });
  }
});

app.post('/api/chat', chatLimiter, async (request, response) => {
  const incomingMessages = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const messages = incomingMessages
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .slice(-12)
    .map(message => ({ role: message.role, content: text(message.content, 2000) }));

  if (!messages.length) return response.status(400).json({ error: 'Please enter a message.' });

  const preparedAnswer = localChatAnswer(messages);
  if (preparedAnswer) {
    return response.json({
      answer: preparedAnswer,
      local: true,
      showEnquiryForm: shouldOfferEnquiry(messages),
    });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    const answer = fallbackChatAnswer(messages);
    return response.json({ answer, fallback: true, showEnquiryForm: shouldOfferEnquiry(messages) });
  }

  const site = siteRender.loadSite();
  const planList = site.plans.map(plan => siteRender.lakhLabel(plan.amount)).join(', ');
  const userTurns = messages.filter(message => message.role === 'user').length;
  const wantsCall = shouldOfferEnquiry(messages);
  const systemPrompt = `You are Sai, the friendly assistant on the website of Sainand Chits India Pvt. Ltd., a registered Bhisi (chit fund) company in ${site.city}. Talk like a warm, helpful person at our front desk.

How to talk:
- Have a real conversation. Read what the visitor said and reply to THAT first — greetings, small talk, doubts, worries.
- Keep replies short: 1 to 3 sentences. Use the visitor's language (English, Hindi or Marathi). An emoji now and then is fine.
- Be curious about them: ask what they are saving for (home, education, wedding, business) or what they'd like to know.
- Answer general questions simply and honestly. You are not a calculator or a rule book.
- Do NOT ask for their phone number, email or details, and do NOT tell them to fill a form — unless the instructions below say so.
- Offer a call from our team only at a natural moment: when they ask for exact figures, specific rules or how to join, or when they show real interest. Offer it as a question, e.g. "Would you like our team to give you a call?" — and offer it at most once every few messages.
${wantsCall ? '- The visitor wants a call now. Reply warmly in one sentence and tell them to fill in their details in the form below.' : userTurns >= 4 ? '- The chat has gone on a while; if it fits naturally, you may ask once whether they would like a call from our team.' : '- It is early in the chat: just talk and help. Do not offer a call unless they ask for exact figures or how to join.'}

Never share (say our team explains these personally):
- Monthly instalment amounts, commission, dividends, discounts, bid limits, penalties, fees or any calculations.
- Detailed rules of bidding, security, documents or eligibility.
- Any promise of returns, profit, growth or anything "guaranteed".

You may share:
- That we offer Bhisi plans of ${planList}.
- That it is a registered chit fund under the ${site.registeredUnder}, with open monthly bidding and a statement every month, and that the organisation has ${site.yearsOfService} years of service in ${site.city}.
- Contact: phone ${site.phone}, email ${site.email}, office hours ${site.hours}.

Never claim to be a human, and never claim to see anyone's account or records.`;

  try {
    const groqResponse = await fetch(
      process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
      {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        temperature: 0.4,
        max_completion_tokens: 160,
        reasoning_effort: process.env.GROQ_REASONING_EFFORT || 'low',
        include_reasoning: false,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
      },
    );
    const result = await groqResponse.json();
    if (!groqResponse.ok) {
      console.error('Groq error:', result);
      if (
        groqResponse.status === 401 ||
        result.error?.code === 'insufficient_quota' ||
        result.error?.code === 'credit_balance_exhausted' ||
        result.error?.code === 'token_invalidated' ||
        result.error?.code === 'invalid_api_key'
      ) {
        const answer = fallbackChatAnswer(messages);
        return response.json({ answer, fallback: true, showEnquiryForm: shouldOfferEnquiry(messages) });
      }
      return response.status(502).json({ error: 'The chat service is temporarily unavailable.' });
    }
    let answer = result.choices?.[0]?.message?.content?.trim();
    const formNow = shouldOfferEnquiry(messages);
    // If the AI asks for details but the form isn't being shown yet, drop that sentence so the chat stays natural.
    if (answer && !formNow) {
      const cleaned = answer
        .split(/(?<=[.!?])\s+/)
        .filter(sentence => !/\b(below|fill (in|out)|the form|share your (contact )?(details|number|name)|leave your (details|number))\b/i.test(sentence))
        .join(' ')
        .trim();
      if (cleaned) answer = cleaned;
    }
    if (!answer) return response.status(502).json({ error: 'The chat service returned no answer.' });
    response.json({ answer, showEnquiryForm: formNow });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    response.status(500).json({ error: 'Unable to process the chat message.' });
  }
});

app.post('/api/admin/login', loginLimiter, async (request, response) => {
  if (!isAdminConfigured()) {
    return response.status(503).json({ error: 'Admin access is not configured. Add the ADMIN_PASSWORD secret first.' });
  }

  const username = text(request.body?.username, 80);
  const password = String(request.body?.password || '');
  const otpCode = String(request.body?.otpCode || '').trim();

  const user = await verifyAdminCredentials(username, password);
  if (!user) {
    return response.status(401).json({ error: 'Incorrect username or password.' });
  }

  // If 2FA is active for this admin
  if (user.requireEmailOtp) {
    if (!otpCode) {
      const newOtp = generateOtpCode();
      await createAdminOtp(user.email, newOtp, 'login_2fa', 15);
      const mailRes = await sendAdminOtpEmail({
        email: user.email,
        username: user.username,
        otpCode: newOtp,
        purpose: 'login_2fa',
        expiresMinutes: 15,
      });
      response.locals.requireOtp = true;
      return response.json({
        requireOtp: true,
        maskedEmail: maskEmail(user.email),
        message: 'Two-factor verification code sent to your email.',
      });
    }

    const otpValid = await verifyAndConsumeOtp(user.email, otpCode, 'login_2fa');
    if (!otpValid) {
      return response.status(400).json({ error: 'Invalid or expired verification code.' });
    }
  }

  setSessionCookie(response, signedSession(user), 60 * 60 * 12);
  response.json({
    success: true,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || '',
  });
});

app.post('/api/admin/forgot-password/request', otpLimiter, async (request, response) => {
  const identifier = text(request.body?.identifier, 255).toLowerCase();
  if (!identifier) {
    return response.status(400).json({ error: 'Please enter your username or registered email address.' });
  }

  // Works for every account (owner, support admin and staff); the code goes to that account's own email.
  const sec = await findAdminForReset(identifier);
  const validIdentifier = Boolean(sec && sec.email);

  if (!validIdentifier) {
    // Same reply either way so the form cannot be used to discover admin accounts.
    return response.json({
      success: true,
      maskedEmail: 'your registered email',
      message: 'If that account exists, a verification code has been sent to its registered email.',
    });
  }

  const otpCode = generateOtpCode();
  await createAdminOtp(sec.email, otpCode, 'forgot_password', 15);

  const mailResult = await sendAdminOtpEmail({
    email: sec.email,
    username: sec.username,
    otpCode,
    purpose: 'forgot_password',
    expiresMinutes: 15,
  });

  response.json({
    success: true,
    maskedEmail: maskEmail(sec.email),
    message: `Verification code sent to ${maskEmail(sec.email)}. Please check your inbox.`,
  });
});

app.post('/api/admin/forgot-password/reset', otpLimiter, async (request, response) => {
  const otpCode = text(request.body?.otpCode, 20);
  const newPassword = String(request.body?.newPassword || '');

  if (!otpCode || otpCode.length < 4) {
    return response.status(400).json({ error: 'Please enter a valid verification code.' });
  }
  if (!newPassword || KNOWN_DEFAULT_PASSWORDS.has(newPassword) || passwordProblem(newPassword)) {
    return response.status(400).json({ error: (newPassword && passwordProblem(newPassword)) || 'Please choose a new password (not an old default password).' });
  }

  const identifier = text(request.body?.identifier, 255).toLowerCase();
  const sec = identifier ? await findAdminForReset(identifier) : await getAdminSecurity();
  if (!sec || !sec.email) {
    return response.status(400).json({ error: 'Invalid or expired verification code. Please request a fresh code.' });
  }
  const otpValid = await verifyAndConsumeOtp(sec.email, otpCode, 'forgot_password');
  if (!otpValid) {
    return response.status(400).json({ error: 'Invalid or expired verification code. Please request a fresh code.' });
  }

  const newSalt = generateSalt();
  const newHash = hashPassword(newPassword, newSalt);

  await updateAdminSecurity({
    passwordHash: newHash,
    passwordSalt: newSalt,
  }, sec.username);

  // Automatically authenticate after successful reset
  setSessionCookie(response, signedSession(sec), 60 * 60 * 12);
  response.json({
    success: true,
    username: sec.username,
    message: 'Your password has been successfully reset. You are now logged in.',
  });
});

app.get('/api/admin/security/profile', requireAdmin, async (request, response) => {
  try {
    const sec = await getAdminUser(request.session.username);
    if (!sec) return response.status(404).json({ error: 'Account not found.' });
    response.json({
      username: sec.username,
      email: sec.email,
      emailVerified: sec.emailVerified,
      requireEmailOtp: sec.requireEmailOtp,
      maskedEmail: maskEmail(sec.email),
      smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    });
  } catch (error) {
    console.error('Security profile error:', error);
    response.status(500).json({ error: 'Unable to load security profile.' });
  }
});

app.patch('/api/admin/security/profile', requireAdmin, async (request, response) => {
  try {
    const sec = await getAdminUser(request.session.username);
    if (!sec) return response.status(404).json({ error: 'Account not found.' });
    const updates = {};

    if (request.body?.email !== undefined) {
      const email = text(request.body.email, 254).toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return response.status(400).json({ error: 'Please provide a valid email address.' });
      }
      if (email !== sec.email.toLowerCase()) {
        updates.email = email;
        updates.emailVerified = false; // Reset verification if email changes
      }
    }

    if (request.body?.requireEmailOtp !== undefined) {
      const requireEmailOtp = Boolean(request.body.requireEmailOtp);
      if (requireEmailOtp && !sec.emailVerified && updates.emailVerified !== true) {
        return response.status(400).json({ error: 'Please verify your email address before enabling Two-Factor Authentication.' });
      }
      updates.requireEmailOtp = requireEmailOtp;
    }

    await updateAdminSecurity(updates, sec.username);
    const updated = await getAdminUser(sec.username);
    response.json({
      success: true,
      message: 'Security settings updated successfully.',
      profile: {
        username: updated.username,
        email: updated.email,
        emailVerified: updated.emailVerified,
        requireEmailOtp: updated.requireEmailOtp,
        maskedEmail: maskEmail(updated.email),
        smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
      },
    });
  } catch (error) {
    console.error('Security profile update error:', error);
    response.status(500).json({ error: 'Unable to update security settings.' });
  }
});

app.post('/api/admin/security/send-email-verification', requireAdmin, async (request, response) => {
  try {
    const sec = await getAdminUser(request.session.username);
    if (!sec) return response.status(404).json({ error: 'Account not found.' });
    let targetEmail = sec.email;

    if (request.body?.email) {
      const emailCandidate = text(request.body.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
        return response.status(400).json({ error: 'Please provide a valid email address.' });
      }
      targetEmail = emailCandidate;
      await updateAdminSecurity({ email: targetEmail, emailVerified: false }, sec.username);
    }

    const otpCode = generateOtpCode();
    await createAdminOtp(targetEmail, otpCode, 'verify_email', 15);

    const mailResult = await sendAdminOtpEmail({
      email: targetEmail,
      username: sec.username,
      otpCode,
      purpose: 'verify_email',
      expiresMinutes: 15,
    });

    response.json({
      success: true,
      maskedEmail: maskEmail(targetEmail),
      message: `Verification code sent to ${maskEmail(targetEmail)}.`,
    });
  } catch (error) {
    console.error('Send verification error:', error);
    response.status(500).json({ error: 'Unable to dispatch verification code.' });
  }
});

app.post('/api/admin/security/verify-email', requireAdmin, otpLimiter, async (request, response) => {
  try {
    const otpCode = text(request.body?.otpCode, 20);
    if (!otpCode) {
      return response.status(400).json({ error: 'Please provide the 6-digit verification code.' });
    }

    const sec = await getAdminUser(request.session.username);
    if (!sec) return response.status(404).json({ error: 'Account not found.' });
    const isValid = await verifyAndConsumeOtp(sec.email, otpCode, 'verify_email');
    if (!isValid) {
      return response.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    await updateAdminSecurity({ emailVerified: true }, sec.username);
    response.json({
      success: true,
      message: 'Email address verified successfully!',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    response.status(500).json({ error: 'Unable to verify email address.' });
  }
});

app.post('/api/admin/security/change-password', requireAdmin, async (request, response) => {
  try {
    const currentPassword = String(request.body?.currentPassword || '');
    const newPassword = String(request.body?.newPassword || '');

    if (!currentPassword) {
      return response.status(400).json({ error: 'Please enter your current password.' });
    }
    if (!newPassword || KNOWN_DEFAULT_PASSWORDS.has(newPassword) || passwordProblem(newPassword, request.session?.username)) {
      return response.status(400).json({ error: (newPassword && passwordProblem(newPassword, request.session?.username)) || 'Please choose a new password (not an old default password).' });
    }

    const sec = await getAdminUser(request.session.username);
    if (!sec) return response.status(404).json({ error: 'Account not found.' });
    const validCurrent = await verifyAdminCredentials(sec.username, currentPassword);
    if (!validCurrent) {
      return response.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);
    await updateAdminSecurity({
      passwordHash: newHash,
      passwordSalt: newSalt,
    }, sec.username);

    response.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    response.status(500).json({ error: 'Unable to change password.' });
  }
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
    role: session?.role || null,
    displayName: session?.displayName || null,
    avatarUrl: session?.avatarUrl || '',
    configured: isAdminConfigured(),
  });
});

app.get('/api/admin/profile', requireAdmin, async (request, response) => {
  try {
    const user = await getAdminUser(request.session.username);
    response.json({
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      ...(await pool.query(
        "SELECT COALESCE(designation, '') AS designation, COALESCE(mobile, '') AS mobile, TO_CHAR(dob, 'YYYY-MM-DD') AS dob FROM admin_security WHERE LOWER(username) = $1",
        [String(user.username).toLowerCase()],
      ).then(result => result.rows[0] || {}).catch(() => ({}))),
    });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load profile.' });
  }
});

app.patch('/api/admin/profile', requireAdmin, async (request, response) => {
  try {
    const username = request.session.username;
    const user = await getAdminUser(username);
    if (!user) return response.status(404).json({ error: 'User not found.' });

    const updates = {};
    if (request.body?.displayName !== undefined) {
      updates.displayName = text(request.body.displayName, 100) || user.displayName;
    }
    if (request.body?.avatarUrl !== undefined) {
      updates.avatarUrl = text(request.body.avatarUrl, 10000);
    }
    // Designation, mobile and date of birth (My account).
    const extra = {};
    if (request.body?.designation !== undefined) extra.designation = text(request.body.designation, 100);
    if (request.body?.mobile !== undefined) {
      const mobile = text(request.body.mobile, 40);
      if (mobile && !/^\+?[\d\s-]{10,16}$/.test(mobile)) return response.status(400).json({ error: 'Enter a valid mobile number.' });
      extra.mobile = mobile;
    }
    if (request.body?.dob !== undefined) {
      const dob = String(request.body.dob || '').trim();
      if (dob) {
        const date = new Date(`${dob}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(date.getTime()) || date > new Date() || date.getUTCFullYear() < 1920) {
          return response.status(400).json({ error: 'Enter a valid date of birth.' });
        }
      }
      extra.dob = dob || null;
    }
    if (Object.keys(extra).length) {
      const keys = Object.keys(extra);
      await pool.query(
        `UPDATE admin_security SET ${keys.map((key, i) => `${key} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE LOWER(username) = $1`,
        [username.toLowerCase(), ...keys.map(key => extra[key])],
      );
    }
    if (request.body?.newPassword) {
      const currentPassword = String(request.body.currentPassword || '');
      const newPassword = String(request.body.newPassword);
      const problem = passwordProblem(newPassword, request.session?.username);
      if (problem) {
        return response.status(400).json({ error: problem });
      }
      const verified = await verifyAdminCredentials(username, currentPassword);
      if (!verified) {
        return response.status(400).json({ error: 'Current password is incorrect.' });
      }
      const newSalt = generateSalt();
      updates.passwordSalt = newSalt;
      updates.passwordHash = hashPassword(newPassword, newSalt);
    }

    Object.assign(user, updates);
    await pool.query(
      `UPDATE admin_security SET
        display_name = COALESCE($1, display_name),
        avatar_url = COALESCE($2, avatar_url),
        password_salt = COALESCE($3, password_salt),
        password_hash = COALESCE($4, password_hash),
        updated_at = NOW()
       WHERE LOWER(username) = $5`,
      [
        updates.displayName || null,
        updates.avatarUrl !== undefined ? updates.avatarUrl : null,
        updates.passwordSalt || null,
        updates.passwordHash || null,
        username.toLowerCase(),
      ],
    ).catch(err => console.error('Failed to update admin_security profile in DB:', err.message));

    setSessionCookie(response, signedSession(user), 60 * 60 * 12);
    response.json({
      success: true,
      message: 'Profile updated successfully.',
      profile: {
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    response.status(500).json({ error: 'Unable to update profile.' });
  }
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
    const enquiries = result.rows.map(adminEnquiry);
    enquiries.forEach(syncMemoryEnquiry);
    response.json({ enquiries });
  } catch (error) {
    console.error('Admin enquiries query error, serving from memory fallback:', error.message);
    response.json({ enquiries: memoryEnquiries.map(adminEnquiry) });
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
  if (!id) {
    return response.status(400).json({ error: 'Invalid enquiry ID.' });
  }

  try {
    const currentResult = await pool.query('SELECT * FROM enquiries WHERE id = $1', [id]);
    if (!currentResult.rowCount) {
      return response.status(404).json({ error: 'Enquiry not found.' });
    }
    const current = currentResult.rows[0];

    const hasStatus = request.body?.status !== undefined;
    const status = hasStatus ? text(request.body.status, 30) : current.status;
    if (hasStatus && !allowedStatuses.has(status)) {
      return response.status(400).json({ error: 'Invalid enquiry status.' });
    }

    const followUp1 = request.body?.followUp1 !== undefined ? text(request.body.followUp1, 1000) : current.follow_up_1;
    const followUp2 = request.body?.followUp2 !== undefined ? text(request.body.followUp2, 1000) : current.follow_up_2;
    const followUp3 = request.body?.followUp3 !== undefined ? text(request.body.followUp3, 1000) : current.follow_up_3;
    const adminNotes = request.body?.adminNotes !== undefined ? text(request.body.adminNotes, 4000) : current.admin_notes;

    let scheduledCallAt = current.scheduled_call_at;
    if (request.body?.scheduledCallAt !== undefined) {
      const rawDate = request.body.scheduledCallAt;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      scheduledCallAt = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
    }

    const scheduledCallNote = request.body?.scheduledCallNote !== undefined
      ? text(request.body.scheduledCallNote, 2000)
      : (current.scheduled_call_note || '');

    const scheduledCallStatus = request.body?.scheduledCallStatus !== undefined
      ? (text(request.body.scheduledCallStatus, 30) || 'pending')
      : (current.scheduled_call_status || 'pending');

    if (request.body?.scheduledCallAt !== undefined || request.body?.scheduledCallNote !== undefined || request.body?.scheduledCallStatus !== undefined) {
      enquiryScheduleMemory.set(id, {
        scheduledCallAt,
        scheduledCallNote,
        scheduledCallStatus,
      });
    }

    try {
      const result = await pool.query(
        `UPDATE enquiries
         SET status = $1, follow_up_1 = $2, follow_up_2 = $3, follow_up_3 = $4, admin_notes = $5,
             scheduled_call_at = $6, scheduled_call_note = $7, scheduled_call_status = $8
         WHERE id = $9
         RETURNING *`,
        [
          status,
          followUp1,
          followUp2,
          followUp3,
          adminNotes,
          scheduledCallAt,
          scheduledCallNote,
          scheduledCallStatus,
          id,
        ],
      );
      const updated = adminEnquiry(result.rows[0]);
      syncMemoryEnquiry(updated);
      return response.json({ enquiry: updated });
    } catch (error) {
      console.error('Enquiry update error:', error);
      if (error.code === '42703') {
        try {
          await initDbExtensions();
          const retry = await pool.query(
            `UPDATE enquiries
             SET status = $1, follow_up_1 = $2, follow_up_2 = $3, follow_up_3 = $4, admin_notes = $5,
                 scheduled_call_at = $6, scheduled_call_note = $7, scheduled_call_status = $8
             WHERE id = $9
             RETURNING *`,
            [
              status,
              followUp1,
              followUp2,
              followUp3,
              adminNotes,
              scheduledCallAt,
              scheduledCallNote,
              scheduledCallStatus,
              id,
            ],
          );
          const updated = adminEnquiry(retry.rows[0]);
          syncMemoryEnquiry(updated);
          return response.json({ enquiry: updated });
        } catch (retryErr) {
          console.error('Column migration retry error:', retryErr);
          try {
            const fallback = await pool.query(
              `UPDATE enquiries
               SET status = $1, follow_up_1 = $2, follow_up_2 = $3, follow_up_3 = $4, admin_notes = $5
               WHERE id = $6
               RETURNING *`,
              [
                status,
                followUp1,
                followUp2,
                followUp3,
                adminNotes,
                id,
              ],
            );
            const updated = adminEnquiry(fallback.rows[0]);
            syncMemoryEnquiry(updated);
            return response.json({ enquiry: updated });
          } catch (fallbackErr) {
            // Memory fallback if DB query fails completely
            const memIdx = memoryEnquiries.findIndex(e => e.id === id);
            if (memIdx !== -1) {
              memoryEnquiries[memIdx] = {
                ...memoryEnquiries[memIdx],
                status,
                followUp1,
                followUp2,
                followUp3,
                adminNotes,
                scheduledCallAt,
                scheduledCallNote,
                scheduledCallStatus,
              };
              return response.json({ enquiry: adminEnquiry(memoryEnquiries[memIdx]) });
            }
            return response.status(500).json({ error: 'Unable to update the enquiry.' });
          }
        }
      }
      // Memory fallback if DB query fails
      const memIdx = memoryEnquiries.findIndex(e => e.id === id);
      if (memIdx !== -1) {
        memoryEnquiries[memIdx] = {
          ...memoryEnquiries[memIdx],
          status,
          followUp1,
          followUp2,
          followUp3,
          adminNotes,
          scheduledCallAt,
          scheduledCallNote,
          scheduledCallStatus,
        };
        return response.json({ enquiry: adminEnquiry(memoryEnquiries[memIdx]) });
      }
      return response.status(500).json({ error: 'Unable to update the enquiry.' });
    }
  } catch (error) {
    console.error('Enquiry fetch/update error:', error);
    return response.status(500).json({ error: 'Unable to process enquiry update.' });
  }
});

app.delete('/api/admin/enquiries/:id', requireSuperAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid enquiry.' });
  try {
    deleteMemoryEnquiry(id);
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

app.delete('/api/admin/news/:id', requireSuperAdmin, async (request, response) => {
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

app.get('/api/admin/site-content', requireSuperAdmin, async (_request, response) => {
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

app.put('/api/admin/site-pages/:slug', requireSuperAdmin, async (request, response) => {
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

app.post('/api/admin/site-faqs', requireSuperAdmin, async (request, response) => {
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

app.patch('/api/admin/site-faqs/:id', requireSuperAdmin, async (request, response) => {
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

app.delete('/api/admin/site-faqs/:id', requireSuperAdmin, async (request, response) => {
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

app.post('/api/admin/support-items', requireSuperAdmin, async (request, response) => {
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

app.patch('/api/admin/support-items/:id', requireSuperAdmin, async (request, response) => {
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

app.delete('/api/admin/support-items/:id', requireSuperAdmin, async (request, response) => {
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

app.post('/api/admin/certificates/upload', requireSuperAdmin, certificateUpload.single('certificate'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Please choose an image or PDF certificate.' });
  response.status(201).json({
    url: `/uploads/${request.file.filename}`,
    fileName: request.file.originalname,
  });
});

app.post('/api/admin/certificates', requireSuperAdmin, async (request, response) => {
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

app.patch('/api/admin/certificates/:id', requireSuperAdmin, async (request, response) => {
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

app.delete('/api/admin/certificates/:id', requireSuperAdmin, async (request, response) => {
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

app.get('/api/admin/openings', requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM job_openings ORDER BY sort_order ASC, created_at DESC');
    const openings = result.rows.map(adminOpening);
    if (openings.length) {
      result.rows.forEach(r => syncMemoryOpening(adminOpening(r)));
      return response.json({ openings });
    }
    response.json({ openings: memoryOpenings.map(adminOpening) });
  } catch (error) {
    console.error('Admin openings error:', error);
    if (error.code === '42P01') {
      try {
        await initDbExtensions();
        const retry = await pool.query('SELECT * FROM job_openings ORDER BY sort_order ASC, created_at DESC');
        return response.json({ openings: retry.rows.map(adminOpening) });
      } catch (retryErr) {
        console.error('Admin openings retry error:', retryErr);
      }
    }
    response.json({ openings: memoryOpenings.map(adminOpening) });
  }
});

app.post('/api/admin/openings', requireAdmin, async (request, response) => {
  const title = text(request.body?.title, 180);
  const description = text(request.body?.description, 4000);
  if (!title) return response.status(400).json({ error: 'Please enter a job title.' });
  if (!description) return response.status(400).json({ error: 'Please enter a job description.' });

  const department = text(request.body?.department || 'General', 100);
  const location = text(request.body?.location || 'Nagpur, Maharashtra', 120);
  const jobType = text(request.body?.jobType || 'Full Time', 50);
  const experience = text(request.body?.experience || '1-3 Years', 50);
  const requirements = text(request.body?.requirements, 4000);
  const isActive = request.body?.isActive !== false;
  const sortOrder = Number.parseInt(request.body?.sortOrder, 10) || 0;

  try {
    const result = await pool.query(
      `INSERT INTO job_openings
        (title, department, location, job_type, experience, description, requirements, is_active, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        title,
        department,
        location,
        jobType,
        experience,
        description,
        requirements,
        isActive,
        sortOrder,
      ],
    );
    const opening = adminOpening(result.rows[0]);
    syncMemoryOpening(opening);
    response.status(201).json({ opening });
  } catch (error) {
    console.error('Opening create error:', error);
    if (error.code === '42P01') {
      try {
        await initDbExtensions();
        const retry = await pool.query(
          `INSERT INTO job_openings
            (title, department, location, job_type, experience, description, requirements, is_active, sort_order, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING *`,
          [
            title,
            department,
            location,
            jobType,
            experience,
            description,
            requirements,
            isActive,
            sortOrder,
          ],
        );
        const opening = adminOpening(retry.rows[0]);
        syncMemoryOpening(opening);
        return response.status(201).json({ opening });
      } catch (retryErr) {
        console.error('Retry after table creation failed:', retryErr);
      }
    }

    // Resilient memory fallback so job posting NEVER fails
    const memOpening = {
      id: Date.now(),
      title,
      department,
      location,
      jobType,
      experience,
      description,
      requirements,
      isActive,
      sortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    syncMemoryOpening(memOpening);
    response.status(201).json({ opening: memOpening });
  }
});

app.patch('/api/admin/openings/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const title = text(request.body?.title, 180);
  const description = text(request.body?.description, 4000);
  if (!id || !title) return response.status(400).json({ error: 'Invalid opening update.' });
  if (!description) return response.status(400).json({ error: 'Please enter a job description.' });

  const department = text(request.body?.department, 100);
  const location = text(request.body?.location, 120);
  const jobType = text(request.body?.jobType, 50);
  const experience = text(request.body?.experience, 50);
  const requirements = text(request.body?.requirements, 4000);
  const isActive = request.body?.isActive !== false;
  const sortOrder = Number.parseInt(request.body?.sortOrder, 10) || 0;

  try {
    const result = await pool.query(
      `UPDATE job_openings
       SET title = $1, department = $2, location = $3, job_type = $4, experience = $5,
           description = $6, requirements = $7, is_active = $8, sort_order = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        title,
        department,
        location,
        jobType,
        experience,
        description,
        requirements,
        isActive,
        sortOrder,
        id,
      ],
    );
    if (!result.rowCount) {
      const memIdx = memoryOpenings.findIndex(o => o.id === id);
      if (memIdx !== -1) {
        memoryOpenings[memIdx] = {
          ...memoryOpenings[memIdx],
          title,
          department,
          location,
          jobType,
          experience,
          description,
          requirements,
          isActive,
          sortOrder,
          updatedAt: new Date().toISOString(),
        };
        return response.json({ opening: adminOpening(memoryOpenings[memIdx]) });
      }
      return response.status(404).json({ error: 'Job opening not found.' });
    }
    const opening = adminOpening(result.rows[0]);
    syncMemoryOpening(opening);
    response.json({ opening });
  } catch (error) {
    console.error('Opening update error:', error);
    const memIdx = memoryOpenings.findIndex(o => o.id === id);
    if (memIdx !== -1) {
      memoryOpenings[memIdx] = {
        ...memoryOpenings[memIdx],
        title,
        department,
        location,
        jobType,
        experience,
        description,
        requirements,
        isActive,
        sortOrder,
        updatedAt: new Date().toISOString(),
      };
      return response.json({ opening: adminOpening(memoryOpenings[memIdx]) });
    }
    response.status(500).json({ error: 'Unable to update job opening.' });
  }
});

app.delete('/api/admin/openings/:id', requireSuperAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid opening.' });
  try {
    await pool.query('DELETE FROM job_openings WHERE id = $1', [id]);
    deleteMemoryOpening(id);
    response.json({ success: true });
  } catch (error) {
    console.error('Opening delete error:', error);
    deleteMemoryOpening(id);
    response.json({ success: true });
  }
});

app.get('/api/admin/applications', requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM job_applications ORDER BY created_at DESC');
    response.json({ applications: result.rows.map(adminApplication) });
  } catch (error) {
    console.error('Admin applications error:', error);
    if (error.code === '42P01') {
      try {
        await initDbExtensions();
        const retry = await pool.query('SELECT * FROM job_applications ORDER BY created_at DESC');
        return response.json({ applications: retry.rows.map(adminApplication) });
      } catch (retryErr) {
        console.error('Admin applications retry error:', retryErr);
      }
    }
    response.json({ applications: [] });
  }
});

app.patch('/api/admin/applications/:id', requireAdmin, async (request, response) => {
  const id = validId(request.params.id);
  const status = text(request.body?.status, 30);
  if (!id || !status) return response.status(400).json({ error: 'Invalid application update.' });
  try {
    const result = await pool.query(
      'UPDATE job_applications SET status = $1, notes = $2 WHERE id = $3 RETURNING *',
      [status, text(request.body?.notes, 2000), id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Application not found.' });
    response.json({ application: adminApplication(result.rows[0]) });
  } catch (error) {
    console.error('Application update error:', error);
    response.status(500).json({ error: 'Unable to update application.' });
  }
});

app.delete('/api/admin/applications/:id', requireSuperAdmin, async (request, response) => {
  const id = validId(request.params.id);
  if (!id) return response.status(400).json({ error: 'Invalid application.' });
  try {
    const result = await pool.query('DELETE FROM job_applications WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Application not found.' });
    response.json({ success: true });
  } catch (error) {
    console.error('Application delete error:', error);
    response.status(500).json({ error: 'Unable to delete application.' });
  }
});

const SITE_PAGE_SLUGS = {
  '/faq': 'faq',
  '/contact': 'contact-us',
  '/contact-us': 'contact-us',
  '/support': 'support-center',
  '/support-center': 'support-center',
  '/privacy': 'privacy-policy',
  '/privacy-policy': 'privacy-policy',
  '/certificates': 'authorized-certificates',
  '/authorized-certificates': 'authorized-certificates',
  '/terms': 'terms-and-conditions',
  '/terms-and-conditions': 'terms-and-conditions',
};
app.get(['/news', '/news-announcements'], (_request, response) => sendPage(response, 'news.html'));
app.get(['/careers', '/carrier', '/careers-at-sainand'], (_request, response) => sendPage(response, 'careers.html'));
app.get(
  ['/faq', '/contact', '/contact-us', '/support', '/support-center', '/privacy', '/privacy-policy', '/certificates', '/authorized-certificates', '/terms', '/terms-and-conditions'],
  async (request, response) => {
    // Give each information page its real title and description on the server (for Google and link previews).
    const slug = SITE_PAGE_SLUGS[request.path.replace(/\/$/, '')] || 'faq';
    let page = null;
    try {
      const row = (await pool.query('SELECT * FROM site_pages WHERE slug = $1', [slug])).rows[0];
      page = publicSitePage(row, slug);
    } catch {
      page = publicSitePage(null, slug);
    }
    let faqs;
    if (slug === 'faq') {
      try {
        faqs = (await pool.query('SELECT question, answer FROM site_faqs WHERE is_published = TRUE ORDER BY sort_order ASC, id ASC')).rows;
      } catch {
        faqs = defaultFaqs;
      }
      faqs = faqs.map(faq => ({ question: faq.question, answer: siteRender.refreshContactText(faq.answer || '') }));
    }
    sendPage(response, 'site-page.html', {
      faqs,
      name: { faq: 'FAQ', 'contact-us': 'Contact us' }[slug] || page?.title,
      path: `/${slug}`,
      title: page?.title ? (/sainand chits/i.test(page.title) ? page.title : `${page.title} | Sainand Chits India`) : undefined,
      description: page?.intro ? siteRender.refreshContactText(page.intro) : undefined,
    });
  },
);
app.get(['/admin', '/admin/', '/crm'], (_request, response) => sendPage(response, 'crm.html'));
// The old separate website panel now lives inside the CRM.
app.get('/admin/website', (request, response) => {
  const map = { content: 'news', careers: 'careers', 'site-content': 'site' };
  response.redirect(`/admin#/${map[request.query.tab] || 'news'}`);
});


// Quick check that the latest code is running: open /api/version in the browser.
const APP_VERSION = '2026-11-03 Sai v3 (talks first, form only on request)';
const STARTED_AT = new Date().toISOString();
app.get('/api/version', (_request, response) => response.json({ version: APP_VERSION, startedAt: STARTED_AT }));

// Anything not matched above: a friendly "page not found" page (JSON for API calls).
app.use((request, response) => {
  if (request.path.startsWith('/api/')) return response.status(404).json({ error: 'Not found.' });
  response.status(404);
  sendPage(response, '404.html');
});

// Last-resort error handler: log the details on the server, never show code or stack traces to visitors.
// eslint-disable-next-line no-unused-vars
app.use((error, request, response, _next) => {
  const status = error.status || error.statusCode || 500;
  if (error.type === 'entity.too.large') return response.status(413).json({ error: 'That upload is too large.' });
  if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'The request could not be read.' });
  if (error.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'That file is too large.' });
  console.error(`[error] ${request.method} ${request.path}:`, error.stack || error.message);
  if (response.headersSent) return;
  if (request.path.startsWith('/api/')) return response.status(status >= 400 && status < 500 ? status : 500).json({ error: 'Something went wrong. Please try again.' });
  response.status(500).type('text/plain').send('Something went wrong. Please try again in a moment.');
});

process.on('unhandledRejection', reason => console.error('[error] Unhandled promise rejection:', reason?.stack || reason));

if (require.main === module) {
  const server = app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log(`Sainand Chits server listening on port ${PORT} — version: ${APP_VERSION}`);
  });
  server.headersTimeout = 65 * 1000;
  server.requestTimeout = 120 * 1000;
  // Restarts (PM2 reload, deploys) finish requests in progress and close the database cleanly.
  const shutdown = signal => {
    console.log(`[shutdown] ${signal} received, closing...`);
    server.close(() => pool.end().catch(() => {}).finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;

/**
 * Checks the settings in .env. Used two ways:
 *  - at server start (prints warnings; in production, stops on settings that would be unsafe)
 *  - from the command line:  node services/config-check.js   (prints a readable report, never the secret values)
 */
const path = require('path');

function checks(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const items = [];
  const add = (level, key, message) => items.push({ level, key, message });
  const len = key => String(env[key] || '').length;
  const has = key => Boolean(String(env[key] || '').trim());

  if (!production) add('warn', 'NODE_ENV', 'Not set to "production". Secure cookies, HTTPS redirect and HSTS are off.');

  const dbUrl = env.EXTERNAL_DATABASE_URL || env.DATABASE_URL;
  if (!dbUrl && !(env.PGHOST || env.DB_HOST)) add('error', 'DATABASE_URL', 'No database connection is set.');

  if (len('SESSION_SECRET') < 32) add(production ? 'error' : 'warn', 'SESSION_SECRET', 'Must be at least 32 random characters (admin sign-ins reset on every restart without it).');

  for (const key of ['ADMIN_PASSWORD', 'SYSTEM_ADMIN_PASSWORD']) {
    if (!has(key)) continue;
    const value = String(env[key]);
    if (value.length < 12 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      add(production ? 'error' : 'warn', key, 'Must be at least 12 characters with letters and numbers.');
    }
  }

  const site = String(env.PUBLIC_SITE_URL || '');
  if (!site) add('warn', 'PUBLIC_SITE_URL', 'Not set; links in emails and the sitemap use https://sainandchits.com.');
  else if (production && !/^https:\/\//.test(site)) add('error', 'PUBLIC_SITE_URL', 'Must start with https:// in production.');
  else if (production && /localhost|127\.0\.0\.1/.test(site)) add('error', 'PUBLIC_SITE_URL', 'Still points to localhost.');

  if (!has('SMTP_HOST') || !has('SMTP_USER') || !has('SMTP_PASS')) add('warn', 'SMTP_*', 'Email is not fully set up; enquiry and OTP emails will not be sent.');
  if (production && /@(gmail|yahoo|hotmail|outlook)\./i.test(String(env.COMPANY_EMAIL || ''))) {
    add('warn', 'COMPANY_EMAIL', 'Uses a personal mailbox. A business address on your own domain looks more trustworthy.');
  }
  if (!has('COMPANY_PHONE')) add('info', 'COMPANY_PHONE', 'Not set; the number from config/site.js is used.');
  if (!has('GROQ_API_KEY')) add('info', 'GROQ_API_KEY', 'Not set; Sai chat answers from the FAQ only.');
  if (has('TURNSTILE_SITE_KEY') !== has('TURNSTILE_SECRET_KEY')) add('warn', 'TURNSTILE_*', 'Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither. Forms use the quick sum until both are set.');
  else if (!has('TURNSTILE_SITE_KEY')) add('info', 'TURNSTILE_*', 'Not set; forms use the quick sum check.');
  return { production, items };
}

function reportAtStartup() {
  const { production, items } = checks();
  for (const item of items) {
    if (item.level === 'info') continue;
    console.warn(`[config] ${item.level === 'error' ? 'PROBLEM' : 'warning'}: ${item.key} — ${item.message}`);
  }
  const errors = items.filter(item => item.level === 'error');
  if (production && errors.length && process.env.ALLOW_UNSAFE_CONFIG !== 'true') {
    console.error(`[config] Refusing to start in production with ${errors.length} unsafe setting(s). Fix .env (run: node services/config-check.js).`);
    process.exit(1);
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const { production, items } = checks();
  console.log(`\nSainand settings check (${production ? 'production' : 'development'} mode)\n`);
  if (!items.length) console.log('  ✓ Everything looks good.');
  const icon = { error: '✗ PROBLEM', warn: '! warning', info: '· note   ' };
  for (const item of items) console.log(`  ${icon[item.level]}  ${item.key}: ${item.message}`);
  const errors = items.filter(item => item.level === 'error').length;
  console.log(`\n${errors ? `${errors} problem(s) to fix before going live.` : 'No blocking problems.'}\n`);
  process.exit(errors ? 1 : 0);
}

module.exports = { checks, reportAtStartup };

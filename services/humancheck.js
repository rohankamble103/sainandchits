/**
 * Spam protection for the public website forms.
 *
 * 1. A small "quick check" puzzle (e.g. 4 + 7 = ?). The answer is never sent to the
 *    browser: the server signs a token containing only a keyed hash of the answer.
 * 2. A hidden "website" field that people never see but bots fill in.
 * 3. A minimum time between loading the puzzle and submitting (bots submit instantly).
 * Each puzzle can be used once; a wrong answer means a fresh puzzle.
 *
 * When TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set in .env, Cloudflare Turnstile
 * replaces the puzzle (most visitors see nothing at all). The hidden "website" trap stays.
 */
const crypto = require('crypto');

const MIN_FILL_MS = 2500;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const usedNonces = new Map();

// What the visitor ticked, plus which short privacy notice was shown next to the box.
// Saved with every enquiry, support request and job application as proof of consent.
const NOTICE_VERSION = 'Privacy notice v2 (Nov 2026): details used only to reply; withdraw any time via Support Center or email; complaints to the Data Protection Board of India';
const CONSENT_TEXT = `I agree that Sainand Chits India may contact me about my enquiry or request by phone, WhatsApp or email. [${NOTICE_VERSION}]`;
const APPLICATION_CONSENT_TEXT = `I agree that Sainand Chits India may use my application and CV to consider me for jobs and contact me about it. [${NOTICE_VERSION}]`;

function createHumanCheck(secret) {
  const key = crypto.createHash('sha256').update(`human-check:${secret}`).digest();
  const sign = value => crypto.createHmac('sha256', key).update(value).digest('base64url');

  setInterval(() => {
    const now = Date.now();
    for (const [nonce, expires] of usedNonces) if (expires < now) usedNonces.delete(nonce);
  }, 10 * 60 * 1000).unref();

  function newChallenge() {
    const a = crypto.randomInt(1, 10);
    const b = crypto.randomInt(1, 10);
    const nonce = crypto.randomBytes(9).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ n: nonce, t: Date.now(), h: sign(`${nonce}:${a + b}`) })).toString('base64url');
    return { token: `${payload}.${sign(payload)}`, question: `${a} + ${b}` };
  }

  /** Cloudflare Turnstile check (used instead of the sum when keys are set). */
  async function verifyTurnstile(body, ip) {
    const token = String(body?.['cf-turnstile-response'] || body?.turnstileToken || '').trim();
    if (!token) return { ok: false, error: 'Please wait a moment for the security check to finish, then send again.' };
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip || undefined }),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json();
      if (result.success) return { ok: true };
      console.warn('[security] Turnstile rejected a form:', (result['error-codes'] || []).join(', ') || 'no reason given');
      return { ok: false, error: 'The security check did not pass. Please try again.' };
    } catch (error) {
      // If Cloudflare can't be reached, don't turn real customers away; the bot trap and rate limits still apply.
      console.error('[security] Turnstile could not be reached:', error.message);
      return { ok: true, unverified: true };
    }
  }

  /** Returns { ok: true } | { ok: false, bot: true } | { ok: false, error } */
  async function verify(body, ip) {
    if (String(body?.website || '').trim()) return { ok: false, bot: true };
    if (turnstileEnabled()) return verifyTurnstile(body, ip);
    const [payload, signature] = String(body?.challengeToken || '').split('.');
    if (!payload || !signature || sign(payload) !== signature) {
      return { ok: false, error: 'Please answer the quick check question.' };
    }
    let data;
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, error: 'Please answer the quick check question.' }; }
    const age = Date.now() - Number(data.t);
    if (!(age >= 0) || age > MAX_AGE_MS) return { ok: false, error: 'The quick check expired. Please answer the new question.' };
    if (usedNonces.has(data.n)) return { ok: false, error: 'Please answer the new quick check question.' };
    usedNonces.set(data.n, Date.now() + MAX_AGE_MS);
    if (age < MIN_FILL_MS) return { ok: false, bot: true };
    const answer = String(body?.challengeAnswer ?? '').trim();
    if (!/^\d{1,2}$/.test(answer) || sign(`${data.n}:${Number(answer)}`) !== data.h) {
      return { ok: false, error: 'The quick check answer is not right. Please try the new question.' };
    }
    return { ok: true };
  }

  return { newChallenge, verify };
}

function turnstileEnabled() {
  return Boolean(String(process.env.TURNSTILE_SITE_KEY || '').trim() && String(process.env.TURNSTILE_SECRET_KEY || '').trim());
}

function hasConsent(body) {
  return [true, 'true', 'on', 'yes', '1', 1].includes(body?.consent);
}

module.exports = { createHumanCheck, hasConsent, turnstileEnabled, CONSENT_TEXT, APPLICATION_CONSENT_TEXT };

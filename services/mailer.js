/**
 * Sainand Chits India - Email Service
 * Handles candidate confirmation emails and internal team notifications.
 * Supports SMTP (Gmail, SendGrid, custom SMTP) configured via environment variables.
 * Gracefully logs and succeeds if credentials are not yet configured in .env.
 */

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  // nodemailer will be available after npm install
  nodemailer = null;
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass || !nodemailer) {
    return null;
  }

  // Keep one pooled connection open and reuse it, instead of logging in to the mail server for every email.
  const key = [host, port, secure, user, pass].join('|');
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;
  if (cachedTransporter) cachedTransporter.close();
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}
let cachedTransporter = null;
let cachedTransporterKey = '';

/**
 * Candidate Welcome / Acknowledgment Email Template
 */
function buildCandidateEmailHtml(app) {
  const fullName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Applicant';
  const firstName = fullName.split(/\s+/)[0];
  const location = [app.city, app.state].filter(Boolean).join(', ');
  return emailShell('Application received', `
    ${emailParts.heading({
      greeting: `Dear ${firstName},`,
      title: 'Thank you for applying',
      intro: `We have received your application and CV for a role at ${escapeEmailHtml(brandName())}. Our hiring team will review it carefully.`,
    })}
    ${emailParts.details('Application details', [
      ['Position', app.position_name || 'General application'],
      ['Name', fullName],
      ['Mobile', formatMobile(app.phone)],
      location && ['Location', location],
    ])}
    ${emailParts.para('If your experience matches a current or upcoming opening, a member of our team will contact you to arrange an interview.')}
    ${emailParts.signoff('Hiring Team, ' + brandName())}
  `, { label: 'Careers' });
}

function buildAdminEmailHtml(app, originUrl) {
  const fullName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Applicant';
  const resumeLink = app.resume_url ? `${originUrl || ''}${app.resume_url}` : '';
  return emailShell('New job application', `
    ${emailParts.heading({ title: `New application: ${fullName}`, intro: `For the ${escapeEmailHtml(app.position_name || 'general')} role.` })}
    ${emailParts.details('', [
      ['Position', app.position_name || 'General application'],
      ['Name', fullName],
      ['Mobile', formatMobile(app.phone)],
      ['Email', app.email || '—'],
      ['Location', [app.city, app.state, app.pincode].filter(Boolean).join(', ') || '—'],
      app.experience && ['Experience', String(app.experience)],
      app.cover_letter && ['Note', String(app.cover_letter).slice(0, 600), { long: true }],
    ])}
    ${resumeLink ? emailParts.button(resumeLink, 'Open CV (sign-in needed)') : ''}
  `, { label: 'Careers' });
}

/**
 * Main function to dispatch both emails
 */
async function sendJobApplicationEmails(application, originUrl = '') {
  const transporter = getTransporter();
  const candidateEmail = application.email;
  // First setting that holds a real email address (a login name without "@" is skipped).
  const adminRecipient = [process.env.CAREERS_NOTIFICATION_EMAIL, process.env.NOTIFICATION_EMAIL, process.env.LEADS_NOTIFICATION_EMAIL, process.env.COMPANY_EMAIL, process.env.SMTP_USER, companyDetails().email]
    .map(value => String(value || '').trim()).find(value => value.includes('@')) || 'support@sainandchits.com';
  const fromAddress = process.env.SMTP_FROM || `"Sainand Chits Careers" <${process.env.SMTP_USER || 'support@sainandchits.com'}>`;

  if (!transporter) {
    console.log(
      `[Mailer Info] SMTP credentials not configured yet in .env. Application for ${application.first_name} ${application.last_name} (${application.position_name}) saved successfully in PostgreSQL. Once SMTP_USER and SMTP_PASS are set, automatic emails will dispatch to ${candidateEmail} and ${adminRecipient}.`,
    );
    return { sent: false, reason: 'unconfigured' };
  }

  const results = { candidateSent: false, adminSent: false };

  // 1. Send Welcome Email to Applicant
  try {
    await sendWithLogo(transporter, {
      from: fromAddress,
      to: candidateEmail,
      subject: `Application received · ${application.position_name || 'Careers'}`,
      html: buildCandidateEmailHtml(application),
    });
    results.candidateSent = true;
    console.log(`[Mailer] Candidate confirmation email sent successfully to ${candidateEmail}`);
  } catch (err) {
    console.error(`[Mailer Error] Failed to send email to applicant (${candidateEmail}):`, err.message);
  }

  // 2. Send Alert Email to Admin
  try {
    await sendWithLogo(transporter, {
      from: fromAddress,
      to: adminRecipient,
      subject: `New application: ${application.first_name} ${application.last_name} · ${application.position_name || 'General application'}`,
      html: buildAdminEmailHtml(application, originUrl),
    });
    results.adminSent = true;
    console.log(`[Mailer] Admin notification email sent successfully to ${adminRecipient}`);
  } catch (err) {
    console.error(`[Mailer Error] Failed to send notification to admin (${adminRecipient}):`, err.message);
  }

  return results;
}

/**
 * Admin Security OTP Email Template (Password Reset, Email Verification, 2FA)
 */
function buildAdminOtpEmailHtml({ username, otpCode, purpose, expiresMinutes = 15 }) {
  const purposes = {
    forgot_password: ['Password reset code', 'Use this code to reset the password for your Sainand Chits admin account.'],
    verify_email: ['Verify your email', 'Use this code to confirm this email address for your Sainand Chits admin account.'],
    login_2fa: ['Your sign-in code', 'Use this code to finish signing in to the Sainand Chits admin panel.'],
  };
  const [title, intro] = purposes[purpose] || ['Your verification code', 'Use this code to verify your Sainand Chits admin account.'];
  return emailShell(title, `
    ${emailParts.heading({ greeting: `Hello ${username || 'there'},`, title, intro: escapeEmailHtml(intro) })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td style="background:#faf7f6;border:1px solid #efe5e3;border-radius:12px;padding:22px 16px;text-align:center;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;color:${RED};text-transform:uppercase;">One-time code</div>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:${INK};font-family:Consolas,'Courier New',monospace;margin:8px 0 6px;padding-left:8px;">${escapeEmailHtml(otpCode)}</div>
      <div style="font-size:12.5px;color:${MUTED};">Valid for ${Number(expiresMinutes) || 15} minutes</div>
    </td></tr></table>
    ${emailParts.notice('<strong>Never share this code.</strong> Nobody from Sainand Chits will ever ask you for it. If you did not request it, you can ignore this email; your account is safe.', 'warn')}
    ${emailParts.signoff('Sainand Chits Security')}
  `, { label: 'Admin security' });
}

/**
 * Dispatch Admin Security OTP Email
 */
async function sendAdminOtpEmail({ email, username, otpCode, purpose, expiresMinutes = 15 }) {
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || `"Sainand Chits Security" <${process.env.SMTP_USER || 'support@sainandchits.com'}>`;

  let subject = `Sainand Chits Admin Verification Code: ${otpCode}`;
  if (purpose === 'forgot_password') subject = `Password Reset Code for Sainand Chits Admin: ${otpCode}`;
  if (purpose === 'verify_email') subject = `Verify Admin Email Address - Sainand Chits: ${otpCode}`;
  if (purpose === 'login_2fa') subject = `Two-Factor Login Code for Sainand Chits: ${otpCode}`;

  if (!transporter) {
    console.log(
      `\n======================================================\n[Admin Security Mailer - Unconfigured SMTP Mode]\nDestination: ${email}\nPurpose: ${purpose}\nOTP Code: >>> ${otpCode} <<<\nValid for: ${expiresMinutes} minutes\n======================================================\n`,
    );
    return { sent: true, unconfigured: true, code: otpCode };
  }

  try {
    await sendWithLogo(transporter, {
      from: fromAddress,
      to: email,
      subject,
      html: buildAdminOtpEmailHtml({ username, otpCode, purpose, expiresMinutes }),
    });
    console.log(`[Admin Security Mailer] OTP code sent successfully to ${email} (${purpose})`);
    return { sent: true, unconfigured: false };
  } catch (err) {
    console.error(`[Admin Security Mailer Error] Failed to send OTP to ${email}:`, err.message);
    // In development or if SMTP fails, return fallback info so user is not stuck
    return { sent: false, error: err.message, code: otpCode };
  }
}

/* ==========================================================================
   Customer enquiries & CRM emails
   ========================================================================== */

function escapeEmailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && nodemailer);
}

function companyDetails() {
  return {
    name: process.env.COMPANY_NAME || 'Sainand Chits India Pvt. Ltd.',
    phone: process.env.COMPANY_PHONE || require('./site-render').loadSite().phone,
    email: process.env.COMPANY_EMAIL || 'support@sainandchits.com',
    website: process.env.PUBLIC_SITE_URL || 'https://sainandchits.com',
  };
}

/* ==========================================================================
   Shared email design (all emails): logo header, content, optional trust strip and
   safety note for customers, and a quiet footer. Built with tables and inline styles
   so it looks the same in Gmail, Outlook, Apple Mail and phone mail apps.
   ========================================================================== */
const RED = '#9e1418';
const INK = '#1f1a19';
const MUTED = '#7a706e';
const LINE = '#f1ecea';
const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";
const LOGO_CID = 'sainand-logo';
const LOGO_PATH = require('path').join(__dirname, '..', 'images', 'email-logo.png');
const MARK_CID = 'sainand-mark';
const MARK_PATH = require('path').join(__dirname, '..', 'images', 'email-mark.png');

function siteConfig() {
  return require('./site-render').loadSite();
}

/** 9822001144 → +91 98220 01144 (other formats are left as typed). */
function formatMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : String(phone || '');
}

/** "rohan" or "ROHAN" → "Rohan" (customers often type names in small letters). */
function properName(name) {
  const text = String(name || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text;
}

function brandName(company = companyDetails()) {
  return company.name.replace(/\s+Pvt\.?\s*Ltd\.?$/i, '');
}

const emailParts = {
  /** Small red label above a block, e.g. "ENQUIRY DETAILS". */
  label: text => `<div style="font-size:11px;font-weight:700;letter-spacing:1.4px;color:${RED};text-transform:uppercase;margin:0 0 6px;">${escapeEmailHtml(text)}</div>`,

  /** Greeting line, bold title and an intro paragraph. */
  heading: ({ greeting = '', title, intro = '' }) => `
      ${greeting ? `<div style="font-size:14px;color:${MUTED};margin:0 0 6px;">${escapeEmailHtml(greeting)}</div>` : ''}
      <div style="font-size:21px;line-height:1.3;font-weight:700;color:${INK};margin:0 0 10px;">${escapeEmailHtml(title)}</div>
      ${intro ? `<div style="font-size:14.5px;line-height:1.65;color:#5b5150;margin:0;">${intro}</div>` : ''}`,

  /** Two-column details table: [[label, value(html allowed via {html:true})], ...] */
  details: (title, rows) => `
      <div style="margin:24px 0 0;">${title ? emailParts.label(title) : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        ${rows.filter(Boolean).map(([key, value, opts = {}], index, list) => `
        <tr>
          <td style="padding:11px 12px 11px 0;color:${MUTED};vertical-align:top;width:42%;${index < list.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">${escapeEmailHtml(key)}</td>
          <td style="padding:11px 0;color:${INK};${opts.long ? 'font-weight:400;text-align:left;' : 'font-weight:600;text-align:right;'}vertical-align:top;${index < list.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">${opts.html ? value : escapeEmailHtml(value)}</td>
        </tr>`).join('')}
      </table></div>`,

  /** Bulleted list with red dots. */
  bullets: (title, items) => `
      <div style="margin:22px 0 0;">${emailParts.label(title)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;color:#3d3534;">
        ${items.map(item => `<tr><td style="padding:3px 10px 3px 0;color:${RED};vertical-align:top;font-size:12px;">&#9679;</td><td style="padding:3px 0;">${escapeEmailHtml(item)}</td></tr>`).join('')}
      </table></div>`,

  /** Plain paragraph. */
  para: html => `<p style="margin:16px 0 0;font-size:14.5px;line-height:1.65;color:#5b5150;">${html}</p>`,

  /** Main button (team emails only). */
  button: (href, text) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td style="background:${RED};border-radius:8px;"><a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:11px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;font-family:${FONT};">${escapeEmailHtml(text)}</a></td></tr></table>`,

  /** Highlighted notice box. tone: 'warn' | 'info' */
  notice: (html, tone = 'info') => `<div style="margin:18px 0 0;padding:12px 14px;border-radius:8px;font-size:13.5px;line-height:1.55;${tone === 'warn' ? 'background:#fff4e0;color:#8a5200;' : `background:#faf7f6;color:#3d3534;border-left:3px solid ${RED};`}">${html}</div>`,

  /** Plain letter paragraph. */
  letter: html => `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#3d3534;">${html}</p>`,

  /** Box with a red side bar: title (+ reference) and simple lines. */
  summaryBox: (title, reference, lines) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;background:#faf7f6;border-left:3px solid ${RED};border-radius:6px;">
        <tr><td style="padding:12px 16px;font-size:13.5px;line-height:1.55;color:#3d3534;">
          <div style="font-weight:700;color:${INK};margin-bottom:4px;">${escapeEmailHtml(title)}${reference ? ` &nbsp;<span style="font-weight:600;color:${RED};">· ${escapeEmailHtml(reference)}</span>` : ''}</div>
          ${lines.filter(Boolean).map(([key, value]) => `${escapeEmailHtml(key)}: ${escapeEmailHtml(value)}`).join('<br>')}
        </td></tr>
      </table>`,

  signoff: (team = '') => `<p style="margin:4px 0 0;font-size:14px;line-height:1.6;color:#5b5150;">Warm regards,<br><strong style="color:${INK};">${escapeEmailHtml(team || `Team ${brandName()}`)}</strong></p>`,
};

/**
 * @param {string} title      used for the email's <title>
 * @param {string} innerHtml  the body (use emailParts helpers)
 * @param {object} options    { customer: true } adds the one-line safety note to the footer
 */
function emailShell(title, innerHtml, { customer = false } = {}) {
  const company = companyDetails();
  const site = siteConfig();
  const website = company.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const registration = [`Registered under the ${site.registeredUnder || 'Chit Funds Act, 1982'}`, site.registrationNo ? `Reg. No. ${site.registrationNo}` : ''].filter(Boolean).join(' · ');
  const link = (href, text) => `<a href="${escapeEmailHtml(href)}" style="color:${RED};text-decoration:none;">${escapeEmailHtml(text)}</a>`;
  return withFont(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="format-detection" content="telephone=no"><title>${escapeEmailHtml(title)}</title>
<!--[if mso]><style>body,table,td,div,p,a,span,strong{font-family:'Segoe UI',Arial,sans-serif !important;}</style><![endif]--></head>
<body style="margin:0;padding:0;background:#f4f2f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f1;"><tr><td style="padding:16px 10px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ebe5e3;border-radius:12px;font-family:${FONT};color:${INK};">
    <tr><td style="background:${RED};border-radius:12px 12px 0 0;padding:16px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;padding-right:12px;"><img src="cid:${MARK_CID}" width="44" height="44" alt="" style="display:block;border:0;border-radius:10px;"></td>
        <td style="vertical-align:middle;">
          <div style="font-size:17px;font-weight:700;letter-spacing:0.2px;color:#ffffff;">${escapeEmailHtml(company.name)}</div>
          <div style="font-size:12.5px;color:#f6d9d6;margin-top:2px;">Trusted Bhisi &amp; chit fund savings · ${escapeEmailHtml(String(site.city || 'Nagpur').split(',')[0])}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:22px 24px 22px;font-size:14.5px;line-height:1.6;color:#3d3534;">${innerHtml}</td></tr>
    <tr><td style="background:#faf8f7;border-top:1px solid ${LINE};border-radius:0 0 12px 12px;padding:12px 24px;font-size:11.5px;line-height:1.6;color:${MUTED};">
      ${customer ? `&#128274; We never ask for your OTP, PIN or password.<br>` : ''}${escapeEmailHtml(company.name)} · ${escapeEmailHtml(registration)}<br>
      ${link(`mailto:${company.email}`, company.email)} · ${link(company.website, website)}
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`);
}

/** Puts the same font on every piece of text, so Outlook and phone apps don't switch to their own default font. */
function withFont(html) {
  return html.replace(/<(p|td|div|span|a|strong|b|li|h[1-6])(\s[^>]*)?>/gi, (tag, name, attrs = '') => {
    if (/font-family/i.test(attrs)) return tag;
    if (/\sstyle="/i.test(attrs)) return `<${name}${attrs.replace(/\sstyle="/i, ` style="font-family:${FONT.replace(/"/g, "'")};`)}>`;
    return `<${name}${attrs} style="font-family:${FONT.replace(/"/g, "'")};">`;
  });
}

/** Sends an email, attaching the logo when the email uses it (shows without "load images" prompts). */
function sendWithLogo(transporter, mail) {
  const html = String(mail.html || '');
  const images = [];
  if (html.includes(`cid:${LOGO_CID}`)) images.push({ filename: 'sainand-logo.png', path: LOGO_PATH, cid: LOGO_CID });
  if (html.includes(`cid:${MARK_CID}`)) images.push({ filename: 'sainand.png', path: MARK_PATH, cid: MARK_CID });
  if (images.length) mail.attachments = [...(mail.attachments || []), ...images];
  return transporter.sendMail(mail);
}

function fromAddress(label) {
  return process.env.SMTP_FROM || `"${label}" <${process.env.SMTP_USER || 'support@sainandchits.com'}>`;
}

/**
 * Thank-you email to the customer + alert to the team when someone enquires.
 * Never throws; returns { customerSent, teamSent, reason? }.
 */
async function sendEnquiryEmails(enquiry, { crmUrl = '', isRepeat = false, assignedTo = null, managerEmails = [], skipThankYou = false, teamAlert = true } = {}) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[Mailer Info] SMTP not configured. Enquiry from ${enquiry.name} saved; thank-you email not sent.`);
    return { customerSent: false, teamSent: false, reason: 'unconfigured' };
  }
  const company = companyDetails();
  const firstName = properName(String(enquiry.name || 'there').trim().split(/\s+/)[0]);
  const results = { customerSent: false, teamSent: false };

  const reference = enquiry.id ? `ENQ-${enquiry.id}` : '';
  const shortMessage = String(enquiry.message || '').replace(/\s+/g, ' ').trim();
  const customerHtml = emailShell('Enquiry confirmation', `
    ${emailParts.letter(`Dear ${escapeEmailHtml(firstName)},`)}
    ${emailParts.letter(`Thank you for your interest in ${escapeEmailHtml(brandName(company))}. We have received your enquiry, and one of our team members will call you on <strong style="color:${INK};white-space:nowrap;">${escapeEmailHtml(formatMobile(enquiry.phone))}</strong>, usually within one working day.`)}
    ${emailParts.summaryBox('Your enquiry', reference, [
      ['Plan', enquiry.plan || 'To be discussed on the call'],
      shortMessage && ['Message', shortMessage.length > 240 ? `${shortMessage.slice(0, 237)}…` : shortMessage],
    ])}
    ${emailParts.letter('On the call, our team will explain the plan, the monthly instalment and the bidding process, and answer any questions you have.')}
    ${emailParts.signoff()}
  `, { customer: true });

  if (enquiry.email && !skipThankYou) {
    try {
      await sendWithLogo(transporter, {
        from: fromAddress(brandName(company)),
        to: enquiry.email,
        replyTo: company.email,
        subject: `Thank you for your enquiry${reference ? ` · ${reference}` : ''}`,
        html: customerHtml,
        text: `Dear ${firstName},\n\nThank you for considering ${brandName(company)}. We have received your enquiry, and a member of our team will call you on ${formatMobile(enquiry.phone)}, usually within one working day.\n\n${reference ? `Reference: ${reference}\n` : ''}Plan: ${enquiry.plan || 'To be discussed on the call'}\n\nOn the call, we will cover how the Bhisi plan works, your monthly instalment and the bidding (Boli), and the documents needed to join.\n\nFor your safety: we will never ask for your OTP, PIN or password.\n\nWarm regards,\nTeam ${brandName(company)}`,
      });
      results.customerSent = true;
    } catch (err) {
      console.error(`[Mailer Error] Thank-you email to ${enquiry.email} failed:`, err.message);
    }
  }

  const teamRecipients = [process.env.LEADS_NOTIFICATION_EMAIL || process.env.NOTIFICATION_EMAIL || company.email, assignedTo?.email, ...managerEmails]
    .filter(Boolean)
    .filter((address, index, list) => list.findIndex(other => other.toLowerCase() === address.toLowerCase()) === index);
  const teamRecipient = teamRecipients.join(', ');
  if (teamRecipient && teamAlert) {
    const teamHtml = emailShell(isRepeat ? 'Repeat enquiry' : 'New enquiry', `
      ${emailParts.heading({
        title: isRepeat ? `Repeat enquiry: ${enquiry.name}` : `New enquiry: ${enquiry.name}`,
        intro: isRepeat ? 'This customer has enquired before. Their history is in the CRM.' : 'A new enquiry has come in from the website.',
      })}
      ${emailParts.details('', [
        enquiry.id && ['Reference', `ENQ-${enquiry.id}`],
        ['Name', enquiry.name],
        ['Mobile', `<a href="tel:${escapeEmailHtml(String(enquiry.phone).replace(/\s/g, ''))}" style="color:${RED};text-decoration:none;">${escapeEmailHtml(formatMobile(enquiry.phone))}</a>`, { html: true }],
        ['Email', enquiry.email || '—'],
        ['Plan', enquiry.plan || 'Not specified'],
        ['Message', enquiry.message || '—', { long: true }],
        ['Assigned to', assignedTo?.name || 'Nobody yet'],
      ])}
      ${assignedTo ? '' : emailParts.notice('<strong>No sales agent was available to take this enquiry.</strong> Please open it in the CRM and assign it, or mark an agent as “Gets new leads” on the Team page.', 'warn')}
      ${crmUrl ? emailParts.button(crmUrl, 'Open in CRM') : ''}
    `);
    try {
      await sendWithLogo(transporter, {
        from: fromAddress('Sainand Website'),
        to: teamRecipient,
        replyTo: enquiry.email || undefined,
        subject: `${assignedTo ? '' : '⚠ Unassigned — '}${isRepeat ? 'Repeat' : 'New'} enquiry: ${enquiry.name} · ${enquiry.plan || 'Plan not specified'}${assignedTo ? ` → ${assignedTo.name}` : ''}`,
        html: teamHtml,
      });
      results.teamSent = true;
    } catch (err) {
      console.error('[Mailer Error] Team enquiry alert failed:', err.message);
    }
  }
  return results;
}

/** Email written by a team member inside the CRM. Plain text is converted safely to HTML. */
async function sendCustomerEmail({ to, customerName, subject, message, senderName, replyTo }) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'unconfigured' };
  const company = companyDetails();
  const paragraphs = String(message)
    .split(/\n{2,}/)
    .map(block => `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#3d3534;">${escapeEmailHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const html = emailShell(subject, `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#3d3534;">Dear ${escapeEmailHtml(String(customerName || '').trim().split(/\s+/)[0] || 'Sir/Madam')},</p>${paragraphs}
    <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#5b5150;">Regards,<br><strong style="color:${INK};">${escapeEmailHtml(senderName)}</strong><br><span style="color:${MUTED};">${escapeEmailHtml(company.name)}</span></p>`, { customer: true, label: brandName(company) });
  try {
    const info = await sendWithLogo(transporter, {
      from: process.env.SMTP_FROM ? process.env.SMTP_FROM : `"${String(senderName).replace(/"/g, '')} · Sainand Chits" <${process.env.SMTP_USER}>`,
      to,
      replyTo: replyTo || company.email,
      subject,
      html,
      text: `${message}\n\nRegards,\n${senderName}\n${company.name}`,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer Error] CRM email to ${to} (${customerName}) failed:`, err.message);
    return { sent: false, reason: 'failed' };
  }
}

/** Generic branded email (used by the daily follow-up digest). */
async function sendBrandedEmail({ to, subject, title, innerHtml, text, customer = false, label = '' }) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'unconfigured' };
  try {
    const company = companyDetails();
    await sendWithLogo(transporter, {
      from: fromAddress(customer ? brandName(company) : 'Sainand CRM'),
      to,
      replyTo: customer ? company.email : undefined,
      subject,
      html: emailShell(title || subject, innerHtml, { customer, label }),
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[Mailer Error] ${subject} to ${to} failed:`, err.message);
    return { sent: false, reason: 'failed' };
  }
}

module.exports = {
  companyDetails,
  emailParts,
  formatMobile,
  properName,
  brandName,
  sendBrandedEmail,
  escapeEmailHtml,
  sendJobApplicationEmails,
  sendAdminOtpEmail,
  sendEnquiryEmails,
  sendCustomerEmail,
  isEmailConfigured,
};


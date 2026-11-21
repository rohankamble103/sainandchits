/**
 * Daily follow-up email (9:30 AM India time, Monday–Saturday).
 * - Every active team member: their overdue + today's follow-ups and new leads waiting for a first call.
 * - Owner and managers: also yesterday's summary for the whole team.
 * Runs once per day even with several servers: the date is claimed in crm_settings first.
 */
const { getSettings } = require('./crm');

const IST = 'Asia/Kolkata';
const istDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: IST });
const istTime = d => new Date(d).toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function createDigest({ pool, mailer, baseUrl }) {
  const e = mailer.escapeEmailHtml;
  const link = path => `${baseUrl().replace(/\/$/, '')}/admin#${path}`;

  async function gather(member) {
    const me = member.username.toLowerCase();
    const endOfToday = "(date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'";
    const [tasks, fresh] = await Promise.all([
      pool.query(
        `SELECT t.title, t.notes, t.due_at, c.id, c.name, c.phone, c.plan
         FROM crm_tasks t JOIN crm_contacts c ON c.id = t.contact_id
         WHERE t.status = 'open' AND LOWER(t.assignee) = $1 AND t.due_at < ${endOfToday}
         ORDER BY t.due_at ASC LIMIT 60`,
        [me],
      ),
      pool.query(
        `SELECT id, name, phone, plan, created_at FROM crm_contacts
         WHERE LOWER(owner) = $1 AND stage = 'new' AND last_contacted_at IS NULL
         ORDER BY created_at ASC LIMIT 40`,
        [me],
      ),
    ]);
    const now = Date.now();
    return {
      overdue: tasks.rows.filter(t => new Date(t.due_at).getTime() < now),
      today: tasks.rows.filter(t => new Date(t.due_at).getTime() >= now),
      fresh: fresh.rows,
    };
  }

  async function teamSummary() {
    const y = "date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'";
    const [leads, acts, perPerson, waiting] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM crm_contacts WHERE created_at >= ${y} - INTERVAL '1 day' AND created_at < ${y}`),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE type = 'call')::int AS calls,
                COUNT(*) FILTER (WHERE type = 'stage_change' AND meta->>'to' = 'converted')::int AS converted,
                COUNT(*) FILTER (WHERE type = 'stage_change' AND meta->>'to' = 'not_interested')::int AS lost
         FROM crm_activities WHERE created_at >= ${y} - INTERVAL '1 day' AND created_at < ${y}`,
      ),
      pool.query(
        `SELECT s.display_name AS name,
           (SELECT COUNT(*) FROM crm_activities a WHERE LOWER(a.created_by) = LOWER(s.username) AND a.type = 'call' AND a.created_at >= ${y} - INTERVAL '1 day' AND a.created_at < ${y})::int AS calls,
           (SELECT COUNT(*) FROM crm_tasks t WHERE LOWER(t.assignee) = LOWER(s.username) AND t.status = 'open' AND t.due_at < NOW())::int AS overdue
         FROM admin_security s WHERE COALESCE(s.is_active, TRUE) AND s.role <> 'systemadmin' ORDER BY s.display_name`,
      ),
      pool.query("SELECT COUNT(*) FILTER (WHERE owner = '')::int AS unassigned, COUNT(*) FILTER (WHERE stage = 'new' AND last_contacted_at IS NULL)::int AS uncalled FROM crm_contacts WHERE stage IN ('new','contacted','interested')"),
    ]);
    return { leads: leads.rows[0].n, ...acts.rows[0], people: perPerson.rows, ...waiting.rows[0] };
  }

  // Same look as every other Sainand email (services/mailer.js emailParts).
  const C = { red: '#9e1418', ink: '#1f1a19', muted: '#7a706e', line: '#f1ecea', green: '#1d7a46' };
  function personRow(name, href, sub, phone, right) {
    return `<tr>
      <td style="padding:11px 12px 11px 0;border-bottom:1px solid ${C.line};vertical-align:top;font-size:14px;"><a href="${e(href)}" style="color:${C.ink};font-weight:600;text-decoration:none;">${e(name)}</a><br><span style="color:${C.muted};font-size:12.5px;">${sub}</span></td>
      <td style="padding:11px 0;border-bottom:1px solid ${C.line};text-align:right;vertical-align:top;white-space:nowrap;font-size:14px;"><a href="tel:${e(String(phone || '').replace(/\s/g, ''))}" style="color:${C.red};text-decoration:none;font-weight:600;">${e(mailer.formatMobile(phone))}</a>${right ? `<br><span style="color:${C.muted};font-size:12.5px;">${right}</span>` : ''}</td>
    </tr>`;
  }
  function taskRows(list) {
    return list.map(t => personRow(t.name, link(`/customers/${t.id}`), `${e(t.title)}${t.notes ? ` · ${e(t.notes)}` : ''}`, t.phone, e(istTime(t.due_at)))).join('');
  }

  function section(title, inner) {
    return `<div style="margin:26px 0 0;">${mailer.emailParts.label(title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${inner}</table></div>`;
  }

  async function buildFor(member, summary) {
    const data = await gather(member);
    const isManager = ['superadmin', 'systemadmin'].includes(member.role);
    const nothing = !data.overdue.length && !data.today.length && !data.fresh.length;
    if (nothing && !isManager) return null;
    const first = String(member.display_name || member.username).split(' ')[0];
    let html = mailer.emailParts.heading({
      greeting: `Good morning, ${first}`,
      title: nothing ? 'No follow-ups due today' : 'Your follow-ups for today',
      intro: nothing ? 'You have nothing due today. Here is how the team did yesterday.' : `<strong>${data.overdue.length}</strong> overdue · <strong>${data.today.length}</strong> due today · <strong>${data.fresh.length}</strong> new lead${data.fresh.length === 1 ? '' : 's'} waiting for a first call`,
    });
    if (data.overdue.length) html += section(`Overdue (${data.overdue.length})`, taskRows(data.overdue));
    if (data.today.length) html += section(`Due today (${data.today.length})`, taskRows(data.today));
    if (data.fresh.length) {
      html += section(`New leads not called yet (${data.fresh.length})`, data.fresh.map(c => personRow(c.name, link(`/customers/${c.id}`), `${e(c.plan || 'Plan not specified')} · received ${e(istTime(c.created_at))}`, c.phone, '')).join(''));
    }
    if (isManager && summary) {
      html += mailer.emailParts.details('Yesterday for the whole team', [
        ['New leads', String(summary.leads)],
        ['Calls logged', String(summary.calls)],
        ['Converted', String(summary.converted)],
        ['Not interested', String(summary.lost)],
        ['Waiting: not called yet', String(summary.uncalled)],
        ['Waiting: unassigned', String(summary.unassigned)],
      ]);
      html += section('By team member', `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:12.5px;">Team member</td><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:12.5px;text-align:right;">Calls yesterday</td><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:12.5px;text-align:right;">Overdue now</td></tr>
        ${summary.people.map(p => `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};">${e(p.name)}</td><td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;text-align:right;">${p.calls}</td><td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;text-align:right;${p.overdue ? `color:${C.red};font-weight:700;` : ''}">${p.overdue}</td></tr>`).join('')}`);
    }
    html += mailer.emailParts.button(link('/followups'), 'Open my follow-ups');
    const subject = nothing
      ? 'Your Sainand CRM summary for today'
      : `Today: ${data.overdue.length ? `${data.overdue.length} overdue, ` : ''}${data.today.length} follow-up${data.today.length === 1 ? '' : 's'}, ${data.fresh.length} new lead${data.fresh.length === 1 ? '' : 's'}`;
    return { subject, html };
  }

  async function members(onlyUsername) {
    const result = await pool.query(
      `SELECT username, display_name, role, email FROM admin_security
       WHERE COALESCE(is_active, TRUE) AND email <> '' ${onlyUsername ? 'AND LOWER(username) = LOWER($1)' : "AND role <> 'systemadmin'"}`,
      onlyUsername ? [onlyUsername] : [],
    );
    return result.rows;
  }

  async function sendTo(member, summary) {
    const built = await buildFor(member, summary);
    if (!built) return { skipped: true };
    return mailer.sendBrandedEmail({ to: member.email, subject: built.subject, title: 'Your follow-ups today', label: 'Daily summary', innerHtml: built.html });
  }

  /** Send to everyone, once per day. Returns a short report. */
  async function runDaily({ force = false } = {}) {
    const settings = await getSettings(pool);
    // The daily email is off unless DAILY_DIGEST=on is set in .env (the dashboard and bell cover today's work).
    if (!force && String(process.env.DAILY_DIGEST || '').toLowerCase() !== 'on') return { skipped: 'turned off' };
    const today = istDate();
    if (!force) {
      const weekday = new Date().toLocaleDateString('en-US', { timeZone: IST, weekday: 'short' });
      if (weekday === 'Sun') return { skipped: 'Sunday' };
      const claim = await pool.query(
        `INSERT INTO crm_settings (key, value, updated_by) VALUES ('digest_last_sent', $1::jsonb, 'scheduler')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
         WHERE crm_settings.value->>'date' IS DISTINCT FROM $2
         RETURNING key`,
        [JSON.stringify({ date: today }), today],
      );
      if (!claim.rowCount) return { skipped: 'already sent today' };
    }
    if (!mailer.isEmailConfigured()) return { skipped: 'email not configured' };
    const summary = await teamSummary();
    let sent = 0;
    for (const member of await members()) {
      const result = await sendTo(member, summary).catch(() => ({}));
      if (result.sent) sent += 1;
    }
    console.log(`[Digest] Daily follow-up emails sent: ${sent}`);
    return { sent };
  }

  async function sendTest(username) {
    const [member] = await members(username);
    if (!member) return { sent: false, error: 'Add an email address to your account first (My account).' };
    if (!mailer.isEmailConfigured()) return { sent: false, error: 'Email is not set up on the server yet (SMTP_USER / SMTP_PASS).' };
    const built = await buildFor({ ...member, role: member.role }, await teamSummary());
    const result = await mailer.sendBrandedEmail({ to: member.email, subject: `[Test] ${built?.subject || 'Daily summary'}`, title: 'Your follow-ups today', label: 'Daily summary', innerHtml: built?.html || mailer.emailParts.heading({ title: 'No follow-ups for you today' }) });
    return result.sent ? { sent: true, email: member.email } : { sent: false, error: 'The email could not be sent.' };
  }

  /** In-process scheduler (local / Replit / any always-on server). On Vercel the cron calls /api/cron/daily-digest. */
  function startScheduler() {
    const tick = () => {
      const now = new Date();
      const hm = now.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
      if (hm >= '09:30' && hm < '12:00') runDaily().catch(err => console.error('[Digest] error:', err.message));
    };
    setTimeout(tick, 15000);
    setInterval(tick, 5 * 60 * 1000).unref();
  }

  return { runDaily, sendTest, startScheduler };
}

module.exports = { createDigest };

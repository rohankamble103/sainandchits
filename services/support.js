/**
 * Support requests ("Raise a support request" on /support-center).
 *
 * - Every request gets a number like SR-1001 and shows on the admin Support page.
 * - Plan-related topics also become a normal enquiry (source "Support request"),
 *   so sales sees them in Enquiries. It is one request shown in both places.
 * - Other topics are linked to the customer's existing enquiry record when we can
 *   match them by mobile or email, and go to that customer's staff member.
 */

const { SUPPORT_TOPICS: TOPICS } = require('./support-topics');
const TOPIC_IDS = new Set(TOPICS.map(topic => topic.id));
const STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
];
const STATUS_IDS = new Set(STATUSES.map(status => status.id));

const topicLabel = id => TOPICS.find(topic => topic.id === id)?.label || id;
const statusLabel = id => STATUSES.find(status => status.id === id)?.label || id;
const refOf = id => `SR-${1000 + Number(id)}`;
const idFromRef = value => {
  const match = String(value || '').trim().match(/^(?:SR-?)?(\d+)$/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return n > 1000 ? n - 1000 : 0;
};

function text(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

async function initSupport(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_requests (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      phone_key VARCHAR(20) NOT NULL DEFAULT '',
      email VARCHAR(254) NOT NULL DEFAULT '',
      member_no VARCHAR(60) NOT NULL DEFAULT '',
      topic VARCHAR(40) NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      assigned_to VARCHAR(100) NOT NULL DEFAULT '',
      contact_id INTEGER,
      enquiry_id INTEGER,
      consent_at TIMESTAMPTZ,
      ip VARCHAR(64) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS support_requests_status_idx ON support_requests (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS support_requests_contact_idx ON support_requests (contact_id);
    CREATE TABLE IF NOT EXISTS support_request_notes (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
      author VARCHAR(100) NOT NULL DEFAULT '',
      kind VARCHAR(20) NOT NULL DEFAULT 'note',
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS support_request_notes_req_idx ON support_request_notes (request_id, created_at);
  `);
}

function requestRow(row) {
  return {
    id: row.id,
    ref: refOf(row.id),
    name: row.name,
    phone: row.phone,
    email: row.email,
    memberNo: row.member_no,
    topic: row.topic,
    topicLabel: topicLabel(row.topic),
    message: row.message,
    status: row.status,
    statusLabel: statusLabel(row.status),
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name || '',
    contactId: row.contact_id || null,
    contactName: row.contact_name || '',
    enquiryId: row.enquiry_id || null,
    alsoInEnquiries: Boolean(row.enquiry_id),
    priority: row.topic === 'complaint',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

/**
 * deps: pool, humanCheck, hasConsent, consentText, formLimiter, requireAdmin, crm (upsertContactFromEnquiry, addActivity),
 *       mailer (sendBrandedEmail, escapeEmailHtml, companyDetails), phoneKey, enquiryDedupeKey, clientIp, publicBaseUrl
 */
function registerSupportRoutes(app, deps) {
  const { pool, humanCheck, hasConsent, consentText, formLimiter, requireAdmin, crm, mailer, phoneKey, enquiryDedupeKey, clientIp, publicBaseUrl } = deps;
  const esc = mailer.escapeEmailHtml;

  async function memberInfo(username) {
    if (!username) return null;
    const row = (await pool.query(
      'SELECT username, display_name, email, COALESCE(is_active, TRUE) AS is_active FROM admin_security WHERE LOWER(username) = LOWER($1)',
      [username],
    )).rows[0];
    return row && row.is_active ? { username: row.username, name: row.display_name || row.username, email: row.email } : null;
  }

  async function adminEmails() {
    return (await pool.query(
      "SELECT email FROM admin_security WHERE role = 'superadmin' AND COALESCE(is_active, TRUE) AND email <> ''",
    ).catch(() => ({ rows: [] }))).rows.map(row => row.email);
  }

  async function addNote(requestId, author, body, kind = 'note') {
    await pool.query('INSERT INTO support_request_notes (request_id, author, kind, body) VALUES ($1, $2, $3, $4)', [requestId, author || '', kind, text(body, 4000)]);
  }

  async function loadRequest(id) {
    const row = (await pool.query(
      `SELECT r.*, (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(r.assigned_to) LIMIT 1) AS assigned_name,
              (SELECT name FROM crm_contacts c WHERE c.id = r.contact_id) AS contact_name
       FROM support_requests r WHERE r.id = $1`,
      [id],
    )).rows[0];
    return row || null;
  }

  // ---------- emails ----------
  function detailsTable(r) {
    return mailer.emailParts.details('', [
      ['Request no.', refOf(r.id)],
      ['Topic', topicLabel(r.topic)],
      ['Name', r.name],
      ['Mobile', `<a href="tel:${esc(String(r.phone || '').replace(/\s/g, ''))}" style="color:#9e1418;text-decoration:none;">${esc(mailer.formatMobile(r.phone))}</a>`, { html: true }],
      ['Email', r.email || '—'],
      ['Member / group no.', r.member_no || '—'],
      ['Message', esc(r.message || '—').replace(/\n/g, '<br>'), { html: true, long: true }],
    ]);
  }

  async function sendNewRequestEmails(r, { assignee, origin, customerOnly = false } = {}) {
    const company = mailer.companyDetails();
    const ref = refOf(r.id);
    const firstName = mailer.properName(String(r.name || 'there').trim().split(/\s+/)[0]);
    if (r.email) {
      const P = mailer.emailParts;
      const privacy = r.topic === 'privacy';
      await mailer.sendBrandedEmail({
        to: r.email,
        customer: true,
        subject: privacy ? `Your request has been received · ${ref}` : `We have received your request · ${ref}`,
        title: 'Support request received',
        label: 'Support request',
        innerHtml: `
          ${P.letter(`Dear ${esc(firstName)},`)}
          ${P.letter(privacy
            ? 'We have received your request to withdraw your consent. Our team will stop contacting you about your enquiries, and we will confirm once this is done.'
            : `Thank you for contacting ${esc(mailer.brandName(company))}. We have received your support request, and our team will get back to you, usually within one working day.`)}
          ${P.summaryBox('Your request', ref, [
            ['Topic', topicLabel(r.topic)],
            r.message && ['Message', (m => (m.length > 240 ? `${m.slice(0, 237)}…` : m))(String(r.message || '').replace(/\s+/g, ' ').trim())],
          ])}
          ${P.letter('Please keep this reference number handy when our team contacts you.')}
          ${P.signoff()}`,
        text: `Dear ${firstName},\n\n${privacy ? 'We have received your request to withdraw your consent. We will stop contacting you about your enquiries.' : 'We have received your support request. Our team will get back to you, usually within one working day.'}\n\nReference: ${ref}\nTopic: ${topicLabel(r.topic)}\n\nFor your safety: we will never ask for your OTP, PIN or password.\n\nWarm regards,\nTeam ${mailer.brandName(company)}`,
      });
    }
    if (customerOnly) return;
    const complaint = r.topic === 'complaint';
    const recipients = [assignee?.email, ...((complaint || !assignee) ? await adminEmails() : [])]
      .filter(Boolean)
      .filter((address, i, list) => list.findIndex(other => other.toLowerCase() === address.toLowerCase()) === i);
    if (!recipients.length) return;
    await mailer.sendBrandedEmail({
      to: recipients.join(', '),
      subject: `${complaint ? '⚠ Complaint' : 'Support request'} ${ref}: ${r.name} · ${topicLabel(r.topic)}${assignee ? ` → ${assignee.name}` : ' · Unassigned'}`,
      title: 'New support request',
      label: complaint ? 'Complaint' : 'Support request',
      innerHtml: `
        ${mailer.emailParts.heading({ title: `${complaint ? 'New complaint' : 'New support request'}: ${r.name}`, intro: `Reference ${esc(ref)} · ${esc(topicLabel(r.topic))}` })}
        ${detailsTable(r)}
        ${mailer.emailParts.notice(`Assigned to: <strong>${esc(assignee?.name || 'Nobody yet. Please assign it.')}</strong>${r.enquiry_id ? ' · Also added to Enquiries' : ''}`, assignee ? 'info' : 'warn')}
        ${mailer.emailParts.button(`${origin}/admin#/support/${r.id}`, 'Open request')}`,
    });
  }

  // ---------- public: raise a request ----------
  app.post('/api/support-requests', formLimiter, async (request, response) => {
    const body = request.body || {};
    const name = text(body.name, 120);
    const phone = text(body.phone, 40);
    const key = phoneKey(phone);
    const email = text(body.email, 254).toLowerCase();
    const memberNo = text(body.memberNo, 60);
    const topic = text(body.topic, 40);
    const message = text(body.message, 4000);

    if (!name || key.length < 10) return response.status(400).json({ error: 'Please enter your name and a valid mobile number.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Please enter a valid email address, or leave it empty.' });
    if (!TOPIC_IDS.has(topic)) return response.status(400).json({ error: 'Please choose what you need help with.' });
    const withdrawTopic = Boolean(TOPICS.find(item => item.id === topic)?.withdraw);
    if (message.length < 5 && !withdrawTopic) return response.status(400).json({ error: 'Please tell us a little about your request.' });
    const check = await humanCheck.verify(body, request.ip);
    if (check.bot) return response.status(201).json({ success: true, ref: 'SR-0000' });
    if (!check.ok) return response.status(400).json({ error: check.error, refreshChallenge: true });
    if (!hasConsent(body)) return response.status(400).json({ error: 'Please tick the box to agree to be contacted.', refreshChallenge: true });

    try {
      // Same request sent twice within 30 minutes: return the first one.
      const dup = (await pool.query(
        "SELECT * FROM support_requests WHERE phone_key = $1 AND topic = $2 AND message = $3 AND created_at > NOW() - INTERVAL '30 minutes' ORDER BY id DESC LIMIT 1",
        [key, topic, message],
      )).rows[0];
      if (dup) {
        // Sent twice within 30 minutes: keep one request and don't alert the team again,
        // but always send the customer their confirmation with the reference number.
        response.status(200).json({ success: true, duplicate: true, ref: refOf(dup.id) });
        if (email && !dup.email) await pool.query('UPDATE support_requests SET email = $2 WHERE id = $1', [dup.id, email]).catch(() => {});
        sendNewRequestEmails({ ...dup, email: email || dup.email }, { customerOnly: true }).catch(error => console.error('[Mailer Error] Repeat support confirmation failed:', error.message));
        return undefined;
      }

      let saved = (await pool.query(
        `INSERT INTO support_requests (name, phone, phone_key, email, member_no, topic, message, consent_at, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING *`,
        [name, phone, key, email, memberNo, topic, message, clientIp(request)],
      )).rows[0];
      const ref = refOf(saved.id);
      const topicInfo = TOPICS.find(item => item.id === topic);
      let contactId = null;
      let enquiryId = null;
      let owner = '';

      try {
        if (topicInfo.enquiry) {
          // Plan questions: also a normal enquiry, tagged as coming from Support.
          const enquiryMessage = `[Support request ${ref} · ${topicInfo.label}]${memberNo ? ` Member no: ${memberNo}.` : ''} ${message}`;
          const enquiry = (await pool.query(
            `INSERT INTO enquiries (name, phone, email, plan, message, contact_key, phone_key, dedupe_key, chat_transcript, consent_at, consent_text, ip)
             VALUES ($1, $2, $3, '', $4, $5, $6, $7, '[]'::jsonb, NOW(), $8, $9) RETURNING *`,
            [name, phone, email, enquiryMessage, email || key, key, enquiryDedupeKey(email, key, '', enquiryMessage), consentText, clientIp(request)],
          )).rows[0];
          enquiryId = enquiry.id;
          const { contact } = await crm.upsertContactFromEnquiry(enquiry, { source: 'support', subject: `Support request ${ref} · ${topicInfo.label}` });
          contactId = contact.id;
          owner = contact.owner || '';
        } else {
          // Other topics: link to the customer's record if we already know them.
          const contact = (await pool.query(
            `SELECT id, owner FROM crm_contacts WHERE (phone_key <> '' AND phone_key = $1) OR ($2 <> '' AND LOWER(email) = $2) ORDER BY (phone_key = $1) DESC, id LIMIT 1`,
            [key, email],
          )).rows[0];
          if (contact) {
            contactId = contact.id;
            owner = contact.owner || '';
            await crm.addActivity(contact.id, 'system', { subject: `Support request ${ref} · ${topicInfo.label}`, body: message });
            if (topicInfo.withdraw) await crm.setConsentWithdrawn(contact.id, true, { note: `Requested on the website (${ref})${message ? `: ${message}` : ''}` });
          }
        }
      } catch (linkError) {
        console.error('Support request link error (request still saved):', linkError.message);
      }

      const assignee = await memberInfo(owner);
      saved = (await pool.query(
        'UPDATE support_requests SET contact_id = $2, enquiry_id = $3, assigned_to = $4, updated_at = NOW() WHERE id = $1 RETURNING *',
        [saved.id, contactId, enquiryId, assignee ? assignee.username : ''],
      )).rows[0];
      await addNote(saved.id, '', `Request received from the website${assignee ? ` · assigned to ${assignee.name}` : ''}${enquiryId ? ' · also added to Enquiries' : ''}`, 'system');
      if (topicInfo.withdraw) {
        await addNote(saved.id, '', contactId
          ? 'Customer record marked “Consent withdrawn — do not contact”, and their open schedules were closed.'
          : 'No matching customer record was found by mobile or email. Check whether we hold their details anywhere else.', 'system');
      }

      response.status(201).json({ success: true, ref });
      sendNewRequestEmails(saved, { assignee, origin: publicBaseUrl(request) })
        .catch(error => console.error('Support email error (request already saved):', error.message));
    } catch (error) {
      console.error('Support request save error:', error);
      if (!response.headersSent) response.status(500).json({ error: 'We could not save your request. Please try again or call us.' });
    }
  });

  // ---------- admin ----------
  app.get('/api/crm/support', requireAdmin, async (request, response) => {
    try {
      const status = STATUS_IDS.has(request.query.status) || request.query.status === 'all' ? request.query.status : 'open';
      const mine = request.query.mine === '1';
      const q = text(request.query.q, 80).toLowerCase();
      const where = [];
      const params = [];
      if (status !== 'all') { params.push(status); where.push(`r.status = $${params.length}`); }
      if (mine) { params.push(request.session.username.toLowerCase()); where.push(`LOWER(r.assigned_to) = $${params.length}`); }
      if (q) {
        const id = idFromRef(q);
        params.push(`%${q}%`);
        where.push(`(LOWER(r.name) LIKE $${params.length} OR r.phone LIKE $${params.length} OR LOWER(r.email) LIKE $${params.length} OR LOWER(r.member_no) LIKE $${params.length}${id ? ` OR r.id = ${id}` : ''})`);
      }
      const rows = (await pool.query(
        `SELECT r.*, (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(r.assigned_to) LIMIT 1) AS assigned_name
         FROM support_requests r ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY (r.topic = 'complaint' AND r.status <> 'resolved') DESC, (r.status = 'resolved'), r.created_at DESC
         LIMIT 300`,
        params,
      )).rows;
      const countParams = mine ? [request.session.username.toLowerCase()] : [];
      const counts = (await pool.query(
        `SELECT status, COUNT(*)::int AS n FROM support_requests ${mine ? 'WHERE LOWER(assigned_to) = $1' : ''} GROUP BY status`,
        countParams,
      )).rows.reduce((acc, row) => ({ ...acc, [row.status]: row.n }), {});
      response.json({
        requests: rows.map(requestRow),
        counts: { open: counts.open || 0, in_progress: counts.in_progress || 0, resolved: counts.resolved || 0, all: (counts.open || 0) + (counts.in_progress || 0) + (counts.resolved || 0) },
        topics: TOPICS,
        statuses: STATUSES,
      });
    } catch (error) {
      console.error('Support list error:', error);
      response.status(500).json({ error: 'Could not load support requests.' });
    }
  });

  app.get('/api/crm/support/count', requireAdmin, async (_request, response) => {
    const row = (await pool.query("SELECT COUNT(*)::int AS n FROM support_requests WHERE status <> 'resolved'").catch(() => ({ rows: [{ n: 0 }] }))).rows[0];
    response.json({ open: row.n });
  });

  app.get('/api/crm/support/:id', requireAdmin, async (request, response) => {
    const row = await loadRequest(Number(request.params.id));
    if (!row) return response.status(404).json({ error: 'Support request not found.' });
    const notes = (await pool.query(
      `SELECT n.*, (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(n.author) LIMIT 1) AS author_name
       FROM support_request_notes n WHERE n.request_id = $1 ORDER BY n.created_at DESC, n.id DESC`,
      [row.id],
    )).rows.map(note => ({ id: note.id, kind: note.kind, body: note.body, author: note.author, authorName: note.author_name || note.author, createdAt: note.created_at }));
    response.json({ request: requestRow(row), notes, topics: TOPICS, statuses: STATUSES });
  });

  app.patch('/api/crm/support/:id', requireAdmin, async (request, response) => {
    const id = Number(request.params.id);
    const row = await loadRequest(id);
    if (!row) return response.status(404).json({ error: 'Support request not found.' });
    const me = request.session;
    const myName = me.displayName || me.username;
    const changes = [];
    try {
      if (request.body.status !== undefined && request.body.status !== row.status) {
        if (!STATUS_IDS.has(request.body.status)) return response.status(400).json({ error: 'Unknown status.' });
        await pool.query(
          `UPDATE support_requests SET status = $2::varchar, resolved_at = CASE WHEN $2::varchar = 'resolved' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $1`,
          [id, request.body.status],
        );
        changes.push(`Status changed to ${statusLabel(request.body.status)}`);
      }
      if (request.body.assignedTo !== undefined && String(request.body.assignedTo || '').toLowerCase() !== String(row.assigned_to || '').toLowerCase()) {
        const target = request.body.assignedTo ? await memberInfo(request.body.assignedTo) : null;
        if (request.body.assignedTo && !target) return response.status(400).json({ error: 'That team member is not active.' });
        await pool.query('UPDATE support_requests SET assigned_to = $2, updated_at = NOW() WHERE id = $1', [id, target ? target.username : '']);
        changes.push(target ? `Assigned to ${target.name}` : 'Unassigned');
        if (target?.email && target.username.toLowerCase() !== me.username.toLowerCase()) {
          mailer.sendBrandedEmail({
            to: target.email,
            subject: `Support request ${refOf(id)} assigned to you · ${row.name}`,
            title: 'Support request assigned to you',
            innerHtml: `${mailer.emailParts.heading({ title: `Assigned to you: ${row.name}`, intro: `${esc(myName)} assigned support request ${esc(refOf(id))} to you.` })}${detailsTable(row)}
              ${mailer.emailParts.button(`${publicBaseUrl(request)}/admin#/support/${id}`, 'Open request')}`,
          }).catch(() => {});
        }
      }
      for (const change of changes) await addNote(id, me.username, change, 'system');
      const updated = await loadRequest(id);
      if (changes.length && updated.contact_id) {
        crm.addActivity(updated.contact_id, 'system', { subject: `Support request ${refOf(id)}: ${changes.join(' · ')}`, createdBy: me.username }).catch(() => {});
      }
      response.json({ request: requestRow(updated) });
    } catch (error) {
      console.error('Support update error:', error);
      response.status(500).json({ error: 'Could not update the request.' });
    }
  });

  app.post('/api/crm/support/:id/notes', requireAdmin, async (request, response) => {
    const id = Number(request.params.id);
    const body = text(request.body?.body, 4000);
    if (!body) return response.status(400).json({ error: 'Please write a note.' });
    const row = await loadRequest(id);
    if (!row) return response.status(404).json({ error: 'Support request not found.' });
    await addNote(id, request.session.username, body, 'note');
    await pool.query('UPDATE support_requests SET updated_at = NOW() WHERE id = $1', [id]);
    response.status(201).json({ success: true });
  });
}

module.exports = { initSupport, registerSupportRoutes, SUPPORT_TOPICS: TOPICS };

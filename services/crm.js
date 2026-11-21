const { passwordProblem } = require('./password-policy');
/**
 * Sainand Chits India - Customer CRM
 *
 * One customer record (crm_contacts) per person, matched by phone number
 * (or email when no phone). Every website enquiry, call, email, note, stage
 * change, and scheduled follow-up is stored on that customer's timeline.
 */

const multer = require('multer');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');

const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interested', label: 'Interested' },
  { id: 'converted', label: 'Converted' },
  { id: 'not_interested', label: 'Not interested' },
];
const STAGE_IDS = new Set(STAGES.map(stage => stage.id));
const OPEN_STAGES = ['new', 'contacted', 'interested'];

// Shown when logging a call. "busy" is kept only so older call records still read correctly.
const CALL_OUTCOMES = [
  { id: 'connected', label: 'Spoke to customer' },
  { id: 'callback', label: 'Call back later' },
  { id: 'no_answer', label: 'No answer / busy' },
  { id: 'switched_off', label: 'Not reachable' },
  { id: 'wrong_number', label: 'Wrong number' },
];
const LEGACY_OUTCOMES = [{ id: 'busy', label: 'Busy / call cut' }];
const OUTCOME_IDS = new Set([...CALL_OUTCOMES, ...LEGACY_OUTCOMES].map(outcome => outcome.id));

const SOURCES = [
  { id: 'website', label: 'Website form' },
  { id: 'chatbot', label: 'Sai chatbot' },
  { id: 'support', label: 'Support request' },
  { id: 'phone', label: 'Phone call' },
  { id: 'walk_in', label: 'Office walk-in' },
  { id: 'referral', label: 'Referral' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'other', label: 'Other' },
];
const SOURCE_IDS = new Set(SOURCES.map(source => source.id));

const ACTIVITY_TYPES = new Set(['note', 'call', 'whatsapp', 'meeting']);
// Two roles in the app: Admin (everything) and Staff (enquiries and follow-ups).
// Older "Manager" accounts (systemadmin) are full admins too.
const ROLES = [
  { id: 'superadmin', label: 'Admin' },
  { id: 'agent', label: 'Staff' },
  { id: 'systemadmin', label: 'Admin', hidden: true },
];
const isAdminRole = role => role === 'superadmin' || role === 'systemadmin';
const ROLE_IDS = new Set(ROLES.map(role => role.id));

const LEGACY_STATUS_TO_STAGE = {
  new: 'new',
  contacted: 'contacted',
  qualified: 'interested',
  closed: 'not_interested',
};

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS crm_contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL DEFAULT '',
    phone_key VARCHAR(40) NOT NULL DEFAULT '',
    alt_phone VARCHAR(40) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    occupation VARCHAR(120) NOT NULL DEFAULT '',
    plan VARCHAR(180) NOT NULL DEFAULT '',
    source VARCHAR(40) NOT NULL DEFAULT 'website',
    stage VARCHAR(30) NOT NULL DEFAULT 'new',
    owner VARCHAR(80) NOT NULL DEFAULT '',
    lost_reason TEXT NOT NULL DEFAULT '',
    next_follow_up_at TIMESTAMPTZ,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_phone_key_uidx ON crm_contacts (phone_key) WHERE phone_key <> '';
  CREATE INDEX IF NOT EXISTS crm_contacts_email_idx ON crm_contacts (LOWER(email));
  CREATE INDEX IF NOT EXISTS crm_contacts_stage_idx ON crm_contacts (stage, updated_at DESC);
  CREATE INDEX IF NOT EXISTS crm_contacts_owner_idx ON crm_contacts (owner);
  CREATE INDEX IF NOT EXISTS crm_contacts_follow_idx ON crm_contacts (next_follow_up_at);

  CREATE TABLE IF NOT EXISTS crm_activities (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    outcome VARCHAR(40) NOT NULL DEFAULT '',
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(80) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS crm_activities_contact_idx ON crm_activities (contact_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS crm_activities_created_idx ON crm_activities (created_at DESC);

  CREATE TABLE IF NOT EXISTS crm_tasks (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT 'Scheduled call',
    notes TEXT NOT NULL DEFAULT '',
    due_at TIMESTAMPTZ NOT NULL,
    assignee VARCHAR(80) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_by VARCHAR(80) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(80) NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS crm_tasks_due_idx ON crm_tasks (status, due_at);
  CREATE INDEX IF NOT EXISTS crm_tasks_contact_idx ON crm_tasks (contact_id);

  ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS contact_id INTEGER;
  CREATE INDEX IF NOT EXISTS enquiries_contact_idx ON enquiries (contact_id);
  ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

  -- Consent recorded with every website enquiry / application
  ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
  ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS consent_text TEXT NOT NULL DEFAULT '';
  ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS ip VARCHAR(64) NOT NULL DEFAULT '';
  ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
  ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS consent_text TEXT NOT NULL DEFAULT '';
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
  -- Customer withdrew consent: do not call, WhatsApp or email (cleared if they enquire again)
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ;
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS consent_withdrawn_note TEXT NOT NULL DEFAULT '';

  -- Speed to lead + automatic assignment
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
  ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS receives_leads BOOLEAN;
  ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS last_lead_assigned_at TIMESTAMPTZ;
  -- My account: designation, mobile and date of birth
  ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NOT NULL DEFAULT '';
  ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS mobile VARCHAR(40) NOT NULL DEFAULT '';
  ALTER TABLE admin_security ADD COLUMN IF NOT EXISTS dob DATE;
  UPDATE admin_security SET receives_leads = (role = 'agent') WHERE receives_leads IS NULL;
  UPDATE admin_security SET receives_leads = FALSE WHERE receives_leads AND role <> 'agent';

  CREATE TABLE IF NOT EXISTS crm_settings (
    key VARCHAR(60) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by VARCHAR(80) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Repeat enquiries: last enquiry time drives the default sort
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS last_enquiry_at TIMESTAMPTZ;
  ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS repeat_enquiry_at TIMESTAMPTZ;
  UPDATE crm_contacts c SET last_enquiry_at = COALESCE((SELECT MAX(e.created_at) FROM enquiries e WHERE e.contact_id = c.id), c.created_at)
    WHERE c.last_enquiry_at IS NULL;
  CREATE INDEX IF NOT EXISTS crm_contacts_last_enquiry_idx ON crm_contacts (last_enquiry_at DESC);

  -- Follow-up history
  ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS completion_note TEXT NOT NULL DEFAULT '';
  ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS original_due_at TIMESTAMPTZ;
  ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX IF NOT EXISTS crm_tasks_completed_idx ON crm_tasks (completed_at DESC);
  -- "Follow-ups" are called "Schedules" in the app now.
  ALTER TABLE crm_tasks ALTER COLUMN title SET DEFAULT 'Scheduled call';
  UPDATE crm_tasks SET title = 'Scheduled call' WHERE title = 'Follow-up call';

  -- "Documents pending" is no longer used: those customers move to "Interested".
  UPDATE crm_contacts SET stage = 'interested' WHERE stage = 'documents';

  -- Activity log (who did what)
  CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL DEFAULT '',
    action VARCHAR(80) NOT NULL,
    target VARCHAR(200) NOT NULL DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
  CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (LOWER(username), created_at DESC);
  DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '400 days';
`;

function text(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function phoneKey(value) {
  const digits = String(value || '').replace(/\D/g, '');
  // Indian numbers: compare on the last 10 digits so +91 / 0 prefixes match.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// "₹10 Lakh Bhisi (25 members, ₹40,000/mo) - Most Popular" -> "₹10 Lakh Bhisi"
function shortPlan(value) {
  return text(value, 180).split(' (')[0].split(' - ')[0].trim();
}

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stageLabel(id) {
  return STAGES.find(stage => stage.id === id)?.label || id;
}

function contactRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    altPhone: row.alt_phone,
    email: row.email,
    city: row.city,
    occupation: row.occupation,
    plan: row.plan,
    source: row.source,
    stage: row.stage,
    owner: row.owner,
    lostReason: row.lost_reason,
    nextFollowUpAt: row.next_follow_up_at,
    lastContactedAt: row.last_contacted_at,
    firstResponseAt: row.first_response_at,
    lastEnquiryAt: row.last_enquiry_at || row.created_at,
    repeatEnquiryAt: row.repeat_enquiry_at || null,
    consentAt: row.consent_at,
    consentWithdrawnAt: row.consent_withdrawn_at || null,
    consentWithdrawnNote: row.consent_withdrawn_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    enquiryCount: row.enquiry_count !== undefined ? Number(row.enquiry_count) : undefined,
    ownerName: row.owner_name || undefined,
    supportCount: row.support_count !== undefined ? Number(row.support_count) : undefined,
    openSupport: row.open_support !== undefined ? Number(row.open_support) : undefined,
  };
}

function activityRow(row) {
  return {
    id: row.id,
    contactId: row.contact_id,
    type: row.type,
    subject: row.subject,
    body: row.body,
    outcome: row.outcome,
    meta: row.meta || {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    contactName: row.contact_name || undefined,
  };
}

function taskRow(row) {
  return {
    id: row.id,
    contactId: row.contact_id,
    title: row.title,
    notes: row.notes,
    dueAt: row.due_at,
    assignee: row.assignee,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completionNote: row.completion_note || '',
    originalDueAt: row.original_due_at || null,
    rescheduleCount: Number(row.reschedule_count || 0),
    contactName: row.contact_name || undefined,
    contactPhone: row.contact_phone || undefined,
    contactStage: row.contact_stage || undefined,
  };
}

async function addActivity(db, contactId, type, fields = {}) {
  const result = await db.query(
    `INSERT INTO crm_activities (contact_id, type, subject, body, outcome, meta, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8, NOW()))
     RETURNING *`,
    [
      contactId,
      type,
      text(fields.subject, 300),
      text(fields.body, 8000),
      text(fields.outcome, 40),
      JSON.stringify(fields.meta || {}),
      text(fields.createdBy, 80),
      fields.createdAt || null,
    ],
  );
  return result.rows[0];
}

async function refreshNextFollowUp(db, contactId) {
  await db.query(
    `UPDATE crm_contacts SET next_follow_up_at = (
       SELECT MIN(due_at) FROM crm_tasks WHERE contact_id = $1 AND status = 'open'
     ) WHERE id = $1`,
    [contactId],
  );
}

// assignTo: '' = take turns between staff; otherwise the username who gets every new enquiry.
const DEFAULT_SETTINGS = { autoAssign: true, dailyDigest: false, assignTo: '' };

async function getSettings(db) {
  try {
    const result = await db.query("SELECT value FROM crm_settings WHERE key = 'general'");
    return { ...DEFAULT_SETTINGS, ...(result.rows[0]?.value || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(db, patch, by) {
  const current = await getSettings(db);
  const next = { ...current, ...patch };
  await db.query(
    `INSERT INTO crm_settings (key, value, updated_by, updated_at) VALUES ('general', $1::jsonb, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [JSON.stringify(next), by || ''],
  );
  return next;
}

/**
 * Round-robin among active SALES AGENTS who are marked "Gets new leads":
 * the one who received a customer least recently goes next.
 */
async function pickAssignee(db, { exclude = [] } = {}) {
  const excluded = exclude.map(name => String(name).toLowerCase());
  const { assignTo } = await getSettings(db);
  if (assignTo && !excluded.includes(assignTo.toLowerCase())) {
    const fixed = await db.query(
      "SELECT username, display_name FROM admin_security WHERE LOWER(username) = $1 AND role = 'agent' AND COALESCE(is_active, TRUE)",
      [assignTo.toLowerCase()],
    );
    if (fixed.rowCount) return fixed.rows[0];
  }
  const result = await db.query(
    `SELECT username, display_name FROM admin_security
     WHERE COALESCE(is_active, TRUE) AND role = 'agent'
       AND NOT (LOWER(username) = ANY($1))
     ORDER BY last_lead_assigned_at ASC NULLS FIRST, created_at ASC
     LIMIT 1 FOR UPDATE SKIP LOCKED`,
    [excluded],
  );
  return result.rows[0] || null;
}

/** Follow-ups always belong to the customer's agent: move every open one to the new owner. */
async function moveOpenTasks(db, contactId, newOwner) {
  await db.query("UPDATE crm_tasks SET assignee = $2 WHERE contact_id = $1 AND status = 'open'", [contactId, newOwner || '']);
}

/** Give a customer (and their open follow-ups) to the next sales agent in turn. */
async function assignToNextAgent(db, contactId, { reason = 'Automatically assigned', exclude = [], by = '' } = {}) {
  const member = await pickAssignee(db, { exclude });
  if (!member) return null;
  await db.query('UPDATE admin_security SET last_lead_assigned_at = NOW() WHERE username = $1', [member.username]);
  await db.query('UPDATE crm_contacts SET owner = $2, assigned_at = NOW(), updated_at = NOW() WHERE id = $1', [contactId, member.username]);
  await moveOpenTasks(db, contactId, member.username);
  await addActivity(db, contactId, 'system', { subject: `${reason} to ${member.display_name || member.username}`, meta: { to: member.username }, createdBy: by });
  return member;
}

/**
 * Follow-ups only ever go to sales agents: the customer's agent. If the customer has no agent yet,
 * give them the next agent in turn first. If no agent exists at all, the follow-up stays unassigned
 * (managers see it under "Not assigned to an agent").
 */
async function agentForFollowUp(db, contactId, by) {
  const row = (await db.query(
    `SELECT c.owner, s.role, COALESCE(s.is_active, TRUE) AS active FROM crm_contacts c
     LEFT JOIN admin_security s ON LOWER(s.username) = LOWER(c.owner) WHERE c.id = $1`,
    [contactId],
  )).rows[0];
  if (row?.owner && row.role === 'agent' && row.active) return row.owner;
  const member = await assignToNextAgent(db, contactId, { reason: 'Assigned for a scheduled call', by });
  return member ? member.username : '';
}

/** Automatic sharing (can be switched off on the Team page). */
async function autoAssign(db, contactId, options = {}) {
  // New enquiries are always given to a staff member when there is one.
  return assignToNextAgent(db, contactId, options);
}

async function isActiveMember(db, username) {
  if (!username) return false;
  const row = (await db.query('SELECT COALESCE(is_active, TRUE) AS active FROM admin_security WHERE LOWER(username) = LOWER($1)', [username])).rows[0];
  return Boolean(row?.active);
}

/**
 * Find or create the customer for a website enquiry and log it on the timeline.
 * Returns { contact, created }.
 */
async function upsertContactFromEnquiry(pool, enquiry, options = {}) {
  const key = phoneKey(enquiry.phone);
  const email = text(enquiry.email, 254).toLowerCase();
  const source = options.source || (Array.isArray(enquiry.chat_transcript) && enquiry.chat_transcript.length ? 'chatbot' : 'website');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let found = null;
    if (key) {
      found = (await client.query('SELECT * FROM crm_contacts WHERE phone_key = $1 LIMIT 1 FOR UPDATE', [key])).rows[0];
    }
    if (!found && email) {
      found = (await client.query('SELECT * FROM crm_contacts WHERE LOWER(email) = $1 ORDER BY id LIMIT 1 FOR UPDATE', [email])).rows[0];
    }

    let contact;
    let created = false;
    const enquiredAt = enquiry.created_at || new Date();
    const previousEnquiryAt = found ? (found.last_enquiry_at || found.created_at) : null;
    if (found) {
      // Repeat enquiry: the status stays exactly as it was; the customer moves to the top of the list.
      contact = (await client.query(
        `UPDATE crm_contacts SET
           email = CASE WHEN email = '' THEN $2 ELSE email END,
           plan = CASE WHEN $3 <> '' AND $3 <> 'Not sure yet' THEN $3 WHEN plan = '' THEN $3 ELSE plan END,
           last_enquiry_at = GREATEST(COALESCE(last_enquiry_at, created_at), $4),
           repeat_enquiry_at = CASE WHEN $5 THEN repeat_enquiry_at ELSE GREATEST(COALESCE(repeat_enquiry_at, $4), $4) END,
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [found.id, email, shortPlan(enquiry.plan), enquiredAt, Boolean(options.migrating)],
      )).rows[0];
    } else {
      const stage = options.stage || 'new';
      contact = (await client.query(
        `INSERT INTO crm_contacts (name, phone, phone_key, email, plan, source, stage, created_at, updated_at, last_enquiry_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), COALESCE($8, NOW()), COALESCE($8, NOW()))
         RETURNING *`,
        [text(enquiry.name, 120) || 'Website visitor', text(enquiry.phone, 40), key, email, shortPlan(enquiry.plan), source, stage, enquiry.created_at || null],
      )).rows[0];
      created = true;
    }

    await client.query('UPDATE enquiries SET contact_id = $1 WHERE id = $2', [contact.id, enquiry.id]);
    // A new enquiry from someone who had withdrawn consent = they agreed to be contacted again.
    if (found && found.consent_withdrawn_at && !options.migrating && !options.keepWithdrawn) {
      contact = (await client.query("UPDATE crm_contacts SET consent_withdrawn_at = NULL, consent_withdrawn_note = '' WHERE id = $1 RETURNING *", [contact.id])).rows[0];
      await addActivity(client, contact.id, 'system', { subject: 'Consent given again with a new enquiry — can be contacted' });
    }
    const enquiryNumber = (await client.query('SELECT COUNT(*)::int AS n FROM enquiries WHERE contact_id = $1', [contact.id])).rows[0].n;
    const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
    await addActivity(client, contact.id, 'enquiry', {
      subject: options.subject
        ? `${options.subject}${found ? ` (enquiry no. ${enquiryNumber})` : ''}`
        : found
          ? `Enquired again (${ordinal(enquiryNumber)} time)${source === 'chatbot' ? ' via Sai chatbot' : ''}`
          : (source === 'chatbot' ? 'Enquiry via Sai chatbot' : 'Website enquiry'),
      body: text(enquiry.message, 4000),
      meta: {
        enquiryId: enquiry.id,
        plan: enquiry.plan || '',
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email,
        chatMessages: Array.isArray(enquiry.chat_transcript) ? enquiry.chat_transcript.length : 0,
      },
      createdAt: enquiry.created_at,
    });
    let assignee = null;
    // New customers get the next agent; a repeat enquirer keeps their agent unless that person has left.
    if (!options.migrating && (found || OPEN_STAGES.includes(contact.stage)) && !(await isActiveMember(client, contact.owner))) {
      assignee = await autoAssign(client, contact.id);
      contact = { ...contact, owner: assignee ? assignee.username : '' };
    }
    // Repeat enquiry: make sure the agent calls back soon.
    if (found && !options.migrating) {
      const title = 'Call back — enquired again';
      const open = await client.query("SELECT id FROM crm_tasks WHERE contact_id = $1 AND status = 'open' AND title = $2 LIMIT 1", [contact.id, title]);
      if (open.rowCount) {
        await client.query("UPDATE crm_tasks SET due_at = NOW() + INTERVAL '15 minutes', assignee = $2 WHERE id = $1", [open.rows[0].id, contact.owner || '']);
      } else {
        const task = (await client.query(
          `INSERT INTO crm_tasks (contact_id, title, notes, due_at, assignee, created_by)
           VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes', $4, 'system') RETURNING *`,
          [contact.id, title, `${ordinal(enquiryNumber)} enquiry${enquiry.plan ? ` · ${shortPlan(enquiry.plan)}` : ''}`, contact.owner || ''],
        )).rows[0];
        await logScheduled(client, task, '');
      }
      await refreshNextFollowUp(client, contact.id);
    }
    if (enquiry.consent_at) {
      await client.query('UPDATE crm_contacts SET consent_at = COALESCE(consent_at, $2) WHERE id = $1', [contact.id, enquiry.consent_at]);
    }
    await client.query('COMMIT');
    return { contact, created, assignee, previousEnquiryAt, enquiryNumber };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const istShort = d => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

async function memberDisplayName(db, username) {
  if (!username) return 'Unassigned';
  try {
    const row = (await db.query('SELECT display_name FROM admin_security WHERE LOWER(username) = LOWER($1)', [username])).rows[0];
    return row?.display_name || username;
  } catch {
    return username;
  }
}

/** When a customer is closed (Converted / Not interested), close their open follow-ups and say why. */
/** Mark a customer "consent withdrawn – do not contact": closes their open schedules and logs it. */
async function setConsentWithdrawn(db, contactId, withdrawn, { by = '', note = '' } = {}) {
  const row = (await db.query(
    withdrawn
      ? "UPDATE crm_contacts SET consent_withdrawn_at = COALESCE(consent_withdrawn_at, NOW()), consent_withdrawn_note = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
      : "UPDATE crm_contacts SET consent_withdrawn_at = NULL, consent_withdrawn_note = '', updated_at = NOW() WHERE id = $1 RETURNING *",
    withdrawn ? [contactId, text(note, 500)] : [contactId],
  )).rows[0];
  if (!row) return null;
  await addActivity(db, contactId, 'system', {
    subject: withdrawn ? 'Consent withdrawn — do not call, WhatsApp or email' : 'Consent given again — can be contacted',
    body: text(note, 500),
    createdBy: by,
  });
  if (withdrawn) await closeOpenTasks(db, contactId, by, 'Closed automatically — customer withdrew consent to be contacted');
  return row;
}

async function closeOpenTasks(db, contactId, by, reason) {
  const closed = await db.query(
    `UPDATE crm_tasks SET status = 'cancelled', completed_at = NOW(), completed_by = $2, completion_note = $3
     WHERE contact_id = $1 AND status = 'open' RETURNING title, due_at`,
    [contactId, by, reason],
  );
  if (closed.rowCount) {
    await addActivity(db, contactId, 'followup', {
      subject: `${closed.rowCount} open schedule${closed.rowCount === 1 ? '' : 's'} closed`,
      body: `${reason}\n${closed.rows.map(t => `• ${t.title} (${istShort(t.due_at)})`).join('\n')}`,
      meta: { action: 'cancelled', automatic: true },
      createdBy: by,
    });
  }
  await refreshNextFollowUp(db, contactId);
}

async function logScheduled(db, task, by) {
  await addActivity(db, task.contact_id, 'followup', {
    subject: `Scheduled: ${task.title}`,
    body: `${istShort(task.due_at)} · for ${await memberDisplayName(db, task.assignee)}${task.notes ? `\n${task.notes}` : ''}`,
    meta: { action: 'scheduled', taskId: task.id },
    createdBy: by,
  });
}

/** One-time move of older enquiries (and their notes / scheduled calls) into the CRM. */
async function migrateLegacyEnquiries(pool) {
  const pending = await pool.query('SELECT * FROM enquiries WHERE contact_id IS NULL ORDER BY created_at ASC LIMIT 5000');
  for (const enquiry of pending.rows) {
    try {
      const stage = LEGACY_STATUS_TO_STAGE[enquiry.status] || 'new';
      const { contact, created } = await upsertContactFromEnquiry(pool, enquiry, { stage, migrating: true });
      if (!created && stage !== 'new') {
        await pool.query('UPDATE crm_contacts SET stage = $2 WHERE id = $1', [contact.id, stage]);
      }
      const notes = [
        ['Follow-up 1', enquiry.follow_up_1],
        ['Follow-up 2', enquiry.follow_up_2],
        ['Follow-up 3', enquiry.follow_up_3],
        ['Team notes', enquiry.admin_notes],
        ['Scheduled call note', enquiry.scheduled_call_note],
      ].filter(([, value]) => String(value || '').trim());
      for (const [label, value] of notes) {
        await addActivity(pool, contact.id, 'note', { subject: label, body: value, createdBy: 'imported' });
      }
      if (enquiry.scheduled_call_at && (enquiry.scheduled_call_status || 'pending') === 'pending') {
        await pool.query(
          `INSERT INTO crm_tasks (contact_id, title, notes, due_at, created_by) VALUES ($1, 'Scheduled call', $2, $3, 'imported')`,
          [contact.id, text(enquiry.scheduled_call_note, 2000), enquiry.scheduled_call_at],
        );
        await refreshNextFollowUp(pool, contact.id);
      }
      if (stage !== 'new') {
        await pool.query('UPDATE crm_contacts SET last_contacted_at = COALESCE(last_contacted_at, $2) WHERE id = $1', [contact.id, enquiry.created_at]);
      }
    } catch (error) {
      console.error(`CRM migration failed for enquiry ${enquiry.id}:`, error.message);
    }
  }
  if (pending.rowCount) console.log(`CRM: moved ${pending.rowCount} older enquiries into customer records.`);
}

async function initCrm(pool) {
  await pool.query(SCHEMA_SQL);
  await migrateLegacyEnquiries(pool);
}

function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formulas (CSV injection) and quote everything.
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function istDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function registerCrmRoutes(app, deps) {
  const { pool, requireAdmin, requireSuperAdmin, hashPassword, generateSalt, mailer, limiter } = deps;
  const isManager = session => session.role === 'superadmin' || session.role === 'systemadmin';

  async function teamMembers() {
    try {
      const result = await pool.query(
        `SELECT username, display_name, role, email, COALESCE(is_active, TRUE) AS is_active, COALESCE(designation, '') AS designation,
           COALESCE(receives_leads, FALSE) AS receives_leads, last_lead_assigned_at, created_at
         FROM admin_security ORDER BY created_at ASC`,
      );
      return result.rows.map(row => ({
        username: row.username,
        displayName: row.display_name || row.username,
        role: row.role || 'agent',
        designation: row.designation || '',
        email: row.email,
        isActive: row.is_active,
        receivesLeads: row.receives_leads,
        lastLeadAssignedAt: row.last_lead_assigned_at,
        createdAt: row.created_at,
      }));
    } catch {
      return [];
    }
  }

  async function getContact(id) {
    const result = await pool.query('SELECT * FROM crm_contacts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  function buildContactFilters(query, session) {
    const where = [];
    const params = [];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    const q = text(query.q, 120).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      const n = params.length;
      const digits = q.replace(/\D/g, '');
      const phoneClause = digits.length >= 3 ? ` OR c.phone_key LIKE '%' || $${n + 1} || '%'` : '';
      if (phoneClause) params.push(digits);
      where.push(`(LOWER(c.name) LIKE $${n} OR LOWER(c.email) LIKE $${n} OR LOWER(c.plan) LIKE $${n} OR LOWER(c.city) LIKE $${n}${phoneClause})`);
    }
    const stage = text(query.stage, 30);
    if (stage === 'open') where.push(`c.stage IN ('${OPEN_STAGES.join("','")}')`);
    else if (STAGE_IDS.has(stage)) add('c.stage = ?', stage);
    const owner = text(query.owner, 80).toLowerCase();
    if (owner === 'me') add('LOWER(c.owner) = ?', session.username.toLowerCase());
    else if (owner === 'unassigned') where.push("c.owner = ''");
    else if (owner) add('LOWER(c.owner) = ?', owner);
    const source = text(query.source, 40);
    if (SOURCE_IDS.has(source)) add('c.source = ?', source);
    const plan = text(query.plan, 180);
    if (plan) add('c.plan = ?', plan);
    const follow = text(query.follow, 20);
    if (follow === 'overdue') where.push('c.next_follow_up_at < NOW()');
    if (follow === 'due') where.push("c.next_follow_up_at < (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'");
    if (follow === 'today') where.push("c.next_follow_up_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' AND c.next_follow_up_at < (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'");
    if (follow === 'upcoming') where.push('c.next_follow_up_at >= NOW()');
    if (follow === 'none') where.push(`c.next_follow_up_at IS NULL AND c.stage IN ('${OPEN_STAGES.join("','")}')`);
    if (query.untouched === '1') where.push('c.last_contacted_at IS NULL');
    if (query.repeat === '1') where.push("c.repeat_enquiry_at >= NOW() - INTERVAL '7 days'");
    // Enquired today (India time) — new customers and repeat enquiries alike.
    if (query.today === '1') where.push("COALESCE(c.last_enquiry_at, c.created_at) >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'");
    const from = validDate(query.from);
    if (from) add('c.created_at >= ?', from);
    const to = validDate(query.to);
    if (to) add('c.created_at < ?', to);
    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  // Sortable columns (whitelisted SQL) and the named sort choices shown in the menu.
  const SORT_COLUMNS = {
    created: 'c.created_at',
    enquired: 'COALESCE(c.last_enquiry_at, c.created_at)',
    updated: 'c.updated_at',
    name: 'LOWER(c.name)',
    phone: 'c.phone_key',
    plan: "COALESCE(NULLIF(SUBSTRING(c.plan FROM '(\\d+)\\s*[Ll]akh'), '')::int, 0)",
    stage: "CASE c.stage WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'interested' THEN 3 WHEN 'converted' THEN 5 ELSE 6 END",
    owner: "LOWER(COALESCE((SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) LIMIT 1), NULLIF(c.owner, ''), '~'))",
    followup: 'c.next_follow_up_at',
    contacted: 'c.last_contacted_at',
    enquiries: '(SELECT COUNT(*) FROM enquiries e WHERE e.contact_id = c.id)',
  };
  const SORT_PRESETS = {
    latest: ['enquired', 'desc'],
    newest: ['created', 'desc'],
    oldest: ['created', 'asc'],
    updated: ['updated', 'desc'],
    followup: ['followup', 'asc'],
    neglected: ['contacted', 'asc'],
    value: ['plan', 'desc'],
    status: ['stage', 'asc'],
    repeat: ['enquiries', 'desc'],
    name: ['name', 'asc'],
  };
  function orderSql(query) {
    let [column, dir] = SORT_PRESETS[query.sort] || [query.sort, query.dir];
    if (!SORT_COLUMNS[column]) [column, dir] = SORT_PRESETS.latest;
    if (query.dir === 'asc' || query.dir === 'desc') dir = query.dir;
    dir = dir === 'asc' ? 'ASC' : 'DESC';
    // "Last contacted, oldest first" should list never-contacted customers at the top.
    const nulls = column === 'contacted' && dir === 'ASC' ? 'NULLS FIRST' : 'NULLS LAST';
    return `${SORT_COLUMNS[column]} ${dir} ${nulls}, c.created_at DESC, c.id DESC`;
  }

  // ---------- Meta ----------
  app.get('/api/crm/meta', requireAdmin, async (request, response) => {
    const team = await teamMembers();
    response.json({
      stages: STAGES,
      openStages: OPEN_STAGES,
      outcomes: CALL_OUTCOMES,
      legacyOutcomes: LEGACY_OUTCOMES,
      sources: SOURCES,
      roles: ROLES,
      team: team.filter(member => member.isActive).map(({ username, displayName, role }) => ({ username, displayName, role })),
      me: {
        username: request.session.username,
        displayName: request.session.displayName,
        designation: team.find(member => member.username.toLowerCase() === request.session.username.toLowerCase())?.designation || '',
        role: request.session.role,
        isManager: isManager(request.session),
        isOwner: isAdminRole(request.session.role),
      },
      emailConfigured: mailer.isEmailConfigured(),
    });
  });

  // ---------- Dashboard ----------
  app.get('/api/crm/dashboard', requireAdmin, async (request, response) => {
    try {
      const mine = request.query.scope === 'mine';
      const me = request.session.username.toLowerCase();
      const ownerSql = mine ? 'AND LOWER(owner) = $1' : '';
      const taskOwnerSql = mine ? 'AND LOWER(t.assignee) = $1' : '';
      const params = mine ? [me] : [];
      const dayStart = "date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'";

      const [counts, stages, tasks, recent, newLeads] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE COALESCE(last_enquiry_at, created_at) >= ${dayStart}) AS new_today,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_week,
             COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS new_month,
             COUNT(*) FILTER (WHERE stage = 'new' AND last_contacted_at IS NULL) AS untouched,
             COUNT(*) FILTER (WHERE (owner = '' OR NOT EXISTS (SELECT 1 FROM admin_security s WHERE LOWER(s.username) = LOWER(crm_contacts.owner) AND COALESCE(s.is_active, TRUE))) AND stage IN ('${OPEN_STAGES.join("','")}')) AS unassigned,
             COUNT(*) FILTER (WHERE stage = 'converted' AND updated_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS converted_month,
             COUNT(*) FILTER (WHERE stage IN ('${OPEN_STAGES.join("','")}')) AS open_total,
             COUNT(*) AS total
           FROM crm_contacts WHERE TRUE ${ownerSql}`,
          params,
        ),
        pool.query(`SELECT stage, COUNT(*)::int AS count FROM crm_contacts WHERE TRUE ${ownerSql} GROUP BY stage`, params),
        pool.query(
          `SELECT t.*, c.name AS contact_name, c.phone AS contact_phone, c.stage AS contact_stage
           FROM crm_tasks t JOIN crm_contacts c ON c.id = t.contact_id
           WHERE t.status = 'open' AND t.due_at < (${dayStart} + INTERVAL '1 day') ${taskOwnerSql}
           ORDER BY t.due_at ASC LIMIT 50`,
          params,
        ),
        pool.query(
          `SELECT a.*, c.name AS contact_name FROM crm_activities a JOIN crm_contacts c ON c.id = a.contact_id
           WHERE a.type IN ('call','email','note','whatsapp','meeting','stage_change','enquiry') ${mine ? 'AND (LOWER(a.created_by) = $1 OR LOWER(c.owner) = $1)' : ''}
           ORDER BY a.created_at DESC LIMIT 10`,
          params,
        ),
        pool.query(
          `SELECT c.*, (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) LIMIT 1) AS owner_name
           FROM crm_contacts c WHERE c.stage = 'new' AND c.last_contacted_at IS NULL ${mine ? 'AND (LOWER(c.owner) = $1 OR c.owner = \'\')' : ''}
           ORDER BY c.created_at DESC LIMIT 8`,
          params,
        ),
      ]);
      const now = Date.now();
      const taskList = tasks.rows.map(taskRow);
      const agents = await pool.query("SELECT COUNT(*)::int AS n FROM admin_security WHERE role = 'agent' AND COALESCE(is_active, TRUE)");
      response.json({
        agentsInRotation: agents.rows[0].n,
        autoAssign: (await getSettings(pool)).autoAssign,
        counts: Object.fromEntries(Object.entries(counts.rows[0]).map(([key, value]) => [key, Number(value)])),
        stages: Object.fromEntries(stages.rows.map(row => [row.stage, row.count])),
        overdue: taskList.filter(task => new Date(task.dueAt).getTime() < now),
        dueToday: taskList.filter(task => new Date(task.dueAt).getTime() >= now),
        recentActivity: recent.rows.map(activityRow),
        newLeads: newLeads.rows.map(contactRow),
      });
    } catch (error) {
      console.error('CRM dashboard error:', error);
      response.status(500).json({ error: 'Unable to load the dashboard.' });
    }
  });

  // ---------- Contacts ----------
  app.get('/api/crm/contacts', requireAdmin, async (request, response) => {
    try {
      const { whereSql, params } = buildContactFilters(request.query, request.session);
      const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 25, 5), 100);
      const page = Math.max(Number(request.query.page) || 1, 1);
      const order = orderSql(request.query);
      const total = await pool.query(`SELECT COUNT(*)::int AS count FROM crm_contacts c ${whereSql}`, params);
      const rows = await pool.query(
        `SELECT c.*,
           (SELECT COUNT(*) FROM enquiries e WHERE e.contact_id = c.id) AS enquiry_count,
           (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) LIMIT 1) AS owner_name,
           (SELECT COUNT(*) FROM support_requests sr WHERE sr.contact_id = c.id) AS support_count,
           (SELECT COUNT(*) FROM support_requests sr WHERE sr.contact_id = c.id AND sr.status <> 'resolved') AS open_support
         FROM crm_contacts c ${whereSql}
         ORDER BY ${order}
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      );
      response.json({ contacts: rows.rows.map(contactRow), total: total.rows[0].count, page, pageSize });
    } catch (error) {
      console.error('CRM contacts error:', error);
      response.status(500).json({ error: 'Unable to load customers.' });
    }
  });

  // Counts for the tabs on the Customers page.
  app.get('/api/crm/contacts/counts', requireAdmin, async (request, response) => {
    const views = {
      open: { stage: 'open' },
      mine: { owner: 'me', stage: 'open' },
      untouched: { stage: 'new', untouched: '1' },
      repeat: { repeat: '1' },
      due: { follow: 'due' },
      all: {},
      new_today: { today: '1' },
      new: { stage: 'new' },
      contacted: { stage: 'contacted' },
      interested: { stage: 'interested' },
      converted: { stage: 'converted' },
      not_interested: { stage: 'not_interested' },
    };
    try {
      const entries = await Promise.all(Object.entries(views).map(async ([key, q]) => {
        const { whereSql, params } = buildContactFilters(q, request.session);
        const result = await pool.query(`SELECT COUNT(*)::int AS n FROM crm_contacts c ${whereSql}`, params);
        return [key, result.rows[0].n];
      }));
      response.json({ counts: Object.fromEntries(entries) });
    } catch (error) {
      console.error('Counts error:', error);
      response.status(500).json({ error: 'Unable to count customers.' });
    }
  });

  app.get('/api/crm/plans', requireAdmin, async (_request, response) => {
    const result = await pool.query("SELECT plan, COUNT(*)::int AS count FROM crm_contacts WHERE plan <> '' GROUP BY plan ORDER BY count DESC LIMIT 30").catch(() => ({ rows: [] }));
    response.json({ plans: result.rows });
  });

  app.post('/api/crm/contacts', requireAdmin, async (request, response) => {
    const body = request.body || {};
    const name = text(body.name, 120);
    const phone = text(body.phone, 40);
    const key = phoneKey(phone);
    const email = text(body.email, 254).toLowerCase();
    if (!name || (key.length < 10 && !email)) {
      return response.status(400).json({ error: 'Enter the customer name and a 10-digit mobile number (or an email).' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ error: 'That email address does not look right.' });
    }
    try {
      if (key) {
        const dup = await pool.query('SELECT id, name FROM crm_contacts WHERE phone_key = $1', [key]);
        if (dup.rowCount) {
          return response.status(409).json({ error: `${dup.rows[0].name} already has this mobile number.`, contactId: dup.rows[0].id });
        }
      }
      if (email) {
        const dup = await pool.query('SELECT id, name FROM crm_contacts WHERE LOWER(email) = $1 LIMIT 1', [email]);
        if (dup.rowCount) {
          return response.status(409).json({ error: `${dup.rows[0].name} already has this email address.`, contactId: dup.rows[0].id });
        }
      }
      const source = SOURCE_IDS.has(body.source) ? body.source : 'phone';
      const stage = STAGE_IDS.has(body.stage) ? body.stage : 'new';
      // Agents keep the customers they add. Managers' additions go to the next sales agent,
      // unless they pick a specific person.
      const chosen = text(body.owner, 80);
      let owner = '';
      if (request.session.role === 'agent') owner = request.session.username;
      else if (chosen && chosen !== '__auto' && await isActiveMember(pool, chosen)) owner = chosen;
      const result = await pool.query(
        `INSERT INTO crm_contacts (name, phone, phone_key, alt_phone, email, city, occupation, plan, source, stage, owner)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name, phone, key, text(body.altPhone, 40), email, text(body.city, 100), text(body.occupation, 120), text(body.plan, 180), source, stage, owner],
      );
      const contact = result.rows[0];
      await addActivity(pool, contact.id, 'system', {
        subject: `Customer added manually (${SOURCES.find(item => item.id === source)?.label || source})`,
        body: text(body.note, 4000),
        createdBy: request.session.username,
      });
      let assignedTo = owner ? await memberDisplayName(pool, owner) : '';
      if (!owner && OPEN_STAGES.includes(stage)) {
        const member = await autoAssign(pool, contact.id, { by: request.session.username });
        if (member) assignedTo = member.display_name || member.username;
      }
      response.status(201).json({ contact: contactRow(await getContact(contact.id)), assignedTo });
    } catch (error) {
      console.error('CRM create error:', error);
      response.status(500).json({ error: 'Unable to add the customer.' });
    }
  });

  app.get('/api/crm/contacts/:id', requireAdmin, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    try {
      const contact = await getContact(id);
      if (!contact) return response.status(404).json({ error: 'Customer not found.' });
      const [activities, tasks, enquiries] = await Promise.all([
        pool.query('SELECT * FROM crm_activities WHERE contact_id = $1 ORDER BY created_at DESC, id DESC LIMIT 300', [id]),
        pool.query("SELECT * FROM crm_tasks WHERE contact_id = $1 ORDER BY (status = 'open') DESC, due_at ASC LIMIT 100", [id]),
        pool.query('SELECT id, created_at, name, phone, email, plan, message, chat_transcript FROM enquiries WHERE contact_id = $1 ORDER BY created_at DESC', [id]),
      ]);
      response.json({
        contact: contactRow(contact),
        activities: activities.rows.map(activityRow),
        tasks: tasks.rows.map(taskRow),
        enquiries: enquiries.rows.map(row => ({
          id: row.id,
          createdAt: row.created_at,
          name: row.name,
          phone: row.phone,
          email: row.email,
          plan: row.plan,
          message: row.message,
          chatTranscript: Array.isArray(row.chat_transcript) ? row.chat_transcript : [],
        })),
      });
    } catch (error) {
      console.error('CRM contact error:', error);
      response.status(500).json({ error: 'Unable to load the customer.' });
    }
  });

  app.patch('/api/crm/contacts/:id', requireAdmin, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    const body = request.body || {};
    try {
      const before = await getContact(id);
      if (!before) return response.status(404).json({ error: 'Customer not found.' });
      const updates = {};
      for (const [field, column, max] of [
        ['name', 'name', 120], ['altPhone', 'alt_phone', 40], ['city', 'city', 100],
        ['occupation', 'occupation', 120], ['plan', 'plan', 180], ['lostReason', 'lost_reason', 2000],
      ]) {
        if (body[field] !== undefined) updates[column] = text(body[field], max);
      }
      if (updates.name === '') return response.status(400).json({ error: 'Name cannot be empty.' });
      if (body.phone !== undefined) {
        const key = phoneKey(body.phone);
        if (key.length < 10) return response.status(400).json({ error: 'Enter a 10-digit mobile number.' });
        const dup = await pool.query('SELECT id, name FROM crm_contacts WHERE phone_key = $1 AND id <> $2', [key, id]);
        if (dup.rowCount) return response.status(409).json({ error: `${dup.rows[0].name} already has this mobile number.` });
        updates.phone = text(body.phone, 40);
        updates.phone_key = key;
      }
      if (body.email !== undefined) {
        const email = text(body.email, 254).toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'That email address does not look right.' });
        updates.email = email;
      }
      if (body.source !== undefined && SOURCE_IDS.has(body.source)) updates.source = body.source;
      if (body.stage !== undefined) {
        if (!STAGE_IDS.has(body.stage)) return response.status(400).json({ error: 'Unknown status.' });
        if (body.stage === 'not_interested' && !text(body.lostReason ?? before.lost_reason)) {
          return response.status(400).json({ error: 'Please add a reason when marking a customer Not interested.' });
        }
        updates.stage = body.stage;
      }
      if (body.owner !== undefined && text(body.owner, 80).toLowerCase() !== String(before.owner || '').toLowerCase()) {
        if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can change who looks after a customer.' });
        updates.owner = text(body.owner, 80);
      }

      const columns = Object.keys(updates);
      if (!columns.length) return response.json({ contact: contactRow(before) });
      const setSql = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
      const result = await pool.query(
        `UPDATE crm_contacts SET ${setSql}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, ...columns.map(column => updates[column])],
      );
      const after = result.rows[0];
      const by = request.session.username;
      if (updates.stage && updates.stage !== before.stage) {
        await addActivity(pool, id, 'stage_change', {
          subject: `Status changed: ${stageLabel(before.stage)} → ${stageLabel(updates.stage)}`,
          body: updates.stage === 'not_interested' ? after.lost_reason : '',
          meta: { from: before.stage, to: updates.stage },
          createdBy: by,
        });
        if (['converted', 'not_interested'].includes(updates.stage)) {
          await closeOpenTasks(pool, id, by, `Closed automatically — customer marked ${stageLabel(updates.stage)}`);
        }
      }
      if (updates.owner !== undefined && updates.owner !== before.owner) {
        await moveOpenTasks(pool, id, updates.owner);
        await pool.query('UPDATE crm_contacts SET assigned_at = NOW() WHERE id = $1', [id]);
        await addActivity(pool, id, 'system', {
          subject: updates.owner ? `Assigned to ${await memberDisplayName(pool, updates.owner)}` : 'Unassigned',
          body: 'Open schedules moved with the customer.',
          meta: { from: before.owner, to: updates.owner },
          createdBy: by,
        });
      }
      const fresh = await getContact(id);
      response.json({ contact: contactRow(fresh) });
    } catch (error) {
      console.error('CRM update error:', error);
      response.status(500).json({ error: 'Unable to update the customer.' });
    }
  });

  app.delete('/api/crm/contacts/:id', requireSuperAdmin, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    // Keep the original enquiries, but mark them so they are not re-imported.
    await pool.query('UPDATE enquiries SET contact_id = -1 WHERE contact_id = $1', [id]);
    const result = await pool.query('DELETE FROM crm_contacts WHERE id = $1', [id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Customer not found.' });
    response.json({ success: true });
  });

  // Bulk assign / stage change from the list view
  app.post('/api/crm/contacts/bulk', requireAdmin, async (request, response) => {
    const ids = (Array.isArray(request.body?.ids) ? request.body.ids : []).map(validId).filter(Boolean).slice(0, 500);
    if (!ids.length) return response.status(400).json({ error: 'Select at least one customer.' });
    const by = request.session.username;
    try {
      if (request.body.owner !== undefined) {
        if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can change who looks after a customer.' });
        const owner = text(request.body.owner, 80);
        const changed = await pool.query('UPDATE crm_contacts SET owner = $2, assigned_at = NOW(), updated_at = NOW() WHERE id = ANY($1) AND owner <> $2 RETURNING id', [ids, owner]);
        const ownerName = owner ? await memberDisplayName(pool, owner) : '';
        for (const row of changed.rows) {
          await moveOpenTasks(pool, row.id, owner);
          await addActivity(pool, row.id, 'system', { subject: owner ? `Assigned to ${ownerName}` : 'Unassigned', body: 'Open schedules moved with the customer.', createdBy: by });
        }
        return response.json({ updated: changed.rowCount });
      }
      if (request.body.stage !== undefined) {
        const stage = request.body.stage;
        if (!STAGE_IDS.has(stage) || stage === 'not_interested') {
          return response.status(400).json({ error: 'Choose a status. (Not interested needs a reason, so set it one by one.)' });
        }
        const before = await pool.query('SELECT id, stage FROM crm_contacts WHERE id = ANY($1) AND stage <> $2', [ids, stage]);
        await pool.query('UPDATE crm_contacts SET stage = $2, updated_at = NOW() WHERE id = ANY($1)', [before.rows.map(row => row.id), stage]);
        for (const row of before.rows) {
          await addActivity(pool, row.id, 'stage_change', {
            subject: `Status changed: ${stageLabel(row.stage)} → ${stageLabel(stage)}`,
            meta: { from: row.stage, to: stage },
            createdBy: by,
          });
          if (stage === 'converted') await closeOpenTasks(pool, row.id, by, 'Closed automatically — customer marked Converted');
        }
        return response.json({ updated: before.rowCount });
      }
      response.status(400).json({ error: 'Nothing to update.' });
    } catch (error) {
      console.error('CRM bulk error:', error);
      response.status(500).json({ error: 'Unable to update the selected customers.' });
    }
  });

  // ---------- Activities: log call / note / WhatsApp / meeting ----------
  app.post('/api/crm/contacts/:id/activities', requireAdmin, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    const body = request.body || {};
    const type = ACTIVITY_TYPES.has(body.type) ? body.type : 'note';
    const remarks = text(body.body, 8000);
    const outcome = type === 'call' && OUTCOME_IDS.has(body.outcome) ? body.outcome : '';
    if (type === 'call' && !outcome) return response.status(400).json({ error: 'Choose how the call went.' });
    if (type !== 'call' && !remarks) return response.status(400).json({ error: 'Write a remark first.' });
    try {
      const contact = await getContact(id);
      if (!contact) return response.status(404).json({ error: 'Customer not found.' });
      const by = request.session.username;
      const activity = await addActivity(pool, id, type, {
        subject: type === 'call' ? [...CALL_OUTCOMES, ...LEGACY_OUTCOMES].find(item => item.id === outcome)?.label : '',
        body: remarks,
        outcome,
        meta: body.durationMinutes ? { durationMinutes: Math.min(Number(body.durationMinutes) || 0, 600) } : {},
        createdBy: by,
      });

      if (['call', 'whatsapp', 'meeting'].includes(type)) {
        await pool.query('UPDATE crm_contacts SET last_contacted_at = NOW(), first_response_at = COALESCE(first_response_at, NOW()), updated_at = NOW() WHERE id = $1', [id]);
        // First real contact moves New -> Contacted automatically.
        if (contact.stage === 'new' && (type !== 'call' || ['connected', 'callback'].includes(outcome))) {
          await pool.query("UPDATE crm_contacts SET stage = 'contacted' WHERE id = $1", [id]);
          await addActivity(pool, id, 'stage_change', {
            subject: 'Status changed: New → Contacted',
            meta: { from: 'new', to: 'contacted', automatic: true },
            createdBy: by,
          });
        }
        // An agent who calls an unassigned customer takes them on (managers never become the owner this way).
        if (!contact.owner && request.session.role === 'agent') {
          await pool.query('UPDATE crm_contacts SET owner = $2, assigned_at = NOW() WHERE id = $1', [id, by]);
          await moveOpenTasks(pool, id, by);
          await addActivity(pool, id, 'system', { subject: `Taken on by ${await memberDisplayName(pool, by)}`, createdBy: by });
        }
      } else {
        await pool.query('UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1', [id]);
      }

      // Close the follow-up this call answers first, so a status change below doesn't cancel it.
      if (body.completeTaskId) {
        const channel = { call: 'Call', whatsapp: 'WhatsApp', meeting: 'Office visit' }[type] || 'Note';
        const note = [type === 'call' ? `${channel}: ${CALL_OUTCOMES.find(item => item.id === outcome)?.label || outcome}` : channel, remarks].filter(Boolean).join(' — ');
        const done = await pool.query(
          `UPDATE crm_tasks SET status = 'done', completed_at = NOW(), completed_by = $3, completion_note = $4
           WHERE id = $1 AND contact_id = $2 AND status = 'open' RETURNING *`,
          [validId(body.completeTaskId), id, by, note.slice(0, 2000)],
        );
        if (done.rowCount) {
          const task = done.rows[0];
          await pool.query("UPDATE crm_activities SET meta = meta || $2::jsonb WHERE id = $1", [activity.id, JSON.stringify({ completedTask: { id: task.id, title: task.title, dueAt: task.due_at } })]);
          activity.meta = { ...(activity.meta || {}), completedTask: { id: task.id, title: task.title, dueAt: task.due_at } };
        }
      }
      // Optional: status change and next follow-up in the same step.
      if (body.stage && STAGE_IDS.has(body.stage)) {
        const current = await getContact(id);
        if (current.stage !== body.stage) {
          if (body.stage === 'not_interested' && !text(body.lostReason)) {
            return response.status(400).json({ error: 'Please add a reason when marking a customer Not interested.' });
          }
          await pool.query('UPDATE crm_contacts SET stage = $2, lost_reason = CASE WHEN $3 <> \'\' THEN $3 ELSE lost_reason END WHERE id = $1', [id, body.stage, text(body.lostReason, 2000)]);
          await addActivity(pool, id, 'stage_change', {
            subject: `Status changed: ${stageLabel(current.stage)} → ${stageLabel(body.stage)}`,
            body: body.stage === 'not_interested' ? text(body.lostReason, 2000) : '',
            meta: { from: current.stage, to: body.stage },
            createdBy: by,
          });
          if (['converted', 'not_interested'].includes(body.stage)) {
            await closeOpenTasks(pool, id, by, `Closed automatically — customer marked ${stageLabel(body.stage)}`);
          }
        }
      }
      const followUpAt = validDate(body.followUpAt);
      if (followUpAt) {
        const created = await pool.query(
          'INSERT INTO crm_tasks (contact_id, title, notes, due_at, assignee, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [id, text(body.followUpTitle, 200) || 'Scheduled call', text(body.followUpNotes, 2000), followUpAt, await agentForFollowUp(pool, id, by), by],
        );
        await logScheduled(pool, created.rows[0], by);
      }
      await refreshNextFollowUp(pool, id);
      response.status(201).json({ activity: activityRow(activity) });
    } catch (error) {
      console.error('CRM activity error:', error);
      response.status(500).json({ error: 'Unable to save the remark.' });
    }
  });

  // ---------- Email the customer from the CRM ----------
  // Withdraw / restore consent to be contacted
  app.post('/api/crm/contacts/:id/consent', requireAdmin, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    try {
      const row = await setConsentWithdrawn(pool, id, Boolean(request.body?.withdrawn), { by: request.session.username, note: request.body?.note });
      if (!row) return response.status(404).json({ error: 'Customer not found.' });
      response.json({ contact: contactRow(row) });
    } catch (error) {
      console.error('Consent update error:', error);
      response.status(500).json({ error: 'Could not update consent.' });
    }
  });

  app.post('/api/crm/contacts/:id/email', requireAdmin, limiter, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    const subject = text(request.body?.subject, 200);
    const message = text(request.body?.body, 10000);
    if (!subject || !message) return response.status(400).json({ error: 'Add a subject and a message.' });
    try {
      const contact = await getContact(id);
      if (!contact) return response.status(404).json({ error: 'Customer not found.' });
      if (!contact.email) return response.status(400).json({ error: 'This customer has no email address. Add one first.' });
      if (contact.consent_withdrawn_at) return response.status(409).json({ error: 'This customer withdrew consent to be contacted. Do not email them.' });
      const sender = (await teamMembers()).find(member => member.username.toLowerCase() === request.session.username.toLowerCase());
      const result = await mailer.sendCustomerEmail({
        to: contact.email,
        customerName: contact.name,
        subject,
        message,
        senderName: sender?.displayName || request.session.displayName || 'Sainand Chits team',
        replyTo: sender?.email && !sender.email.endsWith('@***.com') ? sender.email : undefined,
      });
      if (!result.sent) {
        return response.status(503).json({ error: result.reason === 'unconfigured'
          ? 'Email is not set up yet. Add the SMTP settings (SMTP_USER, SMTP_PASS) to send emails.'
          : 'The email could not be sent. Please try again.' });
      }
      const activity = await addActivity(pool, id, 'email', {
        subject,
        body: message,
        meta: { to: contact.email, messageId: result.messageId || '' },
        createdBy: request.session.username,
      });
      await pool.query('UPDATE crm_contacts SET last_contacted_at = NOW(), first_response_at = COALESCE(first_response_at, NOW()), updated_at = NOW() WHERE id = $1', [id]);
      if (contact.stage === 'new') {
        await pool.query("UPDATE crm_contacts SET stage = 'contacted' WHERE id = $1", [id]);
        await addActivity(pool, id, 'stage_change', {
          subject: 'Status changed: New → Contacted',
          meta: { from: 'new', to: 'contacted', automatic: true },
          createdBy: request.session.username,
        });
      }
      response.status(201).json({ activity: activityRow(activity) });
    } catch (error) {
      console.error('CRM email error:', error);
      response.status(500).json({ error: 'Unable to send the email.' });
    }
  });

  // ---------- Follow-ups (scheduled calls) ----------
  app.post('/api/crm/contacts/:id/tasks', requireAdmin, async (request, response) => {
    const id = validId(request.params.id);
    const dueAt = validDate(request.body?.dueAt);
    if (!id) return response.status(400).json({ error: 'Invalid customer.' });
    if (!dueAt) return response.status(400).json({ error: 'Choose a date and time for the schedule.' });
    try {
      const contact = await getContact(id);
      if (!contact) return response.status(404).json({ error: 'Customer not found.' });
      if (contact.consent_withdrawn_at) return response.status(409).json({ error: 'This customer withdrew consent to be contacted, so calls cannot be scheduled.' });
      const result = await pool.query(
        'INSERT INTO crm_tasks (contact_id, title, notes, due_at, assignee, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [id, text(request.body.title, 200) || 'Scheduled call', text(request.body.notes, 2000), dueAt, await agentForFollowUp(pool, id, request.session.username), request.session.username],
      );
      await logScheduled(pool, result.rows[0], request.session.username);
      await refreshNextFollowUp(pool, id);
      response.status(201).json({ task: taskRow(result.rows[0]) });
    } catch (error) {
      console.error('CRM task create error:', error);
      response.status(500).json({ error: 'Unable to save the schedule.' });
    }
  });

  app.patch('/api/crm/tasks/:id', requireAdmin, async (request, response) => {
    const id = validId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid schedule.' });
    try {
      const existing = (await pool.query('SELECT * FROM crm_tasks WHERE id = $1', [id])).rows[0];
      if (!existing) return response.status(404).json({ error: 'Schedule not found.' });
      const by = request.session.username;
      const status = request.body?.status;
      const note = text(request.body?.note, 2000);
      const log = (subject, body, meta) => addActivity(pool, existing.contact_id, 'followup', { subject, body, meta: { taskId: id, ...meta }, createdBy: by });
      if (['done', 'cancelled'].includes(status) && existing.status === 'open') {
        await pool.query('UPDATE crm_tasks SET status = $2, completed_at = NOW(), completed_by = $3, completion_note = $4 WHERE id = $1', [id, status, by, note]);
        await log(status === 'done' ? `Schedule done: ${existing.title}` : `Schedule cancelled: ${existing.title}`,
          [`Was due ${istShort(existing.due_at)}`, note].filter(Boolean).join('\n'), { action: status });
      } else if (status === 'open' && existing.status !== 'open') {
        await pool.query("UPDATE crm_tasks SET status = 'open', completed_at = NULL, completed_by = '', completion_note = '' WHERE id = $1", [id]);
        await log(`Schedule re-opened: ${existing.title}`, `Due ${istShort(existing.due_at)}`, { action: 'reopened' });
      }
      const dueAt = validDate(request.body?.dueAt);
      if (dueAt && dueAt.getTime() !== new Date(existing.due_at).getTime()) {
        await pool.query(
          'UPDATE crm_tasks SET original_due_at = COALESCE(original_due_at, due_at), due_at = $2, reschedule_count = reschedule_count + 1 WHERE id = $1',
          [id, dueAt],
        );
        await log(`Schedule moved: ${existing.title}`, `${istShort(existing.due_at)} → ${istShort(dueAt)}`, { action: 'rescheduled' });
      }
      if (isManager(request.session) && request.body?.assignee !== undefined && text(request.body.assignee, 80).toLowerCase() !== String(existing.assignee || '').toLowerCase()) {
        await pool.query('UPDATE crm_tasks SET assignee = $2 WHERE id = $1', [id, text(request.body.assignee, 80)]);
        await log(`Schedule handed over: ${existing.title}`, `${await memberDisplayName(pool, existing.assignee)} → ${await memberDisplayName(pool, text(request.body.assignee, 80))}`, { action: 'reassigned' });
      }
      if (request.body?.title !== undefined) await pool.query('UPDATE crm_tasks SET title = $2 WHERE id = $1', [id, text(request.body.title, 200) || existing.title]);
      if (request.body?.notes !== undefined) await pool.query('UPDATE crm_tasks SET notes = $2 WHERE id = $1', [id, text(request.body.notes, 2000)]);
      await refreshNextFollowUp(pool, existing.contact_id);
      const fresh = (await pool.query('SELECT * FROM crm_tasks WHERE id = $1', [id])).rows[0];
      response.json({ task: taskRow(fresh) });
    } catch (error) {
      console.error('CRM task update error:', error);
      response.status(500).json({ error: 'Unable to update the schedule.' });
    }
  });

  app.get('/api/crm/tasks', requireAdmin, async (request, response) => {
    try {
      const params = [];
      const history = request.query.status === 'history';
      const where = [history ? "t.status IN ('done', 'cancelled')" : "t.status = 'open'"];
      if (history) {
        const days = Math.min(Math.max(Number(request.query.days) || 30, 1), 365);
        where.push(`t.completed_at >= NOW() - INTERVAL '${days} days'`);
        const doneBy = isManager(request.session) ? text(request.query.doneBy, 80).toLowerCase() : '';
        if (doneBy) { params.push(doneBy === 'me' ? request.session.username.toLowerCase() : doneBy); where.push(`LOWER(t.completed_by) = $${params.length}`); }
      }
      let assignee = text(request.query.assignee, 80).toLowerCase();
      if (!isManager(request.session)) {
        // Sales agents only see their own follow-ups (assigned to them, or that they closed).
        params.push(request.session.username.toLowerCase());
        where.push(history ? `(LOWER(t.assignee) = $${params.length} OR LOWER(t.completed_by) = $${params.length})` : `LOWER(t.assignee) = $${params.length}`);
        assignee = 'all';
      } else if (assignee === 'me' || (!assignee && request.query.scope === 'mine')) {
        params.push(request.session.username.toLowerCase());
        where.push(`LOWER(t.assignee) = $${params.length}`);
      } else if (assignee === 'unassigned') {
        where.push("(t.assignee = '' OR NOT EXISTS (SELECT 1 FROM admin_security s WHERE LOWER(s.username) = LOWER(t.assignee) AND s.role = 'agent' AND COALESCE(s.is_active, TRUE)))");
      } else if (assignee && assignee !== 'all') {
        params.push(assignee);
        where.push(`LOWER(t.assignee) = $${params.length}`);
      }
      const result = await pool.query(
        `SELECT t.*, c.name AS contact_name, c.phone AS contact_phone, c.stage AS contact_stage
         FROM crm_tasks t JOIN crm_contacts c ON c.id = t.contact_id
         WHERE ${where.join(' AND ')}
         ORDER BY ${history ? 't.completed_at DESC' : 't.due_at ASC'} LIMIT 500`,
        params,
      );
      response.json({ tasks: result.rows.map(taskRow) });
    } catch (error) {
      console.error('CRM tasks error:', error);
      response.status(500).json({ error: 'Unable to load schedules.' });
    }
  });

  // ---------- Pipeline board ----------
  app.get('/api/crm/pipeline', requireAdmin, async (request, response) => {
    try {
      const params = [];
      let ownerSql = '';
      const owner = text(request.query.owner, 80).toLowerCase();
      if (owner === 'me') { params.push(request.session.username.toLowerCase()); ownerSql = `AND LOWER(c.owner) = $${params.length}`; }
      else if (owner === 'unassigned') ownerSql = "AND c.owner = ''";
      else if (owner) { params.push(owner); ownerSql = `AND LOWER(c.owner) = $${params.length}`; }
      const recentClosed = "(c.stage NOT IN ('converted','not_interested') OR c.updated_at >= NOW() - INTERVAL '30 days')";
      const result = await pool.query(
        `SELECT * FROM (
           SELECT c.*, ROW_NUMBER() OVER (PARTITION BY c.stage ORDER BY c.updated_at DESC) AS rn,
             (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) LIMIT 1) AS owner_name
           FROM crm_contacts c WHERE ${recentClosed} ${ownerSql}
         ) ranked WHERE rn <= 100`,
        params,
      );
      const totals = await pool.query(`SELECT stage, COUNT(*)::int AS count FROM crm_contacts c WHERE ${recentClosed} ${ownerSql} GROUP BY stage`, params);
      response.json({
        contacts: result.rows.map(contactRow),
        totals: Object.fromEntries(totals.rows.map(row => [row.stage, row.count])),
      });
    } catch (error) {
      console.error('CRM pipeline error:', error);
      response.status(500).json({ error: 'Unable to load the pipeline.' });
    }
  });

  // ---------- Reports ----------
  app.get('/api/crm/reports', requireAdmin, async (request, response) => {
    try {
      const days = Math.min(Math.max(Number(request.query.days) || 30, 7), 365);
      const since = `NOW() - INTERVAL '${days} days'`;
      const [byStage, bySource, byPlan, byOwner, weekly, calls, funnel, speed] = await Promise.all([
        pool.query(`SELECT stage AS key, COUNT(*)::int AS count FROM crm_contacts WHERE created_at >= ${since} GROUP BY stage`),
        pool.query(`SELECT source AS key, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE stage = 'converted')::int AS converted FROM crm_contacts WHERE created_at >= ${since} GROUP BY source ORDER BY count DESC`),
        pool.query(`SELECT COALESCE(NULLIF(plan, ''), 'Not specified') AS key, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE stage = 'converted')::int AS converted FROM crm_contacts WHERE created_at >= ${since} GROUP BY 1 ORDER BY count DESC LIMIT 12`),
        pool.query(
          `SELECT COALESCE(NULLIF(c.owner, ''), '') AS key,
             COALESCE((SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) LIMIT 1), NULLIF(c.owner, ''), 'Unassigned') AS label,
             COUNT(*)::int AS count,
             COUNT(*) FILTER (WHERE c.stage = 'converted')::int AS converted,
             COUNT(*) FILTER (WHERE c.stage IN ('${OPEN_STAGES.join("','")}'))::int AS open
           FROM crm_contacts c WHERE c.created_at >= ${since} GROUP BY 1, 2 ORDER BY count DESC`,
        ),
        pool.query(
          `SELECT to_char(date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS week, COUNT(*)::int AS count
           FROM crm_contacts WHERE created_at >= NOW() - INTERVAL '12 weeks' GROUP BY 1 ORDER BY 1`,
        ),
        pool.query(
          `SELECT created_by AS key,
             COALESCE((SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(a.created_by) LIMIT 1), created_by) AS label,
             COUNT(*) FILTER (WHERE type = 'call')::int AS calls,
             COUNT(*) FILTER (WHERE type = 'call' AND outcome = 'connected')::int AS connected,
             COUNT(*) FILTER (WHERE type = 'email')::int AS emails
           FROM crm_activities a WHERE created_at >= ${since} AND created_by NOT IN ('', 'imported') AND type IN ('call','email')
           GROUP BY 1, 2 ORDER BY calls DESC`,
        ),
        pool.query(
          `SELECT COUNT(*)::int AS leads,
             COUNT(*) FILTER (WHERE last_contacted_at IS NOT NULL OR stage <> 'new')::int AS contacted,
             COUNT(*) FILTER (WHERE stage IN ('interested','converted'))::int AS interested,
             COUNT(*) FILTER (WHERE stage = 'converted')::int AS converted,
             COUNT(*) FILTER (WHERE stage = 'not_interested')::int AS lost
           FROM crm_contacts WHERE created_at >= ${since}`,
        ),
        pool.query(
          `SELECT LOWER(owner) AS key,
             ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - COALESCE(assigned_at, created_at))) / 60))::int AS avg_minutes,
             COUNT(*) FILTER (WHERE first_response_at - created_at <= INTERVAL '1 hour')::int AS within_hour,
             COUNT(*)::int AS responded
           FROM crm_contacts
           WHERE created_at >= ${since} AND first_response_at IS NOT NULL AND first_response_at >= created_at
           GROUP BY ROLLUP (LOWER(owner))`,
        ),
      ]);
      response.json({
        days,
        byStage: byStage.rows,
        bySource: bySource.rows,
        byPlan: byPlan.rows,
        byOwner: byOwner.rows,
        weekly: weekly.rows,
        calls: calls.rows,
        funnel: funnel.rows[0],
        speed: speed.rows,
      });
    } catch (error) {
      console.error('CRM reports error:', error);
      response.status(500).json({ error: 'Unable to load reports.' });
    }
  });

  // ---------- Export (opens in Excel) ----------
  app.get('/api/crm/export.csv', requireAdmin, async (request, response) => {
    if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can export customer data.' });
    try {
      const { whereSql, params } = buildContactFilters(request.query, request.session);
      const result = await pool.query(
        `SELECT c.*,
           (SELECT COUNT(*) FROM enquiries e WHERE e.contact_id = c.id) AS enquiry_count,
           (SELECT body FROM crm_activities a WHERE a.contact_id = c.id AND a.type IN ('call','note','whatsapp','meeting') AND a.body <> '' ORDER BY a.created_at DESC LIMIT 1) AS last_remark
         FROM crm_contacts c ${whereSql} ORDER BY c.created_at DESC LIMIT 20000`,
        params,
      );
      const header = ['ID', 'Name', 'Mobile', 'Alternate mobile', 'Email', 'City', 'Occupation', 'Plan', 'Source', 'Status', 'Owner', 'Next scheduled call', 'Last contacted', 'Enquiries', 'Last remark', 'Not-interested reason', 'Created'];
      const lines = [header.map(csvCell).join(',')];
      for (const row of result.rows) {
        lines.push([
          row.id, row.name, row.phone, row.alt_phone, row.email, row.city, row.occupation, row.plan,
          SOURCES.find(item => item.id === row.source)?.label || row.source,
          stageLabel(row.stage), row.owner, istDate(row.next_follow_up_at), istDate(row.last_contacted_at),
          row.enquiry_count, row.last_remark || '', row.lost_reason, istDate(row.created_at),
        ].map(csvCell).join(','));
      }
      const stamp = new Date().toISOString().slice(0, 10);
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="sainand-customers-${stamp}.csv"`);
      response.send(`﻿${lines.join('\r\n')}`);
    } catch (error) {
      console.error('CRM export error:', error);
      response.status(500).json({ error: 'Unable to export.' });
    }
  });



  // ---------- Duplicates: same email, or a mobile number that matches another customer's mobile/alternate ----------
  const DUP_PAIRS_SQL = `
    WITH c AS (
      SELECT id,
        LOWER(NULLIF(email, '')) AS em,
        NULLIF(phone_key, '') AS pk,
        CASE WHEN LENGTH(RIGHT(REGEXP_REPLACE(alt_phone, '\\D', '', 'g'), 10)) = 10 THEN RIGHT(REGEXP_REPLACE(alt_phone, '\\D', '', 'g'), 10) END AS ak
      FROM crm_contacts
    )
    SELECT a.id AS a_id, b.id AS b_id,
      CASE WHEN a.em = b.em THEN 'same email' ELSE 'same mobile number' END AS reason
    FROM c a JOIN c b ON a.id < b.id
      AND (a.em = b.em OR a.pk = b.ak OR a.ak = b.pk OR a.ak = b.ak)`;

  async function duplicateGroups(onlyId) {
    const pairs = (await pool.query(`${DUP_PAIRS_SQL} ${onlyId ? 'WHERE a.id = $1 OR b.id = $1' : ''} LIMIT 2000`, onlyId ? [onlyId] : [])).rows;
    const parent = new Map();
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const reasons = new Map();
    for (const { a_id: a, b_id: b, reason } of pairs) {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      parent.set(find(a), find(b));
      reasons.set(`${a}`, reason); reasons.set(`${b}`, reason);
    }
    const groups = new Map();
    for (const id of parent.keys()) {
      const root = find(id);
      if (!groups.has(root)) groups.set(root, new Set());
      groups.get(root).add(id);
    }
    const ids = [...parent.keys()];
    if (!ids.length) return [];
    const rows = (await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM enquiries e WHERE e.contact_id = c.id) AS enquiry_count,
         (SELECT COUNT(*) FROM crm_activities a WHERE a.contact_id = c.id) AS activity_count
       FROM crm_contacts c WHERE c.id = ANY($1)`,
      [ids],
    )).rows;
    const byId = new Map(rows.map(row => [row.id, row]));
    return [...groups.values()].slice(0, 200).map(set => {
      const members = [...set].map(id => byId.get(id)).filter(Boolean).sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
      return {
        reason: reasons.get(`${members[0]?.id}`) || 'possible duplicate',
        contacts: members.map(row => ({ ...contactRow(row), activityCount: Number(row.activity_count) })),
      };
    });
  }

  app.get('/api/crm/duplicates', requireAdmin, async (request, response) => {
    try {
      response.json({ groups: await duplicateGroups(validId(request.query.contactId)) });
    } catch (error) {
      console.error('Duplicates error:', error);
      response.status(500).json({ error: 'Unable to look for duplicates.' });
    }
  });

  const STAGE_RANK = { new: 0, contacted: 1, interested: 2, converted: 4, not_interested: -1 };
  app.post('/api/crm/contacts/merge', requireAdmin, async (request, response) => {
    if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can merge customers.' });
    const primaryId = validId(request.body?.primaryId);
    const otherIds = [...new Set((Array.isArray(request.body?.mergeIds) ? request.body.mergeIds : []).map(validId).filter(id => id && id !== primaryId))];
    if (!primaryId || !otherIds.length) return response.status(400).json({ error: 'Choose which record to keep and at least one to merge into it.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const primary = (await client.query('SELECT * FROM crm_contacts WHERE id = $1 FOR UPDATE', [primaryId])).rows[0];
      if (!primary) throw Object.assign(new Error('Customer not found.'), { status: 404 });
      const others = (await client.query('SELECT * FROM crm_contacts WHERE id = ANY($1) FOR UPDATE', [otherIds])).rows;
      const merged = { ...primary };
      for (const o of others) {
        for (const field of ['email', 'city', 'occupation', 'plan', 'owner', 'lost_reason']) if (!merged[field] && o[field]) merged[field] = o[field];
        if (!merged.alt_phone && o.phone && phoneKey(o.phone) !== primary.phone_key) merged.alt_phone = o.phone;
        else if (!merged.alt_phone && o.alt_phone) merged.alt_phone = o.alt_phone;
        if (!merged.phone_key && o.phone_key) { merged.phone = o.phone; merged.phone_key = o.phone_key; }
        if ((STAGE_RANK[o.stage] ?? 0) > (STAGE_RANK[merged.stage] ?? 0)) merged.stage = o.stage;
        for (const field of ['created_at', 'first_response_at', 'consent_at']) if (o[field] && (!merged[field] || new Date(o[field]) < new Date(merged[field]))) merged[field] = o[field];
        if (o.last_contacted_at && (!merged.last_contacted_at || new Date(o.last_contacted_at) > new Date(merged.last_contacted_at))) merged.last_contacted_at = o.last_contacted_at;
        await client.query('UPDATE crm_activities SET contact_id = $1 WHERE contact_id = $2', [primaryId, o.id]);
        await client.query('UPDATE crm_tasks SET contact_id = $1 WHERE contact_id = $2', [primaryId, o.id]);
        await client.query('UPDATE enquiries SET contact_id = $1 WHERE contact_id = $2', [primaryId, o.id]);
      }
      // Free the phone numbers of the merged records before giving them to the kept one.
      await client.query('DELETE FROM crm_contacts WHERE id = ANY($1)', [others.map(o => o.id)]);
      await client.query(
        `UPDATE crm_contacts SET phone = $2, phone_key = $3, alt_phone = $4, email = $5, city = $6, occupation = $7, plan = $8, owner = $9,
           lost_reason = $10, stage = $11, created_at = $12, first_response_at = $13, consent_at = $14, last_contacted_at = $15, updated_at = NOW()
         WHERE id = $1`,
        [primaryId, merged.phone, merged.phone_key, merged.alt_phone, merged.email, merged.city, merged.occupation, merged.plan, merged.owner,
          merged.lost_reason, merged.stage, merged.created_at, merged.first_response_at, merged.consent_at, merged.last_contacted_at],
      );
      await addActivity(client, primaryId, 'system', {
        subject: `Merged ${others.length} duplicate record${others.length === 1 ? '' : 's'} into this customer`,
        body: others.map(o => `${o.name} · ${o.phone || '—'} · ${o.email || '—'}`).join('\n'),
        meta: { mergedIds: others.map(o => o.id) },
        createdBy: request.session.username,
      });
      await client.query('COMMIT');
      await refreshNextFollowUp(pool, primaryId);
      response.json({ success: true, merged: others.length, contactId: primaryId });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Merge error:', error);
      response.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to merge these customers.' });
    } finally {
      client.release();
    }
  });

  // ---------- Import customers from Excel / CSV ----------
  const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, /\.(xlsx|csv)$/i.test(file.originalname || '')),
  });
  const cellText = value => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      if (value.richText) return value.richText.map(part => part.text).join('');
      if (value.text !== undefined) return String(value.text);
      if (value.result !== undefined) return cellText(value.result);
      if (value.hyperlink) return String(value.hyperlink).replace(/^mailto:/, '');
      return '';
    }
    return String(value);
  };

  app.post('/api/crm/import/parse', requireAdmin, (request, response, next) => {
    if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can import customers.' });
    importUpload.single('file')(request, response, error => {
      if (error) return response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB.' : 'Could not read the file.' });
      next();
    });
  }, async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'Choose an Excel (.xlsx) or CSV file.' });
    try {
      const workbook = new ExcelJS.Workbook();
      if (/\.csv$/i.test(request.file.originalname)) {
        await workbook.csv.read(Readable.from(request.file.buffer.toString('utf8').replace(/^﻿/, '')));
      } else {
        await workbook.xlsx.load(request.file.buffer);
      }
      const sheet = workbook.worksheets.find(ws => ws.actualRowCount > 0);
      if (!sheet) return response.status(400).json({ error: 'The file is empty.' });
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, row => {
        if (rows.length > 5001) return;
        const values = [];
        for (let col = 1; col <= Math.min(sheet.columnCount || row.cellCount, 40); col += 1) values.push(cellText(row.getCell(col).value).trim());
        if (values.some(Boolean)) rows.push(values);
      });
      if (rows.length < 2) return response.status(400).json({ error: 'The file needs a heading row and at least one customer.' });
      const headers = rows[0].map((h, i) => h || `Column ${i + 1}`);
      response.json({ fileName: request.file.originalname, sheet: sheet.name, headers, rows: rows.slice(1, 5001), total: rows.length - 1, truncated: rows.length > 5001 });
    } catch (error) {
      console.error('Import parse error:', error.message);
      response.status(400).json({ error: 'Could not read this file. Save it as .xlsx or .csv and try again.' });
    }
  });

  app.post('/api/crm/import', requireAdmin, async (request, response) => {
    if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can import customers.' });
    const rows = Array.isArray(request.body?.rows) ? request.body.rows.slice(0, 1000) : [];
    const options = request.body?.options || {};
    const onDuplicate = options.duplicates === 'update' ? 'update' : 'skip';
    const defaultSource = SOURCE_IDS.has(options.source) ? options.source : 'other';
    const team = await teamMembers();
    const findOwner = value => {
      const v = text(value, 100).toLowerCase();
      if (!v) return '';
      const m = team.find(t => t.username.toLowerCase() === v || t.displayName.toLowerCase() === v || t.displayName.toLowerCase().split(' ')[0] === v);
      return m ? m.username : '';
    };
    const findStage = value => {
      const v = text(value, 40).toLowerCase();
      if (!v) return 'new';
      const hit = STAGES.find(st => st.id === v.replace(/\s+/g, '_') || st.label.toLowerCase() === v || st.label.toLowerCase().startsWith(v));
      if (hit) return hit.id;
      if (/member|joined|convert/.test(v)) return 'converted';
      if (/not|lost|reject/.test(v)) return 'not_interested';
      if (/doc/.test(v)) return 'interested';
      if (/interest/.test(v)) return 'interested';
      if (/contact|called/.test(v)) return 'contacted';
      return 'new';
    };
    const findSource = value => {
      const v = text(value, 40).toLowerCase();
      if (!v) return defaultSource;
      const hit = SOURCES.find(src => src.id === v.replace(/[\s-]+/g, '_') || src.label.toLowerCase().includes(v) || v.includes(src.id.replace('_', ' ')));
      return hit ? hit.id : defaultSource;
    };
    const report = { created: 0, updated: 0, skipped: 0, errors: [] };
    const by = request.session.username;
    for (const [index, raw] of rows.entries()) {
      const rowNo = Number(raw?.rowNumber) || index + 1;
      try {
        const name = text(raw?.name, 120);
        const phone = text(raw?.phone, 40);
        const key = phoneKey(phone);
        const email = text(raw?.email, 254).toLowerCase();
        if (!name) { report.errors.push({ row: rowNo, reason: 'Name is missing' }); continue; }
        if (key.length < 10 && !email) { report.errors.push({ row: rowNo, reason: 'No valid 10-digit mobile number or email' }); continue; }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { report.errors.push({ row: rowNo, reason: `Email looks wrong: ${email}` }); continue; }
        let existing = null;
        if (key.length >= 10) existing = (await pool.query('SELECT * FROM crm_contacts WHERE phone_key = $1', [key])).rows[0];
        if (!existing && email) existing = (await pool.query('SELECT * FROM crm_contacts WHERE LOWER(email) = $1 ORDER BY id LIMIT 1', [email])).rows[0];
        const fields = {
          alt_phone: text(raw?.altPhone, 40), email, city: text(raw?.city, 100), occupation: text(raw?.occupation, 120), plan: text(raw?.plan, 180),
        };
        const note = text(raw?.note, 4000);
        if (existing) {
          if (onDuplicate === 'skip') { report.skipped += 1; continue; }
          await pool.query(
            `UPDATE crm_contacts SET
               alt_phone = CASE WHEN alt_phone = '' THEN $2 ELSE alt_phone END,
               email = CASE WHEN email = '' THEN $3 ELSE email END,
               city = CASE WHEN city = '' THEN $4 ELSE city END,
               occupation = CASE WHEN occupation = '' THEN $5 ELSE occupation END,
               plan = CASE WHEN plan = '' THEN $6 ELSE plan END,
               updated_at = NOW()
             WHERE id = $1`,
            [existing.id, fields.alt_phone, fields.email, fields.city, fields.occupation, fields.plan],
          );
          await addActivity(pool, existing.id, 'system', { subject: `Details updated from import (${text(options.fileName, 120) || 'file'})`, body: note, createdBy: by });
          report.updated += 1;
          continue;
        }
        const created = validDate(raw?.createdAt);
        const ownerChoice = text(options.owner, 80) || '__auto';
        const owner = findOwner(raw?.owner) || (ownerChoice === '__auto' || ownerChoice === '__none' ? '' : ownerChoice);
        const inserted = (await pool.query(
          `INSERT INTO crm_contacts (name, phone, phone_key, alt_phone, email, city, occupation, plan, source, stage, owner, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, NOW()), NOW()) RETURNING id`,
          [name, phone, key.length >= 10 ? key : '', fields.alt_phone, email, fields.city, fields.occupation, fields.plan, findSource(raw?.source), findStage(raw?.stage), owner, created],
        )).rows[0];
        await addActivity(pool, inserted.id, 'system', { subject: `Imported from ${text(options.fileName, 120) || 'a file'}`, body: note, createdBy: by });
        if (!owner && ownerChoice === '__auto' && OPEN_STAGES.includes(findStage(raw?.stage))) {
          const member = await assignToNextAgent(pool, inserted.id, { reason: 'Shared automatically', by });
          if (member) report.assigned = (report.assigned || 0) + 1;
        }
        report.created += 1;
      } catch (error) {
        report.errors.push({ row: rowNo, reason: error.code === '23505' ? 'Mobile number already exists' : 'Could not save this row' });
      }
    }
    response.json(report);
  });

  // ---------- New-lead alerts (polled by the CRM every 30 seconds) ----------
  app.get('/api/crm/notifications', requireAdmin, async (request, response) => {
    try {
      const me = request.session.username.toLowerCase();
      const scopeSql = isManager(request.session) ? '' : "AND (LOWER(c.owner) = $1 OR c.owner = '')";
      const params = isManager(request.session) ? [] : [me];
      const leads = await pool.query(
        `SELECT c.id, c.name, c.plan, c.source, c.owner, c.created_at, c.first_response_at,
           (SELECT MAX(e.created_at) FROM enquiries e WHERE e.contact_id = c.id) AS last_enquiry_at,
           (SELECT COUNT(*) FROM enquiries e WHERE e.contact_id = c.id) AS enquiry_total,
           (SELECT display_name FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) LIMIT 1) AS owner_name
         FROM crm_contacts c
         WHERE c.id IN (SELECT DISTINCT contact_id FROM enquiries WHERE created_at >= NOW() - INTERVAL '3 days' AND contact_id > 0) ${scopeSql}
         ORDER BY last_enquiry_at DESC NULLS LAST LIMIT 20`,
        params,
      );
      const due = await pool.query(
        `SELECT COUNT(*)::int AS count FROM crm_tasks
         WHERE status = 'open' AND LOWER(assignee) = $1
           AND due_at < (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'`,
        [me],
      );
      response.json({
        serverTime: new Date().toISOString(),
        followUpsDue: due.rows[0].count,
        leads: leads.rows.map(row => ({
          id: row.id,
          name: row.name,
          plan: row.plan,
          source: row.source,
          owner: row.owner,
          ownerName: row.owner_name || '',
          at: row.last_enquiry_at || row.created_at,
          responded: Boolean(row.first_response_at),
          repeat: Number(row.enquiry_total || 1) > 1,
        })),
      });
    } catch (error) {
      console.error('CRM notifications error:', error);
      response.status(500).json({ error: 'Unable to load alerts.' });
    }
  });


  // ---------- Activity log (owner) ----------
  app.get('/api/crm/audit', requireSuperAdmin, async (request, response) => {
    try {
      const where = [];
      const params = [];
      const user = text(request.query.user, 80).toLowerCase();
      if (user) { params.push(user); where.push(`LOWER(username) = $${params.length}`); }
      const q = text(request.query.q, 80).toLowerCase();
      if (q) { params.push(`%${q}%`); where.push(`(LOWER(action) LIKE $${params.length} OR LOWER(target) LIKE $${params.length})`); }
      if (request.query.failed === '1') where.push("action = 'Failed sign-in attempt'");
      const page = Math.max(Number(request.query.page) || 1, 1);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [rows, total] = await Promise.all([
        pool.query(`SELECT * FROM audit_log ${whereSql} ORDER BY created_at DESC LIMIT 100 OFFSET ${(page - 1) * 100}`, params),
        pool.query(`SELECT COUNT(*)::int AS n FROM audit_log ${whereSql}`, params),
      ]);
      response.json({
        page,
        total: total.rows[0].n,
        entries: rows.rows.map(row => ({ id: row.id, username: row.username, action: row.action, target: row.target, details: row.details, ip: row.ip, at: row.created_at })),
      });
    } catch (error) {
      console.error('Audit list error:', error);
      response.status(500).json({ error: 'Unable to load the activity log.' });
    }
  });


  // ---------- CRM settings (owner) ----------
  app.get('/api/crm/settings', requireAdmin, async (_request, response) => {
    response.json({ settings: await getSettings(pool) });
  });
  app.put('/api/crm/settings', requireSuperAdmin, async (request, response) => {
    const patch = {};
    if (typeof request.body?.autoAssign === 'boolean') patch.autoAssign = request.body.autoAssign;
    if (typeof request.body?.dailyDigest === 'boolean') patch.dailyDigest = request.body.dailyDigest;
    if (typeof request.body?.assignTo === 'string') patch.assignTo = text(request.body.assignTo, 80).toLowerCase();
    try {
      response.json({ settings: await saveSettings(pool, patch, request.session.username) });
    } catch (error) {
      console.error('CRM settings error:', error);
      response.status(500).json({ error: 'Unable to save settings.' });
    }
  });

  /** When someone leaves: their open customers (and follow-ups) go to the other agents in turn. */
  async function shareOutCustomers(username, by) {
    const leaving = await memberDisplayName(pool, username);
    const open = await pool.query(
      `SELECT id FROM crm_contacts WHERE LOWER(owner) = LOWER($1) AND stage IN ('${OPEN_STAGES.join("','")}') ORDER BY next_follow_up_at ASC NULLS LAST, id`,
      [username],
    );
    const counts = {};
    let unassigned = 0;
    for (const row of open.rows) {
      const member = await assignToNextAgent(pool, row.id, { reason: `Handed over from ${leaving} (left the team)`, exclude: [username], by });
      if (member) counts[member.display_name || member.username] = (counts[member.display_name || member.username] || 0) + 1;
      else {
        await pool.query("UPDATE crm_contacts SET owner = '', updated_at = NOW() WHERE id = $1", [row.id]);
        await moveOpenTasks(pool, row.id, '');
        await addActivity(pool, row.id, 'system', { subject: `Unassigned: ${leaving} left the team and no sales agent was available`, createdBy: by });
        unassigned += 1;
      }
    }
    // Follow-ups of closed customers that still sat with this person.
    await pool.query("UPDATE crm_tasks SET assignee = '' WHERE LOWER(assignee) = LOWER($1) AND status = 'open'", [username]);
    return { total: open.rowCount, counts, unassigned, summary: `${open.rowCount} open customers: ${Object.entries(counts).map(([n, c]) => `${n} ${c}`).join(', ') || 'none shared'}${unassigned ? `, ${unassigned} left unassigned` : ''}` };
  }

  // Share every open customer that has no (active) agent — used from the dashboard warning.
  app.post('/api/crm/assign-unassigned', requireAdmin, async (request, response) => {
    if (!isManager(request.session)) return response.status(403).json({ error: 'Only managers can share customers.' });
    try {
      const rows = await pool.query(
        `SELECT c.id FROM crm_contacts c
         WHERE c.stage IN ('${OPEN_STAGES.join("','")}')
           AND (c.owner = '' OR NOT EXISTS (SELECT 1 FROM admin_security s WHERE LOWER(s.username) = LOWER(c.owner) AND COALESCE(s.is_active, TRUE)))
         ORDER BY c.created_at ASC`,
      );
      const counts = {};
      for (const row of rows.rows) {
        const member = await assignToNextAgent(pool, row.id, { reason: 'Shared', by: request.session.username });
        if (!member) break;
        counts[member.display_name || member.username] = (counts[member.display_name || member.username] || 0) + 1;
      }
      const shared = Object.values(counts).reduce((a, b) => a + b, 0);
      response.locals.auditDetails = { shared, counts };
      response.json({ shared, left: rows.rowCount - shared, counts });
    } catch (error) {
      console.error('Assign unassigned error:', error);
      response.status(500).json({ error: 'Unable to share the customers.' });
    }
  });

  // ---------- Team (owner only) ----------
  app.get('/api/crm/team', requireAdmin, async (request, response) => {
    const members = await teamMembers();
    const stats = await pool.query(
      `SELECT LOWER(owner) AS owner, COUNT(*) FILTER (WHERE stage IN ('${OPEN_STAGES.join("','")}'))::int AS open,
         COUNT(*) FILTER (WHERE stage = 'converted')::int AS converted
       FROM crm_contacts WHERE owner <> '' GROUP BY 1`,
    ).catch(() => ({ rows: [] }));
    const byOwner = Object.fromEntries(stats.rows.map(row => [row.owner, row]));
    const showEmail = isAdminRole(request.session.role);
    response.json({
      members: members.map(member => ({
        ...member,
        email: showEmail ? member.email : undefined,
        openLeads: byOwner[member.username.toLowerCase()]?.open || 0,
        converted: byOwner[member.username.toLowerCase()]?.converted || 0,
      })),
    });
  });

  app.post('/api/crm/team', requireSuperAdmin, async (request, response) => {
    const username = text(request.body?.username, 40).toLowerCase();
    const displayName = text(request.body?.displayName, 100);
    const email = text(request.body?.email, 254).toLowerCase();
    const role = ROLE_IDS.has(request.body?.role) ? request.body.role : 'agent';
    const password = String(request.body?.password || '');
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return response.status(400).json({ error: 'Username: 3–40 characters, letters, numbers, dot, dash or underscore.' });
    if (!displayName) return response.status(400).json({ error: 'Enter the team member\'s name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
    const pwProblem = passwordProblem(password, username);
    if (pwProblem) return response.status(400).json({ error: pwProblem });
    try {
      const exists = await pool.query('SELECT 1 FROM admin_security WHERE LOWER(username) = $1', [username]);
      if (exists.rowCount) return response.status(409).json({ error: 'That username is already taken.' });
      const salt = generateSalt();
      await pool.query(
        `INSERT INTO admin_security (username, password_hash, password_salt, email, email_verified, require_email_otp, role, display_name, is_active, receives_leads)
         VALUES ($1, $2, $3, $4, FALSE, FALSE, $5, $6, TRUE, $7)`,
        [username, hashPassword(password, salt), salt, email, role, displayName, role === 'agent' && request.body?.receivesLeads !== false],
      );
      response.status(201).json({ success: true });
    } catch (error) {
      console.error('CRM team create error:', error);
      response.status(500).json({ error: 'Unable to add the team member.' });
    }
  });

  app.patch('/api/crm/team/:username', requireSuperAdmin, async (request, response) => {
    const username = text(request.params.username, 80).toLowerCase();
    if (username === request.session.username.toLowerCase() && (request.body?.isActive === false || (request.body?.role && !isAdminRole(request.body.role)))) {
      return response.status(400).json({ error: 'You cannot deactivate or demote your own account.' });
    }
    try {
      const found = await pool.query('SELECT * FROM admin_security WHERE LOWER(username) = $1', [username]);
      if (!found.rowCount) return response.status(404).json({ error: 'Team member not found.' });
      if (request.body?.role !== undefined && ROLE_IDS.has(request.body.role)) {
        await pool.query('UPDATE admin_security SET role = $2, updated_at = NOW() WHERE LOWER(username) = $1', [username, request.body.role]);
      }
      if (request.body?.displayName) {
        await pool.query('UPDATE admin_security SET display_name = $2, updated_at = NOW() WHERE LOWER(username) = $1', [username, text(request.body.displayName, 100)]);
      }
      if (request.body?.email) {
        const email = text(request.body.email, 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
        await pool.query('UPDATE admin_security SET email = $2, updated_at = NOW() WHERE LOWER(username) = $1', [username, email]);
      }
      if (typeof request.body?.receivesLeads === 'boolean') {
        if (request.body.receivesLeads && (request.body.role || found.rows[0].role) !== 'agent') {
          return response.status(400).json({ error: 'Only sales agents get new customers. Change the role to Sales agent first.' });
        }
        await pool.query('UPDATE admin_security SET receives_leads = $2, updated_at = NOW() WHERE LOWER(username) = $1', [username, request.body.receivesLeads]);
      }
      if (request.body?.role !== undefined && request.body.role !== 'agent') {
        await pool.query('UPDATE admin_security SET receives_leads = FALSE WHERE LOWER(username) = $1', [username]);
      }
      let handover = null;
      if (typeof request.body?.isActive === 'boolean') {
        const wasActive = found.rows[0].is_active !== false;
        await pool.query('UPDATE admin_security SET is_active = $2, updated_at = NOW() WHERE LOWER(username) = $1', [username, request.body.isActive]);
        if (wasActive && !request.body.isActive) {
          await pool.query('UPDATE admin_security SET receives_leads = FALSE WHERE LOWER(username) = $1', [username]);
          handover = await shareOutCustomers(username, request.session.username);
          response.locals.auditDetails = { handover: handover.summary };
        }
      }
      if (request.body?.password) {
        const password = String(request.body.password);
        const pwProblem = passwordProblem(password, username);
        if (pwProblem) return response.status(400).json({ error: pwProblem });
        const salt = generateSalt();
        await pool.query('UPDATE admin_security SET password_hash = $2, password_salt = $3, updated_at = NOW() WHERE LOWER(username) = $1', [username, hashPassword(password, salt), salt]);
      }
      response.json({ success: true, handover });
    } catch (error) {
      console.error('CRM team update error:', error);
      response.status(500).json({ error: 'Unable to update the team member.' });
    }
  });

  return { upsertContactFromEnquiry: (enquiry, options = {}) => upsertContactFromEnquiry(pool, enquiry, { source: options.source, subject: options.subject }), addActivity: (...args) => addActivity(pool, ...args), setConsentWithdrawn: (contactId, withdrawn, options) => setConsentWithdrawn(pool, contactId, withdrawn, options) };
}

module.exports = { initCrm, registerCrmRoutes, phoneKey, STAGES, getSettings };

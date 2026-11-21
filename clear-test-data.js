/**
 * ONE-TIME CLEAN-UP before going live: removes all test enquiries and related data.
 *
 *   node clear-test-data.js            -> only SHOWS what would be deleted (safe, changes nothing)
 *   node clear-test-data.js --delete   -> deletes it, after you type DELETE to confirm
 *
 * Removed: enquiries, customers (Enquiries list), their notes/calls/emails history, schedules,
 *          support requests and their notes, job applications and the uploaded CV files,
 *          and unused password-reset codes.
 * Kept:    team accounts and passwords, settings, and all website content
 *          (pages, FAQs, support options, certificates, news, job openings and their files).
 * Numbering restarts, so the first real support request becomes SR-1001.
 *
 * Optional: add --staff priya,amit,sneha to also switch OFF those test staff logins
 *           (they are deactivated, not deleted, and can be switched on again in Settings → Team).
 *
 * Uses the same database as the website (DATABASE_URL / EXTERNAL_DATABASE_URL in .env).
 * Delete this file after you have used it.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');

const DATA_TABLES = [
  ['support_request_notes', 'Support request notes'],
  ['support_requests', 'Support requests'],
  ['crm_tasks', 'Schedules'],
  ['crm_activities', 'Customer history (notes, calls, emails)'],
  ['enquiries', 'Enquiries (each form submission)'],
  ['crm_contacts', 'Customers in the Enquiries list'],
  ['job_applications', 'Job applications'],
  ['admin_otps', 'Unused password-reset codes'],
];
const KEPT_TABLES = [
  ['admin_security', 'Team accounts'],
  ['site_pages', 'Website pages'],
  ['site_faqs', 'FAQs'],
  ['support_items', 'Support Center options'],
  ['site_certificates', 'Certificates'],
  ['news_posts', 'News posts'],
  ['job_openings', 'Job openings'],
];

const args = process.argv.slice(2);
const doDelete = args.includes('--delete');
const staffArg = args.includes('--staff') ? String(args[args.indexOf('--staff') + 1] || '') : '';
const staff = staffArg.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('No DATABASE_URL found in .env — run this from the website folder.');
  process.exit(1);
}
const pool = new Pool({ connectionString: databaseUrl });
const uploadsDir = path.join(__dirname, 'uploads');

async function count(table) {
  const exists = (await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`])).rows[0].t;
  if (!exists) return null;
  return Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
}

function resumeFiles() {
  try { return fs.readdirSync(uploadsDir).filter(name => name.startsWith('resume-')); } catch { return []; }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

(async () => {
  try {
    const host = new URL(databaseUrl).host;
    console.log(`\nDatabase: ${host}${new URL(databaseUrl).pathname}\n`);
    console.log('WILL BE DELETED:');
    const present = [];
    for (const [table, label] of DATA_TABLES) {
      const n = await count(table);
      if (n === null) continue;
      present.push(table);
      console.log(`  ${String(n).padStart(6)}  ${label}`);
    }
    const files = resumeFiles();
    console.log(`  ${String(files.length).padStart(6)}  Uploaded CV files (uploads/resume-*)`);
    console.log('\nKEPT (not touched):');
    for (const [table, label] of KEPT_TABLES) {
      const n = await count(table);
      if (n !== null) console.log(`  ${String(n).padStart(6)}  ${label}`);
    }
    if (staff.length) {
      const rows = (await pool.query('SELECT username, COALESCE(is_active, TRUE) AS active FROM admin_security WHERE LOWER(username) = ANY($1)', [staff])).rows;
      console.log(`\nSTAFF LOGINS TO SWITCH OFF: ${rows.length ? rows.map(r => `${r.username}${r.active ? '' : ' (already off)'}`).join(', ') : 'none of these usernames exist'}`);
    }

    if (!doDelete) {
      console.log('\nNothing was changed. To delete, run:  node clear-test-data.js --delete\n');
      return;
    }

    const answer = await ask('\nThis cannot be undone. Type DELETE to continue: ');
    if (answer !== 'DELETE') {
      console.log('Cancelled. Nothing was changed.');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE ${present.join(', ')} RESTART IDENTITY CASCADE`);
      if (staff.length) {
        await client.query('UPDATE admin_security SET is_active = FALSE WHERE LOWER(username) = ANY($1)', [staff]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    let removedFiles = 0;
    for (const name of files) {
      try { fs.unlinkSync(path.join(uploadsDir, name)); removedFiles += 1; } catch { /* ignore */ }
    }
    console.log(`\nDone. Test data deleted${removedFiles ? ` and ${removedFiles} CV file(s) removed` : ''}${staff.length ? '; listed staff logins switched off' : ''}.`);
    console.log('You can now delete clear-test-data.js.\n');
  } catch (error) {
    console.error('\nError:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

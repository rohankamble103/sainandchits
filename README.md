# Sainand Chits India

Responsive Node.js and Express website for Sainand Chits India Pvt. Ltd. The site includes public Bhisi plan information, enquiry forms, News & Announcements, and a protected admin workspace for managing website content.

## Requirements

- Node.js
- PostgreSQL

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure the PostgreSQL connection with `DATABASE_URL`.

3. Configure these environment values through the workspace Secrets tool:

   - `SESSION_SECRET` — signs admin sessions.
   - `ADMIN_PASSWORD` — enables admin sign-in.
    - `ADMIN_USERNAME` — optional; defaults to `rohan.kamble`.
    - `SYSTEM_ADMIN_PASSWORD` — optional; enables the `systemadmin` account. Leave empty to keep it disabled.
    - `GROQ_API_KEY` — enables the Sai chat endpoint.
    - `GROQ_MODEL` — optional; defaults to `openai/gpt-oss-120b`.

4. Apply `schema.sql` to the development database. The schema creates the enquiry, News & Announcements, site page, FAQ, support, and certificate tables and seeds starter public content.

5. Start the application:

   ```bash
   npm start
   ```

The application listens on port `5000` by default.

## Deploy on Vercel

This project includes a Vercel serverless entrypoint in `api/index.js` and a `vercel.json` route configuration. Import the repository into Vercel with the project root as the Root Directory, leave the Build Command empty, and use `npm start` only for local Replit development. Vercel will build `api/index.js` with the Node runtime.

Add these Vercel Environment Variables for the Production environment:

- `DATABASE_URL` — a network-reachable PostgreSQL connection string. Run `schema.sql` against this database before opening the site.
- `ADMIN_PASSWORD` — administrator login password.
- `SESSION_SECRET` — a long random value used to sign admin sessions.
- `GROQ_API_KEY` — enables the Sai chat endpoint.
- `GROQ_MODEL` — optional; defaults to `openai/gpt-oss-120b`.
- `ADMIN_USERNAME` — optional; defaults to `rohan.kamble`.
- `SYSTEM_ADMIN_PASSWORD` — optional; enables the `systemadmin` account.

The app serves static pages and API routes through the same Express function, so browser calls to `/api/...` remain same-origin on Vercel. Vercel's filesystem is temporary; uploaded News and certificate files are written to `/tmp` and can disappear when the function instance is replaced. Use durable object storage before relying on production uploads.

## Security notes

- `SESSION_SECRET` must be at least 32 characters; otherwise a random secret is used and admins are signed out on every restart.
- There are no built-in default passwords. The old defaults are always rejected.
- Only `css/`, `js/`, `images/`, the HTML pages, and `/uploads` are served publicly. Uploaded resumes are only visible to signed-in admins.
- Login, password-reset, enquiry, careers, and chat endpoints are rate limited per IP.

## Verification

Run the available syntax check with:

```bash
npm test
```

## Main public routes

- `/` — Homepage and Bhisi plans
- `/news` or `/news-announcements` — News & Announcements
- `/faq` — Frequently asked questions
- `/contact-us` — Contact information
- `/support-center` — Support options
- `/privacy-policy` — Privacy Policy
- `/authorized-certificates` — Published certificates
- `/terms-and-conditions` — Terms & Conditions

Short aliases are also available for some pages, including `/contact`, `/support`, `/privacy`, `/certificates`, and `/terms`.

## Customer CRM (`/admin`)

Every enquiry from the website form or the Sai chatbot becomes a **customer record**. Repeat enquiries from the same mobile number are added to the same customer.

When a customer submits the form:

1. The enquiry is saved and linked to their customer record.
2. The customer gets a **thank-you email** (needs `SMTP_USER` / `SMTP_PASS`).
3. The team gets an **alert email** at `LEADS_NOTIFICATION_EMAIL`, with an "Open in CRM" button.

What the team can do in the CRM:

- **Dashboard:** new leads, leads not called yet, overdue and today's follow-ups, pipeline summary, and recent activity. Switch between "My customers" and "Everyone".
- **Customers:** saved views (Open, My customers, Unassigned, Not called yet, Follow-up overdue/today, Converted, Not interested), search, filters, bulk assign / status change, and export to Excel (CSV, managers only).
- **Customer page:**
  - one-click Call and WhatsApp buttons
  - log the call result with remarks
  - change the status: New → Contacted → Interested → Documents pending → Converted, or Not interested (with a reason)
  - schedule follow-ups
  - send an email from the website, with templates
  - a full timeline of every action
- **Pipeline:** a board you can drag customers across.
- **Follow-ups:** overdue, today, tomorrow and later, for each team member.
- **Reports:** conversion funnel, leads per week, lead sources, popular plans, and team performance.
- **Team (owner only):** add team members as Owner/Admin, Manager or Sales agent, reset passwords, and deactivate people who leave.

More team features:

- **Every customer belongs to a sales agent:** website/chatbot enquiries, customers added by a manager and imported customers go to the next sales agent in turn (agents marked "Gets new customers" on the Team page). Customers an agent adds stay with that agent; repeat enquiries stay with the same agent. Follow-ups always go to the customer's agent and move with the customer. Only managers can change a customer's agent. When an agent is deactivated, their open customers and follow-ups are shared among the other agents (with a summary). If no agent is available, the customer stays unassigned, the alert email goes to the managers too, and the dashboard shows a "Share them with agents now" button.
- **New-enquiry alerts:** a bell in the CRM top bar checks every 30 seconds, plays a short sound and can show desktop notifications. Reports show the **average time to first call**.
- **Daily follow-up email at 9:30 AM (Mon–Sat):** each team member gets their overdue and today's follow-ups plus new leads not called yet. The owner and managers also get yesterday's summary. On Vercel this runs through the cron in `vercel.json` (set `CRON_SECRET`); on an always-on server the app sends it by itself. Use "Send me a test now" on the Team page.
- **Import from Excel/CSV** (Customers → Import): match the columns, choose what to do with existing customers, and get a report of rows that could not be imported.
- **Duplicates** (Customers → Duplicates): customers with the same email, or whose mobile matches another customer's mobile or alternate number. Merging moves all enquiries, calls, notes and follow-ups into the record you keep.
- **Activity log** (owner): sign-ins, failed sign-in attempts, exports, imports, merges, deletions and content changes, kept for about a year.
- **Repeat enquiries:** when an existing customer enquires again (matched by mobile number, or email), they move to the top of the Customers list (default sort "Latest enquiry first"), keep their status, get a red "Enquired again · 2nd" badge for 7 days and appear under the **Enquired again** tab. Their agent gets a "Call back — enquired again" follow-up and the alert email is marked "Repeat enquiry". The same form sent twice within 30 minutes counts as one.
- **Sorting:** click any column heading, or choose last contacted (oldest first), plan value, status order or most enquiries.

Website forms (contact form, enquiry pop-up, Sai chatbot, careers) have a **consent checkbox** (saved with each enquiry) and a small **"quick check" puzzle**, plus invisible bot traps.

Sales agents only see the CRM. Managers also see News & media and Job applications, and the owner also sees Site pages. These live in the website panel at `/admin/website`.

When the server starts, older enquiries (with their follow-up notes and scheduled calls) are moved into the CRM automatically.

## Admin workspace

Open `/admin/website` for website content. Enquiries are handled in the CRM at `/admin`. The website panel includes:

- Enquiry filtering, status updates, chat history, and follow-up notes.
- News & Announcements creation, editing, publishing, images, and media links.
- Page text editing for the public information pages.
- FAQ and Support Center item creation, editing, publishing, ordering, and deletion.
- Authorized certificate upload, description editing, publishing, ordering, and deletion.

Certificate uploads accept images and PDFs up to 10 MB. Editable public content is rendered as safe plain text rather than arbitrary HTML.

## Project structure

```text
server.js              Express server, APIs, authentication, and uploads
schema.sql             PostgreSQL tables and starter content
index.html              Public homepage
news.html               News & Announcements page
site-page.html          Shared public information-page template
admin.html              Admin workspace
css/                    Public and admin styles
js/                     Public, news, site-page, and admin behavior
images/                 Website image assets
uploads/                Locally served uploaded media
```
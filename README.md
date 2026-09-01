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
   - `ADMIN_USERNAME` — optional; defaults to `admin`.

4. Apply `schema.sql` to the development database. The schema creates the enquiry, News & Announcements, site page, FAQ, support, and certificate tables and seeds starter public content.

5. Start the application:

   ```bash
   npm start
   ```

The application listens on port `5000` by default.

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

## Admin workspace

Open `/admin` and sign in with the configured admin credentials. The workspace includes:

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
# Sainand Chits India

## Run locally in Replit

The app uses the existing HTML/CSS/JavaScript homepage with a small Express server and PostgreSQL persistence.

```bash
npm start
```

The configured `Start application` workflow serves the site on port 5000.

## Admin access

Open `/admin` to sign in. Configure these values as Replit Secrets before using the admin area:

- `ADMIN_PASSWORD` — required administrator password
- `ADMIN_USERNAME` — optional username; defaults to `admin`
- `SESSION_SECRET` — used to sign the administrator session cookie (already provisioned in this workspace)

The admin area manages saved enquiries and News / Blog posts. Each enquiry has three contact-attempt fields plus team notes. News posts support YouTube links, Instagram links, photo links, and uploaded photos.

## Chat assistant

The public Sai chat widget calls `/api/chat`. Add `OPENAI_API_KEY` as a Replit Secret to enable answers. `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`.

## Data

Development tables are defined in `schema.sql`:

- `enquiries` stores contact form submissions and admin follow-up notes.
- `news_posts` stores public and draft YouTube, Instagram, and News / Blog content.

The homepage design and existing color system remain in `css/styles.css`.
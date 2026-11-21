# Going live on AWS: Sainand Chits India

The website and admin panel run on your AWS server in `/home/ubuntu/sainandchits`.
Follow these steps in order. Every command is run on the server (SSH in as `ubuntu`).

---

## 0. Before you start (details only you can give)

| Item | Where it goes |
|---|---|
| Chit fund registration number | `config/site.js` → `registrationNo` |
| Real "Families served" figure | `config/site.js` → stats |
| Office address (confirm) | `config/site.js` → `address` |
| 6th leader's photo + name | `images/team/` + `config/site.js` → `team` |
| Business email on your domain | `.env` → `COMPANY_EMAIL`, `SMTP_*` |
| Domain pointed to the server | DNS: an **A record** for `sainandchits.com` and `www` → the server's public IP |

On AWS, use an **Elastic IP** so the address never changes, and in the **Security Group** allow only
ports **22** (SSH, ideally only from your own IP), **80** and **443**. Port 5001 must **not** be open to the internet.

---

## 1. Install the server tools (one time)

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx postgresql-client
sudo npm install -g pm2
```

## 2. Copy the new code

Upload the website folder to `/home/ubuntu/sainandchits` (not `node_modules`, not `.env`), then:

```bash
cd /home/ubuntu/sainandchits
npm ci --omit=dev
mkdir -p logs uploads
```

## 3. Production settings (.env)

```bash
cp deploy/env.production.example .env      # only the first time; otherwise edit your existing .env
nano .env                            # fill every <...> value
chmod 600 .env
node services/config-check.js        # must say "No blocking problems"
```

Make a new session secret with:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

> In production the app **refuses to start** if a setting is unsafe (weak admin password, short
> session secret, `PUBLIC_SITE_URL` not https). The check tells you exactly which one.

## 4. Start with PM2 (auto-restart, survives reboots)

```bash
pm2 delete all 2>/dev/null; pm2 start ecosystem.config.js
pm2 save
pm2 startup        # run the one command it prints, then: pm2 save
pm2 install pm2-logrotate
curl -s http://127.0.0.1:5001/api/health    # {"ok":true,"database":"up",...}
```

## 5. nginx + free HTTPS certificate

```bash
sudo cp deploy/sainand-proxy.conf /etc/nginx/snippets/sainand-proxy.conf
sudo cp deploy/nginx-sainand.conf /etc/nginx/sites-available/sainand
sudo ln -sf /etc/nginx/sites-available/sainand /etc/nginx/sites-enabled/sainand
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d sainandchits.com -d www.sainandchits.com --redirect
```

Certbot renews the certificate automatically. Check with `sudo certbot renew --dry-run`.

> With `NODE_ENV=production` the app sends every plain-http visitor to https.
> Do steps 4 and 5 together; until HTTPS works you can set `FORCE_HTTPS=false` in `.env` temporarily.

## 6. Nightly backups (keeps 14 days)

```bash
chmod +x deploy/backup-db.sh
mkdir -p ~/backups && ./deploy/backup-db.sh      # test it once
crontab -e
# add this line:
30 2 * * * /home/ubuntu/sainandchits/deploy/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
```

Backups on the same server don't protect against losing the server. Also either:
- turn on **AWS Backup / EBS snapshots** for the server's disk (daily, keep 14), **or**
- create a private S3 bucket and put `S3_BUCKET=your-bucket` at the top of the crontab line.

**Restore** (only if needed): `pg_restore --clean --no-owner --dbname="$DATABASE_URL" ~/backups/sainand-db-<date>.dump`

## 7. Start clean (remove test data)

```bash
node clear-test-data.js                 # dry run: shows what would be removed
node clear-test-data.js --delete        # type DELETE to confirm
```

## 8. Final checks (5 minutes)

- [ ] `https://sainandchits.com` opens with the padlock; `http://` and `www.` redirect to it
- [ ] Submit the enquiry form and a support request: both appear in the admin panel and the office email arrives
- [ ] Sign in to `/admin`; create each staff member's account with their own password
- [ ] Sitemap: `https://sainandchits.com/sitemap.xml`; submit it in Google Search Console
- [ ] Share the home page link on WhatsApp: the preview card shows the logo banner
- [ ] Security headers check: https://securityheaders.com (expect A)
- [ ] SSL check: https://www.ssllabs.com/ssltest (expect A)

## Updating the site later

```bash
cd /home/ubuntu/sainandchits
./deploy/backup-db.sh            # backup first
# copy the changed files in
npm ci --omit=dev
pm2 reload sainand               # no downtime
pm2 logs sainand --lines 50      # check for errors
```

## What is already built in

- HTTPS-only cookies, HSTS, strict Content-Security-Policy and other security headers
- Admin sign-in ends after 30 minutes of inactivity (`ADMIN_IDLE_MINUTES`) and always after 12 hours
- Strong password rule for every new or changed admin password (12+ characters, letters and numbers)
- Email OTP option, role-based access (sales agents see CRM only), audit log of admin actions
- CVs are only downloadable by signed-in managers, never cached
- Rate limits on forms and sign-in, human check and consent on every form (DPDP)
- Errors are logged on the server only; visitors never see technical details
- `/api/health` for uptime monitoring (e.g. free UptimeRobot check every 5 minutes)

## Recommended (not code)

- Have a CA / lawyer review the Privacy Policy and Terms against the Chit Funds Act and DPDP Act
- Turn on AWS billing alerts, and MFA on the AWS root account
- Add a free uptime monitor on `https://sainandchits.com/api/health`

/**
 * Fills the public pages from config/site.js: shared top bar, menu, footer and phone action bar,
 * plus the numbers bar, plan cards, plan options and leadership on the home page.
 *
 * Pages mark the spots with comments, e.g. <!--@header page="home"-->, and words like {{phone}}.
 */
const { SUPPORT_TOPICS } = require('./support-topics');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'site.js');
function loadSite() {
  delete require.cache[require.resolve(CONFIG_PATH)];
  return require(CONFIG_PATH);
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const digits = value => String(value || '').replace(/\D/g, '');
/** Indian number format: 107000 -> 1,07,000 */
const inr = value => Math.round(Number(value) || 0).toLocaleString('en-IN');
const lakhLabel = amount => {
  if (amount >= 10000000) return `₹${+(amount / 10000000).toFixed(2)} Crore`;
  const lakh = amount / 100000;
  return lakh >= 100 ? `₹${+(lakh / 100).toFixed(2)} Crore` : `₹${+lakh.toFixed(2)} Lakh`;
};

/** The numbers behind one plan, following the company's commission model. */
function planNumbers(plan, site) {
  const months = Number(plan.months || plan.members);
  const group = months + 1; // members + 1 company share
  const share = plan.amount / group;
  const commission = Math.round((share * site.commissionPercent) / 100);
  const fixed = Math.round(share) + commission;
  // Example from month 3: the Bhisi is taken at 70% of the plan amount.
  const exampleTaken = Math.round(plan.amount * 0.7);
  const examplePay = Math.round(exampleTaken / group) + commission;
  const members = Number(plan.members || months);
  return {
    amount: plan.amount,
    label: lakhLabel(plan.amount),
    members,
    instalment: Math.round(plan.amount / members), // full monthly instalment, before any auction discount
    months,
    group,
    share: Math.round(share),
    commission,
    fixed,
    exampleTaken,
    examplePay,
    featured: Boolean(plan.featured),
    option: `${lakhLabel(plan.amount)} Bhisi (${months} months)`,
  };
}

const ICON = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3 .78.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.42l-.75-1.8c-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.7 2.7 0 0 0-.85 2.02 4.7 4.7 0 0 0 1 2.5 10.8 10.8 0 0 0 4.13 3.65c1.54.66 2.14.72 2.91.6.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h1.6v5.2l4.2 2.5-.8 1.3L11 13z"/></svg>',
  form: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
};

function regLine(site) {
  return site.registrationNo
    ? `Registered under the ${esc(site.registeredUnder)} · Reg. No. ${esc(site.registrationNo)}`
    : `Registered under the ${esc(site.registeredUnder)}`;
}

const MENU = [
  ['home', '/', 'Home'],
  ['scheme', '/#scheme', 'How it works'],
  ['plans', '/#plans', 'Plans'],
  ['about', '/#about', 'About us'],
  ['news', '/news', 'News'],
  ['careers', '/careers', 'Careers'],
  ['contact', '/contact-us', 'Contact'],
];

function topbar(site) {
  return `<div class="top-bar">
  <div class="wrap">
    <div class="contacts">
      <a class="top-contact" href="tel:+${digits(site.phone)}" aria-label="Call ${esc(site.phone)}"><span>${ICON.phone}${esc(site.phone)}</span></a>
      <a class="top-contact" href="mailto:${esc(site.email)}" aria-label="Email ${esc(site.email)}"><span>${ICON.mail}${esc(site.email)}</span></a>
    </div>
    <div class="location">
      <span class="top-contact top-hours">${ICON.clock}${esc(site.hours)}</span>
      <a class="top-contact" href="${esc(site.mapUrl)}" target="_blank" rel="noopener" aria-label="Open our office in Google Maps"><span>${ICON.pin}<span class="tb-full">${esc(site.city)}</span><span class="tb-short">${esc(site.city.split(',')[0])}</span></span></a>
    </div>
  </div>
</div>`;
}

function header(site, { page = '', cta = 'enquire' } = {}) {
  const ctaHtml = cta === 'join'
    ? '<button type="button" class="btn-fill menu-desktop" data-job="General Application">Join Us</button>'
    : '<a href="/#contact" class="btn-fill menu-desktop enquiry-trigger">Enquire Now</a>';
  return `<header>
  <div class="wrap">
    <a class="brand" href="/" aria-label="${esc(site.shortName)} home"><img src="/images/logo.webp" alt="${esc(site.company)}" class="logo-img" width="863" height="289"></a>
    <nav aria-label="Main">
      <ul class="menu-desktop">
        ${MENU.map(([id, href, label]) => `<li><a href="${href}"${id === page ? ' class="active" aria-current="page"' : ''}>${label}</a></li>`).join('\n        ')}
        <li class="mobile-enquire-item"><a href="/#contact" class="btn-fill enquiry-trigger mobile-enquire-btn">Enquire Now</a></li>
      </ul>
      ${ctaHtml}
      <button class="menu-toggle" aria-label="Menu" aria-expanded="false">&#9776;</button>
    </nav>
  </div>
</header>`;
}

function footer(site) {
  const year = new Date().getFullYear();
  return `<footer>
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-col">
        <div class="footer-brand"><div class="footer-logo-plate"><img src="/images/logo.webp" alt="${esc(site.company)}" class="footer-logo-img" loading="lazy"></div></div>
        <p>Bhisi (chit fund) savings groups in ${esc(site.city)}, backed by ${esc(site.yearsOfService)} years of service. Transparent monthly bidding, every payment recorded, a statement every month.</p>
        <p class="footer-reg">${ICON.check}${regLine(site)}</p>
      </div>
      <div class="footer-col">
        <h4>Quick links</h4>
        <ul>
          <li><a href="/#scheme">How it works</a></li>
          <li><a href="/#plans">Plans</a></li>
          <li><a href="/#about">About us</a></li>
          <li><a href="/news">News</a></li>
          <li><a href="/careers">Careers</a></li>
          <li><a href="/contact-us">Contact us</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Information</h4>
        <ul>
          <li><a href="/faq">FAQ</a></li>
          <li><a href="/support-center">Support center</a></li>
          <li><a href="/authorized-certificates">Certificates</a></li>
          <li><a href="/privacy-policy">Privacy policy</a></li>
          <li><a href="/terms-and-conditions">Terms &amp; conditions</a></li>
        </ul>
      </div>
      <div class="footer-col footer-contact">
        <h4>Contact</h4>
        <a href="tel:+${digits(site.phone)}">${ICON.phone}${esc(site.phone)}</a>
        <a href="https://wa.me/${digits(site.whatsapp)}" target="_blank" rel="noopener">${ICON.whatsapp}WhatsApp us</a>
        <a href="mailto:${esc(site.email)}">${ICON.mail}${esc(site.email)}</a>
        <a href="${esc(site.mapUrl)}" target="_blank" rel="noopener">${ICON.pin}${esc(site.address.slice(1).join(', '))}</a>
        <span>${ICON.clock}${esc(site.hours)}</span>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${year} ${esc(String(site.company).replace(/\.$/, ''))}. All rights reserved.</span>
      <span>Please confirm plan details with our team before joining.</span>
      <a href="/admin" class="staff-login" rel="nofollow">Staff login</a>
    </div>
  </div>
</footer>`;
}

function mobileBar(site) {
  return `<nav class="m-actionbar" aria-label="Quick contact">
  <a href="tel:+${digits(site.phone)}" class="m-call">${ICON.phone}<span>Call</span></a>
  <a href="https://wa.me/${digits(site.whatsapp)}?text=${encodeURIComponent(`Hi, I would like to know about your Bhisi plans.`)}" target="_blank" rel="noopener" class="m-wa">${ICON.whatsapp}<span>WhatsApp</span></a>
  <a href="/#contact" class="m-enquire enquiry-trigger">${ICON.form}<span>Enquire</span></a>
</nav>`;
}

function stats(site) {
  return site.stats.map((s, i) => `<div class="stat reveal"${i ? ` style="transition-delay:.${i}s"` : ''}>
      <div class="stat-num"><span class="count" data-target="${Number(s.value) || 0}">0</span><span class="suffix">${esc(s.suffix)}</span></div>
      <div class="stat-label">${esc(s.label)}</div>
    </div>`).join('\n    ');
}

function plans(site) {
  // A short line under each plan card, chosen by plan amount.
  const PLAN_LINES = {
    500000: 'Small savings today, a big smile tomorrow.',
    1000000: 'Ready for something bigger? Start here.',
    2500000: 'Big plans need steady steps.',
    5000000: 'Big money, built together.',
    10000000: 'Think big. Save together. Build a legacy.',
  };
  return site.plans.map((plan, index) => {
    const p = planNumbers(plan, site);
    return `<article class="plan-card${p.featured ? ' feat' : ''}">
      ${p.featured ? '<div class="plan-tag">Most popular</div>' : ''}
      <div class="amt">${p.label}</div>
      <div class="sub">${p.months} months · ${p.members} members</div>
      <p class="plan-after">${PLAN_LINES[plan.amount] || 'Save a little every month. Take the full amount when your dream calls.'}</p>
      <div class="plan-card-actions">
        <a href="#contact" class="plan-details-btn btn-plan-enquire" data-plan-index="${index}" data-plan="${esc(p.option)}" aria-haspopup="dialog">View Details</a>
      </div>
    </article>`;
  }).join('\n      ');
}

function planOptions(site) {
  return `${site.plans.map(plan => `<option>${esc(planNumbers(plan, site).option)}</option>`).join('')}<option>Not sure yet – need more information</option>`;
}

const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
function team(site) {
  return site.team.map((m, i) => `<div class="team-card reveal"${i % 3 ? ` style="transition-delay:.${i % 3}s"` : ''}>
        <div class="team-photo">${m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}" width="240" height="240" loading="lazy">` : esc(initials(m.name))}</div>
        <h3>${esc(m.name)}</h3>${m.role ? `
        <div class="role">${esc(m.role)}</div>` : ''}${m.bio ? `
        <p>${esc(m.bio)}</p>` : ''}
      </div>`).join('\n      ');
}

/** Banner slides for the top of the home page (the original full-width slider). */
function banners(site) {
  const offered = new Set(site.plans.map(p => p.amount));
  const list = (site.banners || []).filter(b => !b.plan || offered.has(b.plan));
  // A phone version is used automatically when "<name>-mobile.webp" sits next to the desktop file.
  const hasMobile = b => fs.existsSync(path.join(__dirname, '..', b.image.replace(/^\//, '') + '-mobile.webp'));
  return list.map((b, i) => {
    const img = `<img src="${esc(b.image)}-full.webp" alt="${esc(b.alt)}" width="1264" height="848" decoding="async" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`;
    // Until a banner has its own phone version, phones show it on a soft blurred copy of itself.
    if (!hasMobile(b)) return `<div class="slide" style="--slide-bg:url('${esc(b.image)}-full.webp')">${img}</div>`;
    return `<div class="slide has-mobile"><picture><source media="(max-width: 640px)" srcset="${esc(b.image)}-mobile.webp" width="1080" height="1080">${img}</picture></div>`;
  }).join('\n      ');
}

/** "Getting started" timeline: the 4 steps on a glowing track (steps only, no amounts). */
function howSteps() {
  const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const steps = [
    { title: 'Choose a plan', text: 'Talk to our team and pick the Bhisi size and duration that suit your savings goal and monthly budget.',
      icon: icon('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>') },
    { title: 'Join a group', text: 'Complete a simple sign-up and join one fixed group. The same members stay together until the cycle ends.',
      icon: icon('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19c.6-3 2.9-4.8 5.5-4.8s4.9 1.8 5.5 4.8M15 14.4c2.6-.3 4.7 1.2 5.3 4"/>') },
    { title: 'Pay monthly', text: 'Pay your instalment every month. Each payment is recorded, and you get a monthly statement.',
      icon: icon('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M10 14h4"/>') },
    { title: 'Take the Bhisi', text: 'When you need the money, bid for that month’s Bhisi. Every member receives the Bhisi once during the cycle.',
      icon: icon('<path d="M12 21c4.4 0 7.5-2.3 7.5-6 0-3.7-3-7-5.5-8.5l1.5-3h-7l1.5 3C7.5 8 4.5 11.3 4.5 15c0 3.7 3.1 6 7.5 6z"/><path d="M10 12.5h4M10 15h4M11.2 12.5c1.6 0 1.6 2.5 0 2.5l2.3 2.5"/>') },
  ];
  const items = steps.map((step, i) => `<div class="jr-step" role="listitem" data-step="${i}" tabindex="0">
          <div class="jr-node">${step.icon}<span class="jr-num">${i + 1}</span></div>
          <div class="jr-card">
            <span class="jr-kicker">Step ${i + 1}</span>
            <h3>${esc(step.title)}</h3>
            <p>${esc(step.text)}</p>
          </div>
        </div>`).join('\n        ');
  return `<div class="jr" data-journey>
      <div class="jr-steps" role="list">
        <svg class="jr-svg" aria-hidden="true">
          <defs><mask id="jrMask" maskUnits="userSpaceOnUse"><path class="jr-mask" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/></mask></defs>
          <path class="jr-base"/>
          <path class="jr-glow" mask="url(#jrMask)"/>
          <circle class="jr-start" r="5"/>
          <circle class="jr-finish-dot" r="7"/>
        </svg>
        ${items}
        <span class="jr-finish">✓ Bhisi in hand</span>
      </div>
    </div>`;
}

// ---------- Home page v2 (preview at /v2) ----------
const rupees = n => `₹${inr(n)}`;

/** Plan comparison rows: amount, length, months 1–2 instalment, and the most anyone pays later. */
function v2Plans(site) {
  return site.plans.map(plan => {
    const p = planNumbers(plan, site);
    return `<tr${p.featured ? ' class="is-popular"' : ''}>
            <th scope="row"><span class="v2-amt">${esc(p.label)}</span>${p.featured ? '<span class="v2-tag">Most chosen</span>' : ''}</th>
            <td data-label="Length">${p.months} months</td>
            <td data-label="Group">${p.months} members</td>
            <td data-label="Months 1–2"><span class="v2-num">${rupees(p.fixed)}</span><small>a month</small></td>
            <td data-label="From month 3"><span class="v2-num">Up to ${rupees(p.fixed)}</span><small>less when bids are low</small></td>
            <td class="v2-act"><a href="#contact" class="v2-link enquiry-trigger" data-plan="${esc(p.option)}">Ask about ${esc(p.label)}</a></td>
          </tr>`;
  }).join('\n          ');
}

/** Numbers for the worked example in the hero statement (the featured plan). */
function v2Example(site) {
  const plan = site.plans.find(x => x.featured) || site.plans[0];
  const p = planNumbers(plan, site);
  return `data-amount="${p.amount}" data-group="${p.group}" data-commission="${p.commission}" data-fixed="${p.fixed}"`;
}

function v2Team(site) {
  return site.team.map(m => `<li class="v2-person">
          <div class="v2-person-photo">${m.photo ? `<img src="${esc(m.photo)}" alt="" width="240" height="240" loading="lazy">` : `<span>${esc(initials(m.name))}</span>`}</div>
          <h3>${esc(m.name)}</h3>${m.role ? `<p>${esc(m.role)}</p>` : ''}
        </li>`).join('\n        ');
}

/** Live website address used in canonical links, link previews and the sitemap. */
function siteBaseUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://sainandchits.com').replace(/\/$/, '');
}

/**
 * Title, description, canonical link and link-preview tags (WhatsApp, Facebook, LinkedIn, X),
 * written into the page on the server so apps that do not run JavaScript still see them.
 */
function seo(html, { path = '/', title, description, image = '/images/og-image.jpg', noindex = false, structured = null } = {}) {
  const site = loadSite();
  const base = siteBaseUrl();
  const attr = value => String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = html
    .replace(/[ \t]*<meta (?:property|name)="(?:og|twitter):[^"]*"[^>]*>\n?/g, '')
    .replace(/[ \t]*<link rel="canonical"[^>]*>\n?/g, '');
  const pageTitle = title || (out.match(/<title>([^<]*)<\/title>/) || [])[1] || site.company;
  const plainTitle = pageTitle.replace(/&amp;/g, '&');
  let desc = description;
  if (desc) out = out.replace(/<meta([^>]*)name="description"([^>]*)content="[^"]*"/, `<meta$1name="description"$2content="${attr(desc)}"`);
  else desc = ((out.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) || [])[1] || '').replace(/&amp;/g, '&');
  if (title) out = out.replace(/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`);
  const url = `${base}${path === '/' ? '/' : path}`;
  const img = /^https?:/.test(image) ? image : `${base}${image}`;
  if (noindex) return /name="robots"/.test(out) ? out : out.replace('</head>', '  <meta name="robots" content="noindex">\n</head>');
  const tags = [
    `<link rel="canonical" href="${attr(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${attr(site.company)}">`,
    '<meta property="og:locale" content="en_IN">',
    `<meta property="og:title" content="${attr(plainTitle)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta property="og:image" content="${attr(img)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="Sainand Chits India – Secure your future with us">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${attr(plainTitle)}">`,
    `<meta name="twitter:description" content="${attr(desc)}">`,
    `<meta name="twitter:image" content="${attr(img)}">`,
  ].map(tag => `  ${tag}`).join('\n');
  // Invisible company / page / FAQ details for Google, Bing and AI assistants.
  const jsonLd = structured
    ? `\n  ${require('./structured-data').jsonLdScript(site, base, { path, title: plainTitle, description: desc, name: structured.name || plainTitle.replace(/\s*\|.*$/, ''), faqs: structured.faqs, team: structured.team })}`
    : '';
  return out.replace('</head>', `${tags}${jsonLd}\n</head>`);
}

/** Public subset of the settings, for the plan calculator in the browser. */
function clientConfig(site) {
  // Only what the browser needs: plan names and the full instalment for the plan pop-up.
  return {
    phone: site.phone,
    email: site.email,
    // Cloudflare Turnstile (public site key only; the secret stays on the server).
    ...(require('./humancheck').turnstileEnabled() ? { turnstileSiteKey: String(process.env.TURNSTILE_SITE_KEY).trim() } : {}),
    plans: site.plans.map(plan => {
      const p = planNumbers(plan, site);
      return { amount: p.amount, label: p.label, months: p.months, members: p.members, instalment: p.instalment, featured: p.featured, option: p.option };
    }),
  };
}

function attrs(text) {
  const out = {};
  String(text || '').replace(/(\w+)="([^"]*)"/g, (_, key, value) => { out[key] = value; });
  return out;
}

function renderPage(html) {
  const site = loadSite();
  const blocks = {
    topbar: () => topbar(site),
    header: a => header(site, a),
    footer: () => footer(site),
    mobilebar: () => mobileBar(site),
    stats: () => stats(site),
    plans: () => plans(site),
    planOptions: () => planOptions(site),
    team: () => team(site),
    howSteps: () => howSteps(),
    supportTopics: () => ['<option value="">Select a topic</option>', ...SUPPORT_TOPICS.map(t => `<option value="${t.id}">${esc(t.label)}</option>`)].join(''),
    banners: () => banners(site),
    v2Plans: () => v2Plans(site),
    v2Team: () => v2Team(site),
    siteConfig: () => `<script>window.SAINAND_SITE = ${JSON.stringify(clientConfig(site)).replace(/</g, '\\u003c')};</script>`,
  };
  const words = {
    company: esc(site.company),
    shortName: esc(site.shortName),
    phone: esc(site.phone),
    phoneHref: `tel:+${digits(site.phone)}`,
    whatsappHref: `https://wa.me/${digits(site.whatsapp)}`,
    email: esc(site.email),
    hours: esc(site.hours),
    grievanceName: esc(site.grievanceOfficer?.name || 'Grievance Officer'),
    grievanceEmail: esc(site.grievanceOfficer?.email || site.email),
    grievancePhone: esc(site.grievanceOfficer?.phone || site.phone),
    grievancePhoneHref: `tel:+${digits(site.grievanceOfficer?.phone || site.phone)}`,
    city: esc(site.city),
    addressHtml: site.address.map(esc).join('<br>'),
    mapUrl: esc(site.mapUrl),
    mapEmbed: `https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`,
    years: esc(site.yearsOfService),
    regLine: regLine(site),
    commission: esc(site.commissionPercent),
    planCount: esc(site.plans.length),
    planRange: `${lakhLabel(Math.min(...site.plans.map(p => p.amount)))} to ${lakhLabel(Math.max(...site.plans.map(p => p.amount)))}`,
    year: String(new Date().getFullYear()),
    v2Example: v2Example(site),
    v2ExampleLabel: esc(lakhLabel((site.plans.find(x => x.featured) || site.plans[0]).amount)),
    v2ExampleMonths: esc((site.plans.find(x => x.featured) || site.plans[0]).months),
    v2ExampleFixed: rupees(planNumbers(site.plans.find(x => x.featured) || site.plans[0], site).fixed),
    v2ExampleShare: rupees(planNumbers(site.plans.find(x => x.featured) || site.plans[0], site).share),
    v2ExampleCommission: rupees(planNumbers(site.plans.find(x => x.featured) || site.plans[0], site).commission),
    v2ExampleGroup: esc(planNumbers(site.plans.find(x => x.featured) || site.plans[0], site).group),
    regNo: esc(site.registrationNo || ''),
  };
  return html
    .replace(/<!--@(\w+)([^>]*?)-->/g, (match, name, rest) => (blocks[name] ? blocks[name](attrs(rest)) : match))
    .replace(/\{\{(\w+)\}\}/g, (match, name) => (name in words ? words[name] : match));
}

/** Swap the old placeholder phone/email in admin-edited page text for the current details. */
function refreshContactText(text) {
  const site = loadSite();
  return String(text ?? '')
    .replace(/\+91 98765 43210/g, site.phone)
    .replace(/tel:\+919876543210/g, `tel:+${digits(site.phone)}`)
    .replace(/wa\.me\/919876543210/g, `wa.me/${digits(site.whatsapp || site.phone)}`);
}

module.exports = {
  seo,
  siteBaseUrl, renderPage, loadSite, planNumbers, clientConfig, refreshContactText, inr, lakhLabel };

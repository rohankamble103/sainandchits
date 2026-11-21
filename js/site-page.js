const pageSlugByPath = {
  '/faq': 'faq',
  '/contact': 'contact-us',
  '/contact-us': 'contact-us',
  '/support': 'support-center',
  '/support-center': 'support-center',
  '/privacy': 'privacy-policy',
  '/privacy-policy': 'privacy-policy',
  '/certificates': 'authorized-certificates',
  '/authorized-certificates': 'authorized-certificates',
  '/terms': 'terms-and-conditions',
  '/terms-and-conditions': 'terms-and-conditions',
};

function escapePageHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function safePageLink(value) {
  const link = String(value || '').trim();
  return /^(https?:|mailto:|tel:|\/|#)/i.test(link) ? link : '';
}

// Page text: blank line between paragraphs, "## " starts a heading, "- " starts a bullet point.
function renderPageBody(body) {
  const blocks = String(body || '').trim().split(/\n\s*\n/).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split('\n');
    let html = '';
    let list = [];
    const flushList = () => { if (list.length) { html += `<ul>${list.map(item => `<li>${escapePageHtml(item)}</li>`).join('')}</ul>`; list = []; } };
    let para = [];
    const flushPara = () => { if (para.length) { html += `<p>${para.map(escapePageHtml).join('<br>')}</p>`; para = []; } };
    lines.forEach(line => {
      if (/^##\s+/.test(line)) { flushPara(); flushList(); html += `<h2>${escapePageHtml(line.replace(/^##\s+/, ''))}</h2>`; }
      else if (/^-\s+/.test(line)) { flushPara(); list.push(line.replace(/^-\s+/, '')); }
      else { flushList(); para.push(line); }
    });
    flushPara(); flushList();
    return html;
  }).join('');
}

function renderFaqs(faqs) {
  const list = document.getElementById('faqList');
  if (!faqs.length) {
    list.innerHTML = '<div class="site-page-empty">Frequently asked questions will appear here soon.</div>';
    return;
  }
  const paragraphs = answer => {
    const [first, ...rest] = String(answer || '').split(/\n\s*\n/);
    return `<p${rest.length ? ' class="faq-short"' : ''}>${escapePageHtml(first)}</p>${rest.map(part => `<p>${escapePageHtml(part)}</p>`).join('')}`;
  };
  list.innerHTML = faqs.map(faq => `
    <article class="faq-item">
      <h3>${escapePageHtml(faq.question)}</h3>
      ${paragraphs(faq.answer)}
    </article>
  `).join('');
}

function renderSupportItems(items) {
  const list = document.getElementById('supportList');
  if (!items.length) {
    list.closest('section').hidden = true;
    return;
  }
  const iconFor = link => {
    if (/^tel:/i.test(link)) return { cls: 'is-call', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z"/></svg>', cta: 'Call now' };
    if (/wa\.me|whatsapp/i.test(link)) return { cls: 'is-wa', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.5-.7a12.2 12.2 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2.9.9 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6a8.4 8.4 0 0 0 1.6 2 7.6 7.6 0 0 0 2.3 1.4c.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.4a2.3 2.3 0 0 1-.2 1.2z"/></svg>', cta: 'Chat on WhatsApp' };
    if (/^mailto:/i.test(link)) return { cls: 'is-mail', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>', cta: 'Send an email' };
    return { cls: 'is-visit', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/></svg>', cta: 'View details' };
  };
  list.innerHTML = items.map(item => {
    const link = safePageLink(item.linkUrl);
    const look = iconFor(link);
    const tag = link ? 'a' : 'div';
    const attrs = link ? ` href="${escapePageHtml(link)}"${/^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : ''}` : '';
    return `
      <${tag} class="support-card ${look.cls}"${attrs}>
        <span class="sq-icon">${look.icon}</span>
        <span class="sq-text"><strong>${escapePageHtml(item.title)}</strong><span>${escapePageHtml(item.description)}</span>${link ? `<em>${look.cta} →</em>` : ''}</span>
      </${tag}>`;
  }).join('');
}

// ---------- "Raise a support request" form ----------
function initSupportRequestForm() {
  const form = document.getElementById('supportRequestForm');
  if (!form || form.dataset.ready) return;
  form.dataset.ready = '1';
  const note = document.getElementById('srNote');
  const button = form.querySelector('.sr-submit');
  const tries = () => window.SainandForms;
  const attachCheck = () => { if (tries()) tries().attach(form); else setTimeout(attachCheck, 100); };
  attachCheck();
  const showNote = message => { note.textContent = message; note.hidden = !message; };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const digits = String(data.phone || '').replace(/\D/g, '');
    if (!String(data.name || '').trim()) return showNote('Please enter your name.');
    if (digits.length < 10) return showNote('Please enter a valid 10-digit mobile number.');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return showNote('Please enter a valid email address, or leave it empty.');
    if (!data.topic) return showNote('Please choose what you need help with.');
    if (data.topic !== 'privacy' && String(data.message || '').trim().length < 5) return showNote('Please tell us a little about your request.');
    const problem = tries()?.problem(form);
    if (problem) return showNote(problem);
    showNote('');
    button.disabled = true;
    button.textContent = 'Sending...';
    try {
      const response = await fetch('/api/support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, phone: data.phone, email: data.email, memberNo: data.memberNo, topic: data.topic, message: data.message, ...(tries()?.values(form) || {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.refreshChallenge) tries()?.refresh(form);
        throw new Error(result.error || 'Could not send your request. Please try again.');
      }
      const topicLabel = form.querySelector(`#srTopic option[value="${CSS.escape(data.topic)}"]`)?.textContent || '';
      const firstName = String(data.name).trim().split(/\s+/)[0];
      const card = form.closest('.sr-form-card');
      card.classList.add('is-done');
      card.innerHTML = `
        <div class="sr-done" role="status">
          <span class="sr-done-tick" aria-hidden="true">✓</span>
          <h2>Thank you, ${escapePageHtml(firstName)}!</h2>
          <p>Your request has been received.</p>
          <div class="sr-ref"><span>Your request number</span><strong>${escapePageHtml(result.ref)}</strong><small>${escapePageHtml(topicLabel)}</small></div>
          <p class="sr-done-small">${data.email ? 'We have also emailed this number to you. ' : ''}Our team will get back to you, usually within one working day. Please quote this number if you call us.</p>
          <button type="button" class="sr-again">Raise another request</button>
        </div>`;
      card.querySelector('.sr-again').addEventListener('click', () => window.location.reload());
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      showNote(error.message);
      button.disabled = false;
      button.textContent = 'Submit request';
    }
  });
}

function renderCertificates(certificates) {
  const list = document.getElementById('certificateList');
  if (!certificates.length) {
    list.innerHTML = '<div class="site-page-empty">Certificates will appear here when they are published.</div>';
    return;
  }
  list.innerHTML = certificates.map(certificate => {
    const fileUrl = safePageLink(certificate.fileUrl);
    return `
      <article class="certificate-card">
        <div class="certificate-icon" aria-hidden="true">▣</div>
        <h3>${escapePageHtml(certificate.title)}</h3>
        <p>${escapePageHtml(certificate.description)}</p>
        ${fileUrl ? `<a href="${escapePageHtml(fileUrl)}" target="_blank" rel="noopener">View ${escapePageHtml(certificate.fileName || 'certificate')} ↗</a>` : '<span class="site-page-muted">Document details available from our office.</span>'}
      </article>
    `;
  }).join('');
}

function showSection(id, shouldShow) {
  const section = document.getElementById(id);
  section.hidden = !shouldShow;
}

async function loadSitePage() {
  const slug = pageSlugByPath[window.location.pathname] || 'faq';
  const status = document.getElementById('pageStatus');

  try {
    const response = await fetch(`/api/site/pages/${slug}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load this page.');

    document.title = /sainand chits/i.test(result.page.title) ? result.page.title : `${result.page.title} | Sainand Chits India`;
    document.getElementById('pageDescription').content = result.page.intro;
    document.getElementById('pageEyebrow').textContent = slug === 'authorized-certificates'
      ? 'Company documents'
      : slug.replaceAll('-', ' ');
    document.getElementById('pageTitle').textContent = result.page.title;
    document.getElementById('pageIntro').textContent = result.page.intro;
    document.getElementById('pageBody').innerHTML = renderPageBody(result.page.body);

    showSection('faqSection', slug === 'faq');
    showSection('supportSection', slug === 'support-center');
    showSection('supportRequestSection', slug === 'support-center');
    showSection('certificatesSection', slug === 'authorized-certificates');
    showSection('contactSection', slug === 'contact-us');
    // The contact page already has the form, so the "Send an enquiry" box below isn't needed there.
    const cta = document.getElementById('pageCta');
    if (cta) cta.hidden = slug === 'contact-us' || slug === 'support-center';
    document.querySelectorAll('nav .menu-desktop a').forEach(link => {
      if (slug === 'contact-us' && link.getAttribute('href') === '/contact-us') { link.classList.add('active'); link.setAttribute('aria-current', 'page'); }
    });

    if (slug === 'faq') renderFaqs(result.faqs || []);
    if (slug === 'support-center') { renderSupportItems(result.supportItems || []); initSupportRequestForm(); }
    if (slug === 'authorized-certificates') renderCertificates(result.certificates || []);

    status.hidden = true;
  } catch (error) {
    status.textContent = error.message || 'Unable to load this page right now.';
    status.classList.add('is-error');
  }
}

document.addEventListener('DOMContentLoaded', loadSitePage);
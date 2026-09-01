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

function renderPageBody(body) {
  const paragraphs = String(body || '').trim().split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map(paragraph => `<p>${escapePageHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}

function renderFaqs(faqs) {
  const list = document.getElementById('faqList');
  if (!faqs.length) {
    list.innerHTML = '<div class="site-page-empty">Frequently asked questions will appear here soon.</div>';
    return;
  }
  list.innerHTML = faqs.map(faq => `
    <article class="faq-item">
      <h3>${escapePageHtml(faq.question)}</h3>
      <p>${escapePageHtml(faq.answer)}</p>
    </article>
  `).join('');
}

function renderSupportItems(items) {
  const list = document.getElementById('supportList');
  if (!items.length) {
    list.innerHTML = '<div class="site-page-empty">Support options will appear here soon.</div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const link = safePageLink(item.linkUrl);
    return `
      <article class="support-card">
        <h3>${escapePageHtml(item.title)}</h3>
        <p>${escapePageHtml(item.description)}</p>
        ${link ? `<a href="${escapePageHtml(link)}">${link.startsWith('/') ? 'View details →' : 'Contact support →'}</a>` : ''}
      </article>
    `;
  }).join('');
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

    document.title = `${result.page.title} | Sainand Chits India`;
    document.getElementById('pageDescription').content = result.page.intro;
    document.getElementById('pageEyebrow').textContent = slug === 'authorized-certificates'
      ? 'Company documents'
      : slug.replaceAll('-', ' ');
    document.getElementById('pageTitle').textContent = result.page.title;
    document.getElementById('pageIntro').textContent = result.page.intro;
    document.getElementById('pageBody').innerHTML = renderPageBody(result.page.body);

    showSection('faqSection', slug === 'faq');
    showSection('supportSection', slug === 'support-center');
    showSection('certificatesSection', slug === 'authorized-certificates');

    if (slug === 'faq') renderFaqs(result.faqs || []);
    if (slug === 'support-center') renderSupportItems(result.supportItems || []);
    if (slug === 'authorized-certificates') renderCertificates(result.certificates || []);

    status.hidden = true;
  } catch (error) {
    status.textContent = error.message || 'Unable to load this page right now.';
    status.classList.add('is-error');
  }
}

document.addEventListener('DOMContentLoaded', loadSitePage);
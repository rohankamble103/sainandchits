const state = {
  enquiries: [],
  posts: [],
  siteContent: {
    pages: [],
    faqs: [],
    supportItems: [],
    certificates: [],
  },
  enquiryFilters: {
    search: '',
    status: 'all',
    source: 'all',
    sort: 'newest',
  },
};

function escapeAdminHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderTranscript(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return '<div class="transcript-empty">No chatbot transcript was saved for this enquiry.</div>';
  }
  return messages.map(message => `
    <div class="transcript-line transcript-${message.role === 'user' ? 'user' : 'sai'}">
      <strong>${message.role === 'user' ? 'Visitor' : 'Sai'}</strong>
      <span>${escapeAdminHtml(message.content)}</span>
    </div>
  `).join('');
}

function renderHistoryItem(enquiry) {
  const followUps = [enquiry.followUp1, enquiry.followUp2, enquiry.followUp3].filter(Boolean);
  return `
    <article class="history-item">
      <div class="history-item-top">
        <strong>${formatDate(enquiry.createdAt)}</strong>
        <span>${escapeAdminHtml(enquiry.status)}</span>
      </div>
      <div class="history-item-plan">${escapeAdminHtml(enquiry.plan || 'Plan not specified')}</div>
      <div class="history-item-contact">${escapeAdminHtml(enquiry.name)} · ${escapeAdminHtml(enquiry.phone)} · ${escapeAdminHtml(enquiry.email)}</div>
      <p>${escapeAdminHtml(enquiry.message || 'No message provided')}</p>
      ${followUps.length ? `<div class="history-item-followups"><strong>Contact attempts:</strong> ${followUps.map(escapeAdminHtml).join(' · ')}</div>` : ''}
      ${enquiry.adminNotes ? `<div class="history-item-notes"><strong>Team notes:</strong> ${escapeAdminHtml(enquiry.adminNotes)}</div>` : ''}
      ${enquiry.chatTranscript?.length ? `<details><summary>Chat transcript (${enquiry.chatTranscript.length} messages)</summary><div class="transcript">${renderTranscript(enquiry.chatTranscript)}</div></details>` : ''}
    </article>
  `;
}

function showAlert(message, type = '') {
  const alert = document.getElementById('dashboardAlert');
  alert.textContent = message;
  alert.className = `admin-alert ${type ? `is-${type}` : ''}`;
  alert.hidden = false;
  window.clearTimeout(showAlert.timer);
  showAlert.timer = window.setTimeout(() => { alert.hidden = true; }, 5000);
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(result.error || 'Something went wrong.');
  }
  return result;
}

function showLogin() {
  document.getElementById('loginView').hidden = false;
  document.getElementById('dashboardView').hidden = true;
}

function showDashboard() {
  document.getElementById('loginView').hidden = true;
  document.getElementById('dashboardView').hidden = false;
}

function renderEnquiries() {
  const list = document.getElementById('enquiriesList');
  const visibleEnquiries = getVisibleEnquiries();
  document.getElementById('enquiryCount').textContent = visibleEnquiries.length;
  const summary = document.getElementById('enquiryResultsSummary');
  summary.textContent = state.enquiries.length === visibleEnquiries.length
    ? `${state.enquiries.length} ${state.enquiries.length === 1 ? 'enquiry' : 'enquiries'}`
    : `Showing ${visibleEnquiries.length} of ${state.enquiries.length} enquiries`;

  if (!visibleEnquiries.length) {
    const hasFilters = state.enquiries.length > 0;
    list.innerHTML = hasFilters
      ? '<div class="empty-state"><strong>No matching enquiries</strong><span>Try a different search or clear the filters.</span></div>'
      : '<div class="empty-state"><strong>No enquiries yet</strong><span>New contact form submissions will appear here.</span></div>';
    return;
  }
  list.innerHTML = visibleEnquiries.map(enquiry => `
    <article class="enquiry-card" data-enquiry-id="${enquiry.id}">
      <div class="enquiry-top">
        <div><h3>${escapeAdminHtml(enquiry.name)}</h3><p class="enquiry-meta">${formatDate(enquiry.createdAt)} · ${escapeAdminHtml(enquiry.plan || 'Plan not specified')} ${enquiry.chatTranscript?.length ? '· Chat with Sai' : ''}</p></div>
        <select class="status-select" data-field="status" aria-label="Enquiry status">
          ${['new', 'contacted', 'qualified', 'closed'].map(status => `<option value="${status}" ${status === enquiry.status ? 'selected' : ''}>${status[0].toUpperCase() + status.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="enquiry-contact"><a href="tel:${escapeAdminHtml(enquiry.phone)}">${escapeAdminHtml(enquiry.phone)}</a><a href="mailto:${escapeAdminHtml(enquiry.email)}">${escapeAdminHtml(enquiry.email)}</a></div>
      <div class="enquiry-message">${escapeAdminHtml(enquiry.message || 'No message provided')}</div>
      <div class="follow-up-grid">
        <label>Contact attempt 1<textarea data-field="followUp1" rows="2">${escapeAdminHtml(enquiry.followUp1)}</textarea></label>
        <label>Contact attempt 2<textarea data-field="followUp2" rows="2">${escapeAdminHtml(enquiry.followUp2)}</textarea></label>
        <label>Contact attempt 3<textarea data-field="followUp3" rows="2">${escapeAdminHtml(enquiry.followUp3)}</textarea></label>
      </div>
      <label>Team description / notes<textarea data-field="adminNotes" rows="2" placeholder="Store your follow-up description here...">${escapeAdminHtml(enquiry.adminNotes)}</textarea></label>
      <div class="enquiry-actions">
        ${enquiry.chatTranscript?.length ? '<button class="text-button view-chat" type="button">View chat</button>' : ''}
        ${enquiry.historyCount > 1 ? `<button class="text-button view-history" data-history-count="${enquiry.historyCount}" type="button">History (${enquiry.historyCount})</button>` : ''}
        <button class="admin-button save-enquiry" type="button">Save changes</button>
        <button class="text-button delete-enquiry" type="button">Delete enquiry</button>
      </div>
      ${enquiry.chatTranscript?.length ? `<div class="chat-transcript" hidden><div class="transcript">${renderTranscript(enquiry.chatTranscript)}</div></div>` : ''}
      ${enquiry.historyCount > 1 ? '<div class="history-panel" hidden></div>' : ''}
    </article>
  `).join('');
}

function getVisibleEnquiries() {
  const { search, status, source, sort } = state.enquiryFilters;
  const query = search.trim().toLowerCase();
  const filtered = state.enquiries.filter(enquiry => {
    const searchable = [
      enquiry.name,
      enquiry.phone,
      enquiry.email,
      enquiry.plan,
      enquiry.message,
      enquiry.adminNotes,
      enquiry.followUp1,
      enquiry.followUp2,
      enquiry.followUp3,
    ].join(' ').toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesStatus = status === 'all' || enquiry.status === status;
    const matchesSource = source === 'all'
      || (source === 'chat' && enquiry.chatTranscript?.length)
      || (source === 'form' && !enquiry.chatTranscript?.length);
    return matchesSearch && matchesStatus && matchesSource;
  });

  return filtered.sort((left, right) => {
    if (sort === 'oldest') return new Date(left.createdAt) - new Date(right.createdAt);
    if (sort === 'name-asc') return left.name.localeCompare(right.name, 'en');
    if (sort === 'name-desc') return right.name.localeCompare(left.name, 'en');
    return new Date(right.createdAt) - new Date(left.createdAt);
  });
}

function resetEnquiryFilters() {
  state.enquiryFilters = { search: '', status: 'all', source: 'all', sort: 'newest' };
  document.getElementById('enquirySearch').value = '';
  document.getElementById('enquiryStatusFilter').value = 'all';
  document.getElementById('enquirySourceFilter').value = 'all';
  document.getElementById('enquirySort').value = 'newest';
  renderEnquiries();
}

function bindEnquiryFilters() {
  document.getElementById('enquirySearch').addEventListener('input', event => {
    state.enquiryFilters.search = event.target.value;
    renderEnquiries();
  });
  document.getElementById('enquiryStatusFilter').addEventListener('change', event => {
    state.enquiryFilters.status = event.target.value;
    renderEnquiries();
  });
  document.getElementById('enquirySourceFilter').addEventListener('change', event => {
    state.enquiryFilters.source = event.target.value;
    renderEnquiries();
  });
  document.getElementById('enquirySort').addEventListener('change', event => {
    state.enquiryFilters.sort = event.target.value;
    renderEnquiries();
  });
  document.getElementById('resetEnquiryFilters').addEventListener('click', resetEnquiryFilters);
}

function renderPosts() {
  const list = document.getElementById('postsList');
  if (!state.posts.length) {
    list.innerHTML = '<div class="empty-state"><strong>No posts yet</strong><span>Create your first YouTube, Instagram, or News post.</span></div>';
    return;
  }
  list.innerHTML = state.posts.map(post => `
    <article class="post-row">
      <div class="post-type">${escapeAdminHtml(post.category)}</div>
      <div class="post-info"><h3>${escapeAdminHtml(post.title)}</h3><p>${escapeAdminHtml(post.description || 'No description')}</p><small>${formatDate(post.createdAt)} · ${post.isPublished ? 'Published' : 'Draft'}</small></div>
      <div class="post-actions"><button class="text-button edit-post" data-id="${post.id}" type="button">Edit</button><button class="text-button delete-post" data-id="${post.id}" type="button">Delete</button></div>
    </article>
  `).join('');
}

async function loadEnquiries() {
  const result = await api('/api/admin/enquiries');
  state.enquiries = result.enquiries;
  renderEnquiries();
}

async function loadPosts() {
  const result = await api('/api/admin/news');
  state.posts = result.posts;
  renderPosts();
}

async function loadSiteContent() {
  const result = await api('/api/admin/site-content');
  state.siteContent = result;
  renderSitePageEditor();
  renderFaqAdminList();
  renderSupportAdminList();
  renderCertificateAdminList();
}

function renderSitePageEditor() {
  const page = state.siteContent.pages.find(item => item.slug === document.getElementById('sitePageSlug').value);
  if (!page) return;
  document.getElementById('sitePageTitle').value = page.title;
  document.getElementById('sitePageIntro').value = page.intro;
  document.getElementById('sitePageBody').value = page.body;
}

function renderFaqAdminList() {
  const list = document.getElementById('faqAdminList');
  if (!state.siteContent.faqs.length) {
    list.innerHTML = '<div class="empty-state"><strong>No FAQs yet</strong><span>Add your first frequently asked question above.</span></div>';
    return;
  }
  list.innerHTML = state.siteContent.faqs.map(faq => `
    <article class="site-admin-row">
      <div class="site-admin-info"><h4>${escapeAdminHtml(faq.question)}</h4><p>${escapeAdminHtml(faq.answer)}</p><small>${faq.isPublished ? 'Published' : 'Draft'} · Order ${faq.sortOrder}</small></div>
      <div class="site-admin-actions"><button class="text-button edit-faq" data-id="${faq.id}" type="button">Edit</button><button class="text-button delete-site-item" data-kind="faq" data-id="${faq.id}" type="button">Delete</button></div>
    </article>
  `).join('');
}

function renderSupportAdminList() {
  const list = document.getElementById('supportAdminList');
  if (!state.siteContent.supportItems.length) {
    list.innerHTML = '<div class="empty-state"><strong>No support items yet</strong><span>Add a help pointer for visitors.</span></div>';
    return;
  }
  list.innerHTML = state.siteContent.supportItems.map(item => `
    <article class="site-admin-row">
      <div class="site-admin-info"><h4>${escapeAdminHtml(item.title)}</h4><p>${escapeAdminHtml(item.description)}</p><small>${item.isPublished ? 'Published' : 'Draft'} · ${escapeAdminHtml(item.linkUrl || 'No link')} · Order ${item.sortOrder}</small></div>
      <div class="site-admin-actions"><button class="text-button edit-support" data-id="${item.id}" type="button">Edit</button><button class="text-button delete-site-item" data-kind="support" data-id="${item.id}" type="button">Delete</button></div>
    </article>
  `).join('');
}

function renderCertificateAdminList() {
  const list = document.getElementById('certificateAdminList');
  if (!state.siteContent.certificates.length) {
    list.innerHTML = '<div class="empty-state"><strong>No certificates yet</strong><span>Upload your first authorized certificate above.</span></div>';
    return;
  }
  list.innerHTML = state.siteContent.certificates.map(certificate => `
    <article class="site-admin-row">
      <div class="site-admin-info"><h4>${escapeAdminHtml(certificate.title)}</h4><p>${escapeAdminHtml(certificate.description)}</p><small>${certificate.isPublished ? 'Published' : 'Draft'} · ${escapeAdminHtml(certificate.fileName || certificate.fileUrl)} · Order ${certificate.sortOrder}</small></div>
      <div class="site-admin-actions"><button class="text-button edit-certificate" data-id="${certificate.id}" type="button">Edit</button><button class="text-button delete-site-item" data-kind="certificate" data-id="${certificate.id}" type="button">Delete</button></div>
    </article>
  `).join('');
}

function resetPostForm() {
  document.getElementById('postForm').reset();
  document.getElementById('postId').value = '';
  document.getElementById('postPublished').checked = true;
  document.getElementById('uploadStatus').textContent = '';
}

function editPost(id) {
  const post = state.posts.find(item => item.id === id);
  if (!post) return;
  document.getElementById('postId').value = post.id;
  document.getElementById('postCategory').value = post.category;
  document.getElementById('postTitle').value = post.title;
  document.getElementById('postDescription').value = post.description;
  document.getElementById('postMediaUrl').value = post.mediaUrl;
  document.getElementById('postImageUrl').value = post.imageUrl;
  document.getElementById('postPublished').checked = post.isPublished;
  document.getElementById('postForm').hidden = false;
  document.getElementById('postTitle').focus();
}

document.getElementById('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.getElementById('loginError');
  error.hidden = true;
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('adminUsername').value,
        password: document.getElementById('adminPassword').value,
      }),
    });
    showDashboard();
    await Promise.all([loadEnquiries(), loadPosts()]);
  } catch (loginError) {
    error.textContent = loginError.message;
    error.hidden = false;
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  showLogin();
});

document.querySelectorAll('.admin-tab').forEach(tab => tab.addEventListener('click', async () => {
  document.querySelectorAll('.admin-tab').forEach(item => item.classList.toggle('active', item === tab));
  const selectedTab = tab.dataset.tab;
  document.getElementById('enquiriesPanel').hidden = selectedTab !== 'enquiries';
  document.getElementById('contentPanel').hidden = selectedTab !== 'content';
  document.getElementById('siteContentPanel').hidden = selectedTab !== 'site-content';
  try {
    if (selectedTab === 'content') await loadPosts();
    if (selectedTab === 'site-content') await loadSiteContent();
  } catch (error) {
    showAlert(error.message, 'error');
  }
}));

document.getElementById('refreshEnquiries').addEventListener('click', () => loadEnquiries().catch(error => showAlert(error.message, 'error')));
document.getElementById('refreshSiteContent').addEventListener('click', () => loadSiteContent().catch(error => showAlert(error.message, 'error')));
document.getElementById('newPostButton').addEventListener('click', () => {
  resetPostForm();
  document.getElementById('postForm').hidden = false;
  document.getElementById('postTitle').focus();
});
document.getElementById('cancelPostButton').addEventListener('click', () => {
  resetPostForm();
  document.getElementById('postForm').hidden = true;
});

document.getElementById('uploadImageButton').addEventListener('click', async () => {
  const file = document.getElementById('postImageFile').files[0];
  const status = document.getElementById('uploadStatus');
  if (!file) {
    status.textContent = 'Choose a photo first.';
    return;
  }
  const data = new FormData();
  data.append('image', file);
  status.textContent = 'Uploading...';
  try {
    const result = await api('/api/admin/uploads', { method: 'POST', headers: {}, body: data });
    document.getElementById('postImageUrl').value = result.url;
    status.textContent = 'Photo uploaded.';
  } catch (error) {
    status.textContent = error.message;
  }
});

document.getElementById('postForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('postId').value;
  const payload = {
    category: document.getElementById('postCategory').value,
    title: document.getElementById('postTitle').value,
    description: document.getElementById('postDescription').value,
    mediaUrl: document.getElementById('postMediaUrl').value,
    imageUrl: document.getElementById('postImageUrl').value,
    isPublished: document.getElementById('postPublished').checked,
  };
  try {
    await api(id ? `/api/admin/news/${id}` : '/api/admin/news', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    resetPostForm();
    document.getElementById('postForm').hidden = true;
    await loadPosts();
    showAlert('Post saved successfully.', 'success');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

function showSiteEditor(section) {
  document.querySelectorAll('.site-content-tab').forEach(tab => {
    const active = tab.dataset.siteSection === section;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.getElementById('sitePagesEditor').hidden = section !== 'pages';
  document.getElementById('siteFaqEditor').hidden = section !== 'faq';
  document.getElementById('siteSupportEditor').hidden = section !== 'support';
  document.getElementById('siteCertificatesEditor').hidden = section !== 'certificates';
}

function resetFaqForm() {
  document.getElementById('faqForm').reset();
  document.getElementById('faqId').value = '';
  document.getElementById('faqPublished').checked = true;
  document.getElementById('faqSortOrder').value = 0;
}

function resetSupportForm() {
  document.getElementById('supportForm').reset();
  document.getElementById('supportId').value = '';
  document.getElementById('supportPublished').checked = true;
  document.getElementById('supportSortOrder').value = 0;
}

function resetCertificateForm() {
  document.getElementById('certificateForm').reset();
  document.getElementById('certificateId').value = '';
  document.getElementById('certificateFileUrl').value = '';
  document.getElementById('certificateFileName').value = '';
  document.getElementById('certificatePublished').checked = true;
  document.getElementById('certificateSortOrder').value = 0;
  document.getElementById('certificateUploadStatus').textContent = '';
  document.getElementById('certificateCurrentFile').textContent = '';
}

function editFaq(id) {
  const faq = state.siteContent.faqs.find(item => item.id === id);
  if (!faq) return;
  document.getElementById('faqId').value = faq.id;
  document.getElementById('faqQuestion').value = faq.question;
  document.getElementById('faqAnswer').value = faq.answer;
  document.getElementById('faqSortOrder').value = faq.sortOrder;
  document.getElementById('faqPublished').checked = faq.isPublished;
  document.getElementById('faqForm').hidden = false;
  document.getElementById('faqQuestion').focus();
}

function editSupportItem(id) {
  const item = state.siteContent.supportItems.find(entry => entry.id === id);
  if (!item) return;
  document.getElementById('supportId').value = item.id;
  document.getElementById('supportTitle').value = item.title;
  document.getElementById('supportDescription').value = item.description;
  document.getElementById('supportLinkUrl').value = item.linkUrl;
  document.getElementById('supportSortOrder').value = item.sortOrder;
  document.getElementById('supportPublished').checked = item.isPublished;
  document.getElementById('supportForm').hidden = false;
  document.getElementById('supportTitle').focus();
}

function editCertificate(id) {
  const certificate = state.siteContent.certificates.find(item => item.id === id);
  if (!certificate) return;
  document.getElementById('certificateId').value = certificate.id;
  document.getElementById('certificateTitle').value = certificate.title;
  document.getElementById('certificateDescription').value = certificate.description;
  document.getElementById('certificateSortOrder').value = certificate.sortOrder;
  document.getElementById('certificatePublished').checked = certificate.isPublished;
  document.getElementById('certificateFileUrl').value = certificate.fileUrl;
  document.getElementById('certificateFileName').value = certificate.fileName;
  document.getElementById('certificateCurrentFile').textContent = certificate.fileName
    ? `Current file: ${certificate.fileName}`
    : 'No file uploaded yet.';
  document.getElementById('certificateForm').hidden = false;
  document.getElementById('certificateTitle').focus();
}

document.querySelectorAll('.site-content-tab').forEach(tab => tab.addEventListener('click', () => {
  showSiteEditor(tab.dataset.siteSection);
}));

const sitePagePicker = document.getElementById('sitePagePicker');
const sitePagePickerButton = document.getElementById('sitePagePickerButton');
const sitePagePickerMenu = document.getElementById('sitePagePickerMenu');
const sitePagePickerLabel = document.getElementById('sitePagePickerLabel');

function closeSitePagePicker() {
  sitePagePickerMenu.hidden = true;
  sitePagePickerButton.setAttribute('aria-expanded', 'false');
}

function setSitePage(slug, label) {
  document.getElementById('sitePageSlug').value = slug;
  sitePagePickerLabel.textContent = label;
  document.querySelectorAll('.site-page-picker-option').forEach(option => {
    const active = option.dataset.value === slug;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', String(active));
  });
  closeSitePagePicker();
  renderSitePageEditor();
}

sitePagePickerButton.addEventListener('click', () => {
  const isOpen = sitePagePickerButton.getAttribute('aria-expanded') === 'true';
  sitePagePickerMenu.hidden = isOpen;
  sitePagePickerButton.setAttribute('aria-expanded', String(!isOpen));
});

document.querySelectorAll('.site-page-picker-option').forEach(option => {
  option.addEventListener('click', () => setSitePage(option.dataset.value, option.textContent));
});

document.addEventListener('click', event => {
  if (!sitePagePicker.contains(event.target)) closeSitePagePicker();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSitePagePicker();
});

document.getElementById('sitePageForm').addEventListener('submit', async event => {
  event.preventDefault();
  const slug = document.getElementById('sitePageSlug').value;
  try {
    await api(`/api/admin/site-pages/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: document.getElementById('sitePageTitle').value,
        intro: document.getElementById('sitePageIntro').value,
        body: document.getElementById('sitePageBody').value,
      }),
    });
    await loadSiteContent();
    showAlert('Page saved successfully.', 'success');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

document.getElementById('newFaqButton').addEventListener('click', () => {
  resetFaqForm();
  document.getElementById('faqForm').hidden = false;
  document.getElementById('faqQuestion').focus();
});

document.getElementById('cancelFaqButton').addEventListener('click', () => {
  resetFaqForm();
  document.getElementById('faqForm').hidden = true;
});

document.getElementById('faqForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('faqId').value;
  const payload = {
    question: document.getElementById('faqQuestion').value,
    answer: document.getElementById('faqAnswer').value,
    sortOrder: document.getElementById('faqSortOrder').value,
    isPublished: document.getElementById('faqPublished').checked,
  };
  try {
    await api(id ? `/api/admin/site-faqs/${id}` : '/api/admin/site-faqs', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    resetFaqForm();
    document.getElementById('faqForm').hidden = true;
    await loadSiteContent();
    showAlert('FAQ saved successfully.', 'success');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

document.getElementById('newSupportButton').addEventListener('click', () => {
  resetSupportForm();
  document.getElementById('supportForm').hidden = false;
  document.getElementById('supportTitle').focus();
});

document.getElementById('cancelSupportButton').addEventListener('click', () => {
  resetSupportForm();
  document.getElementById('supportForm').hidden = true;
});

document.getElementById('supportForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('supportId').value;
  const payload = {
    title: document.getElementById('supportTitle').value,
    description: document.getElementById('supportDescription').value,
    linkUrl: document.getElementById('supportLinkUrl').value,
    sortOrder: document.getElementById('supportSortOrder').value,
    isPublished: document.getElementById('supportPublished').checked,
  };
  try {
    await api(id ? `/api/admin/support-items/${id}` : '/api/admin/support-items', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    resetSupportForm();
    document.getElementById('supportForm').hidden = true;
    await loadSiteContent();
    showAlert('Support item saved successfully.', 'success');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

document.getElementById('uploadCertificateButton').addEventListener('click', async () => {
  const file = document.getElementById('certificateFile').files[0];
  const status = document.getElementById('certificateUploadStatus');
  if (!file) {
    status.textContent = 'Choose an image or PDF first.';
    return;
  }
  const data = new FormData();
  data.append('certificate', file);
  status.textContent = 'Uploading...';
  try {
    const result = await api('/api/admin/certificates/upload', { method: 'POST', headers: {}, body: data });
    document.getElementById('certificateFileUrl').value = result.url;
    document.getElementById('certificateFileName').value = result.fileName;
    document.getElementById('certificateCurrentFile').textContent = `New file ready: ${result.fileName}`;
    status.textContent = 'File uploaded.';
  } catch (error) {
    status.textContent = error.message;
  }
});

document.getElementById('certificateForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('certificateId').value;
  const payload = {
    title: document.getElementById('certificateTitle').value,
    description: document.getElementById('certificateDescription').value,
    fileUrl: document.getElementById('certificateFileUrl').value,
    fileName: document.getElementById('certificateFileName').value,
    sortOrder: document.getElementById('certificateSortOrder').value,
    isPublished: document.getElementById('certificatePublished').checked,
  };
  try {
    await api(id ? `/api/admin/certificates/${id}` : '/api/admin/certificates', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    resetCertificateForm();
    document.getElementById('certificateForm').hidden = true;
    await loadSiteContent();
    showAlert('Certificate saved successfully.', 'success');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

async function deleteSiteItem(kind, id, label) {
  if (!window.confirm(`Delete this ${label} permanently?`)) return;
  const endpoint = kind === 'faq'
    ? `/api/admin/site-faqs/${id}`
    : kind === 'support'
      ? `/api/admin/support-items/${id}`
      : `/api/admin/certificates/${id}`;
  try {
    await api(endpoint, { method: 'DELETE' });
    await loadSiteContent();
    showAlert(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted.`, 'success');
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

document.getElementById('faqAdminList').addEventListener('click', event => {
  const id = Number(event.target.dataset.id);
  if (event.target.classList.contains('edit-faq')) editFaq(id);
  if (event.target.classList.contains('delete-site-item')) deleteSiteItem('faq', id, 'FAQ');
});

document.getElementById('supportAdminList').addEventListener('click', event => {
  const id = Number(event.target.dataset.id);
  if (event.target.classList.contains('edit-support')) editSupportItem(id);
  if (event.target.classList.contains('delete-site-item')) deleteSiteItem('support', id, 'support item');
});

document.getElementById('certificateAdminList').addEventListener('click', event => {
  const id = Number(event.target.dataset.id);
  if (event.target.classList.contains('edit-certificate')) editCertificate(id);
  if (event.target.classList.contains('delete-site-item')) deleteSiteItem('certificate', id, 'certificate');
});

document.getElementById('enquiriesList').addEventListener('click', async event => {
  const card = event.target.closest('[data-enquiry-id]');
  if (!card) return;
  const id = card.dataset.enquiryId;
  if (event.target.classList.contains('view-chat')) {
    const panel = card.querySelector('.chat-transcript');
    panel.hidden = !panel.hidden;
    event.target.textContent = panel.hidden ? 'View chat' : 'Hide chat';
    return;
  }
  if (event.target.classList.contains('view-history')) {
    const panel = card.querySelector('.history-panel');
    if (!panel.dataset.loaded) {
      try {
        const result = await api(`/api/admin/enquiries/${id}/history`);
        panel.innerHTML = `<h4>Customer history</h4>${result.enquiries.map(renderHistoryItem).join('')}`;
        panel.dataset.loaded = 'true';
      } catch (error) {
        showAlert(error.message, 'error');
        return;
      }
    }
    panel.hidden = !panel.hidden;
    event.target.textContent = panel.hidden ? `History (${event.target.dataset.historyCount})` : 'Hide history';
    return;
  }
  if (event.target.classList.contains('delete-enquiry')) {
    if (!window.confirm('Delete this enquiry permanently?')) return;
    try {
      await api(`/api/admin/enquiries/${id}`, { method: 'DELETE' });
      await loadEnquiries();
      showAlert('Enquiry deleted.', 'success');
    } catch (error) { showAlert(error.message, 'error'); }
  }
  if (event.target.classList.contains('save-enquiry')) {
    const payload = {};
    card.querySelectorAll('[data-field]').forEach(field => { payload[field.dataset.field] = field.value; });
    try {
      await api(`/api/admin/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showAlert('Enquiry changes saved.', 'success');
    } catch (error) { showAlert(error.message, 'error'); }
  }
});

document.getElementById('postsList').addEventListener('click', async event => {
  const id = Number(event.target.dataset.id);
  if (event.target.classList.contains('edit-post')) editPost(id);
  if (event.target.classList.contains('delete-post')) {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await api(`/api/admin/news/${id}`, { method: 'DELETE' });
      await loadPosts();
      showAlert('Post deleted.', 'success');
    } catch (error) { showAlert(error.message, 'error'); }
  }
});

bindEnquiryFilters();

async function boot() {
  const session = await fetch('/api/admin/session').then(response => response.json());
  if (session.authenticated) {
    showDashboard();
    await Promise.all([loadEnquiries(), loadPosts()]);
  } else {
    showLogin();
  }
}

boot().catch(error => {
  document.getElementById('loginError').textContent = error.message;
  document.getElementById('loginError').hidden = false;
});
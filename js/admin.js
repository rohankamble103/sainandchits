const state = {
  enquiries: [],
  posts: [],
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
  const enquiries = tab.dataset.tab === 'enquiries';
  document.getElementById('enquiriesPanel').hidden = !enquiries;
  document.getElementById('contentPanel').hidden = enquiries;
  if (!enquiries) await loadPosts();
}));

document.getElementById('refreshEnquiries').addEventListener('click', () => loadEnquiries().catch(error => showAlert(error.message, 'error')));
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
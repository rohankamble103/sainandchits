function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    let videoId = parsed.searchParams.get('v');
    if (!videoId && parsed.hostname.includes('youtu.be')) videoId = parsed.pathname.slice(1);
    if (!videoId && parsed.pathname.includes('/shorts/')) videoId = parsed.pathname.split('/shorts/')[1].split('/')[0];
    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : '';
  } catch {
    return '';
  }
}

function instagramEmbed(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('instagram.com')) return '';
    const slug = parsed.pathname.split('/').filter(Boolean)[1] || parsed.pathname.split('/').filter(Boolean)[0];
    return slug ? `https://www.instagram.com/${parsed.pathname.split('/').filter(Boolean)[0]}/${slug}/embed` : '';
  } catch {
    return '';
  }
}

function mediaMarkup(post) {
  if (post.category === 'youtube' && post.mediaUrl) {
    const embed = youtubeEmbed(post.mediaUrl);
    if (embed) return `<iframe class="news-embed" src="${embed}" title="${escapeHtml(post.title)}" loading="lazy" allowfullscreen></iframe>`;
  }
  if (post.category === 'instagram' && post.mediaUrl) {
    const embed = instagramEmbed(post.mediaUrl);
    if (embed) return `<iframe class="news-embed instagram-embed" src="${embed}" title="${escapeHtml(post.title)}" loading="lazy"></iframe>`;
  }
  if (post.imageUrl) return `<img class="news-image" src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title)}" loading="lazy">`;
  if (post.mediaUrl) return `<a class="news-link-media" href="${escapeHtml(post.mediaUrl)}" target="_blank" rel="noopener">Open ${post.category === 'instagram' ? 'on Instagram' : 'the update'} <span>↗</span></a>`;
  return '<div class="news-empty-media">Sainand Chits India</div>';
}

function renderPosts(posts, category, elementId) {
  const target = document.getElementById(elementId);
  const matching = posts.filter(post => post.category === category);
  if (!matching.length) {
    target.innerHTML = '<div class="news-empty">New updates will appear here soon.</div>';
    return;
  }
  target.innerHTML = matching.map(post => `
    <article class="news-card">
      <div class="news-card-media">${mediaMarkup(post)}</div>
      <div class="news-card-copy">
        <time>${new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.description)}</p>
      </div>
    </article>
  `).join('');
}

async function loadNews() {
  const status = document.getElementById('newsStatus');
  try {
    const response = await fetch('/api/news');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load updates');
    renderPosts(result.posts, 'youtube', 'youtubePosts');
    renderPosts(result.posts, 'instagram', 'instagramPosts');
    renderPosts(result.posts, 'news', 'newsPosts');
    status.remove();
  } catch (error) {
    status.textContent = error.message || 'Unable to load updates right now.';
    status.classList.add('is-error');
  }
}

document.addEventListener('DOMContentLoaded', loadNews);
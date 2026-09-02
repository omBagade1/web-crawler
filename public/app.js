const API_BASE = '/api';

let currentCrawlId = null;
let pollInterval = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el) { el.style.display = 'block'; }
function hide(el) { el.style.display = 'none'; }

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function formatDuration(ms) {
  if (!ms) return '-';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

async function fetchApi(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadCrawls() {
  try {
    const crawls = await fetchApi('/crawls');
    const list = $('#crawl-list');
    list.innerHTML = '';
    
    if (crawls.length === 0) {
      list.innerHTML = '<div class="empty-state">No completed crawls yet. Start a new crawl above!</div>';
      return;
    }

    for (const crawl of crawls) {
      const item = document.createElement('div');
      item.className = `crawl-item completed-crawl`;
      item.innerHTML = `
        <div class="crawl-info">
          <h3>${crawl.crawlId}</h3>
          <div class="crawl-meta">
            <span>Visited: ${crawl.visited}</span>
            <span>Failed: ${crawl.failed}</span>
            <span>Started: ${formatDate(crawl.started)}</span>
            <span>Updated: ${formatDate(crawl.updated)}</span>
          </div>
        </div>
        <div class="crawl-actions">
          <button class="btn btn-primary view-btn" data-id="${crawl.crawlId}">View</button>
          <button class="btn btn-secondary export-json" data-id="${crawl.crawlId}">JSON</button>
          <button class="btn btn-secondary export-csv" data-id="${crawl.crawlId}">CSV</button>
          <button class="btn btn-secondary export-sitemap" data-id="${crawl.crawlId}">Sitemap</button>
          <button class="btn btn-danger delete-btn" data-id="${crawl.crawlId}">Delete</button>
        </div>
      `;
      list.appendChild(item);
    }
  } catch (e) {
    console.error('Failed to load crawls:', e);
  }
}

async function loadActiveCrawls() {
  try {
    const metrics = await fetchApi('/metrics');
    const list = $('#active-list');
    list.innerHTML = '';
    
    if (metrics.runningCrawlIds.length === 0) {
      hide($('#active-crawls'));
      return;
    }

    show($('#active-crawls'));
    
    for (const id of metrics.runningCrawlIds) {
      try {
        const crawl = await fetchApi(`/crawl/${id}`);
        const item = document.createElement('div');
        item.className = 'crawl-item active-crawl';
        item.innerHTML = `
          <div class="crawl-info">
            <h3>${id}</h3>
            <div class="crawl-meta">
              <span class="status-running">● Running</span>
              <span>Visited: ${crawl.stats?.visited || 0}</span>
              <span>Queued: ${crawl.stats?.queued || 0}</span>
              <span>Elapsed: ${formatDuration(crawl.stats?.elapsed)}</span>
            </div>
          </div>
          <div class="crawl-actions">
            <button class="btn btn-primary view-btn" data-id="${id}">View Details</button>
          </div>
        `;
        list.appendChild(item);
      } catch (e) {}
    }
  } catch (e) {
    console.error('Failed to load active crawls:', e);
  }
}

async function viewCrawl(crawlId) {
  currentCrawlId = crawlId;
  try {
    const data = await fetchApi(`/crawl/${crawlId}/urls`);
    const statsData = await fetchApi(`/crawl/${crawlId}`);
    
    $('#detail-title').textContent = `Crawl: ${crawlId}`;
    show($('#crawl-detail'));
    hide($('#new-crawl'));
    hide($('#completed-crawls'));
    hide($('#active-crawls'));
    
    renderStats(statsData.stats || {});
    renderUrls(data.urls || []);
    
    if (statsData.status === 'running') {
      startPolling(crawlId);
    } else {
      stopPolling();
    }
  } catch (e) {
    alert('Failed to load crawl: ' + e.message);
  }
}

function renderStats(stats) {
  const html = `
    <div class="stat-item"><div class="stat-value">${stats.visited || 0}</div><div class="stat-label">Visited</div></div>
    <div class="stat-item"><div class="stat-value">${stats.queued || 0}</div><div class="stat-label">Queued</div></div>
    <div class="stat-item"><div class="stat-value">${stats.completed || 0}</div><div class="stat-label">Completed</div></div>
    <div class="stat-item"><div class="stat-value">${stats.failed || 0}</div><div class="stat-label">Failed</div></div>
    <div class="stat-item"><div class="stat-value">${formatDuration(stats.elapsed)}</div><div class="stat-label">Elapsed</div></div>
    <div class="stat-item"><div class="stat-value">${(stats.bytesDownloaded / 1024 / 1024).toFixed(2)} MB</div><div class="stat-label">Downloaded</div></div>
  `;
  $('#stats').innerHTML = html;
}

function renderUrls(urls) {
  const tbody = $('#urls-body');
  tbody.innerHTML = '';
  
  for (const u of urls) {
    const tr = document.createElement('tr');
    const statusClass = u.error ? 'status-failed' : 'status-success';
    const statusText = u.error ? 'Failed' : 'Success';
    tr.innerHTML = `
      <td class="url-cell"><a href="${u.url}" target="_blank">${u.url}</a></td>
      <td>${u.depth}</td>
      <td class="${statusClass}">${statusText}</td>
      <td>${u.links?.length || 0}</td>
      <td>${formatDate(u.timestamp)}</td>
      <td class="error-cell">${u.error || ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

function startPolling(crawlId) {
  stopPolling();
  pollInterval = setInterval(async () => {
    try {
      const data = await fetchApi(`/crawl/${crawlId}/urls`);
      const statsData = await fetchApi(`/crawl/${crawlId}`);
      renderStats(statsData.stats || {});
      renderUrls(data.urls || []);
      if (statsData.status !== 'running') {
        stopPolling();
        await loadCrawls();
        await loadActiveCrawls();
      }
    } catch (e) {
      stopPolling();
    }
  }, 2000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function backToList() {
  stopPolling();
  currentCrawlId = null;
  hide($('#crawl-detail'));
  show($('#new-crawl'));
  show($('#completed-crawls'));
  loadCrawls();
  loadActiveCrawls();
}

async function exportCrawl(format) {
  if (!currentCrawlId) return;
  window.location.href = `${API_BASE}/crawl/${currentCrawlId}/export/${format}`;
}

async function deleteCrawl(crawlId) {
  if (!confirm('Delete this crawl? This cannot be undone.')) return;
  try {
    await fetchApi(`/crawl/${crawlId}`, { method: 'DELETE' });
    await loadCrawls();
    await loadActiveCrawls();
    if (crawlId === currentCrawlId) backToList();
  } catch (e) {
    alert('Failed to delete: ' + e.message);
  }
}

$('#crawl-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#start-btn');
  btn.disabled = true;
  btn.textContent = 'Starting...';
  
  try {
    const formData = new FormData(e.target);
    const res = await fetchApi('/crawl', {
      method: 'POST',
      body: JSON.stringify({
        url: formData.get('url'),
        depth: parseInt(formData.get('depth')),
        crawlId: formData.get('crawlId') || undefined
      })
    });
    btn.disabled = false;
    btn.textContent = 'Start Crawl';
    e.target.reset();
    await loadActiveCrawls();
    viewCrawl(res.crawlId);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Start Crawl';
    alert('Failed to start crawl: ' + err.message);
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.matches('.view-btn')) {
    viewCrawl(e.target.dataset.id);
  }
  if (e.target.matches('.export-json')) {
    window.location.href = `${API_BASE}/crawl/${e.target.dataset.id}/export/json`;
  }
  if (e.target.matches('.export-csv')) {
    window.location.href = `${API_BASE}/crawl/${e.target.dataset.id}/export/csv`;
  }
  if (e.target.matches('.export-sitemap')) {
    window.location.href = `${API_BASE}/crawl/${e.target.dataset.id}/export/sitemap.xml`;
  }
  if (e.target.matches('.delete-btn')) {
    deleteCrawl(e.target.dataset.id);
  }
});

$('#back-btn').addEventListener('click', backToList);
$('#export-json').addEventListener('click', () => exportCrawl('json'));
$('#export-csv').addEventListener('click', () => exportCrawl('csv'));
$('#export-sitemap').addEventListener('click', () => exportCrawl('sitemap.xml'));

loadCrawls();
loadActiveCrawls();
setInterval(() => {
  loadActiveCrawls();
}, 5000);
const { JSDOM } = require('jsdom');
const { canFetch, getCrawlDelay } = require('./robots.js');
const pLimit = require('p-limit');
const fs = require('fs').promises;
const path = require('path');

const CONCURRENCY = parseInt(process.env.CRAWL_CONCURRENCY) || 5;
const MAX_RETRIES = parseInt(process.env.CRAWL_MAX_RETRIES) || 3;
const REQUEST_TIMEOUT = parseInt(process.env.CRAWL_TIMEOUT) || 10000;
const USER_AGENT = process.env.CRAWL_USER_AGENT || 'WebCrawler/1.0';
const STATE_DIR = process.env.CRAWL_STATE_DIR || './crawl-state';
const MAX_PAGES = parseInt(process.env.CRAWL_MAX_PAGES) || 10000;
const ALLOWED_DOMAINS = (process.env.CRAWL_ALLOWED_DOMAINS || '').split(',').filter(Boolean);

const limit = pLimit(CONCURRENCY);

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

const normalizeUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    const hostpath = `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase();
    if (hostpath.endsWith('/')) {
      return hostpath.slice(0, -1);
    }
    return hostpath;
  } catch (e) {
    return null;
  }
};

const getUrlsFromHtml = (htmlBody, baseUrl) => {
  const urls = [];
  const dom = new JSDOM(htmlBody);
  const linkElements = dom.window.document.querySelectorAll('a');
  linkElements.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    try {
      const resolvedUrl = new URL(href, baseUrl);
      if (resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:') {
        resolvedUrl.hash = '';
        urls.push(resolvedUrl.href);
      }
    } catch (e) {
    }
  });
  return urls;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, ...options.headers }
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
      }
      if (attempt === retries) throw error;
      const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
      await sleep(backoff + Math.random() * 1000);
    }
  }
}

async function getUrlsWrapper(url) {
  if (!isValidUrl(url)) throw new Error('Invalid URL');

  const allowed = await canFetch(url);
  if (!allowed) {
    console.log(`Blocked by robots.txt: ${url}`);
    return [];
  }

  if (ALLOWED_DOMAINS.length > 0) {
    const hostname = new URL(url).hostname;
    if (!ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
      console.log(`Domain not allowed: ${hostname}`);
      return [];
    }
  }

  const response = await fetchWithRetry(url);
  
  if (!response.ok) {
    console.log(`HTTP ${response.status} for ${url}`);
    return [];
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    console.log(`Skipping non-HTML: ${contentType} for ${url}`);
    return [];
  }

  const htmlBody = await response.text();
  const baseUrl = response.url || url;
  return getUrlsFromHtml(htmlBody, baseUrl);
}

class CrawlState {
  constructor(crawlId) {
    this.crawlId = crawlId;
    this.visitedUrls = new Map();
    this.queue = [];
    this.metrics = {
      started: Date.now(),
      completed: 0,
      failed: 0,
      queued: 0,
      bytesDownloaded: 0
    };
    this.stateFile = path.join(STATE_DIR, `${crawlId}.json`);
  }

  async load() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.visitedUrls = new Map(Object.entries(parsed.visitedUrls || {}));
      this.queue = parsed.queue || [];
      this.metrics = { ...this.metrics, ...parsed.metrics };
      return true;
    } catch (e) {
      return false;
    }
  }

  async save() {
    await fs.mkdir(STATE_DIR, { recursive: true });
    const data = {
      crawlId: this.crawlId,
      visitedUrls: Object.fromEntries(this.visitedUrls),
      queue: this.queue,
      metrics: this.metrics,
      updated: Date.now()
    };
    await fs.writeFile(this.stateFile, JSON.stringify(data, null, 2));
  }

  addUrl(url, depth, parentUrl = null) {
    const normalized = normalizeUrl(url);
    if (!normalized) return false;
    if (this.visitedUrls.has(normalized)) return false;
    if (this.queue.some(item => normalizeUrl(item.url) === normalized)) return false;
    this.queue.push({ url, depth, parentUrl, added: Date.now() });
    this.metrics.queued++;
    return true;
  }

  markVisited(url, depth, links = [], error = null) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    this.visitedUrls.set(normalized, { url, depth, links, error, timestamp: Date.now() });
    this.metrics.completed++;
    if (error) this.metrics.failed++;
  }

  getNextUrl() {
    return this.queue.shift();
  }

  hasPending() {
    return this.queue.length > 0;
  }

  getStats() {
    return {
      crawlId: this.crawlId,
      visited: this.visitedUrls.size,
      queued: this.queue.length,
      ...this.metrics,
      elapsed: Date.now() - this.metrics.started
    };
  }
}

async function crawl(startUrl, maxDepth, options = {}) {
  const { crawlId = `crawl-${Date.now()}`, resume = false, onProgress } = options;
  
  const state = new CrawlState(crawlId);
  if (resume) await state.load();
  
  if (state.queue.length === 0) {
    state.addUrl(startUrl, maxDepth);
  }

  const workers = Array(CONCURRENCY).fill(null).map(async () => {
    while (state.hasPending() && state.visitedUrls.size < MAX_PAGES) {
      const item = state.getNextUrl();
      if (!item) break;

      const { url, depth } = item;
      const normalized = normalizeUrl(url);
      
      if (state.visitedUrls.has(normalized)) continue;
      if (depth < 0) continue;

      try {
        const urls = await getUrlsWrapper(url);
        const links = urls.map(u => normalizeUrl(u)).filter(Boolean);
        
        state.markVisited(url, depth, links);
        
        if (depth > 0) {
          const crawlDelay = await getCrawlDelay(url);
          for (const nextUrl of urls) {
            if (state.visitedUrls.size >= MAX_PAGES) break;
            state.addUrl(nextUrl, depth - 1, url);
          }
          if (crawlDelay > 0) await sleep(crawlDelay);
        }
      } catch (error) {
        state.markVisited(url, depth, [], error.message);
      }

      if (onProgress) onProgress(state.getStats());
      await state.save();
    }
  });

  await Promise.all(workers);
  return state;
}

function generateSitemap(urls) {
  const urlEntries = Array.from(urls.values())
    .filter(v => !v.error)
    .map(v => `  <url><loc>${v.url}</loc><lastmod>${new Date(v.timestamp).toISOString()}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join('\n')}\n</urlset>`;
}

function generateCsv(urls) {
  const headers = ['URL', 'Depth', 'Status', 'Links Found', 'Timestamp', 'Error'];
  const rows = Array.from(urls.values()).map(v => [
    v.url,
    v.depth,
    v.error ? 'failed' : 'success',
    v.links?.length || 0,
    new Date(v.timestamp).toISOString(),
    v.error || ''
  ]);
  return [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

module.exports = {
  isValidUrl,
  normalizeUrl,
  getUrlsFromHtml,
  getUrlsWrapper,
  crawl,
  CrawlState,
  generateSitemap,
  generateCsv,
  MAX_PAGES,
  CONCURRENCY
};
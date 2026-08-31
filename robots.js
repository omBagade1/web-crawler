const { URL } = require('url');

const robotCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

class RobotsParser {
  constructor() {
    this.rules = { allow: [], disallow: [] };
    this.crawlDelay = null;
    this.sitemaps = [];
  }

  static parse(content) {
    const parser = new RobotsParser();
    let currentAgent = null;

    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const [directive, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      switch (directive.toLowerCase()) {
        case 'user-agent':
          currentAgent = value.toLowerCase();
          break;
        case 'disallow':
          if (currentAgent === '*' && value) {
            parser.rules.disallow.push(value);
          }
          break;
        case 'allow':
          if (currentAgent === '*' && value) {
            parser.rules.allow.push(value);
          }
          break;
        case 'crawl-delay':
          if (currentAgent === '*') {
            const delay = parseFloat(value);
            if (!isNaN(delay)) parser.crawlDelay = delay * 1000; // ms
          }
          break;
        case 'sitemap':
          parser.sitemaps.push(value);
          break;
      }
    });

    return parser;
  }

  canFetch(pathname) {
    // Check allow rules first (more specific)
    for (const rule of this.rules.allow) {
      if (this.matchPath(pathname, rule)) return true;
    }
    // Then disallow rules
    for (const rule of this.rules.disallow) {
      if (this.matchPath(pathname, rule)) return false;
    }
    return true;
  }

  matchPath(pathname, rule) {
    // Convert robots.txt pattern to regex
    // * = any chars, $ = end of string
    const regexStr = rule
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\$/g, '$');
    return new RegExp(`^${regexStr}`).test(pathname);
  }

  getCrawlDelay() {
    return this.crawlDelay;
  }
}

async function fetchRobotsTxt(domain) {
  const now = Date.now();
  const cached = robotCache.get(domain);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.parser;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://${domain}/robots.txt`, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'WebCrawler/1.0' }
    });
    clearTimeout(timeout);

    const content = response.ok ? await response.text() : '';
    const parser = RobotsParser.parse(content);
    
    robotCache.set(domain, { parser, timestamp: now });
    return parser;
  } catch (e) {
    // No robots.txt or fetch failed = allow all
    const parser = new RobotsParser();
    robotCache.set(domain, { parser, timestamp: now });
    return parser;
  }
}

function getDomain(url) {
  return new URL(url).hostname;
}

async function canFetch(url) {
  const domain = getDomain(url);
  const parser = await fetchRobotsTxt(domain);
  const pathname = new URL(url).pathname;
  return parser.canFetch(pathname);
}

async function getCrawlDelay(url) {
  const domain = getDomain(url);
  const parser = await fetchRobotsTxt(domain);
  return parser.getCrawlDelay() || 1000; // default 1s
}

module.exports = { canFetch, getCrawlDelay, RobotsParser };
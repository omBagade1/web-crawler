const { isValidUrl, normalizeUrl, getUrlsFromHtml, crawl, getUrlsWrapper, delay, CrawlState, generateSitemap, generateCsv, MAX_PAGES, CONCURRENCY } = require('./crawler');

global.fetch = jest.fn();
jest.mock('./crawler.js', () => {
  const original = jest.requireActual('./crawler.js');
  return {
    ...original,
    delay: jest.fn().mockResolvedValue(undefined)
  };
});

jest.setTimeout(15000);

beforeEach(() => {
  fetch.mockReset();
  delay.mockClear();
  delay.mockResolvedValue(undefined);
});

test('returns the validity of a URL', () => {
  let url = 'https://www.example.com';
  let invalidUrl = 'not a url';
  expect(isValidUrl(url)).toBe(true);
  expect(isValidUrl(invalidUrl)).toBe(false);
});

test('returns the normalized version of a URL', () => {
  let url = 'https://www.example.com/path/to/page';
  let normalizedUrl = 'www.example.com/path/to/page';
  expect(normalizeUrl(url)).toBe(normalizedUrl);
});

test('returns the normalized version of a URL without trailing slash', () => {
  let url = 'https://www.example.com/path/to/page/';
  let normalizedUrl = 'www.example.com/path/to/page';
  expect(normalizeUrl(url)).toBe(normalizedUrl);
});

test('resturns the normalized version of a URL with uppercase letters', () => {
  let url = 'https://www.Example.com/Path/To/Page';
  let normalizedUrl = 'www.example.com/path/to/page';
  expect(normalizeUrl(url)).toBe(normalizedUrl);
});

test('returns an array of URLs from HTML', () => {
  const htmlBody = `
    <html> 
      <body>
        <a href="https://www.example.com/page1">Page 1</a>
        <a href="https://www.example.com/page2">Page 2</a>
        <a href="/page3">Page 3</a>
      </body>
    </html>
  `;
  const baseUrl = 'https://www.example.com';
  const expectedUrls = [
    'https://www.example.com/page1',
    'https://www.example.com/page2',
    'https://www.example.com/page3'
  ];
  expect(getUrlsFromHtml(htmlBody, baseUrl)).toEqual(expectedUrls);
});

test('resolves relative links and ignores non-web links', () => {
  const htmlBody = `
    <a href="next-page">Next page</a>
    <a href="#section">Section</a>
    <a href="mailto:test@example.com">Email</a>
    <a href="javascript:void(0)">Script</a>
  `;
  const baseUrl = 'https://www.example.com/section/';

  expect(getUrlsFromHtml(htmlBody, baseUrl)).toEqual([
    'https://www.example.com/section/next-page',
    'https://www.example.com/section/'
  ]);
});

test('crawl function returns CrawlState with visited URLs (mocked)', async () => {
  fetch.mockImplementation((url) => {
    if (url.includes('/robots.txt')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('User-agent: *\nAllow: /')
      });
    }
    return Promise.resolve({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      url: 'https://www.example.com',
      text: () => Promise.resolve('<html><body><a href="/page1">Page 1</a></body></html>')
    });
  });

  const url = 'https://www.example.com';
  const depth = 1;  
  const state = await crawl(url, depth, { crawlId: 'test-crawl' });
  
  expect(state).toBeInstanceOf(CrawlState);
  expect(state.visitedUrls.size).toBeGreaterThan(0);
  expect(state.visitedUrls.has('www.example.com')).toBe(true);
});

test('getUrlsWrapper respects robots.txt disallow', async () => {
  fetch.mockImplementation((url) => {
    if (url.includes('/robots.txt')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('User-agent: *\nDisallow: /private/')
      });
    }
    return Promise.resolve({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      url: 'https://www.example.com',
      text: () => Promise.resolve('<html><body></body></html>')
    });
  });

  const urls = await getUrlsWrapper('https://www.example.com/private/page');
  expect(urls).toEqual([]);
});

test('getUrlsWrapper skips non-HTML content', async () => {
  fetch.mockImplementation((url) => {
    if (url.includes('/robots.txt')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
    }
    return Promise.resolve({
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      url: 'https://www.example.com/api',
      text: () => Promise.resolve('{"data": "test"}')
    });
  });

  const urls = await getUrlsWrapper('https://www.example.com/api');
  expect(urls).toEqual([]);
});

test('getUrlsWrapper handles HTTP errors', async () => {
  fetch.mockImplementation((url) => {
    if (url.includes('/robots.txt')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      headers: new Map([['content-type', 'text/html']]),
      url: 'https://www.example.com',
      text: () => Promise.resolve('Not Found')
    });
  });

  const urls = await getUrlsWrapper('https://www.example.com/missing');
  expect(urls).toEqual([]);
});

test('CrawlState saves and loads state', async () => {
  const state = new CrawlState('test-crawl-save');
  state.addUrl('https://example.com/page1', 2);
  state.addUrl('https://example.com/page2', 1);
  state.markVisited('https://example.com/page1', 2, ['page2'], null);
  
  await state.save();
  
  const loaded = new CrawlState('test-crawl-save');
  await loaded.load();
  
  expect(loaded.visitedUrls.size).toBe(1);
  expect(loaded.queue.length).toBe(2); // both URLs still in queue (markVisited doesn't remove from queue)
  expect(loaded.metrics.completed).toBe(1);
});

test('generateSitemap creates valid XML', () => {
  const urls = new Map();
  urls.set('example.com/page1', { url: 'https://example.com/page1', timestamp: Date.now(), error: null });
  urls.set('example.com/page2', { url: 'https://example.com/page2', timestamp: Date.now(), error: 'failed' });
  
  const sitemap = generateSitemap(urls);
  expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  expect(sitemap).toContain('https://example.com/page1');
  expect(sitemap).not.toContain('https://example.com/page2');
});

test('generateCsv creates valid CSV', () => {
  const urls = new Map();
  urls.set('example.com/page1', { url: 'https://example.com/page1', depth: 1, links: ['a', 'b'], timestamp: Date.now(), error: null });
  urls.set('example.com/page2', { url: 'https://example.com/page2', depth: 0, links: [], timestamp: Date.now(), error: 'timeout' });
  
  const csv = generateCsv(urls);
  const lines = csv.split('\n');
  expect(lines[0]).toContain('"URL"');
  expect(lines[0]).toContain('"Depth"');
  expect(lines[0]).toContain('"Status"');
  expect(lines[1]).toContain('https://example.com/page1');
  expect(lines[1]).toContain('success');
  expect(lines[2]).toContain('https://example.com/page2');
  expect(lines[2]).toContain('failed');
  expect(lines[2]).toContain('timeout');
});

test('normalizeUrl handles query parameters and fragments', () => {
  expect(normalizeUrl('https://example.com/page?foo=bar')).toBe('example.com/page');
  expect(normalizeUrl('https://example.com/page#section')).toBe('example.com/page');
  expect(normalizeUrl('https://example.com/page?foo=bar#section')).toBe('example.com/page');
});

test('CONCURRENCY and MAX_PAGES are exported', () => {
  expect(typeof CONCURRENCY).toBe('number');
  expect(typeof MAX_PAGES).toBe('number');
  expect(CONCURRENCY).toBeGreaterThan(0);
  expect(MAX_PAGES).toBeGreaterThan(0);
});
const { isValidUrl, normalizeUrl, getUrlsFromHtml, crawl, getUrlsWrapper, delay } = require('./crawler');

global.fetch = jest.fn();
jest.mock('./crawler.js', () => {
  const original = jest.requireActual('./crawler.js');
  return {
    ...original,
    delay: jest.fn().mockResolvedValue(undefined)
  };
});

jest.setTimeout(10000);

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

test('crawl function returns a set of unique URLs (mocked)', async () => {
  // Mock robots.txt allow all
  fetch.mockImplementation((url) => {
    if (url.includes('/robots.txt')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('User-agent: *\nAllow: /')
      });
    }
    // Mock HTML response
    return Promise.resolve({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      url: 'https://www.example.com',
      text: () => Promise.resolve('<html><body><a href="/page1">Page 1</a></body></html>')
    });
  });

  const url = 'https://www.example.com';
  const depth = 1;  
  const visitedUrls = new Set();
  const urls = await crawl(url, depth, visitedUrls);
  
  expect(urls).toBeInstanceOf(Set);
  expect(urls.size).toBeGreaterThan(0);
  expect(urls.has('https://www.example.com')).toBe(true);
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
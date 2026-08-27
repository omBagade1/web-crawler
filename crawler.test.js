const { isValidUrl, normalizeUrl, getUrlsFromHtml , crawl } = require('./crawler');

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

test('crawl function returns a set of unique URLs', async () => {
  const url = 'https://www.example.com';
  const depth = 2;  
  const visitedUrls = new Set();
  const urls = await crawl(url, depth, visitedUrls);
  expect(urls).toBeInstanceOf(Set);
  expect(urls.size).toBeGreaterThan(0);
} 
);

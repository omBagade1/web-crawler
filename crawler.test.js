const { isValidUrl, normalizeUrl, getUrlsFromHtml } = require('./crawler');

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

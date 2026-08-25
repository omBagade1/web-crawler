const { isValidUrl , normalizeUrl } = require("./crawler");


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

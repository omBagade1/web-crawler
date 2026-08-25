const { isValidUrl, normalizeUrl, getUrlsFromHtml } = require('./crawler');


function main() {
  const url = 'https://en.wikipedia.org/wiki/Lionel_Messi';
  console.log(url);
  if (!isValidUrl(url)) {
    console.error('Invalid URL');
    return;
  }
  else {
    console.log('Valid URL');
  }

  console.log('Starting with normalized URL:', normalizeUrl(url));
  
  async function fetchAndExtractUrls(url) {
    try {
      const response = await fetch(url);
      const htmlBody = await response.text();
      const extractedUrls = getUrlsFromHtml(htmlBody, url);
      console.log('Extracted URLs:', extractedUrls);
    } catch (error) {
      console.error('Error fetching the URL:', error);
    }
  }

  fetchAndExtractUrls(url);
}

main();
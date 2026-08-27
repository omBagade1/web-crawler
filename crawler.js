const { JSDOM } = require('jsdom');



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
    if(hostpath.endsWith('/')) {
      return hostpath.slice(0, -1);
    }
    return hostpath;
  } catch (e) {
    return null;
  } 
} ;

const getUrlsFromHtml = (htmlBody, baseUrl) => {
  const urls = [];
  const dom = new JSDOM(htmlBody);
  const linkElements = dom.window.document.querySelectorAll('a');
  linkElements.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    try {
      const resolvedUrl = new URL(href, baseUrl);
      if (resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:') {
        resolvedUrl.hash = '';
        urls.push(resolvedUrl.href);
      }
    } catch (e) {
      // Ignore malformed links instead of aborting the crawl.
     }
  });

  return urls;
};


async function geturlWrapper(url) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL');
  }
  else{
    const response = await fetch(url);
    const htmlBody = await response.text();

    // Resolve relative links against a full absolute URL.
    const baseUrl = response.url || url;
    const urls = getUrlsFromHtml(htmlBody, baseUrl);
    console.log(`Extracted URLs: ${urls}`);
    return urls;  
  }
};

async function crawl(url, depth, visitedUrls) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL');
  }

  if (depth === 0 || visitedUrls.has(url)) {
    return visitedUrls;
  }
  else{ 
    visitedUrls.add(url);
    const urls = await geturlWrapper(url);
    depth--;
    for (const nextUrl of urls) {
      await crawl(nextUrl, depth, visitedUrls);
    }
    return visitedUrls;
  }
}

    


module.exports = {
  isValidUrl,
  normalizeUrl,
  getUrlsFromHtml,
  geturlWrapper,
  crawl
};
   
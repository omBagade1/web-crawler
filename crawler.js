const { JSDOM } = require('jsdom');
const { canFetch, getCrawlDelay } = require('./robots.js');


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


async function getUrlsWrapper(url) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL');
  }
  else{
    const allowed = await canFetch(url);
    if (!allowed) {
      console.log(`Blocked by robots.txt: ${url}`);
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'WebCrawler/1.0' }
    });
    clearTimeout(timeout);

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

    // Resolve relative links against a full absolute URL.
    const baseUrl = response.url || url;
    const urls = getUrlsFromHtml(htmlBody, baseUrl);
    console.log(`Extracted URLs: ${urls}`);
    return urls;  
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function crawl(url, depth, visitedUrls) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL');
  }

  if (depth === 0 || visitedUrls.has(url)) {
    return visitedUrls;
  }
  else{ 
    visitedUrls.add(url);
    const urls = await getUrlsWrapper(url);
    depth--;
    
    const crawlDelay = await getCrawlDelay(url);
    
    for (const nextUrl of urls) {
      await delay(crawlDelay); // Respect robots.txt crawl-delay
      await crawl(nextUrl, depth, visitedUrls);
    }
    return visitedUrls;
  }
}

    


module.exports = {
  isValidUrl,
  normalizeUrl,
  getUrlsFromHtml,
  getUrlsWrapper,
  crawl
};
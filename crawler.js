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
     if(link.href.startsWith('/')) {
      urls.push(new URL(link.href, baseUrl).href);
     } else {
      urls.push(link.href);
     }
  });

  return urls;
};



module.exports = {
  isValidUrl,
  normalizeUrl,
  getUrlsFromHtml
};
   
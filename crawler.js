
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


module.exports = { isValidUrl, normalizeUrl };
   
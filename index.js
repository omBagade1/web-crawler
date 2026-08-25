console.log("Starting web crawler...");

const url = 'https://developer.mozilla.org/en-US/docs/Web/API/URL/parse_static';

console.log(new URL(url));

async function htmlData(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    console.log(true);
    return html;
  } catch (error) {
    console.error(`Error fetching HTML data: ${error}`);
    return null;
  } 
};

htmlData(url);



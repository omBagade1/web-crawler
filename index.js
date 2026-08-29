const express = require('express');
const app = express();


app.get('/', (req, res) => {
  res.send('Welcome to the web crawler!');
});

app.get('/crawl', (req, res) => {
  const url = req.query.url;  
  if (!url) {
    console.log('URL parameter is required');
    return res.status(400).send('URL parameter is required');
  }
  const depth = parseInt(req.query.depth);
  if (isNaN(depth) || depth < 0 || depth > 10) {
    return res.status(400).send('Depth must be a number between 0 and 10');
  }
  const { crawl } = require('./crawler.js');
  const visitedUrls = new Set();
  crawl(url, depth, visitedUrls)
    .then(urls => {
      res.json({ urls: [...urls] });
    })
    .catch(error => {
      console.error(`Error occurred while crawling: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).send(`Error: ${error.message}`);
      }
    });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
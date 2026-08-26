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
  else {
    const { geturlWrapper } = require('./crawler.js');
    geturlWrapper(url)
      .then(urls => {
        res.json({ urls });
      })
      .catch(error => {
        console.error(`Error occurred while crawling: ${error.message}`);
        res.status(500).send(`Error: ${error.message}`);
      });
  }
});


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
const express = require('express');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { crawl, CrawlState, generateSitemap, generateCsv, MAX_PAGES, CONCURRENCY } = require('./crawler.js');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/crawler.log' })
  ]
});

const app = express();
app.use(express.json());
app.use(express.static('public'));

const activeCrawls = new Map();

function getStateDir() {
  return process.env.CRAWL_STATE_DIR || './crawl-state';
}

async function listCrawls() {
  const dir = getStateDir();
  try {
    const files = await fs.readdir(dir);
    const crawls = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = JSON.parse(await fs.readFile(path.join(dir, file), 'utf-8'));
          crawls.push({
            crawlId: data.crawlId,
            visited: Object.keys(data.visitedUrls || {}).length,
            queued: (data.queue || []).length,
            completed: data.metrics?.completed || 0,
            failed: data.metrics?.failed || 0,
            started: data.metrics?.started,
            updated: data.updated
          });
        } catch (e) {}
      }
    }
    return crawls.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  } catch (e) {
    return [];
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() });
});

app.get('/api/crawls', async (req, res) => {
  try {
    const crawls = await listCrawls();
    res.json(crawls);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/crawl', async (req, res) => {
  const { url, depth = 2, crawlId, resume = false } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  const id = crawlId || `crawl-${Date.now()}`;
  const d = parseInt(depth);
  if (isNaN(d) || d < 0 || d > 10) return res.status(400).json({ error: 'Depth must be 0-10' });

  if (activeCrawls.has(id)) {
    return res.status(409).json({ error: 'Crawl already in progress', crawlId: id });
  }

  const progressCb = (stats) => {
    logger.info('Crawl progress', { crawlId: id, ...stats });
  };

  const crawlPromise = crawl(url, d, { crawlId: id, resume, onProgress: progressCb })
    .then(state => {
      activeCrawls.delete(id);
      logger.info('Crawl completed', { crawlId: id, stats: state.getStats() });
      return state;
    })
    .catch(err => {
      activeCrawls.delete(id);
      logger.error('Crawl failed', { crawlId: id, error: err.message });
      throw err;
    });

  activeCrawls.set(id, crawlPromise);
  res.json({ crawlId: id, message: 'Crawl started' });
});

app.get('/api/crawl/:crawlId', async (req, res) => {
  const { crawlId } = req.params;
  if (activeCrawls.has(crawlId)) {
    return res.json({ status: 'running', crawlId });
  }
  try {
    const state = new CrawlState(crawlId);
    await state.load();
    res.json({ status: 'completed', crawlId, stats: state.getStats() });
  } catch (e) {
    res.status(404).json({ error: 'Crawl not found' });
  }
});

app.get('/api/crawl/:crawlId/urls', async (req, res) => {
  const { crawlId } = req.params;
  try {
    const state = new CrawlState(crawlId);
    await state.load();
    const urls = Array.from(state.visitedUrls.entries()).map(([norm, data]) => ({
      normalized: norm,
      ...data
    }));
    res.json({ crawlId, urls, total: urls.length });
  } catch (e) {
    res.status(404).json({ error: 'Crawl not found' });
  }
});

app.get('/api/crawl/:crawlId/export/json', async (req, res) => {
  const { crawlId } = req.params;
  try {
    const state = new CrawlState(crawlId);
    await state.load();
    const data = {
      crawlId,
      stats: state.getStats(),
      urls: Array.from(state.visitedUrls.entries()).map(([norm, data]) => ({ normalized: norm, ...data }))
    };
    res.setHeader('Content-Disposition', `attachment; filename="${crawlId}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (e) {
    res.status(404).json({ error: 'Crawl not found' });
  }
});

app.get('/api/crawl/:crawlId/export/csv', async (req, res) => {
  const { crawlId } = req.params;
  try {
    const state = new CrawlState(crawlId);
    await state.load();
    const csv = generateCsv(state.visitedUrls);
    res.setHeader('Content-Disposition', `attachment; filename="${crawlId}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (e) {
    res.status(404).json({ error: 'Crawl not found' });
  }
});

app.get('/api/crawl/:crawlId/export/sitemap.xml', async (req, res) => {
  const { crawlId } = req.params;
  try {
    const state = new CrawlState(crawlId);
    await state.load();
    const sitemap = generateSitemap(state.visitedUrls);
    res.setHeader('Content-Disposition', `attachment; filename="sitemap.xml"`);
    res.setHeader('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (e) {
    res.status(404).json({ error: 'Crawl not found' });
  }
});

app.delete('/api/crawl/:crawlId', async (req, res) => {
  const { crawlId } = req.params;
  if (activeCrawls.has(crawlId)) {
    return res.status(409).json({ error: 'Cannot delete running crawl' });
  }
  try {
    const stateFile = path.join(getStateDir(), `${crawlId}.json`);
    await fs.unlink(stateFile);
    res.json({ message: 'Crawl deleted' });
  } catch (e) {
    res.status(404).json({ error: 'Crawl not found' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    concurrency: CONCURRENCY,
    maxPages: MAX_PAGES,
    maxRetries: parseInt(process.env.CRAWL_MAX_RETRIES) || 3,
    timeout: parseInt(process.env.CRAWL_TIMEOUT) || 10000,
    userAgent: process.env.CRAWL_USER_AGENT || 'WebCrawler/1.0',
    allowedDomains: (process.env.CRAWL_ALLOWED_DOMAINS || '').split(',').filter(Boolean)
  });
});

app.get('/api/metrics', (req, res) => {
  const running = Array.from(activeCrawls.keys());
  res.json({
    runningCrawls: running.length,
    runningCrawlIds: running,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
});
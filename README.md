# Web Crawler

A robust, production-ready web crawler with robots.txt compliance, concurrent crawling, persistence, and a web UI.

## Features

- **Robots.txt Compliance** - Automatically fetches and respects robots.txt rules including crawl-delay
- **Concurrent Crawling** - Configurable worker pool for parallel crawling (default: 5 concurrent)
- **Depth-Limited Crawling** - Crawl to specified depth (0-10)
- **URL Deduplication** - Normalizes URLs to avoid crawling the same page multiple times
- **Retry Logic** - Exponential backoff with configurable retries for failed requests
- **Persistence** - Save/resume crawl state to disk (survives restarts)
- **Multiple Export Formats** - JSON, CSV, and sitemap.xml
- **Web UI** - Start crawls, monitor progress, view results, export data
- **REST API** - Full programmatic access
- **Structured Logging** - Winston-based JSON logging
- **Health Checks** - `/health` endpoint for monitoring
- **Configuration** - Environment variable based configuration

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
PORT=3000                    # Server port
LOG_LEVEL=info               # Log level (error, warn, info, debug)
CRAWL_CONCURRENCY=5          # Concurrent workers
CRAWL_MAX_RETRIES=3          # Max retry attempts
CRAWL_TIMEOUT=10000          # Request timeout (ms)
CRAWL_USER_AGENT=WebCrawler/1.0
CRAWL_MAX_PAGES=10000        # Max pages per crawl
CRAWL_ALLOWED_DOMAINS=       # Comma-separated allowed domains (empty = all)
CRAWL_STATE_DIR=./crawl-state # State persistence directory
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/crawls` | List all crawls |
| POST | `/api/crawl` | Start new crawl |
| GET | `/api/crawl/:id` | Get crawl status |
| GET | `/api/crawl/:id/urls` | Get crawled URLs |
| GET | `/api/crawl/:id/export/json` | Export as JSON |
| GET | `/api/crawl/:id/export/csv` | Export as CSV |
| GET | `/api/crawl/:id/export/sitemap.xml` | Export as sitemap |
| DELETE | `/api/crawl/:id` | Delete crawl state |
| GET | `/api/config` | Get current config |
| GET | `/api/metrics` | Get server metrics |

### Start a Crawl

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "depth": 2}'
```

Response:
```json
{"crawlId": "crawl-1234567890", "message": "Crawl started"}
```

### Resume a Crawl

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "depth": 2, "crawlId": "crawl-1234567890", "resume": true}'
```

## Web UI

The UI at `/` provides:
- Start new crawls with URL and depth
- View active crawls with real-time progress
- Browse completed crawls with statistics
- View crawled URLs in a sortable table
- Export results (JSON, CSV, sitemap.xml)
- Delete crawl data

## Programmatic Usage

```javascript
const { crawl } = require('./crawler');

const state = await crawl('https://example.com', 2, {
  crawlId: 'my-crawl',
  onProgress: (stats) => console.log(stats)
});

console.log(`Visited: ${state.visitedUrls.size} URLs`);
console.log(state.getStats());
```

## Project Structure

```
├── index.js          # Express server, API routes, UI serving
├── crawler.js        # Core crawling logic
├── robots.js         # Robots.txt parsing and compliance
├── public/           # Web UI (HTML, CSS, JS)
├── logs/             # Winston log files
├── crawl-state/      # Persisted crawl states
└── crawler.test.js   # Jest tests
```

## Testing

```bash
npm test
```

## License

ISC
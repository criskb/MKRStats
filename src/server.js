import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_CONFIG } from './config/platforms.js';
import { fetchAllPlatformStats } from './services/connectors/platformConnectorService.js';
import { aggregatePortfolioData } from './services/analytics/aggregateService.js';
import { forecastNextDays } from './services/predictions/forecastService.js';

const PORT = Number(process.env.PORT ?? 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '../web');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

async function handleOverview(req, res) {
  try {
    const platformData = await fetchAllPlatformStats();
    const aggregated = aggregatePortfolioData(platformData);

    sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      platforms: platformData,
      aggregated,
      forecast: {
        revenue: forecastNextDays(aggregated.timeline, 'revenue', 14),
        sales: forecastNextDays(aggregated.timeline, 'sales', 14)
      }
    });
  } catch (error) {
    sendJson(res, 500, {
      message: 'Unexpected server error',
      details: error.message
    });
  }
}

async function serveStatic(req, res) {
  try {
    const requestPath = req.url === '/' ? '/index.html' : req.url;
    const normalized = path.normalize(requestPath).replace(/^\.+/, '');
    const filePath = path.join(webDir, normalized);

    if (!filePath.startsWith(webDir)) {
      sendJson(res, 400, { message: 'Invalid path' });
      return;
    }

    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
    const file = await readFile(filePath);

    res.writeHead(200, { 'Content-Type': mime });
    res.end(file);
  } catch {
    sendJson(res, 404, { message: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { message: 'Missing request URL' });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/platforms') {
    sendJson(res, 200, { platforms: PLATFORM_CONFIG });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/overview') {
    await handleOverview(req, res);
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MKRStats listening on http://localhost:${PORT}`);
});

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

function normalizeScope(url) {
  const requestedHorizon = Number(url.searchParams.get('horizon') ?? 14);
  const horizon = Number.isFinite(requestedHorizon) ? Math.max(7, Math.min(60, Math.floor(requestedHorizon))) : 14;
  const selectedPlatform = url.searchParams.get('platform') ?? 'all';
  return { horizon, selectedPlatform };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function sendCsv(res, filename, text) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

function selectPlatforms(rawPlatformData, selectedPlatform) {
  return selectedPlatform === 'all'
    ? rawPlatformData
    : rawPlatformData.filter((platform) => platform.id === selectedPlatform);
}

async function getOverviewPayload(url) {
  const { horizon, selectedPlatform } = normalizeScope(url);
  const rawPlatformData = await fetchAllPlatformStats();
  const platformData = selectPlatforms(rawPlatformData, selectedPlatform);

  if (platformData.length === 0) {
    return { status: 404, error: { message: `Platform '${selectedPlatform}' not found` } };
  }

  const aggregated = aggregatePortfolioData(platformData);

  return {
    status: 200,
    payload: {
      generatedAt: new Date().toISOString(),
      selectedPlatform,
      horizon,
      sampleWindowDays: aggregated.timeline.length,
      platforms: platformData,
      aggregated,
      forecast: {
        revenue: forecastNextDays(aggregated.timeline, 'revenue', horizon),
        sales: forecastNextDays(aggregated.timeline, 'sales', horizon)
      }
    }
  };
}

async function handleOverview(_req, res, url) {
  try {
    const overview = await getOverviewPayload(url);
    if (overview.status !== 200) {
      sendJson(res, overview.status, overview.error);
      return;
    }

    sendJson(res, 200, overview.payload);
  } catch (error) {
    sendJson(res, 500, {
      message: 'Unexpected server error',
      details: error.message
    });
  }
}

async function handleExportCsv(_req, res, url) {
  try {
    const overview = await getOverviewPayload(url);
    if (overview.status !== 200) {
      sendJson(res, overview.status, overview.error);
      return;
    }

    const { payload } = overview;
    const header = 'date,views,downloads,sales,revenue\n';
    const rows = payload.aggregated.timeline
      .map((row) => `${row.date},${row.views},${row.downloads},${row.sales},${row.revenue}`)
      .join('\n');

    sendCsv(res, `mkrstats-${payload.selectedPlatform}-${payload.generatedAt.slice(0, 10)}.csv`, `${header}${rows}\n`);
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

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/platforms') {
    sendJson(res, 200, { platforms: PLATFORM_CONFIG });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/overview') {
    await handleOverview(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/export.csv') {
    await handleExportCsv(req, res, url);
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MKRStats listening on http://localhost:${PORT}`);
});

import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_CONFIG } from './config/platforms.js';
import { fetchAllPlatformStats } from './services/connectors/platformConnectorService.js';
import { aggregatePortfolioData } from './services/analytics/aggregateService.js';
import { forecastNextDays } from './services/predictions/forecastService.js';
import { buildGlobalBenchmarks } from './services/benchmarks/globalBenchmarkService.js';
import { getConnectionStatuses, upsertConnectionConfig } from './services/connectors/connectionConfigStore.js';

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
  const connected = (url.searchParams.get('connected') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return { horizon, selectedPlatform, connected };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (error) => reject(error));
  });
}

function sendCsv(res, filename, text) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

function selectPlatforms(rawPlatformData, selectedPlatform, connected = []) {
  const scoped = selectedPlatform === 'all'
    ? rawPlatformData
    : rawPlatformData.filter((platform) => platform.id === selectedPlatform);

  if (!connected.length) return scoped;

  const connectedSet = new Set(connected);
  return scoped.filter((platform) => connectedSet.has(platform.id));
}


function buildCollectionSummary(platformData, connected) {
  const dataPoints = platformData.reduce((acc, platform) => {
    const seriesRows = platform.snapshot?.series?.length ?? 0;
    const modelRows = platform.snapshot?.models?.length ?? 0;
    return acc + seriesRows * 4 + modelRows * 4;
  }, 0);

  const freshnessMinutes = platformData
    .map((platform) => Date.parse(platform.snapshot?.fetchedAt ?? '') || Date.now())
    .map((timestamp) => Math.max(0, Math.round((Date.now() - timestamp) / 60000)));

  return {
    source: 'configured_platform_connectors',
    requestedConnectedPlatforms: connected,
    activePlatforms: platformData.map((platform) => platform.id),
    platformCoveragePct: connected.length ? Math.round((platformData.length / connected.length) * 100) : 100,
    estimatedDataPoints: dataPoints,
    maxSnapshotAgeMinutes: freshnessMinutes.length ? Math.max(...freshnessMinutes) : 0
  };
}

async function getOverviewPayload(url) {
  const { horizon, selectedPlatform, connected } = normalizeScope(url);
  const rawPlatformData = await fetchAllPlatformStats();
  const platformData = selectPlatforms(rawPlatformData, selectedPlatform, connected);

  if (platformData.length === 0) {
    const detail = connected.length
      ? `No data found for configured connections: ${connected.join(', ')}`
      : `Platform '${selectedPlatform}' not found`;
    return { status: 404, error: { message: detail } };
  }

  const aggregated = aggregatePortfolioData(platformData);
  const benchmarks = buildGlobalBenchmarks(platformData);
  const collection = buildCollectionSummary(platformData, connected);

  return {
    status: 200,
    payload: {
      generatedAt: new Date().toISOString(),
      selectedPlatform,
      connected,
      horizon,
      sampleWindowDays: aggregated.timeline.length,
      platforms: platformData,
      benchmarks,
      aggregated,
      collection,
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

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/platforms') {
    sendJson(res, 200, {
      platforms: PLATFORM_CONFIG,
      benchmarks: buildGlobalBenchmarks(PLATFORM_CONFIG)
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/overview') {
    await handleOverview(req, res, url);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/connections') {
    try {
      const payload = await readJsonBody(req);
      const saved = await upsertConnectionConfig(payload);
      sendJson(res, 200, { connection: saved });
    } catch (error) {
      sendJson(res, 400, { message: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/connections') {
    try {
      const connections = await getConnectionStatuses();
      sendJson(res, 200, { connections });
    } catch (error) {
      sendJson(res, 500, { message: 'Failed to load connections', details: error.message });
    }
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

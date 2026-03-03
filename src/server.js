import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_CONFIG } from './config/platforms.js';
import { aggregatePortfolioData } from './services/analytics/aggregateService.js';
import { forecastNextDays } from './services/predictions/forecastService.js';
import { buildGlobalBenchmarks } from './services/benchmarks/globalBenchmarkService.js';
import { authenticateBridgeSubmission, getConnectionStatuses, upsertConnectionConfig } from './services/connectors/connectionConfigStore.js';
import { initializeStorage, readLatestBridgeIngestCapturedAt, readPlatformHistory, readRecentCollectionRuns } from './services/storage/index.js';
import { runCollectionCycle } from './services/collection/runCollectionCycle.js';
import { startCollectionScheduler } from './services/collection/scheduler.js';
import { processBridgeIngest } from './services/connectors/bridgeIngestService.js';

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


const connectionStore = new Map();

async function readRequestJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function normalizeConnectionsInput(input) {
  const entries = Object.entries(input ?? {});
  const allowedPlatforms = new Set(PLATFORM_CONFIG.map((platform) => platform.id));

  const normalized = {};
  for (const [platformId, value] of entries) {
    if (!allowedPlatforms.has(platformId)) continue;

    const handle = String(value?.handle ?? '').trim();
    const apiKey = String(value?.apiKey ?? '').trim();

    if (!handle && !apiKey) continue;

    normalized[platformId] = {
      handle,
      hasApiKey: Boolean(apiKey),
      updatedAt: new Date().toISOString()
    };
  }

  return normalized;
}

async function handleSaveConnections(req, res) {
  try {
    const body = await readRequestJson(req);
    const connections = normalizeConnectionsInput(body.connections);

    const snapshot = {
      updatedAt: new Date().toISOString(),
      connections
    };

    connectionStore.set('default', snapshot);

    sendJson(res, 200, {
      message: 'Connections saved',
      configuredPlatforms: Object.keys(connections),
      configuredCount: Object.keys(connections).length
    });
  } catch (error) {
    sendJson(res, 400, { message: error.message || 'Unable to save connections' });
  }
}

function handleGetConnections(_req, res) {
  const snapshot = connectionStore.get('default') ?? { updatedAt: null, connections: {} };
  sendJson(res, 200, snapshot);
}

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



function isAllowedBridgeOrigin(req) {
  const configured = String(process.env.MKRSTATS_BRIDGE_ALLOWED_ORIGINS ?? '').trim();
  if (!configured) return true;

  const origin = String(req.headers.origin ?? '').trim();
  if (!origin) return false;

  const allowedOrigins = configured.split(',').map((value) => value.trim()).filter(Boolean);
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
}

function getBridgeCredentials(req) {
  const token = String(req.headers['x-bridge-api-token'] ?? '').trim();
  const session = String(req.headers['x-bridge-session'] ?? '').trim();
  return { token, session };
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


function buildCollectionSummary(platformData, connected, latestRunByPlatform = new Map()) {
  const dataPoints = platformData.reduce((acc, platform) => {
    const seriesRows = platform.snapshot?.series?.length ?? 0;
    const modelRows = platform.snapshot?.models?.length ?? 0;
    return acc + seriesRows * 4 + modelRows * 4;
  }, 0);

  const freshnessMinutes = platformData
    .map((platform) => Date.parse(platform.snapshot?.fetchedAt ?? '') || Date.now())
    .map((timestamp) => Math.max(0, Math.round((Date.now() - timestamp) / 60000)));

  const perPlatformQuality = platformData.map((platform) => ({
    platformId: platform.id,
    score: platform.snapshot?.quality?.qualityScore ?? 0,
    stale: Boolean(platform.snapshot?.quality?.checks?.staleSnapshot?.stale),
    failed: Boolean(platform.snapshot?.quality?.hasFailures) || platform.metadata?.connector?.status === 'error'
  }));

  const averageQualityScore = perPlatformQuality.length
    ? Math.round(perPlatformQuality.reduce((acc, row) => acc + row.score, 0) / perPlatformQuality.length)
    : 0;

  const platformStatus = platformData.map((platform) => {
    const latestRun = latestRunByPlatform.get(platform.id) ?? null;
    const runConnectorStatus = latestRun?.connectorStatus;
    const snapshotFetchedAt = platform.snapshot?.fetchedAt ?? null;

    return {
      platformId: platform.id,
      status: platform.metadata?.connector?.status ?? runConnectorStatus ?? 'unknown',
      lastSuccessAt: (platform.metadata?.connector?.status === 'ok' || runConnectorStatus === 'ok') ? snapshotFetchedAt : null,
      lastAttemptAt: latestRun?.startedAt ?? snapshotFetchedAt,
      errorCode: platform.metadata?.connector?.error?.code ?? latestRun?.errorCode ?? null,
      errorMessage: platform.metadata?.connector?.error?.message ?? latestRun?.errorMessage ?? null
    };
  });

  return {
    source: 'configured_platform_connectors',
    requestedConnectedPlatforms: connected,
    activePlatforms: platformData.map((platform) => platform.id),
    platformCoveragePct: connected.length ? Math.round((platformData.length / connected.length) * 100) : 100,
    estimatedDataPoints: dataPoints,
    maxSnapshotAgeMinutes: freshnessMinutes.length ? Math.max(...freshnessMinutes) : 0,
    quality: {
      averageQualityScore,
      stalePlatforms: perPlatformQuality.filter((row) => row.stale).length,
      failedPlatforms: perPlatformQuality.filter((row) => row.failed).length,
      perPlatform: perPlatformQuality
    },
    platformStatus
  };
}

function formatRunSummary(run) {
  return {
    id: Number(run.id),
    runType: run.run_type ?? run.runType,
    status: run.status,
    startedAt: run.started_at ?? run.startedAt,
    completedAt: run.ended_at ?? run.completed_at ?? run.completedAt,
    fetchedPlatforms: Number(run.fetched_platforms ?? run.fetchedPlatforms ?? 0),
    upsertedPlatformRows: Number(run.upserted_item_rows ?? run.upsertedItemRows ?? run.upserted_platform_rows ?? run.upsertedPlatformRows ?? 0),
    upsertedModelRows: Number(run.upserted_metric_rows ?? run.upsertedMetricRows ?? run.upserted_model_rows ?? run.upsertedModelRows ?? 0),
    errorMessage: run.error_message ?? run.errorMessage ?? null,
    platformQualityMetrics: run.platform_quality_metrics ?? run.platformQualityMetrics ?? null,
    qualitySummary: run.quality_summary ?? run.qualitySummary ?? null,
    errorCount: Number(run.error_count ?? run.errorCount ?? 0),
    rateLimitedCount: Number(run.rate_limited_count ?? run.rateLimitedCount ?? 0),
    rateLimitEvents: run.rate_limit_events ?? run.rateLimitEvents ?? null,
    nextScheduledAt: run.next_scheduled_at ?? run.nextScheduledAt ?? null
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


  if (req.method === 'GET' && url.pathname === '/api/connections') {
    handleGetConnections(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/connections') {
    await handleSaveConnections(req, res);
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

  if (req.method === 'POST' && url.pathname === '/api/bridge_ingest') {
    try {
      if (!isAllowedBridgeOrigin(req)) {
        sendJson(res, 403, { message: 'Bridge ingest origin is not allowed.' });
        return;
      }

      const payload = await readJsonBody(req);
      const credentials = getBridgeCredentials(req);
      const authenticated = await authenticateBridgeSubmission({
        platformId: payload.platform,
        accountHandle: payload.accountHandle,
        apiToken: credentials.token,
        sessionId: credentials.session
      });

      if (!authenticated) {
        sendJson(res, 401, { message: 'Invalid bridge authentication credentials.' });
        return;
      }

      const result = await processBridgeIngest(payload);
      sendJson(res, 202, { accepted: true, result });
    } catch (error) {
      sendJson(res, 400, { message: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/export.csv') {
    await handleExportCsv(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/collection/status') {
    try {
      const requestedLimit = Number(url.searchParams.get('limit') ?? 20);
      const runs = await readRecentCollectionRuns(requestedLimit);
      const latestBridgeIngestAt = await readLatestBridgeIngestCapturedAt();
      const latestRun = runs[0] ? formatRunSummary(runs[0]) : null;
      const freshnessMinutes = latestBridgeIngestAt
        ? Math.max(0, Math.round((Date.now() - Date.parse(latestBridgeIngestAt)) / 60000))
        : null;

      sendJson(res, 200, {
        generatedAt: new Date().toISOString(),
        latestRun,
        bridgeIngest: {
          latestCapturedAt: latestBridgeIngestAt,
          freshnessMinutes,
          healthy: freshnessMinutes == null ? false : freshnessMinutes <= Number(process.env.MKRSTATS_BRIDGE_FRESHNESS_SLA_MINUTES ?? 120)
        },
        runs: runs.map(formatRunSummary)
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Failed to load collection run status', details: error.message });
    }
    return;
  }

  await serveStatic(req, res);
});

async function start() {
  await initializeStorage();
  const scheduler = startCollectionScheduler();

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}; shutting down.`);
    await scheduler.stop();
    await new Promise((resolve) => server.close(resolve));
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT').finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    shutdown('SIGTERM').finally(() => process.exit(0));
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`MKRStats listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});

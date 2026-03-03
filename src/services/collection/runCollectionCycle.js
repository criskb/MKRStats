import { createHash, randomUUID } from 'crypto';
import { PLATFORM_CONFIG } from '../../config/platforms.js';
import { isoDay } from '../../utils/date.js';
import { normalizeSnapshot, buildMockPlatformSnapshot, isMockFallbackEnabled } from '../connectors/baseConnector.js';
import { getConnectionStatuses } from '../connectors/connectionConfigStore.js';
import { getConnectorRegistration } from '../connectors/registry.js';
import { getStorageRepositories } from '../storage/index.js';
import { getPlatformPolicy } from './platformPolicy.js';

const ACTIVE_STATUSES = new Set(['active', 'connected', 'validated']);
const DEFAULT_SCHEDULE_MS = Number(process.env.MKRSTATS_COLLECTION_INTERVAL_MS ?? 5 * 60 * 1000);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashSnapshot(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function isRateLimited(error) {
  return error?.statusCode === 429 || error?.status === 429 || error?.code === 'RATE_LIMITED';
}

function parseRetryAfterMs(error) {
  const headerValue = error?.retryAfter ?? error?.headers?.['retry-after'] ?? error?.headers?.['Retry-After'];
  if (headerValue == null) return null;

  const numericSeconds = Number(headerValue);
  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, numericSeconds * 1000);
  }

  const ts = Date.parse(String(headerValue));
  if (Number.isNaN(ts)) return null;
  return Math.max(0, ts - Date.now());
}

function computeBackoffMs(attempt, baseDelayMs) {
  const exponential = baseDelayMs * (2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.max(50, Math.floor(baseDelayMs * 0.3)));
  return exponential + jitter;
}

function mergeSnapshots(platformId, snapshots = []) {
  const byDate = new Map();
  const byModel = new Map();

  for (const snapshot of snapshots) {
    for (const row of snapshot.series ?? []) {
      const existing = byDate.get(row.date) ?? { date: row.date, views: 0, downloads: 0, likes: 0, sales: 0, revenue: 0, currency: row.currency ?? 'USD' };
      existing.views += Number(row.views ?? 0);
      existing.downloads += Number(row.downloads ?? 0);
      existing.likes += Number(row.likes ?? 0);
      existing.sales += Number(row.sales ?? 0);
      existing.revenue = Number((existing.revenue + Number(row.revenue ?? 0)).toFixed(2));
      byDate.set(row.date, existing);
    }

    for (const model of snapshot.models ?? []) {
      const key = String(model.id ?? model.title);
      const existing = byModel.get(key) ?? { id: key, title: model.title ?? 'Untitled Model', downloads: 0, likes: 0, sales: 0, revenue: 0 };
      existing.downloads += Number(model.downloads ?? 0);
      existing.likes += Number(model.likes ?? 0);
      existing.sales += Number(model.sales ?? 0);
      existing.revenue = Number((existing.revenue + Number(model.revenue ?? 0)).toFixed(2));
      byModel.set(key, existing);
    }
  }

  return normalizeSnapshot(platformId, {
    source: `${platformId}_job_runner`,
    fetchedAt: new Date().toISOString(),
    series: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    models: [...byModel.values()].sort((a, b) => b.revenue - a.revenue)
  });
}

async function runPlatformJobs(platform, activeConnections, registration, rateLimitEvents) {
  const policy = getPlatformPolicy(platform.id);
  const useMockData = isMockFallbackEnabled();

  if (useMockData) {
    const mockSnapshots = activeConnections.map(() => buildMockPlatformSnapshot(platform.id));
    return {
      snapshots: mockSnapshots,
      errors: []
    };
  }

  const queue = [...activeConnections];
  const snapshots = [];
  const errors = [];

  const worker = async () => {
    while (queue.length) {
      const connection = queue.shift();
      if (!connection) return;
      let attempt = 0;
      let completed = false;

      while (!completed) {
        attempt += 1;
        try {
          const snapshot = await registration.client(connection);
          snapshots.push(snapshot);
          completed = true;
        } catch (error) {
          const canRetry = attempt <= policy.maxRetries;
          if (isRateLimited(error)) {
            const retryAfterMs = parseRetryAfterMs(error);
            const delayMs = retryAfterMs ?? computeBackoffMs(attempt, Math.max(policy.minDelayMs, 250));
            rateLimitEvents.push({
              platformId: platform.id,
              accountId: connection.accountId,
              attempt,
              delayMs,
              usedRetryAfter: retryAfterMs != null,
              message: error.message,
              at: new Date().toISOString()
            });
            if (canRetry) {
              await wait(delayMs);
              continue;
            }
          }

          if (!canRetry) {
            errors.push(error);
            break;
          }

          await wait(computeBackoffMs(attempt, Math.max(policy.minDelayMs, 150)));
        }
      }

      if (policy.minDelayMs > 0) {
        await wait(policy.minDelayMs);
      }
    }
  };

  const workers = Array.from({ length: Math.min(policy.maxConcurrency, activeConnections.length) }, () => worker());
  await Promise.all(workers);
  return { snapshots, errors };
}

function buildRunQualityMetrics(platformData) {
  const perPlatform = platformData.map((platform) => ({
    platformId: platform.id,
    connectorStatus: platform.metadata?.connector?.status ?? 'unknown',
    qualityScore: platform.snapshot?.quality?.qualityScore ?? 0,
    stale: Boolean(platform.snapshot?.quality?.checks?.staleSnapshot?.stale),
    failed: Boolean(platform.snapshot?.quality?.hasFailures) || platform.metadata?.connector?.status === 'error',
    checks: platform.snapshot?.quality?.checks ?? null
  }));

  const stalePlatforms = perPlatform.filter((entry) => entry.stale).length;
  const failedPlatforms = perPlatform.filter((entry) => entry.failed).length;
  const averageQualityScore = perPlatform.length
    ? Math.round(perPlatform.reduce((acc, entry) => acc + entry.qualityScore, 0) / perPlatform.length)
    : 0;

  return {
    perPlatform,
    summary: {
      averageQualityScore,
      stalePlatforms,
      failedPlatforms,
      healthyPlatforms: Math.max(0, perPlatform.length - failedPlatforms)
    }
  };
}

export async function runCollectionCycle({ runType = 'scheduled_fetch', daysBack = null, scheduleIntervalMs = DEFAULT_SCHEDULE_MS } = {}) {
  const repos = getStorageRepositories();
  const startedAt = new Date().toISOString();
  const correlationId = randomUUID();
  const nextScheduledAt = new Date(Date.now() + scheduleIntervalMs).toISOString();
  const runId = await repos.ingestionRuns.createRun({ runType, status: 'running', startedAt, nextScheduledAt });
  const rateLimitEvents = [];

  try {
    const connections = await getConnectionStatuses();
    const platformData = [];

    for (const platform of PLATFORM_CONFIG) {
      const activeConnections = connections.filter((connection) => connection.platformId === platform.id && ACTIVE_STATUSES.has(connection.status));
      const registration = getConnectorRegistration(platform.id);

      if (activeConnections.length === 0) {
        const snapshot = normalizeSnapshot(platform.id, { source: 'connector_unavailable', series: [], models: [] });
        platformData.push({
          ...platform,
          snapshot,
          metadata: { connector: { status: 'error', error: { code: 'NO_ACTIVE_CONNECTION', message: `No active connection configured for ${platform.id}.` } } }
        });
        continue;
      }

      if (!registration?.client) {
        const snapshot = normalizeSnapshot(platform.id, { source: 'connector_unavailable', series: [], models: [] });
        platformData.push({
          ...platform,
          snapshot,
          metadata: { connector: { status: 'error', error: { code: 'UNSUPPORTED_PLATFORM', message: `No connector client implemented for ${platform.id}.` } } }
        });
        continue;
      }

      const { snapshots, errors } = await runPlatformJobs(platform, activeConnections, registration, rateLimitEvents);
      if (!snapshots.length) {
        const firstError = errors[0] ?? new Error('No connector snapshots were returned.');
        const snapshot = normalizeSnapshot(platform.id, { source: 'connector_error', series: [], models: [] });
        platformData.push({
          ...platform,
          snapshot,
          metadata: { connector: { status: 'error', error: { code: firstError.code ?? 'CONNECTOR_FAILURE', message: firstError.message } } }
        });
        continue;
      }

      const snapshot = mergeSnapshots(platform.id, snapshots);
      platformData.push({
        ...platform,
        snapshot,
        metadata: {
          connector: {
            status: errors.length ? 'partial' : 'ok',
            error: errors.length ? { code: 'PARTIAL_CONNECTOR_FAILURE', message: `${errors.length} account connection(s) failed while collecting ${platform.id}.` } : null,
            accountId: activeConnections[0]?.accountId ?? null
          }
        }
      });
    }

    const qualityMetrics = buildRunQualityMetrics(platformData);
    let upsertedItemRows = 0;
    let upsertedMetricRows = 0;

    for (const platform of platformData) {
      const fetchedAt = platform.snapshot?.fetchedAt ?? new Date().toISOString();
      const account = await repos.accounts.upsertAccount({
        platformId: platform.id,
        externalAccountId: platform.metadata?.connector?.accountId ?? `default-${platform.id}`,
        displayName: platform.label,
        now: fetchedAt
      });

      const series = Array.isArray(platform.snapshot?.series) ? platform.snapshot.series : [];
      const limitedSeries = daysBack == null ? series : series.slice(-Math.max(1, daysBack));
      const metricDates = limitedSeries.length ? limitedSeries : [{ date: isoDay(new Date()), views: 0, downloads: 0, likes: 0, sales: 0, revenue: 0 }];
      const models = Array.isArray(platform.snapshot?.models) ? platform.snapshot.models : [];

      for (const model of models) {
        const item = await repos.items.upsertItem({
          accountId: account.id,
          externalItemId: String(model.id ?? model.title),
          title: String(model.title ?? model.id),
          now: fetchedAt
        });
        upsertedItemRows += 1;

        for (const metric of metricDates) {
          const daily = {
            itemId: item.id,
            date: metric.date,
            views: Number(metric.views ?? 0),
            downloads: Number(model.downloads ?? 0),
            sales: Number(model.sales ?? 0),
            revenue: Number(Number(model.revenue ?? 0).toFixed(2)),
            capturedAt: fetchedAt
          };
          await repos.itemMetricsDaily.upsertDailyMetric(daily);
          await repos.itemSnapshotRaw.insertSnapshot({
            ingestionRunId: runId,
            accountId: account.id,
            itemId: item.id,
            date: metric.date,
            dedupeHash: hashSnapshot({ platformId: platform.id, accountId: account.id, itemId: item.id, date: metric.date, model, aggregate: metric, fetchedAt }),
            payload: { platformId: platform.id, accountId: account.id, itemId: item.id, date: metric.date, model, aggregate: metric, fetchedAt },
            capturedAt: fetchedAt
          });
          upsertedMetricRows += 1;
        }
      }
    }

    const errorCount = qualityMetrics.perPlatform.filter((entry) => entry.connectorStatus === 'error').length;
    await repos.ingestionRuns.completeRun(runId, {
      status: 'success',
      endedAt: new Date().toISOString(),
      fetchedPlatforms: platformData.length,
      upsertedItemRows,
      upsertedMetricRows,
      platformQualityMetrics: qualityMetrics.perPlatform,
      qualitySummary: qualityMetrics.summary,
      errorCount,
      rateLimitedCount: rateLimitEvents.length,
      rateLimitEvents,
      nextScheduledAt
    });

    return { runId, correlationId, fetchedPlatforms: platformData.length, upsertedItemRows, upsertedMetricRows, qualitySummary: qualityMetrics.summary };
  } catch (error) {
    await repos.ingestionRuns.completeRun(runId, {
      status: 'failed',
      endedAt: new Date().toISOString(),
      fetchedPlatforms: 0,
      upsertedItemRows: 0,
      upsertedMetricRows: 0,
      errorMessage: error.message,
      platformQualityMetrics: [],
      qualitySummary: { averageQualityScore: 0, stalePlatforms: 0, failedPlatforms: 0, healthyPlatforms: 0 },
      errorCount: 1,
      rateLimitedCount: rateLimitEvents.length,
      rateLimitEvents,
      nextScheduledAt
    });
    throw error;
  }
}

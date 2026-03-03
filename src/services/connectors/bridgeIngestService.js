import { createHash } from 'crypto';
import { validateBridgeIngestPayload } from './validation/bridgeSchemas.js';
import { getStorageRepositories } from '../storage/index.js';

function hashSnapshot(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function toCanonicalMetricRow(row = {}, capturedAt) {
  return {
    date: String(row.date ?? capturedAt.slice(0, 10)).slice(0, 10),
    views: Math.max(0, Math.floor(Number(row.views ?? 0))),
    downloads: Math.max(0, Math.floor(Number(row.downloads ?? 0))),
    sales: Math.max(0, Math.floor(Number(row.sales ?? 0))),
    revenue: Number(Math.max(0, Number(row.revenue ?? 0)).toFixed(2))
  };
}

export async function processBridgeIngest(rawPayload = {}) {
  const payload = validateBridgeIngestPayload(rawPayload);
  const repos = getStorageRepositories();
  const now = payload.capturedAt;

  const runId = await repos.ingestionRuns.createRun({
    runType: 'bridge_ingest',
    status: 'running',
    startedAt: now,
    nextScheduledAt: null
  });

  let upsertedItemRows = 0;
  let upsertedMetricRows = 0;

  try {
    const account = await repos.accounts.upsertAccount({
      platformId: payload.platform,
      externalAccountId: payload.data.accountId,
      displayName: payload.data.displayName,
      now
    });

    for (const itemPayload of payload.data.items) {
      const item = await repos.items.upsertItem({
        accountId: account.id,
        externalItemId: itemPayload.id,
        title: itemPayload.title,
        now
      });
      upsertedItemRows += 1;

      for (const metricRow of itemPayload.metrics) {
        const canonicalRow = toCanonicalMetricRow(metricRow, payload.capturedAt);
        await repos.itemSnapshotRaw.insertSnapshot({
          ingestionRunId: runId,
          accountId: account.id,
          itemId: item.id,
          date: canonicalRow.date,
          dedupeHash: hashSnapshot({
            platform: payload.platform,
            accountId: account.id,
            itemId: item.id,
            date: canonicalRow.date,
            capturedAt: payload.capturedAt,
            metrics: canonicalRow
          }),
          payload: {
            source: 'bridge_ingest',
            platform: payload.platform,
            accountHandle: payload.accountHandle,
            accountId: payload.data.accountId,
            itemId: itemPayload.id,
            itemTitle: itemPayload.title,
            metrics: canonicalRow,
            capturedAt: payload.capturedAt
          },
          capturedAt: payload.capturedAt
        });

        await repos.itemMetricsDaily.upsertDailyMetric({
          itemId: item.id,
          date: canonicalRow.date,
          views: canonicalRow.views,
          downloads: canonicalRow.downloads,
          sales: canonicalRow.sales,
          revenue: canonicalRow.revenue,
          capturedAt: payload.capturedAt
        });
        upsertedMetricRows += 1;
      }
    }

    await repos.ingestionRuns.completeRun(runId, {
      status: 'success',
      endedAt: new Date().toISOString(),
      fetchedPlatforms: 1,
      upsertedItemRows,
      upsertedMetricRows,
      errorCount: 0,
      rateLimitedCount: 0,
      platformQualityMetrics: [{ platformId: payload.platform, connectorStatus: 'ok', source: 'bridge_ingest' }],
      qualitySummary: { averageQualityScore: 100, stalePlatforms: 0, failedPlatforms: 0, healthyPlatforms: 1 },
      rateLimitEvents: [],
      nextScheduledAt: null
    });

    return {
      runId,
      platform: payload.platform,
      accountHandle: payload.accountHandle,
      upsertedItemRows,
      upsertedMetricRows,
      capturedAt: payload.capturedAt
    };
  } catch (error) {
    await repos.ingestionRuns.completeRun(runId, {
      status: 'failed',
      endedAt: new Date().toISOString(),
      fetchedPlatforms: 0,
      upsertedItemRows,
      upsertedMetricRows,
      errorMessage: error.message,
      errorCount: 1,
      rateLimitedCount: 0,
      platformQualityMetrics: [{ platformId: payload.platform, connectorStatus: 'error', source: 'bridge_ingest' }],
      qualitySummary: { averageQualityScore: 0, stalePlatforms: 0, failedPlatforms: 1, healthyPlatforms: 0 },
      rateLimitEvents: [],
      nextScheduledAt: null
    });
    throw error;
  }
}

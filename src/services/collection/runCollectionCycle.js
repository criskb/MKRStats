import { fetchAllPlatformStats } from '../connectors/platformConnectorService.js';
import { getStorageRepositories } from '../storage/index.js';
import { isoDay } from '../../utils/date.js';
import { createHash, randomUUID } from 'crypto';

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

function hashSnapshot(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export async function runCollectionCycle({ runType = 'scheduled_fetch', daysBack = null } = {}) {
  const repos = getStorageRepositories();
  const startedAt = new Date().toISOString();
  const correlationId = randomUUID();
  const runId = await repos.ingestionRuns.createRun({ runType, status: 'running', startedAt });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', event: 'collection.cycle.started', ts: startedAt, correlationId, runId, runType }));

  try {
    const platformData = await fetchAllPlatformStats({ correlationId, runId });
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
      const fallbackDates = [isoDay(new Date())];
      const metricDates = (limitedSeries.length ? limitedSeries : [{ date: fallbackDates[0], views: 0, downloads: 0, sales: 0, revenue: 0 }]);
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
          const date = metric.date;
          const daily = {
            itemId: item.id,
            date,
            views: Number(metric.views ?? 0),
            downloads: Number(model.downloads ?? 0),
            sales: Number(model.sales ?? 0),
            revenue: Number(Number(model.revenue ?? 0).toFixed(2)),
            capturedAt: fetchedAt
          };
          await repos.itemMetricsDaily.upsertDailyMetric(daily);
          const payload = {
            platformId: platform.id,
            accountId: account.id,
            itemId: item.id,
            date,
            model,
            aggregate: metric,
            fetchedAt
          };
          await repos.itemSnapshotRaw.insertSnapshot({
            ingestionRunId: runId,
            accountId: account.id,
            itemId: item.id,
            date,
            dedupeHash: hashSnapshot(payload),
            payload,
            capturedAt: fetchedAt
          });
          upsertedMetricRows += 1;
        }
      }
    }

    await repos.ingestionRuns.completeRun(runId, {
      status: 'success',
      completedAt: new Date().toISOString(),
      fetchedPlatforms: platformData.length,
      upsertedItemRows,
      upsertedMetricRows,
      platformQualityMetrics: qualityMetrics.perPlatform,
      qualitySummary: qualityMetrics.summary
    });

    return { runId, correlationId, fetchedPlatforms: platformData.length, upsertedItemRows, upsertedMetricRows, qualitySummary: qualityMetrics.summary };
  } catch (error) {
    await repos.ingestionRuns.completeRun(runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      fetchedPlatforms: 0,
      upsertedItemRows: 0,
      upsertedMetricRows: 0,
      errorMessage: error.message,
      platformQualityMetrics: [],
      qualitySummary: { averageQualityScore: 0, stalePlatforms: 0, failedPlatforms: 0, healthyPlatforms: 0 }
    });
    throw error;
  }
}

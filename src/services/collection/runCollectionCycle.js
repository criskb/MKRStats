import { fetchAllPlatformStats } from '../connectors/platformConnectorService.js';
import { getStorage } from '../storage/index.js';
import { isoDay } from '../../utils/date.js';

function buildPlatformRows(platform, { seriesRows = null } = {}) {
  const rows = seriesRows ?? platform.snapshot.series;
  return rows.map((row) => ({
    platformId: platform.id,
    date: row.date,
    views: Number(row.views ?? 0),
    downloads: Number(row.downloads ?? 0),
    sales: Number(row.sales ?? 0),
    revenue: Number(Number(row.revenue ?? 0).toFixed(2)),
    collectedAt: platform.snapshot.fetchedAt ?? new Date().toISOString()
  }));
}

function buildModelRows(platform, dates) {
  const models = platform.snapshot.models ?? [];
  return dates.flatMap((date) => models.map((model) => ({
    platformId: platform.id,
    modelId: String(model.id ?? model.title),
    modelTitle: String(model.title ?? model.id),
    date,
    downloads: Number(model.downloads ?? 0),
    sales: Number(model.sales ?? 0),
    revenue: Number(Number(model.revenue ?? 0).toFixed(2)),
    collectedAt: platform.snapshot.fetchedAt ?? new Date().toISOString()
  })));
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

export async function runCollectionCycle({ runType = 'scheduled_fetch', daysBack = null } = {}) {
  const storage = getStorage();
  const startedAt = new Date().toISOString();
  const runId = await storage.createCollectionRun({ runType, status: 'running', startedAt });

  try {
    const platformData = await fetchAllPlatformStats();
    const qualityMetrics = buildRunQualityMetrics(platformData);
    let upsertedPlatformRows = 0;
    let upsertedModelRows = 0;

    for (const platform of platformData) {
      const series = Array.isArray(platform.snapshot?.series) ? platform.snapshot.series : [];
      const limitedSeries = daysBack == null ? series : series.slice(-Math.max(1, daysBack));

      const platformRows = buildPlatformRows(platform, { seriesRows: limitedSeries });
      const targetDates = limitedSeries.length ? limitedSeries.map((row) => row.date) : [isoDay(new Date())];
      const modelRows = buildModelRows(platform, targetDates);

      await storage.upsertPlatformDailyMetrics(platformRows);
      await storage.upsertModelDailyMetrics(modelRows);
      upsertedPlatformRows += platformRows.length;
      upsertedModelRows += modelRows.length;
    }

    await storage.completeCollectionRun(runId, {
      status: 'success',
      completedAt: new Date().toISOString(),
      fetchedPlatforms: platformData.length,
      upsertedPlatformRows,
      upsertedModelRows,
      platformQualityMetrics: qualityMetrics.perPlatform,
      qualitySummary: qualityMetrics.summary
    });

    return {
      runId,
      fetchedPlatforms: platformData.length,
      upsertedPlatformRows,
      upsertedModelRows,
      qualitySummary: qualityMetrics.summary
    };
  } catch (error) {
    await storage.completeCollectionRun(runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      fetchedPlatforms: 0,
      upsertedPlatformRows: 0,
      upsertedModelRows: 0,
      errorMessage: error.message,
      platformQualityMetrics: [],
      qualitySummary: { averageQualityScore: 0, stalePlatforms: 0, failedPlatforms: 0, healthyPlatforms: 0 }
    });
    throw error;
  }
}

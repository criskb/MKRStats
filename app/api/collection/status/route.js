import { NextResponse } from 'next/server';
import { initializeStorage, readLatestBridgeIngestCapturedAt, readRecentCollectionRuns } from '../../../../src/services/storage/index.js';

function formatRunSummary(run = {}) {
  return {
    runId: run.runId ?? run.run_id ?? null,
    startedAt: run.startedAt ?? run.started_at ?? null,
    completedAt: run.completedAt ?? run.completed_at ?? null,
    status: run.status ?? 'unknown',
    platformCount: Number(run.platformCount ?? run.platform_count ?? 0),
    modelCount: Number(run.modelCount ?? run.model_count ?? 0),
    errorCount: Number(run.errorCount ?? run.error_count ?? 0),
    platformQualityMetrics: run.platformQualityMetrics ?? run.platform_quality_metrics ?? []
  };
}

export async function GET(req) {
  try {
    await initializeStorage();
    const { searchParams } = new URL(req.url);
    const requestedLimit = Number(searchParams.get('limit') ?? 20);
    const runs = await readRecentCollectionRuns(requestedLimit);
    const latestBridgeIngestAt = await readLatestBridgeIngestCapturedAt();
    const latestRun = runs[0] ? formatRunSummary(runs[0]) : null;
    const freshnessMinutes = latestBridgeIngestAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(latestBridgeIngestAt)) / 60000))
      : null;

    return NextResponse.json({
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
    return NextResponse.json({ message: 'Failed to load collection run status', details: error.message }, { status: 500 });
  }
}

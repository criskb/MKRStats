import { PLATFORM_CONFIG } from '../../../src/config/platforms.js';
import { aggregatePortfolioData } from '../../../src/services/analytics/aggregateService.js';
import { buildCollectionSummary } from '../../../src/services/analytics/collectionSummaryService.js';
import { buildGlobalBenchmarks } from '../../../src/services/benchmarks/globalBenchmarkService.js';
import { fetchAllPlatformStats } from '../../../src/services/connectors/platformConnectorService.js';
import { forecastNextDays } from '../../../src/services/predictions/forecastService.js';

export function normalizeScope(searchParams) {
  const requestedHorizon = Number(searchParams.get('horizon') ?? 30);
  const horizon = Number.isFinite(requestedHorizon) ? Math.max(7, Math.min(3650, Math.floor(requestedHorizon))) : 30;
  const selectedPlatform = searchParams.get('platform') ?? 'all';
  const connected = String(searchParams.get('connected') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return { horizon, selectedPlatform, connected };
}

function selectPlatforms(rawPlatformData, selectedPlatform, connected = []) {
  const scoped = selectedPlatform === 'all'
    ? rawPlatformData
    : rawPlatformData.filter((platform) => platform.id === selectedPlatform);

  if (!connected.length) return scoped;

  const connectedSet = new Set(connected);
  return scoped.filter((platform) => connectedSet.has(platform.id));
}

export async function getOverviewPayload(searchParams) {
  const { horizon, selectedPlatform, connected } = normalizeScope(searchParams);
  const rawPlatformData = await fetchAllPlatformStats();
  const platformData = selectPlatforms(rawPlatformData, selectedPlatform, connected);

  if (platformData.length === 0) {
    const detail = connected.length
      ? `No data found for configured connections: ${connected.join(', ')}`
      : `Platform '${selectedPlatform}' not found`;
    return { status: 404, payload: { message: detail } };
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

export function platformsPayload() {
  return {
    platforms: PLATFORM_CONFIG,
    benchmarks: buildGlobalBenchmarks(PLATFORM_CONFIG)
  };
}

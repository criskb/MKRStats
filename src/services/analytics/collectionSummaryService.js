export function buildCollectionSummary(platformData, connected = []) {
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

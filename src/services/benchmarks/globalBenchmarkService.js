function seededRandom(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function round2(value) {
  return Number(value.toFixed(2));
}

export function buildGlobalBenchmarks(platforms) {
  return platforms.map((platform, index) => {
    const seed = platform.id.length * (index + 11);

    const avgViews30d = Math.floor(25000 + seededRandom(seed + 1) * 120000);
    const avgDownloads30d = Math.floor(avgViews30d * (0.08 + seededRandom(seed + 2) * 0.09));
    const avgSales30d = Math.floor(avgDownloads30d * (0.06 + seededRandom(seed + 3) * 0.13));
    const avgRevenue30d = round2(avgSales30d * (2.5 + seededRandom(seed + 4) * 5.5));

    return {
      platformId: platform.id,
      platformName: platform.name,
      benchmark: {
        avgViews30d,
        avgDownloads30d,
        avgSales30d,
        avgRevenue30d,
        avgConversionRate: round2((avgSales30d / Math.max(avgDownloads30d, 1)) * 100)
      }
    };
  });
}

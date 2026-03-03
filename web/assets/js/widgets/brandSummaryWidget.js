export function mountBrandSummaryWidget(container, data) {
  const top = data.aggregated.insights.topPerformer?.title ?? 'N/A';
  const collection = data.collection ?? {};
  const quality = collection.quality ?? {};

  container.innerHTML = `
    <div class="brand-summary">
      <p><strong>Scope:</strong> ${data.selectedPlatform === 'all' ? 'All Platforms' : data.selectedPlatform}</p>
      <p><strong>Sample Window:</strong> ${data.sampleWindowDays} days</p>
      <p><strong>Top Model:</strong> ${top}</p>
      <p><strong>Revenue Forecast Confidence:</strong> ${data.forecast.revenue.confidenceScore}%</p>
      <p><strong>Current Conversion:</strong> ${data.aggregated.insights.conversionRate}%</p>
      <p><strong>Collection Coverage:</strong> ${collection.platformCoveragePct ?? 0}%</p>
      <p><strong>Estimated Data Points:</strong> ${(collection.estimatedDataPoints ?? 0).toLocaleString()}</p>
      <p><strong>Snapshot Age:</strong> ${collection.maxSnapshotAgeMinutes ?? 0} minute(s)</p>
      <p><strong>Quality Score:</strong> ${quality.averageQualityScore ?? 0}%</p>
      <p><strong>Stale Platforms:</strong> ${quality.stalePlatforms ?? 0}</p>
      <p><strong>Failed Platforms:</strong> ${quality.failedPlatforms ?? 0}</p>
    </div>
  `;
}

export function mountBrandSummaryWidget(container, data) {
  const top = data.aggregated.insights.topPerformer?.title ?? 'N/A';
  container.innerHTML = `
    <div class="brand-summary">
      <p><strong>Scope:</strong> ${data.selectedPlatform === 'all' ? 'All Platforms' : data.selectedPlatform}</p>
      <p><strong>Sample Window:</strong> ${data.sampleWindowDays} days</p>
      <p><strong>Top Model:</strong> ${top}</p>
      <p><strong>Revenue Forecast Confidence:</strong> ${data.forecast.revenue.confidenceScore}%</p>
      <p><strong>Current Conversion:</strong> ${data.aggregated.insights.conversionRate}%</p>
    </div>
  `;
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export function mountInsightsWidget(container, insights, revenueForecast, meta = {}) {
  const top = insights.topPerformer?.title ?? 'N/A';
  const generated = meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : 'N/A';

  container.innerHTML = `
    <ul class="insight-list">
      <li><strong>Portfolio conversion:</strong> ${insights.conversionRate}%</li>
      <li><strong>7-day revenue trend:</strong> ${insights.revenueTrendPct}%</li>
      <li><strong>7-day downloads trend:</strong> ${insights.downloadTrendPct}%</li>
      <li><strong>7-day sales trend:</strong> ${insights.salesTrendPct}%</li>
      <li><strong>Forecast baseline (${revenueForecast.days}d):</strong> ${usd.format(revenueForecast.scenarios.baseline)}</li>
      <li><strong>Model confidence:</strong> ${revenueForecast.confidenceScore}%</li>
      <li><strong>Top earning model:</strong> ${top}</li>
      <li><strong>Data refreshed:</strong> ${generated}</li>
    </ul>
  `;
}

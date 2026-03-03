import { renderTable } from '../components/table.js';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export function mountPlatformGridWidget(container, platforms, platformSummaries) {
  const summaryMap = new Map(platformSummaries.map((row) => [row.platformId, row]));

  renderTable(
    container,
    ['Platform', 'Mode', 'Revenue', 'Downloads', 'Conv %'],
    platforms.map((platform) => {
      const summary = summaryMap.get(platform.id);
      return [
        platform.name,
        `<span class="pill">${platform.integrationMode}</span>`,
        summary ? usd.format(summary.revenue) : '-',
        summary ? summary.downloads.toLocaleString() : '-',
        summary ? `${summary.conversionRate}%` : '-'
      ];
    })
  );
}

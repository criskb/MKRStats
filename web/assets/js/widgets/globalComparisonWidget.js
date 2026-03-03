import { renderTable } from '../components/table.js';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

function ratioPct(own, benchmark) {
  if (!benchmark || benchmark <= 0) return '—';
  return `${Math.round((own / benchmark) * 100)}%`;
}

export function mountGlobalComparisonWidget(container, platforms, benchmarks, platformSummaries) {
  const benchmarkMap = new Map(benchmarks.map((row) => [row.platformId, row.benchmark]));
  const ownMap = new Map(platformSummaries.map((row) => [row.platformId, row]));

  renderTable(
    container,
    ['Platform', 'Our Revenue', 'Global Avg Revenue', 'Our vs Avg', 'Our Conv %', 'Global Conv %'],
    platforms.map((platform) => {
      const own = ownMap.get(platform.id);
      const benchmark = benchmarkMap.get(platform.id);

      return [
        platform.name,
        own ? usd.format(own.revenue) : '-',
        benchmark ? usd.format(benchmark.avgRevenue30d) : '-',
        own && benchmark ? ratioPct(own.revenue, benchmark.avgRevenue30d) : '-',
        own ? `${own.conversionRate}%` : '-',
        benchmark ? `${benchmark.avgConversionRate}%` : '-'
      ];
    })
  );
}

import { renderKpiCards } from '../components/kpiCard.js';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const integer = new Intl.NumberFormat('en-US');

export function mountOverviewWidget(container, totals) {
  renderKpiCards(container, [
    { label: 'Total Views (30d)', value: integer.format(totals.views) },
    { label: 'Total Downloads (30d)', value: integer.format(totals.downloads) },
    { label: 'Total Sales (30d)', value: integer.format(totals.sales) },
    { label: 'Total Revenue (30d)', value: usd.format(totals.revenue) }
  ]);
}

import { renderTable } from '../components/table.js';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export function mountTopModelsWidget(container, models) {
  renderTable(
    container,
    ['Model', 'Downloads', 'Sales', 'Revenue', 'Conversion'],
    models.map((model) => [
      model.title,
      model.downloads.toLocaleString(),
      model.sales.toLocaleString(),
      usd.format(model.revenue),
      `<span class="pill">${model.conversionRate}%</span>`
    ])
  );
}

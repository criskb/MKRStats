import { renderTable } from '../components/table.js';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const SORTS = {
  revenue: (a, b) => b.revenue - a.revenue,
  downloads: (a, b) => b.downloads - a.downloads,
  conversion: (a, b) => b.conversionRate - a.conversionRate
};

function render(container, models, sortBy) {
  container.innerHTML = '';

  if (!models.length) {
    container.innerHTML = '<p>No model data available for this scope yet.</p>';
    return;
  }

  const controls = document.createElement('div');
  controls.className = 'inline-controls';
  controls.innerHTML = `
    <label>
      Sort by
      <select>
        <option value="revenue">Revenue</option>
        <option value="downloads">Downloads</option>
        <option value="conversion">Conversion</option>
      </select>
    </label>
  `;

  const select = controls.querySelector('select');
  select.value = sortBy;

  const sorted = [...models].sort(SORTS[sortBy]);

  container.append(controls);
  renderTable(
    container,
    ['Model', 'Downloads', 'Sales', 'Revenue', 'Conversion'],
    sorted.map((model) => [
      model.title,
      model.downloads.toLocaleString(),
      model.sales.toLocaleString(),
      usd.format(model.revenue),
      `<span class="pill">${model.conversionRate}%</span>`
    ])
  );

  select.addEventListener('change', () => {
    render(container, models, select.value);
  });
}

export function mountTopModelsWidget(container, models = []) {
  render(container, models, 'revenue');
}

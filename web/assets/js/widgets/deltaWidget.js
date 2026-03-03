function normalize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

function formatDelta(value) {
  const normalized = normalize(value);
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized}%`;
}

function deltaClass(value) {
  const normalized = normalize(value);
  if (normalized > 0) return 'is-up';
  if (normalized < 0) return 'is-down';
  return 'is-flat';
}

export function mountDeltaWidget(container, deltas = {}) {
  const revenue = deltas.revenue7d?.changePct;
  const downloads = deltas.downloads7d?.changePct;
  const sales = deltas.sales7d?.changePct;

  container.innerHTML = `
    <div class="delta-grid">
      <article class="delta-card ${deltaClass(revenue)}">
        <h4>Revenue (7d)</h4>
        <p>${formatDelta(revenue)}</p>
      </article>
      <article class="delta-card ${deltaClass(downloads)}">
        <h4>Downloads (7d)</h4>
        <p>${formatDelta(downloads)}</p>
      </article>
      <article class="delta-card ${deltaClass(sales)}">
        <h4>Sales (7d)</h4>
        <p>${formatDelta(sales)}</p>
      </article>
    </div>
  `;
}

function formatDelta(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

function deltaClass(value) {
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

export function mountDeltaWidget(container, deltas) {
  container.innerHTML = `
    <div class="delta-grid">
      <article class="delta-card ${deltaClass(deltas.revenue7d.changePct)}">
        <h4>Revenue (7d)</h4>
        <p>${formatDelta(deltas.revenue7d.changePct)}</p>
      </article>
      <article class="delta-card ${deltaClass(deltas.downloads7d.changePct)}">
        <h4>Downloads (7d)</h4>
        <p>${formatDelta(deltas.downloads7d.changePct)}</p>
      </article>
      <article class="delta-card ${deltaClass(deltas.sales7d.changePct)}">
        <h4>Sales (7d)</h4>
        <p>${formatDelta(deltas.sales7d.changePct)}</p>
      </article>
    </div>
  `;
}

function formatDelta(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

export function mountDeltaWidget(container, deltas) {
  container.innerHTML = `
    <div class="delta-grid">
      <article class="delta-card">
        <h4>Revenue (7d)</h4>
        <p>${formatDelta(deltas.revenue7d.changePct)}</p>
      </article>
      <article class="delta-card">
        <h4>Downloads (7d)</h4>
        <p>${formatDelta(deltas.downloads7d.changePct)}</p>
      </article>
      <article class="delta-card">
        <h4>Sales (7d)</h4>
        <p>${formatDelta(deltas.sales7d.changePct)}</p>
      </article>
    </div>
  `;
}

export function renderKpiCards(container, metrics) {
  const wrap = document.createElement('div');
  wrap.className = 'kpi-grid';

  for (const metric of metrics) {
    const card = document.createElement('article');
    card.className = 'kpi-card';
    card.innerHTML = `
      <div class="kpi-card__label">${metric.label}</div>
      <div class="kpi-card__value">${metric.value}</div>
    `;
    wrap.append(card);
  }

  container.append(wrap);
}

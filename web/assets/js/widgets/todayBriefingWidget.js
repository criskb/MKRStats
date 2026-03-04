function formatDelta(delta = 0) {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

export function mountTodayBriefingWidget(container, data) {
  const topMover = data.aggregated.topModels?.[0];
  const kpiDeltas = data.aggregated.kpiDeltas ?? {};
  const downloadsDelta = Number(kpiDeltas.downloads7d?.changePct ?? 0);
  const forecast = data.forecast.revenue?.scenarios?.base ?? [];
  const min = Math.round((forecast.at(-1)?.predicted ?? 0) * 0.85);
  const max = Math.round((forecast.at(-1)?.predicted ?? 0) * 1.15);

  container.innerHTML = `
    <div class="briefing">
      <p class="briefing__headline">Today’s Briefing</p>
      <p>Downloads are <strong>${formatDelta(downloadsDelta)}</strong> vs prior window.</p>
      <p>Top mover: <strong>${topMover?.title ?? 'No model data'}</strong> (${Math.round(topMover?.downloads ?? 0)} downloads).</p>
      <p>Forecast next 7d: <strong>${min.toLocaleString()}–${max.toLocaleString()}</strong> projected revenue.</p>
      <button class="button-secondary" type="button">Show me why</button>
    </div>
  `;
}

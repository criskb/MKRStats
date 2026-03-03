function calculateAnomalies(timeline = []) {
  const downloads = timeline.map((row) => Number(row.downloads ?? 0));
  if (downloads.length < 5) return [];

  const mean = downloads.reduce((sum, value) => sum + value, 0) / downloads.length;
  const variance = downloads.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / downloads.length;
  const sigma = Math.sqrt(variance);

  return timeline
    .filter((row) => Math.abs(Number(row.downloads ?? 0) - mean) > (2 * sigma))
    .slice(-3)
    .map((row) => ({
      date: row.date,
      downloads: row.downloads,
      sigma: sigma ? ((Number(row.downloads ?? 0) - mean) / sigma).toFixed(1) : '0.0'
    }));
}

export function mountAnomalyRadarWidget(container, timeline = []) {
  const anomalies = calculateAnomalies(timeline);

  container.innerHTML = `
    <ul class="insight-list">
      ${anomalies.length
    ? anomalies.map((item) => `<li>${item.date}: ${item.downloads} downloads (${item.sigma}σ)</li>`).join('')
    : '<li>No significant spikes or drops detected in current window.</li>'}
    </ul>
  `;
}

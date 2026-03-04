export function mountPlatformShareWidget(container, platformSummaries = []) {
  const total = platformSummaries.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);

  container.innerHTML = `
    <div class="segment-bar">
      ${platformSummaries
    .map((row) => {
      const pct = total ? Math.max(2, Math.round((Number(row.revenue ?? 0) / total) * 100)) : 0;
      return `<button class="segment-bar__item" style="width:${pct}%" title="${row.platformName}: ${pct}%">${row.platformName}</button>`;
    })
    .join('')}
    </div>
    <p class="scenario-note">Click a segment to filter by platform (interaction shell ready).</p>
  `;
}

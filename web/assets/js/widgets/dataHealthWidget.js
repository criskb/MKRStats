export function mountDataHealthWidget(container, collection = {}, statusPayload = {}) {
  const freshness = statusPayload?.bridgeIngest?.freshnessMinutes;
  const failedJobs = (statusPayload?.runs ?? []).filter((run) => run.status !== 'completed').length;

  container.innerHTML = `
    <div class="kpi-grid">
      <article class="kpi-card">
        <p class="kpi-card__label">Freshness</p>
        <p class="kpi-card__value">${freshness == null ? 'Unknown' : `${freshness}m ago`}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">Rate-limit hits (429)</p>
        <p class="kpi-card__value">${collection.rateLimitHits ?? 0}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">Failed jobs</p>
        <p class="kpi-card__value">${failedJobs}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">Coverage</p>
        <p class="kpi-card__value">${collection.platformCoveragePct ?? 0}%</p>
      </article>
    </div>
  `;
}

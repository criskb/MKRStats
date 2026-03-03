const STALE_HOURS_THRESHOLD = 24;
const COVERAGE_THRESHOLD = 80;

function formatRelativeHours(isoDate) {
  if (!isoDate) return 'never';
  const diffMs = Date.now() - Date.parse(isoDate);
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'unknown';
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  return `${hours}h ago`;
}

export function evaluateCollectionAlerts(collection) {
  const staleHours = Math.round((Number(collection?.maxSnapshotAgeMinutes ?? 0) / 60) * 10) / 10;
  const coveragePct = Number(collection?.platformCoveragePct ?? 0);

  return {
    staleHours,
    coveragePct,
    staleBreached: staleHours > STALE_HOURS_THRESHOLD,
    coverageBreached: coveragePct < COVERAGE_THRESHOLD
  };
}

export function renderCollectionAlertBanner(root, collection) {
  const { staleHours, coveragePct, staleBreached, coverageBreached } = evaluateCollectionAlerts(collection);
  const failedIntegrations = Number(collection?.quality?.failedPlatforms ?? 0);

  if (!staleBreached && !coverageBreached && failedIntegrations === 0) {
    return;
  }

  const messages = [];
  if (staleBreached) messages.push(`Data freshness is stale (${staleHours}h > ${STALE_HOURS_THRESHOLD}h).`);
  if (coverageBreached) messages.push(`Platform coverage is low (${coveragePct}% < ${COVERAGE_THRESHOLD}%).`);
  if (failedIntegrations > 0) messages.push(`${failedIntegrations} integration(s) currently failing.`);

  root.insertAdjacentHTML(
    'afterbegin',
    `<section class="status-banner" role="status"><strong>Collection alert:</strong> ${messages.join(' ')}</section>`
  );
}

export function mountCollectionDiagnosticsWidget(container, collection, statusPayload) {
  const platformStatus = collection?.platformStatus ?? [];
  const failedPlatforms = platformStatus.filter((row) => row.status !== 'ok');
  const recentRuns = statusPayload?.runs ?? [];

  const rowsHtml = platformStatus
    .map((row) => `
      <tr>
        <td>${row.platformId}</td>
        <td>${row.status}</td>
        <td>${formatRelativeHours(row.lastSuccessAt)}</td>
        <td>${formatRelativeHours(row.lastAttemptAt)}</td>
        <td>${row.errorCode ?? '-'}</td>
      </tr>
    `)
    .join('');

  const recentRunsHtml = recentRuns
    .slice(0, 5)
    .map((run) => `<li>#${run.id} ${run.runType} · ${run.status} · ${new Date(run.startedAt).toLocaleString()}</li>`)
    .join('');

  container.innerHTML = `
    <p><strong>Failed integrations:</strong> ${failedPlatforms.length}</p>
    <p><strong>Coverage:</strong> ${collection.platformCoveragePct}% · <strong>Max age:</strong> ${collection.maxSnapshotAgeMinutes}m</p>
    <table class="table">
      <thead>
        <tr><th>Platform</th><th>Status</th><th>Last Success</th><th>Last Attempt</th><th>Error</th></tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="5">No platform health data available.</td></tr>'}</tbody>
    </table>
    <h4>Recent Collection Runs</h4>
    <ul>${recentRunsHtml || '<li>No recent collection runs found.</li>'}</ul>
  `;
}

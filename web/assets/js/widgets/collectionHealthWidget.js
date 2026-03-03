const STALE_HOURS_THRESHOLD = 24;
const COVERAGE_THRESHOLD = 80;

const STATUS_LABELS = {
  ok: 'OK',
  rate_limited: 'Rate limited',
  auth_required: 'Auth required',
  stale: 'Stale'
};

function formatRelativeTime(isoDate) {
  if (!isoDate) return 'Never';

  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return 'Unknown';

  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return 'Just now';

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function normalizeStatus(status) {
  if (STATUS_LABELS[status]) return status;
  return 'stale';
}

function buildPlatformHealthRows(collection = {}, statusPayload = {}) {
  const collectionRows = collection.platformStatus ?? [];
  const latestMetrics = statusPayload?.latestRun?.platformQualityMetrics ?? [];
  const latestByPlatform = new Map(
    latestMetrics
      .filter((metric) => metric?.platformId)
      .map((metric) => [metric.platformId, metric])
  );

  return collectionRows.map((row) => {
    const metric = latestByPlatform.get(row.platformId);
    return {
      platformId: row.platformId,
      status: normalizeStatus(row.status ?? metric?.connectorStatus ?? 'stale'),
      lastSuccessAt: row.lastSuccessAt ?? null,
      errorSummary: row.errorMessage ?? metric?.checks?.connectorError?.message ?? row.errorCode ?? metric?.checks?.connectorError?.code ?? '-'
    };
  });
}

function renderStatusPill(status) {
  return `<span class="health-pill health-pill--${status}">${STATUS_LABELS[status] ?? status}</span>`;
}

export function evaluateCollectionHealth(collection) {
  const staleHours = Math.round((Number(collection?.maxSnapshotAgeMinutes ?? 0) / 60) * 10) / 10;
  const coveragePct = Number(collection?.platformCoveragePct ?? 0);

  return {
    staleHours,
    coveragePct,
    staleBreached: staleHours > STALE_HOURS_THRESHOLD,
    coverageBreached: coveragePct < COVERAGE_THRESHOLD
  };
}

export function renderCollectionHealthBanner(root, collection) {
  const { staleHours, coveragePct, staleBreached, coverageBreached } = evaluateCollectionHealth(collection);

  if (!staleBreached && !coverageBreached) {
    return;
  }

  const messages = [];
  if (coverageBreached) messages.push(`coverage ${coveragePct}% is below ${COVERAGE_THRESHOLD}%`);
  if (staleBreached) messages.push(`freshness ${staleHours}h exceeds ${STALE_HOURS_THRESHOLD}h`);

  root.insertAdjacentHTML(
    'afterbegin',
    `<section class="status-banner" role="status"><strong>Collection warning:</strong> ${messages.join(' and ')}. <a href="#collection-health-details">Review health details</a>.</section>`
  );
}

export function mountCollectionHealthWidget(container, collection, statusPayload) {
  const platformRows = buildPlatformHealthRows(collection, statusPayload);

  const rowsHtml = platformRows
    .map((row) => `
      <tr>
        <td>${row.platformId}</td>
        <td>${renderStatusPill(row.status)}</td>
        <td>${formatRelativeTime(row.lastSuccessAt)}</td>
        <td>${row.errorSummary}</td>
      </tr>
    `)
    .join('');

  container.innerHTML = `
    <p>
      <strong>Coverage:</strong> ${collection.platformCoveragePct ?? 0}% ·
      <strong>Estimated Data Points:</strong> ${(collection.estimatedDataPoints ?? 0).toLocaleString()} ·
      <strong>Snapshot Age:</strong> ${collection.maxSnapshotAgeMinutes ?? 0}m
    </p>
    <table class="table">
      <thead>
        <tr><th>Platform</th><th>Status</th><th>Last Success</th><th>Error Summary</th></tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="4">No platform health data available.</td></tr>'}</tbody>
    </table>
  `;
}

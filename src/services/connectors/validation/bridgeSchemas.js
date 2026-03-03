const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertPlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
}

function assertNoUnexpectedKeys(value, allowedKeys, fieldName) {
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${fieldName} contains unsupported field(s): ${unexpected.join(', ')}.`);
  }
}

function toNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function parseIsoTimestamp(value, fieldName) {
  const normalized = toNonEmptyString(value, fieldName);
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp.`);
  }
  return new Date(timestamp).toISOString();
}

function toSafeMetric(value, fieldName, { decimals = 0 } = {}) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  if (decimals > 0) return Number(parsed.toFixed(decimals));
  return Math.floor(parsed);
}

function normalizeMetricRow(row, fallbackDate, itemLabel) {
  assertPlainObject(row, `${itemLabel}.metrics[]`);
  assertNoUnexpectedKeys(row, new Set(['date', 'views', 'downloads', 'sales', 'revenue', 'likes']), `${itemLabel}.metrics[]`);

  const date = row.date == null ? fallbackDate : String(row.date).slice(0, 10);
  if (!ISO_DATE_RE.test(date)) {
    throw new Error(`${itemLabel}.metrics[].date must be YYYY-MM-DD.`);
  }

  return {
    date,
    views: toSafeMetric(row.views ?? 0, `${itemLabel}.metrics[].views`),
    downloads: toSafeMetric(row.downloads ?? 0, `${itemLabel}.metrics[].downloads`),
    sales: toSafeMetric(row.sales ?? 0, `${itemLabel}.metrics[].sales`),
    revenue: toSafeMetric(row.revenue ?? 0, `${itemLabel}.metrics[].revenue`, { decimals: 2 }),
    likes: toSafeMetric(row.likes ?? 0, `${itemLabel}.metrics[].likes`)
  };
}

function normalizeItem(item, fallbackDate, index) {
  const label = `data.items[${index}]`;
  assertPlainObject(item, label);
  assertNoUnexpectedKeys(item, new Set(['id', 'title', 'metrics']), label);

  const id = toNonEmptyString(item.id, `${label}.id`);
  const title = toNonEmptyString(item.title ?? item.id, `${label}.title`);

  if (!Array.isArray(item.metrics) || item.metrics.length === 0) {
    throw new Error(`${label}.metrics must be a non-empty array.`);
  }

  const metrics = item.metrics.map((metricRow) => normalizeMetricRow(metricRow, fallbackDate, label));
  return { id, title, metrics };
}

export function validateBridgeIngestPayload(payload = {}) {
  assertPlainObject(payload, 'payload');
  assertNoUnexpectedKeys(payload, new Set(['platform', 'accountHandle', 'capturedAt', 'data']), 'payload');

  const platform = toNonEmptyString(payload.platform, 'platform').toLowerCase();
  const accountHandle = toNonEmptyString(payload.accountHandle, 'accountHandle');
  const capturedAt = parseIsoTimestamp(payload.capturedAt, 'capturedAt');

  assertPlainObject(payload.data, 'data');
  assertNoUnexpectedKeys(payload.data, new Set(['accountId', 'displayName', 'items']), 'data');

  const accountId = payload.data.accountId == null ? accountHandle : toNonEmptyString(payload.data.accountId, 'data.accountId');
  const displayName = payload.data.displayName == null ? accountHandle : toNonEmptyString(payload.data.displayName, 'data.displayName');

  if (!Array.isArray(payload.data.items) || payload.data.items.length === 0) {
    throw new Error('data.items must be a non-empty array.');
  }

  const fallbackDate = capturedAt.slice(0, 10);
  const items = payload.data.items.map((item, index) => normalizeItem(item, fallbackDate, index));

  return {
    platform,
    accountHandle,
    capturedAt,
    data: {
      accountId,
      displayName,
      items
    }
  };
}

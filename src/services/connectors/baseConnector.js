import crypto from 'crypto';
import { lastNDays } from '../../utils/date.js';
import { validateAndNormalizeSnapshot } from './validation/connectorPayloadValidators.js';

const MODELS = [
  'Articulated Dragon v3',
  'Desk Cable Organizer Pro',
  'Wall Planter Set',
  'Modular Dice Tower',
  'Phone Stand Mini'
];

const DEFAULT_TIMEOUT_MS = Number(process.env.MKRSTATS_CONNECTOR_TIMEOUT_MS ?? 12000);
const DEFAULT_RETRY_ATTEMPTS = Number(process.env.MKRSTATS_CONNECTOR_RETRY_ATTEMPTS ?? 2);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.MKRSTATS_CONNECTOR_RETRY_DELAY_MS ?? 400);

function seededRandom(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMockFallbackEnabled() {
  const explicitMockFlag = String(process.env.MKRSTATS_USE_MOCK_DATA ?? '').trim().toLowerCase() === 'true';

  if (process.env.NODE_ENV === 'production' && !explicitMockFlag) {
    return false;
  }

  return explicitMockFlag;
}

export async function withTimeout(taskFactory, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new Error(`Connector request timed out after ${timeoutMs}ms.`);
      error.code = 'CONNECTOR_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([taskFactory(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function requestWithRetry(taskFactory, {
  attempts = DEFAULT_RETRY_ATTEMPTS,
  baseDelayMs = DEFAULT_RETRY_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  shouldRetry = () => true
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(taskFactory, timeoutMs);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && shouldRetry(error, attempt + 1);
      if (!canRetry) {
        throw error;
      }

      const backoffMs = baseDelayMs * (2 ** attempt);
      await wait(backoffMs);
    }
  }

  throw lastError;
}

export async function paginate(fetchPage, {
  startPage = 1,
  maxPages = 50,
  getNextPage = (pagePayload, currentPage) => (pagePayload?.nextPage ?? (currentPage + 1))
} = {}) {
  const rows = [];
  let page = startPage;

  for (let traversed = 0; traversed < maxPages && page != null; traversed += 1) {
    const payload = await fetchPage(page);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    rows.push(...items);

    page = getNextPage(payload, page);
  }

  return rows;
}

export function normalizeSeriesRow(row = {}) {
  return validateAndNormalizeSnapshot('tmp', { series: [row] }).series[0];
}

export function normalizeModelRow(row = {}) {
  const normalized = validateAndNormalizeSnapshot('tmp', { models: [{ ...row, id: row.id ?? row.title ?? crypto.randomUUID?.() ?? `${Date.now()}` }] });
  return normalized.models[0];
}

export function normalizeSnapshot(platformId, snapshot = {}) {
  return validateAndNormalizeSnapshot(platformId, snapshot);
}

export function buildMockPlatformSnapshot(platformId, seedSuffix = "") {
  const days = lastNDays(30);
  const series = days.map((date, index) => {
    const seedOffset = String(seedSuffix).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const seed = index + platformId.length + seedOffset;
    const views = Math.floor(500 + seededRandom(seed) * 1800);
    const downloads = Math.floor(views * (0.1 + seededRandom(seed + 22) * 0.08));
    const sales = Math.floor(downloads * (0.08 + seededRandom(seed + 50) * 0.2));
    const revenue = Number((sales * (3 + seededRandom(seed + 81) * 5)).toFixed(2));

    return { date, views, downloads, sales, revenue };
  });

  const models = MODELS.map((name, index) => {
    const seedOffset = String(seedSuffix).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const seed = platformId.length * (index + 1) + seedOffset;
    const downloads = Math.floor(250 + seededRandom(seed + 100) * 3000);
    const sales = Math.floor(downloads * (0.05 + seededRandom(seed + 200) * 0.25));
    const revenue = Number((sales * (2.5 + seededRandom(seed + 300) * 6)).toFixed(2));

    return {
      id: `${platformId}-${index + 1}`,
      title: name,
      downloads,
      sales,
      revenue,
      conversionRate: Number(((sales / Math.max(downloads, 1)) * 100).toFixed(2))
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return normalizeSnapshot(platformId, {
    fetchedAt: new Date().toISOString(),
    source: 'mock_connector_fallback',
    series,
    models
  });
}

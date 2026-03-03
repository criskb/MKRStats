import path from 'path';
import { fileURLToPath } from 'url';
import { SqliteStorageAdapter } from './adapters/sqliteAdapter.js';
import { PostgresStorageAdapter } from './adapters/postgresAdapter.js';
import { PLATFORM_CONFIG } from '../../config/platforms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let storage;

function getStorageAdapter() {
  if (storage) return storage;

  const engine = String(process.env.MKRSTATS_STORAGE_ENGINE ?? 'sqlite').trim().toLowerCase();
  if (engine === 'postgres') {
    const connectionString = process.env.MKRSTATS_POSTGRES_URL;
    if (!connectionString) {
      throw new Error('MKRSTATS_POSTGRES_URL is required when MKRSTATS_STORAGE_ENGINE=postgres');
    }
    storage = new PostgresStorageAdapter(connectionString);
    return storage;
  }

  const dbPath = process.env.MKRSTATS_SQLITE_PATH
    ? path.resolve(process.env.MKRSTATS_SQLITE_PATH)
    : path.resolve(__dirname, '../../../data/metrics.sqlite');
  storage = new SqliteStorageAdapter(dbPath);
  return storage;
}

export async function initializeStorage() {
  const adapter = getStorageAdapter();
  await adapter.initialize();
  return adapter;
}

export function getStorage() {
  return getStorageAdapter();
}

export async function readPlatformHistory(platformIds = []) {
  const adapter = getStorageAdapter();
  const platforms = PLATFORM_CONFIG.filter((p) => !platformIds.length || platformIds.includes(p.id));
  const [seriesRows, modelRows] = await Promise.all([
    adapter.getPlatformDailyMetrics(platformIds),
    adapter.getModelDailyMetrics(platformIds)
  ]);

  const seriesByPlatform = new Map();
  for (const row of seriesRows) {
    const key = row.platform_id ?? row.platformId;
    const date = String(row.date).slice(0, 10);
    const collectedAt = row.collected_at ?? row.collectedAt;
    const rows = seriesByPlatform.get(key) ?? [];
    rows.push({
      date,
      views: Number(row.views),
      downloads: Number(row.downloads),
      sales: Number(row.sales),
      revenue: Number(row.revenue),
      currency: 'USD',
      collectedAt
    });
    seriesByPlatform.set(key, rows);
  }

  const modelMap = new Map();
  for (const row of modelRows) {
    const key = `${row.platform_id ?? row.platformId}:${row.model_id ?? row.modelId}:${String(row.date).slice(0, 10)}`;
    modelMap.set(key, row);
  }

  const modelsByPlatform = new Map();
  for (const row of modelMap.values()) {
    const platformId = row.platform_id ?? row.platformId;
    const title = row.model_title ?? row.modelTitle;
    const modelId = row.model_id ?? row.modelId;
    const aggregateKey = `${platformId}:${modelId}`;
    const existing = modelsByPlatform.get(aggregateKey) ?? {
      platformId,
      id: modelId,
      title,
      downloads: 0,
      sales: 0,
      revenue: 0
    };
    existing.downloads += Number(row.downloads);
    existing.sales += Number(row.sales);
    existing.revenue = Number((existing.revenue + Number(row.revenue)).toFixed(2));
    modelsByPlatform.set(aggregateKey, existing);
  }

  return platforms.map((platform) => {
    const platformSeries = (seriesByPlatform.get(platform.id) ?? [])
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ collectedAt, ...metricRow }) => metricRow);

    const platformModels = [...modelsByPlatform.values()]
      .filter((model) => model.platformId === platform.id)
      .sort((a, b) => b.revenue - a.revenue)
      .map(({ platformId: _platformId, ...model }) => ({
        ...model,
        conversionRate: Number(((model.sales / Math.max(model.downloads, 1)) * 100).toFixed(2))
      }));

    const fetchedAt = (seriesByPlatform.get(platform.id) ?? []).at(-1)?.collectedAt ?? new Date(0).toISOString();

    return {
      ...platform,
      snapshot: {
        platformId: platform.id,
        fetchedAt,
        source: 'stored_history',
        currency: 'USD',
        series: platformSeries,
        models: platformModels
      }
    };
  });
}

export async function readRecentCollectionRuns(limit = 20) {
  const adapter = getStorageAdapter();
  return adapter.getRecentCollectionRuns(limit);
}

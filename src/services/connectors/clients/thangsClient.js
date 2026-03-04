import { buildMockPlatformSnapshot, normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchThangsSnapshot(connection = {}) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  if (items.length === 0) {
    return buildMockPlatformSnapshot('thangs', connection.accountId ?? connection.credential?.handle ?? 'default');
  }

  return normalizeSnapshot('thangs', {
    source: 'thangs_hybrid',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

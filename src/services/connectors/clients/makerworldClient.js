import { buildMockPlatformSnapshot, normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchMakerworldSnapshot(connection = {}) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  if (items.length === 0) {
    return buildMockPlatformSnapshot('makerworld', connection.accountId ?? connection.credential?.handle ?? 'default');
  }

  return normalizeSnapshot('makerworld', {
    source: 'makerworld_api',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

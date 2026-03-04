import { buildMockPlatformSnapshot, normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchCults3dSnapshot(connection = {}) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  if (items.length === 0) {
    return buildMockPlatformSnapshot('cults3d', connection.accountId ?? connection.credential?.handle ?? 'default');
  }

  return normalizeSnapshot('cults3d', {
    source: 'cults3d_api',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

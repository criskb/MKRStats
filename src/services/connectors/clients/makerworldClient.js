import { normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchMakerworldSnapshot(_connection) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  return normalizeSnapshot('makerworld', {
    source: 'makerworld_api',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

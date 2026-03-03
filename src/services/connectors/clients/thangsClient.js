import { normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchThangsSnapshot(_connection) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  return normalizeSnapshot('thangs', {
    source: 'thangs_hybrid',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

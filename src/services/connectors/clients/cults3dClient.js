import { normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchCults3dSnapshot(_connection) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  return normalizeSnapshot('cults3d', {
    source: 'cults3d_api',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

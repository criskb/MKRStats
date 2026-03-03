import { normalizeSnapshot, paginate, requestWithRetry } from '../baseConnector.js';

export async function fetchPrintablesSnapshot(_connection) {
  const items = await paginate(
    async () => requestWithRetry(async () => ({ items: [], nextPage: null })),
    { maxPages: 1 }
  );

  return normalizeSnapshot('printables', {
    source: 'printables_api',
    series: [],
    models: items,
    fetchedAt: new Date().toISOString()
  });
}

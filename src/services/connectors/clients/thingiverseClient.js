import { paginate, requestWithRetry } from '../baseConnector.js';
import { normalizeSeriesToCanonical } from '../validation/connectorPayloadValidators.js';

function normalizeMetricRow(row = {}) {
  return normalizeSeriesToCanonical({
    date: row.date ?? new Date().toISOString(),
    views: row.views,
    downloads: row.downloads,
    likes: row.likes,
    sales: row.sales,
    revenue: row.revenue
  });
}

export const thingiverseClient = {
  async discoverItems(account = {}) {
    if (Array.isArray(account.items)) {
      return account.items;
    }

    return paginate(async () => requestWithRetry(async () => ({ items: [], nextPage: null })), { maxPages: 1 });
  },

  async fetchItemMetrics(item = {}) {
    return normalizeMetricRow(item.metrics ?? item);
  },

  async fetchAccountMetrics(account = {}) {
    const metrics = Array.isArray(account.metrics) ? account.metrics : [];
    return metrics.map(normalizeMetricRow);
  },

  capabilities() {
    return {
      platform: 'thingiverse',
      integrationMode: 'api',
      supportsDiscoverItems: true,
      acceptsUserMediatedPayload: false,
      canonicalMetricFields: ['views', 'downloads', 'likes', 'sales', 'revenue', 'date']
    };
  }
};

export default thingiverseClient;

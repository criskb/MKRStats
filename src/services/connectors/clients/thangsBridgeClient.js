import { normalizeSeriesToCanonical } from '../validation/connectorPayloadValidators.js';

function assertValidatedBridgePayload(payload = {}, platformId) {
  if (!payload || payload.validated !== true) {
    const error = new Error(`Bridge payload for ${platformId} must be validated by a user-mediated endpoint.`);
    error.code = 'INVALID_BRIDGE_PAYLOAD';
    throw error;
  }

  return payload;
}

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

export const thangsBridgeClient = {
  async discoverItems(account = {}) {
    const payload = assertValidatedBridgePayload(account.bridgePayload, 'thangs');
    return Array.isArray(payload.items) ? payload.items : [];
  },

  async fetchItemMetrics(item = {}) {
    return normalizeMetricRow(item.metrics ?? item);
  },

  async fetchAccountMetrics(account = {}) {
    const payload = assertValidatedBridgePayload(account.bridgePayload, 'thangs');
    return (Array.isArray(payload.accountMetrics) ? payload.accountMetrics : []).map(normalizeMetricRow);
  },

  capabilities() {
    return {
      platform: 'thangs',
      integrationMode: 'bridge',
      supportsDiscoverItems: true,
      acceptsUserMediatedPayload: true,
      canonicalMetricFields: ['views', 'downloads', 'likes', 'sales', 'revenue', 'date']
    };
  }
};

export default thangsBridgeClient;

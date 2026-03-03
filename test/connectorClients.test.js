import test from 'node:test';
import assert from 'node:assert/strict';
import { cultsClient } from '../src/services/connectors/clients/cultsClient.js';
import { thingiverseClient } from '../src/services/connectors/clients/thingiverseClient.js';
import { printablesClient } from '../src/services/connectors/clients/printablesClient.js';
import { makerworldBridgeClient } from '../src/services/connectors/clients/makerworldBridgeClient.js';
import { thangsBridgeClient } from '../src/services/connectors/clients/thangsBridgeClient.js';
import { crealityBridgeClient } from '../src/services/connectors/clients/crealityBridgeClient.js';

const clients = [
  cultsClient,
  thingiverseClient,
  printablesClient,
  makerworldBridgeClient,
  thangsBridgeClient,
  crealityBridgeClient
];

test('all connector clients expose the common interface and canonical field metadata', async () => {
  for (const client of clients) {
    assert.equal(typeof client.discoverItems, 'function');
    assert.equal(typeof client.fetchItemMetrics, 'function');
    assert.equal(typeof client.fetchAccountMetrics, 'function');
    assert.equal(typeof client.capabilities, 'function');

    const caps = client.capabilities();
    assert.deepEqual(caps.canonicalMetricFields, ['views', 'downloads', 'likes', 'sales', 'revenue', 'date']);
  }
});

test('api clients normalize metrics into canonical schema', async () => {
  const metric = await printablesClient.fetchItemMetrics({
    date: '2026-01-01',
    views: '20',
    downloads: '10',
    likes: '7',
    sales: '2',
    revenue: '12.45'
  });

  assert.deepEqual(metric, {
    date: '2026-01-01',
    views: 20,
    downloads: 10,
    likes: 7,
    sales: 2,
    revenue: 12.45,
    currency: 'USD'
  });
});

test('bridge clients require validated user-mediated payloads', async () => {
  await assert.rejects(() => makerworldBridgeClient.fetchAccountMetrics({ bridgePayload: { validated: false } }), {
    code: 'INVALID_BRIDGE_PAYLOAD'
  });

  const bridgePayload = {
    validated: true,
    accountMetrics: [{ date: '2026-01-01', views: 1, downloads: 2, likes: 3, sales: 4, revenue: 5.5 }],
    items: [{ id: 'a' }]
  };

  const items = await thangsBridgeClient.discoverItems({ bridgePayload });
  const metrics = await crealityBridgeClient.fetchAccountMetrics({ bridgePayload });

  assert.equal(items.length, 1);
  assert.equal(metrics[0].likes, 3);
});

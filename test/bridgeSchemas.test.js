import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBridgeIngestPayload } from '../src/services/connectors/validation/bridgeSchemas.js';

test('validateBridgeIngestPayload normalizes strict bridge payload', () => {
  const normalized = validateBridgeIngestPayload({
    platform: 'MakerWorld',
    accountHandle: 'alice',
    capturedAt: '2026-02-01T10:00:00.000Z',
    data: {
      accountId: 'alice',
      displayName: 'Alice',
      items: [
        {
          id: 'item-1',
          title: 'Rocket',
          metrics: [{ date: '2026-02-01', views: 12, downloads: 5, sales: 2, revenue: 9.991, likes: 1 }]
        }
      ]
    }
  });

  assert.equal(normalized.platform, 'makerworld');
  assert.equal(normalized.data.items[0].metrics[0].revenue, 9.99);
});

test('validateBridgeIngestPayload rejects unexpected top-level fields', () => {
  assert.throws(
    () => validateBridgeIngestPayload({
      platform: 'makerworld',
      accountHandle: 'alice',
      capturedAt: '2026-02-01T10:00:00.000Z',
      data: { items: [{ id: 'i', title: 't', metrics: [{ date: '2026-02-01' }] }] },
      evil: true
    }),
    /unsupported field/
  );
});

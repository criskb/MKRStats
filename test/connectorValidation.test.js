import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalizeSnapshot } from '../src/services/connectors/validation/connectorPayloadValidators.js';

test('validateAndNormalizeSnapshot canonicalizes rows and detects issues', () => {
  const snapshot = validateAndNormalizeSnapshot('printables', {
    fetchedAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString(),
    series: [
      { date: '2025-01-01', views: 100, downloads: 10, likes: 7, sales: 4, revenue: 20.11 },
      { date: '2025-01-01', views: 99999999, downloads: 20, likes: 5, sales: 1, revenue: 3.5 }
    ],
    models: [{ title: 'Example', downloads: 10, sales: 2, revenue: 9 }]
  });

  assert.equal(snapshot.platformId, 'printables');
  assert.equal(snapshot.series.length, 1);
  assert.equal(snapshot.series[0].currency, 'USD');
  assert.equal(snapshot.series[0].likes, 7);
  assert.equal(snapshot.quality.checks.duplicateDayDetection.duplicateDays, 1);
  assert.equal(snapshot.quality.checks.staleSnapshot.stale, true);
  assert.equal(snapshot.models[0].conversionRate, 20);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastNextDays } from '../src/services/predictions/forecastService.js';

test('forecastNextDays returns increasing values for increasing timeline', () => {
  const timeline = Array.from({ length: 10 }, (_, index) => ({
    revenue: index * 10 + 100,
    sales: index + 1
  }));

  const result = forecastNextDays(timeline, 'revenue', 3);

  assert.equal(result.method, 'linear_regression');
  assert.equal(result.forecast.length, 3);
  assert.ok(result.forecast[2] > result.forecast[0]);
});

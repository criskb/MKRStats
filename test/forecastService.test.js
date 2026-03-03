import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastNextDays } from '../src/services/predictions/forecastService.js';

test('forecastNextDays returns interval predictions, scenarios, and confidence', () => {
  const timeline = Array.from({ length: 10 }, (_, index) => ({
    revenue: index * 10 + 100,
    sales: index + 1
  }));

  const result = forecastNextDays(timeline, 'revenue', 3);

  assert.equal(result.method, 'linear_regression_with_residual_interval');
  assert.equal(result.forecast.length, 7);
  assert.ok(result.forecast[2].value > result.forecast[0].value);
  assert.ok(result.forecast[0].lower90 <= result.forecast[0].value);
  assert.ok(result.forecast[0].upper90 >= result.forecast[0].value);
  assert.ok(result.scenarios.conservative < result.scenarios.baseline);
  assert.ok(result.scenarios.aggressive > result.scenarios.baseline);
  assert.ok(result.confidenceScore >= 0 && result.confidenceScore <= 100);
});

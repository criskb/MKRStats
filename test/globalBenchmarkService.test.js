import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlobalBenchmarks } from '../src/services/benchmarks/globalBenchmarkService.js';

test('buildGlobalBenchmarks creates benchmark rows per platform', () => {
  const platforms = [
    { id: 'cults3d', name: 'Cults3D' },
    { id: 'makerworld', name: 'MakerWorld' }
  ];

  const result = buildGlobalBenchmarks(platforms);

  assert.equal(result.length, 2);
  assert.equal(result[0].platformId, 'cults3d');
  assert.ok(result[0].benchmark.avgRevenue30d > 0);
  assert.ok(result[1].benchmark.avgConversionRate >= 0);
});

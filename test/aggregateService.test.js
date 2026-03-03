import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePortfolioData } from '../src/services/analytics/aggregateService.js';

test('aggregatePortfolioData builds platform summaries, insights, funnel, and kpi deltas', () => {
  const payload = [
    {
      id: 'one',
      name: 'One',
      integrationMode: 'api',
      snapshot: {
        series: [
          { date: '2025-01-01', views: 100, downloads: 20, sales: 4, revenue: 40 },
          { date: '2025-01-02', views: 120, downloads: 24, sales: 5, revenue: 50 }
        ],
        models: [{ title: 'A', downloads: 44, sales: 9, revenue: 90 }]
      }
    }
  ];

  const result = aggregatePortfolioData(payload);

  assert.equal(result.totals.downloads, 44);
  assert.equal(result.platformSummaries.length, 1);
  assert.equal(result.platformSummaries[0].revenue, 90);
  assert.equal(result.insights.topPerformer.title, 'A');
  assert.equal(result.funnel.views, 220);
  assert.equal(result.funnel.downloads, 44);
  assert.equal(result.kpiDeltas.revenue7d.current, 90);
});

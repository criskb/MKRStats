import { getOverview } from './api/client.js';
import { createWidget } from './components/widget.js';
import { mountOverviewWidget } from './widgets/overviewWidget.js';
import { mountPerformanceChart } from './widgets/performanceChartWidget.js';
import { mountTopModelsWidget } from './widgets/topModelsWidget.js';
import { mountForecastWidget } from './widgets/forecastWidget.js';
import { mountDeltaWidget } from './widgets/deltaWidget.js';
import { mountFunnelWidget } from './widgets/funnelWidget.js';
import { mountScenarioWidget } from './widgets/scenarioWidget.js';
import { mountBrandSummaryWidget } from './widgets/brandSummaryWidget.js';

async function initOurStats() {
  const root = document.querySelector('#our-stats');
  root.innerHTML = '<div class="widget col-12"><div class="widget__content">Loading our stats...</div></div>';

  try {
    const data = await getOverview({ platform: 'all', horizon: 30 });

    root.innerHTML = '';

    const summary = createWidget('Our Performance Summary', 'col-4');
    const kpi = createWidget('Our KPI Totals', 'col-8');
    const trend = createWidget('Our Traffic + Sales Trend', 'col-8');
    const forecast = createWidget('Our Revenue Forecast (30d)', 'col-4');
    const deltas = createWidget('Our KPI Momentum', 'col-4');
    const funnel = createWidget('Our Conversion Funnel', 'col-4');
    const scenarios = createWidget('Our Forecast Scenarios', 'col-4');
    const topModels = createWidget('Our Top Models', 'col-12');

    root.append(
      summary.node,
      kpi.node,
      trend.node,
      forecast.node,
      deltas.node,
      funnel.node,
      scenarios.node,
      topModels.node
    );

    mountBrandSummaryWidget(summary.content, data);
    mountOverviewWidget(kpi.content, data.aggregated.totals);
    mountPerformanceChart(trend.content, data.aggregated.timeline);
    mountForecastWidget(forecast.content, data.aggregated.timeline, data.forecast);
    mountDeltaWidget(deltas.content, data.aggregated.kpiDeltas);
    mountFunnelWidget(funnel.content, data.aggregated.funnel);
    mountScenarioWidget(scenarios.content, data.forecast.revenue);
    mountTopModelsWidget(topModels.content, data.aggregated.topModels);
  } catch (error) {
    root.innerHTML = `<div class="widget col-12"><div class="widget__content">Failed to load our stats: ${error.message}</div></div>`;
  }
}

initOurStats();

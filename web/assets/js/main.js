import { getOverview, getPlatforms } from './api/client.js';
import { createWidget } from './components/widget.js';
import { mountOverviewWidget } from './widgets/overviewWidget.js';
import { mountPerformanceChart } from './widgets/performanceChartWidget.js';
import { mountTopModelsWidget } from './widgets/topModelsWidget.js';
import { mountForecastWidget } from './widgets/forecastWidget.js';
import { mountPlatformGridWidget } from './widgets/platformGridWidget.js';
import { mountControlsWidget } from './widgets/controlsWidget.js';
import { mountInsightsWidget } from './widgets/insightsWidget.js';
import { mountPlatformRevenueWidget } from './widgets/platformRevenueWidget.js';
import { mountFunnelWidget } from './widgets/funnelWidget.js';
import { mountScenarioWidget } from './widgets/scenarioWidget.js';
import { mountDeltaWidget } from './widgets/deltaWidget.js';

const state = {
  platform: 'all',
  horizon: 14
};

function clearDashboard(node) {
  node.innerHTML = '';
}

function renderLoading(dashboard) {
  dashboard.innerHTML = '<div class="widget col-12"><div class="widget__content">Loading analytics...</div></div>';
}

function renderDashboard(dashboard, platforms, data) {
  const controls = createWidget('Dashboard Controls', 'col-4');
  const insights = createWidget('Executive Insights', 'col-8');
  const overview = createWidget('Portfolio KPI Overview', 'col-12');
  const deltas = createWidget('KPI Momentum (vs prior 7d)', 'col-4');
  const scenario = createWidget('Forecast Scenarios', 'col-4');
  const funnel = createWidget('Conversion Funnel', 'col-4');
  const performance = createWidget('Traffic and Sales Trends', 'col-8');
  const forecast = createWidget(`Revenue Forecast (${data.horizon}d)`, 'col-4');
  const topModels = createWidget('Top Models by Revenue', 'col-8');
  const platformRevenue = createWidget('Platform Revenue Comparison', 'col-4');
  const platformGrid = createWidget('Connected Platform Coverage', 'col-12');

  dashboard.append(
    controls.node,
    insights.node,
    overview.node,
    deltas.node,
    scenario.node,
    funnel.node,
    performance.node,
    forecast.node,
    topModels.node,
    platformRevenue.node,
    platformGrid.node
  );

  mountControlsWidget(controls.content, platforms, state, (nextState) => {
    state.platform = nextState.platform;
    state.horizon = Math.max(7, Math.min(60, nextState.horizon));
    init();
  });

  mountInsightsWidget(insights.content, data.aggregated.insights, data.forecast.revenue);
  mountOverviewWidget(overview.content, data.aggregated.totals);
  mountDeltaWidget(deltas.content, data.aggregated.kpiDeltas);
  mountScenarioWidget(scenario.content, data.forecast.revenue);
  mountFunnelWidget(funnel.content, data.aggregated.funnel);
  mountPerformanceChart(performance.content, data.aggregated.timeline);
  mountForecastWidget(forecast.content, data.aggregated.timeline, data.forecast);
  mountTopModelsWidget(topModels.content, data.aggregated.topModels);
  mountPlatformRevenueWidget(platformRevenue.content, data.aggregated.platformSummaries);
  mountPlatformGridWidget(platformGrid.content, data.platforms, data.aggregated.platformSummaries);
}

async function init() {
  const dashboard = document.querySelector('#dashboard');
  renderLoading(dashboard);

  try {
    const [platformResponse, overviewData] = await Promise.all([
      getPlatforms(),
      getOverview(state)
    ]);

    clearDashboard(dashboard);
    renderDashboard(dashboard, platformResponse.platforms, overviewData);
  } catch (error) {
    dashboard.innerHTML = `<div class="widget col-12"><div class="widget__content">Failed to load dashboard: ${error.message}</div></div>`;
  }
}

init();

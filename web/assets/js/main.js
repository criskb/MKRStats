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
  mountControlsWidget(controls.content, platforms, state, (nextState) => {
    state.platform = nextState.platform;
    state.horizon = Math.max(7, Math.min(60, nextState.horizon));
    init();
  });

  const insights = createWidget('Executive Insights', 'col-8');
  mountInsightsWidget(insights.content, data.aggregated.insights, data.forecast.revenue);

  const overview = createWidget('Portfolio KPI Overview', 'col-12');
  mountOverviewWidget(overview.content, data.aggregated.totals);

  const deltas = createWidget('KPI Momentum (vs prior 7d)', 'col-4');
  mountDeltaWidget(deltas.content, data.aggregated.kpiDeltas);

  const scenario = createWidget('Forecast Scenarios', 'col-4');
  mountScenarioWidget(scenario.content, data.forecast.revenue);

  const funnel = createWidget('Conversion Funnel', 'col-4');
  mountFunnelWidget(funnel.content, data.aggregated.funnel);

  const performance = createWidget('Traffic and Sales Trends', 'col-8');
  mountPerformanceChart(performance.content, data.aggregated.timeline);

  const forecast = createWidget(`Revenue Forecast (${data.horizon}d)`, 'col-4');
  mountForecastWidget(forecast.content, data.aggregated.timeline, data.forecast);

  const topModels = createWidget('Top Models by Revenue', 'col-8');
  mountTopModelsWidget(topModels.content, data.aggregated.topModels);

  const platformRevenue = createWidget('Platform Revenue Comparison', 'col-4');
  mountPlatformRevenueWidget(platformRevenue.content, data.aggregated.platformSummaries);

  const platformGrid = createWidget('Connected Platform Coverage', 'col-12');
  mountPlatformGridWidget(platformGrid.content, data.platforms, data.aggregated.platformSummaries);

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
}

async function init() {
  const dashboard = document.querySelector('#dashboard');
  renderLoading(dashboard);

  try {
    const [platformResponse, overview] = await Promise.all([
      getPlatforms(),
      getOverview(state)
    ]);

    clearDashboard(dashboard);
    renderDashboard(dashboard, platformResponse.platforms, overview);
  } catch (error) {
    dashboard.innerHTML = `<div class="widget col-12"><div class="widget__content">Failed to load dashboard: ${error.message}</div></div>`;
  }
}

init();

import { getCollectionStatus, getOverview } from './api/client.js';
import { createWidget } from './components/widget.js';
import { mountOverviewWidget } from './widgets/overviewWidget.js';
import { mountPerformanceChart } from './widgets/performanceChartWidget.js';
import { mountTopModelsWidget } from './widgets/topModelsWidget.js';
import { mountForecastWidget } from './widgets/forecastWidget.js';
import { mountDeltaWidget } from './widgets/deltaWidget.js';
import { mountFunnelWidget } from './widgets/funnelWidget.js';
import { mountScenarioWidget } from './widgets/scenarioWidget.js';
import { mountBrandSummaryWidget } from './widgets/brandSummaryWidget.js';
import { mountCollectionHealthWidget, renderCollectionHealthBanner } from './widgets/collectionHealthWidget.js';
import { loadConnectionMeta } from './profile/secureStore.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function getConnectionScope() {
  const meta = loadConnectionMeta();
  const configuredPlatforms = meta?.configuredPlatforms ?? [];

  return {
    configuredPlatforms,
    hasConfiguredScope: configuredPlatforms.length > 0,
    meta
  };
}

function renderSkeleton(root) {
  root.innerHTML = '<div class="widget col-12"><div class="widget__content">Loading our stats...</div></div>';
}

function renderScopeNotice(root, scope) {
  if (scope.hasConfiguredScope) {
    root.insertAdjacentHTML(
      'afterbegin',
      `<section class="widget col-12"><div class="widget__content">Scoped to ${scope.configuredPlatforms.length} configured platform(s). Data refreshes every 5 minutes.</div></section>`
    );
    return;
  }

  root.insertAdjacentHTML(
    'afterbegin',
    '<section class="widget col-12"><div class="widget__content">No platform connections configured yet. Showing full portfolio fallback. Go to Settings / Profile and save connections to enable strict scoped stats.</div></section>'
  );
}

async function renderOurStats() {
  const root = document.querySelector('#our-stats');
  renderSkeleton(root);

  try {
    const scope = getConnectionScope();
    const [data, statusPayload] = await Promise.all([
      getOverview({
        platform: 'all',
        horizon: 30,
        connected: scope.configuredPlatforms
      }),
      getCollectionStatus(10)
    ]);

    root.innerHTML = '';

    const summary = createWidget('Our Performance Summary', 'col-4');
    const kpi = createWidget('Our KPI Totals', 'col-8');
    const trend = createWidget('Our Traffic + Sales Trend', 'col-8');
    const forecast = createWidget('Our Revenue Forecast (30d)', 'col-4');
    const deltas = createWidget('Our KPI Momentum', 'col-4');
    const funnel = createWidget('Our Conversion Funnel', 'col-4');
    const scenarios = createWidget('Our Forecast Scenarios', 'col-4');
    const diagnostics = createWidget('Collection Health', 'col-12');
    diagnostics.node.id = 'collection-health-details';
    const topModels = createWidget('Our Top Models', 'col-12');

    root.append(
      summary.node,
      kpi.node,
      trend.node,
      forecast.node,
      deltas.node,
      funnel.node,
      scenarios.node,
      diagnostics.node,
      topModels.node
    );

    renderCollectionHealthBanner(root, data.collection);
    renderScopeNotice(root, scope);
    mountBrandSummaryWidget(summary.content, data);
    mountOverviewWidget(kpi.content, data.aggregated.totals);
    mountPerformanceChart(trend.content, data.aggregated.timeline);
    mountForecastWidget(forecast.content, data.aggregated.timeline, data.forecast);
    mountDeltaWidget(deltas.content, data.aggregated.kpiDeltas);
    mountFunnelWidget(funnel.content, data.aggregated.funnel);
    mountScenarioWidget(scenarios.content, data.forecast.revenue);
    mountCollectionHealthWidget(diagnostics.content, data.collection, statusPayload);
    mountTopModelsWidget(topModels.content, data.aggregated.topModels);
  } catch (error) {
    root.innerHTML = `<div class="widget col-12"><div class="widget__content">Failed to load our stats: ${error.message}</div></div>`;
  }
}

renderOurStats();
setInterval(renderOurStats, REFRESH_INTERVAL_MS);

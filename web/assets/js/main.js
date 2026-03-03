import { getOverview } from './api/client.js';
import { createWidget } from './components/widget.js';
import { mountOverviewWidget } from './widgets/overviewWidget.js';
import { mountPerformanceChart } from './widgets/performanceChartWidget.js';
import { mountTopModelsWidget } from './widgets/topModelsWidget.js';
import { mountForecastWidget } from './widgets/forecastWidget.js';
import { mountPlatformGridWidget } from './widgets/platformGridWidget.js';

async function init() {
  const dashboard = document.querySelector('#dashboard');

  try {
    const data = await getOverview();

    const overview = createWidget('Portfolio KPI Overview', 'col-12');
    mountOverviewWidget(overview.content, data.aggregated.totals);

    const performance = createWidget('Traffic and Sales Trends', 'col-8');
    mountPerformanceChart(performance.content, data.aggregated.timeline);

    const forecast = createWidget('Revenue Forecast (14d)', 'col-4');
    mountForecastWidget(forecast.content, data.aggregated.timeline, data.forecast);

    const topModels = createWidget('Top Models by Revenue', 'col-8');
    mountTopModelsWidget(topModels.content, data.aggregated.topModels);

    const platformGrid = createWidget('Connected Platform Coverage', 'col-4');
    mountPlatformGridWidget(platformGrid.content, data.platforms);

    dashboard.append(
      overview.node,
      performance.node,
      forecast.node,
      topModels.node,
      platformGrid.node
    );
  } catch (error) {
    dashboard.innerHTML = `<div class="widget col-12"><div class="widget__content">Failed to load dashboard: ${error.message}</div></div>`;
  }
}

init();

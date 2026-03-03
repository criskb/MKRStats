import { getCollectionStatus, getOverview, getPlatforms } from './api/client.js';
import { createWidget } from './components/widget.js';
import { mountAnomalyRadarWidget } from './widgets/anomalyRadarWidget.js';
import { mountDataHealthWidget } from './widgets/dataHealthWidget.js';
import { mountForecastWidget } from './widgets/forecastWidget.js';
import { mountInsightsWidget } from './widgets/insightsWidget.js';
import { mountOverviewWidget } from './widgets/overviewWidget.js';
import { mountPerformanceChart } from './widgets/performanceChartWidget.js';
import { mountPlatformShareWidget } from './widgets/platformShareWidget.js';
import { mountTodayBriefingWidget } from './widgets/todayBriefingWidget.js';
import { mountTopModelsWidget } from './widgets/topModelsWidget.js';

const SCOPE_TO_HORIZON = {
  week: 7,
  month: 30,
  year: 365,
  all: 3650
};

const state = {
  mode: 'overview',
  platform: 'all',
  horizon: 30,
  metric: 'downloads',
  scope: 'month'
};

function buildGlobalBar(platforms) {
  const host = document.querySelector('#global-filter-bar');
  host.innerHTML = `
    <section class="global-bar">
      <label>Time scope
        <select id="scope-select">
          <option value="week">Weekly</option>
          <option value="month" selected>30 days</option>
          <option value="year">Yearly</option>
          <option value="all">All time</option>
        </select>
      </label>
      <label>Platform
        <select id="platform-select">
          <option value="all">All platforms</option>
          ${platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
        </select>
      </label>
      <label>Metric
        <select id="metric-select">
          <option value="downloads">Downloads</option>
          <option value="views">Views</option>
          <option value="likes">Likes</option>
          <option value="revenue">Revenue</option>
        </select>
      </label>
      <span class="pill pill--live">🔴 Data freshness</span>
    </section>
    <section class="mode-tabs">
      <button data-mode="overview" class="mode-tab mode-tab--active">Overview</button>
      <button data-mode="explore" class="mode-tab">Explore</button>
      <button data-mode="forecast" class="mode-tab">Forecast Studio</button>
    </section>
  `;

  host.querySelector('#scope-select').addEventListener('change', (event) => {
    state.scope = event.target.value;
    state.horizon = SCOPE_TO_HORIZON[state.scope] ?? 30;
    init();
  });

  host.querySelector('#platform-select').addEventListener('change', (event) => {
    state.platform = event.target.value;
    init();
  });

  host.querySelector('#metric-select').addEventListener('change', (event) => {
    state.metric = event.target.value;
    init();
  });

  host.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.mode = tab.dataset.mode;
      host.querySelectorAll('.mode-tab').forEach((node) => node.classList.remove('mode-tab--active'));
      tab.classList.add('mode-tab--active');
      init();
    });
  });
}

function withScopedTimeline(data) {
  const scopedTimeline = state.scope === 'all'
    ? data.aggregated.timeline
    : data.aggregated.timeline.slice(-state.horizon);

  return {
    ...data,
    aggregated: {
      ...data.aggregated,
      timeline: scopedTimeline
    }
  };
}

function renderDashboard(dashboard, data, statusPayload) {
  dashboard.innerHTML = '';

  if (state.mode === 'overview') {
    const briefing = createWidget('Today\'s Briefing', 'col-12');
    const insights = createWidget('Executive Insights', 'col-6');
    const kpis = createWidget('KPI Cards 2.0', 'col-6');
    const trend = createWidget('Trend Lab Chart', 'col-8');
    const platformShare = createWidget('Platform Share', 'col-4');

    dashboard.append(briefing.node, insights.node, kpis.node, trend.node, platformShare.node);
    mountTodayBriefingWidget(briefing.content, data);
    mountInsightsWidget(insights.content, data.aggregated.insights, data.forecast.revenue, data);
    mountOverviewWidget(kpis.content, data.aggregated.totals);
    mountPerformanceChart(trend.content, data.aggregated.timeline);
    mountPlatformShareWidget(platformShare.content, data.aggregated.platformSummaries);
    return;
  }

  if (state.mode === 'explore') {
    const models = createWidget('Model Card Rail', 'col-8');
    const anomalies = createWidget('Anomaly Radar', 'col-4');
    const dataHealth = createWidget('Data Health', 'col-12');

    dashboard.append(models.node, anomalies.node, dataHealth.node);
    mountTopModelsWidget(models.content, data.aggregated.topModels);
    mountAnomalyRadarWidget(anomalies.content, data.aggregated.timeline);
    mountDataHealthWidget(dataHealth.content, data.collection, statusPayload);
    return;
  }

  const forecast = createWidget('Forecast Studio', 'col-8');
  const quality = createWidget('Quality + Scenario', 'col-4');
  dashboard.append(forecast.node, quality.node);
  mountForecastWidget(forecast.content, data.aggregated.timeline, data.forecast);
  quality.content.innerHTML = `
    <p class="scenario-note">Backtest + model picker shell:</p>
    <ul class="insight-list">
      <li>Method: ETS / ARIMA / Boosting</li>
      <li>Time scope: ${state.scope}</li>
      <li>Forecast horizon: ${Math.min(60, state.horizon)} days</li>
      <li>Metric focus: ${state.metric}</li>
      <li>Scenario sliders: Promo, Platform uplift, Posting frequency</li>
    </ul>
  `;
}

async function init() {
  const dashboard = document.querySelector('#dashboard');
  dashboard.innerHTML = '<div class="widget col-12"><div class="widget__content">Loading analytics...</div></div>';

  try {
    const [platformResponse, overviewData, statusPayload] = await Promise.all([
      getPlatforms(),
      getOverview({ platform: state.platform, horizon: state.horizon }),
      getCollectionStatus(10)
    ]);

    if (!document.querySelector('#global-filter-bar').childElementCount) {
      buildGlobalBar(platformResponse.platforms);
    }

    renderDashboard(dashboard, withScopedTimeline(overviewData), statusPayload);
  } catch (error) {
    dashboard.innerHTML = `<div class="widget col-12"><div class="widget__content">Failed to load dashboard: ${error.message}</div></div>`;
  }
}

init();

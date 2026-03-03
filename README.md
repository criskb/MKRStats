# MKRStats

MKRStats is a Node.js web app scaffold for a **multi-platform 3D model brand intelligence dashboard**. It centralizes marketplace traffic and commerce data (downloads, sales, revenue, and engagement) from platforms like Cults3D, MakerWorld, Thangs, and Printables, then transforms those streams into KPI widgets, trend graphs, top-model rankings, platform comparison views, and scenario-based sales/revenue forecasts with confidence bands.

## Product goals

- Connect one brand identity across marketplaces.
- Aggregate performance into a single analytics view.
- Track growth drivers: views → downloads → conversions → revenue.
- Forecast short-term sales and revenue with explainable methods, intervals, and scenario ranges.
- Keep UI modular through reusable dashboard widgets.

## Proposed high-level architecture

```text
┌─────────────────────┐
│  Frontend Widgets   │  (Vanilla JS modules + Chart.js)
└─────────┬───────────┘
          │ /api/overview
┌─────────▼───────────┐
│   Node HTTP API     │
│  Router + Services  │
└─────────┬───────────┘
          │
┌─────────▼───────────────────────────────────────────┐
│ Connectors Layer                                    │
│ - OAuth/API clients                                 │
│ - HTML/parsing fallback jobs                        │
│ - Rate limits, retries, normalization               │
└─────────┬───────────────────────────────────────────┘
          │
┌─────────▼────────────┐
│ Analytics + Forecast │
│ Aggregation + models │
└──────────────────────┘
```

## Folder structure (modular widget-first)

```text
src/
  config/
    platforms.js                  # Platform metadata and metric coverage
  services/
    connectors/
      baseConnector.js            # Mock/fallback snapshot builder
      platformConnectorService.js # Unified fetch service
    analytics/
      aggregateService.js         # Timeline + KPI aggregation + insights
    predictions/
      forecastService.js          # Regression + interval + scenarios
  utils/
    date.js                       # Date range helpers
  server.js                       # Native Node HTTP server + API/static routing

web/
  index.html
  assets/
    css/
      main.css                    # Dashboard styling
    js/
      api/
        client.js                 # API transport
      components/
        widget.js                 # Widget shell
        kpiCard.js                # KPI cards
        chart.js                  # Chart wrapper
        table.js                  # Generic table
      widgets/
        controlsWidget.js         # Filter controls (platform/horizon)
        insightsWidget.js         # Executive insight bullets
        overviewWidget.js         # KPI summary
        performanceChartWidget.js # Downloads/Sales trends
        forecastWidget.js         # Revenue forecast with 90% band
        topModelsWidget.js        # Model leaderboard
        platformRevenueWidget.js  # Revenue comparison by marketplace
        funnelWidget.js           # Views->downloads->sales funnel
        scenarioWidget.js         # Forecast scenarios + confidence
        deltaWidget.js            # 7-day KPI momentum deltas
        platformGridWidget.js     # Connector status/coverage table
      main.js                     # Dashboard composition

test/
  forecastService.test.js         # Forecast output behavior
  aggregateService.test.js        # Aggregation + insight behavior
```

## API response shape

`GET /api/overview?platform=all|<platformId>&horizon=7..60` returns:

`GET /api/export.csv?platform=all|<platformId>&horizon=7..60` downloads timeline data as CSV.

- `platforms`: selected platform configs + snapshots.
- `aggregated`:
  - `totals`
  - `timeline`
  - `topModels`
  - `platformSummaries`
  - `insights`
  - `funnel`
  - `kpiDeltas`
- `forecast`:
  - `revenue` (baseline + 90% interval + scenarios + confidence score)
  - `sales` (baseline + 90% interval + scenarios + confidence score)

## Run locally

```bash
npm start
```

Open http://localhost:3000

## Test

```bash
npm test
```

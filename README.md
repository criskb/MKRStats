# MKRStats

MKRStats is a Node.js web app scaffold for a **multi-platform 3D model brand intelligence dashboard**. It centralizes marketplace traffic and commerce data (downloads, sales, revenue, and engagement) from platforms like Cults3D, MakerWorld, Thangs, and Printables, then transforms those streams into KPI widgets, trend graphs, top-model rankings, and short-horizon sales/revenue predictions.

## Product goals

- Connect one brand identity across marketplaces.
- Aggregate performance into a single analytics view.
- Track growth drivers: views → downloads → conversions → revenue.
- Forecast short-term sales and revenue with explainable methods.
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

> Current implementation includes **mock connector snapshots** so UI and analytics pipelines are production-like while real platform integrations are developed.

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
      aggregateService.js         # Timeline + top-model aggregation
    predictions/
      forecastService.js          # Linear regression forecasting
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
        overviewWidget.js         # KPI summary
        performanceChartWidget.js # Downloads/Sales trends
        forecastWidget.js         # Future revenue chart
        topModelsWidget.js        # Model leaderboard
        platformGridWidget.js     # Connector status/coverage
      main.js                     # Dashboard composition

test/
  forecastService.test.js         # Node test for prediction logic
```

## How predictions are calculated

- The app computes a simple linear regression over the past 30 daily points.
- It forecasts the next 14 days for:
  - `revenue`
  - `sales`
- Returned metadata includes method name, slope, and per-day projected values.

This is intentionally explainable and lightweight; for production you can add Prophet/XGBoost/LSTM models behind the same `forecastService` interface.

## API response shape

`GET /api/overview` returns:

- `platforms`: each platform config + normalized snapshot.
- `aggregated`:
  - `totals`
  - `timeline`
  - `topModels`
- `forecast`:
  - `revenue`
  - `sales`

## Next production steps

1. **OAuth + secure secrets** per platform.
2. **Persistent storage** (Postgres + Timescale hypertables recommended).
3. **Job queue** (BullMQ) for API pulls and scraper fallback.
4. **Attribution model** for campaign/source-level impact.
5. **Cohort and retention widgets** for repeat buyers/downloaders.
6. **Scenario engine** (e.g., "what if conversion improves by 2%?").
7. **Role-based workspaces** for multi-brand or agency usage.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Test

```bash
npm test
```

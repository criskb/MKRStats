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
  our-stats.html                  # Dedicated tab/page for our own stats
  profile.html                    # Settings/profile page
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
        performanceChartWidget.js # Interactive trend chart mode selector
        forecastWidget.js         # Revenue forecast with 90% band
        topModelsWidget.js        # Sortable model leaderboard
        platformRevenueWidget.js  # Revenue comparison by marketplace
        funnelWidget.js           # Views->downloads->sales funnel
        scenarioWidget.js         # Forecast scenarios + confidence
        deltaWidget.js            # 7-day KPI momentum deltas
        globalComparisonWidget.js # Global benchmark vs own stats
        platformGridWidget.js     # Connector status/coverage table
      profile/
        secureStore.js            # AES-GCM encrypted local storage helper
        main.js                   # profile/settings interactions
      ourStatsMain.js             # Our Stats page composition
      main.js                     # Dashboard composition

test/
  forecastService.test.js         # Forecast output behavior
  aggregateService.test.js        # Aggregation + insight behavior
```

## API response shape

`GET /api/overview?platform=all|<platformId>&horizon=7..365` returns:

`GET /api/export.csv?platform=all|<platformId>&horizon=7..365` downloads timeline data as CSV.

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
- `benchmarks`:
  - per-platform global averages for views/downloads/sales/revenue/conversion

## Run locally

```bash
npm run dev
```

Or production-style:

```bash
npm start
```

If you accidentally type `node run dev`, this repo now includes a small `run` shim that forwards to `npm run <script>` for convenience.

Open http://localhost:3000

## Test

```bash
npm test
```


## Profile/settings security

- Open `/profile.html` to configure platform handles and API keys per platform.
- Sensitive values are encrypted in the browser using AES-GCM.
- The encryption key is derived from your passphrase with PBKDF2 and the passphrase is never stored.
- Encrypted blobs are stored in `localStorage` and can be cleared locally at any time.
- Server-side connection storage uses encrypted credential blobs when `CONNECTION_MASTER_KEY` is set; without it, the app falls back to plaintext server storage for local/dev convenience.


## Interactive widget UX

- Trend widget supports mode switching (Commerce / Awareness / Revenue) without reloading.
- Top models widget supports in-place sorting by revenue, downloads, or conversion.
- Control panel updates CSV export URL dynamically when filters change.
- KPI delta cards are color-coded for up/down/flat momentum at a glance.

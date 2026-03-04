'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.js';

const SCOPE_TO_HORIZON = { week: 7, month: 30, year: 365, all: 3650 };

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message ?? String(response.status));
  return payload;
}

function formatFreshness(isoDate) {
  const parsed = Date.parse(isoDate ?? '');
  if (!Number.isFinite(parsed)) return 'unknown';
  const minutes = Math.max(0, Math.round((Date.now() - parsed) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function buildAnomalies(timeline = []) {
  const downloads = timeline.map((row) => Number(row.downloads ?? 0));
  if (downloads.length < 5) return [];
  const mean = downloads.reduce((sum, value) => sum + value, 0) / downloads.length;
  const variance = downloads.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / downloads.length;
  const sigma = Math.sqrt(variance);
  return timeline
    .filter((row) => Math.abs(Number(row.downloads ?? 0) - mean) > (2 * sigma))
    .slice(-3)
    .map((row) => ({
      date: row.date,
      downloads: Number(row.downloads ?? 0),
      sigma: sigma ? ((Number(row.downloads ?? 0) - mean) / sigma).toFixed(1) : '0.0'
    }));
}

export default function DashboardPage() {
  const [platforms, setPlatforms] = useState([]);
  const [overview, setOverview] = useState(null);
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('month');
  const [platform, setPlatform] = useState('all');
  const [mode, setMode] = useState('overview');
  const [refreshToken, setRefreshToken] = useState(Date.now());

  const horizon = SCOPE_TO_HORIZON[scope] ?? 30;

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      jsonFetch('/api/platforms'),
      jsonFetch(`/api/overview?platform=${platform}&horizon=${horizon}&_t=${refreshToken}`),
      jsonFetch('/api/collection/status?limit=10')
    ]).then(([p, o, c]) => {
      if (!active) return;
      setPlatforms(p.platforms ?? []);
      setOverview(o);
      setCollection(c);
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      active = false;
    };
  }, [platform, horizon, refreshToken]);

  const totals = overview?.aggregated?.totals ?? {};
  const topModels = useMemo(() => overview?.aggregated?.topModels?.slice(0, 8) ?? [], [overview]);
  const platformSummaries = useMemo(() => overview?.aggregated?.platformSummaries ?? [], [overview]);
  const anomalies = useMemo(() => buildAnomalies(overview?.aggregated?.timeline ?? []), [overview]);

  const totalRevenue = platformSummaries.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);

  return (
    <>
      <Header
        title="MKRStats"
        subtitle="Unified marketplace analytics and forecasting for 3D model brands"
        current="dashboard"
      />

      <section className="dashboard-controls" id="global-filter-bar">
        <section className="global-bar">
          <label>Time scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="week">Weekly</option>
              <option value="month">30 days</option>
              <option value="year">Yearly</option>
              <option value="all">All time</option>
            </select>
          </label>

          <label>Platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="all">All platforms</option>
              {platforms.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <span className="pill pill--live">🔴 Data freshness: {formatFreshness(overview?.generatedAt)}</span>
          <button className="button-secondary" type="button" onClick={() => setRefreshToken(Date.now())}>Refresh data</button>
        </section>

        <section className="mode-tabs">
          <button className={`mode-tab ${mode === 'overview' ? 'mode-tab--active' : ''}`} onClick={() => setMode('overview')} type="button">Overview</button>
          <button className={`mode-tab ${mode === 'explore' ? 'mode-tab--active' : ''}`} onClick={() => setMode('explore')} type="button">Explore</button>
          <button className={`mode-tab ${mode === 'forecast' ? 'mode-tab--active' : ''}`} onClick={() => setMode('forecast')} type="button">Forecast Studio</button>
        </section>
      </section>

      <main className="dashboard-grid" id="dashboard">
        {loading && <section className="widget col-12"><div className="widget__content">Loading analytics...</div></section>}

        {!loading && overview && mode === 'overview' && (
          <>
            <section className="widget col-12">
              <header className="widget__header">Today&apos;s Briefing</header>
              <div className="widget__content briefing">
                <p className="briefing__headline">Performance snapshot</p>
                <p><strong>Views:</strong> {(totals.views ?? 0).toLocaleString()} · <strong>Downloads:</strong> {(totals.downloads ?? 0).toLocaleString()} · <strong>Revenue:</strong> ${(totals.revenue ?? 0).toLocaleString()}</p>
              </div>
            </section>

            <section className="widget col-6">
              <header className="widget__header">KPI Cards</header>
              <div className="widget__content kpi-grid">
                <article className="kpi-card"><p className="kpi-card__label">Views</p><p className="kpi-card__value">{(totals.views ?? 0).toLocaleString()}</p></article>
                <article className="kpi-card"><p className="kpi-card__label">Downloads</p><p className="kpi-card__value">{(totals.downloads ?? 0).toLocaleString()}</p></article>
                <article className="kpi-card"><p className="kpi-card__label">Sales</p><p className="kpi-card__value">{(totals.sales ?? 0).toLocaleString()}</p></article>
                <article className="kpi-card"><p className="kpi-card__label">Revenue</p><p className="kpi-card__value">${(totals.revenue ?? 0).toLocaleString()}</p></article>
              </div>
            </section>

            <section className="widget col-6">
              <header className="widget__header">Platform Share</header>
              <div className="widget__content">
                <div className="segment-bar">
                  {platformSummaries.map((row) => {
                    const pct = totalRevenue ? Math.max(4, Math.round((Number(row.revenue ?? 0) / totalRevenue) * 100)) : 0;
                    return <button type="button" className="segment-bar__item" style={{ width: `${pct}%` }} key={row.platformId}>{row.name}</button>;
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        {!loading && overview && mode === 'explore' && (
          <>
            <section className="widget col-8">
              <header className="widget__header">Top Models</header>
              <div className="widget__content">
                <table className="table">
                  <thead><tr><th>Model</th><th>Downloads</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {topModels.map((item) => (
                      <tr key={item.title}><td>{item.title}</td><td>{item.downloads}</td><td>${item.revenue}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="widget col-4">
              <header className="widget__header">Anomaly Radar</header>
              <div className="widget__content">
                <ul className="insight-list">
                  {(anomalies.length ? anomalies : [{ date: 'none', downloads: 0, sigma: '0.0' }]).map((item) => (
                    <li key={item.date}>{item.date === 'none' ? 'No significant anomalies detected.' : `${item.date}: ${item.downloads} downloads (${item.sigma}σ)`}</li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}

        {!loading && overview && mode === 'forecast' && (
          <>
            <section className="widget col-8">
              <header className="widget__header">Forecast Studio</header>
              <div className="widget__content">
                <p className="scenario-note">Method shell: ETS / ARIMA / Boosting</p>
                <p className="scenario-note">Horizon: {horizon} days</p>
                <p className="scenario-note">Revenue confidence: {overview?.forecast?.revenue?.confidence ?? 'n/a'}</p>
              </div>
            </section>
            <section className="widget col-4">
              <header className="widget__header">Collection Health</header>
              <div className="widget__content">
                <p><strong>Latest run:</strong> {collection?.latestRun?.status ?? 'unknown'}</p>
                <p><strong>Bridge freshness:</strong> {collection?.bridgeIngest?.freshnessMinutes ?? 'n/a'}m</p>
                <p><strong>Runs listed:</strong> {(collection?.runs ?? []).length}</p>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

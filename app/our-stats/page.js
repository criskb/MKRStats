'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.js';

async function jsonFetch(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message ?? `${response.status}`);
  return payload;
}

export default function OurStatsPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(Date.now());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      jsonFetch(`/api/overview?platform=all&horizon=30&_t=${refreshToken}`),
      jsonFetch('/api/collection/status?limit=10')
    ]).then(([overviewPayload, statusPayload]) => {
      if (!active) return;
      setData(overviewPayload);
      setStatus(statusPayload);
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      active = false;
    };
  }, [refreshToken]);

  const totals = data?.aggregated?.totals ?? {};
  const topModels = useMemo(() => data?.aggregated?.topModels?.slice(0, 6) ?? [], [data]);

  return (
    <>
      <Header
        title="Our Brand Stats"
        subtitle="Dedicated view of our account performance across connected platforms."
        current="our-stats"
      />

      <main className="dashboard-grid" id="our-stats">
        <section className="widget col-12">
          <header className="widget__header">Scope & Refresh</header>
          <div className="widget__content">
            <button className="button-secondary" type="button" onClick={() => setRefreshToken(Date.now())}>Refresh now</button>
          </div>
        </section>

        {loading && <section className="widget col-12"><div className="widget__content">Loading our stats...</div></section>}

        {!loading && data && (
          <>
            <section className="widget col-4">
              <header className="widget__header">Revenue</header>
              <div className="widget__content"><p className="kpi-card__value">${(totals.revenue ?? 0).toLocaleString()}</p></div>
            </section>
            <section className="widget col-4">
              <header className="widget__header">Downloads</header>
              <div className="widget__content"><p className="kpi-card__value">{(totals.downloads ?? 0).toLocaleString()}</p></div>
            </section>
            <section className="widget col-4">
              <header className="widget__header">Views</header>
              <div className="widget__content"><p className="kpi-card__value">{(totals.views ?? 0).toLocaleString()}</p></div>
            </section>

            <section className="widget col-8">
              <header className="widget__header">Our Top Models</header>
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

            <section className="widget col-4" id="collection-health-details">
              <header className="widget__header">Collection Health</header>
              <div className="widget__content">
                <p><strong>Latest run:</strong> {status?.latestRun?.status ?? 'unknown'}</p>
                <p><strong>Bridge freshness:</strong> {status?.bridgeIngest?.freshnessMinutes ?? 'n/a'}m</p>
                <p><strong>Runs listed:</strong> {(status?.runs ?? []).length}</p>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

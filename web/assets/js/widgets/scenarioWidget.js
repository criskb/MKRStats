const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

function safeCurrency(value) {
  const numeric = Number(value);
  return usd.format(Number.isFinite(numeric) ? numeric : 0);
}

export function mountScenarioWidget(container, revenueForecast = {}) {
  const scenarios = revenueForecast.scenarios ?? {};

  container.innerHTML = `
    <div class="scenario-grid">
      <article class="scenario-card">
        <h4>Conservative</h4>
        <p>${safeCurrency(scenarios.conservative)}</p>
      </article>
      <article class="scenario-card">
        <h4>Baseline</h4>
        <p>${safeCurrency(scenarios.baseline)}</p>
      </article>
      <article class="scenario-card">
        <h4>Aggressive</h4>
        <p>${safeCurrency(scenarios.aggressive)}</p>
      </article>
    </div>
    <p class="scenario-note">Model confidence score: ${Number(revenueForecast.confidenceScore) || 0}%</p>
  `;
}

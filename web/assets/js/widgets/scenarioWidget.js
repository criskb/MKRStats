const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export function mountScenarioWidget(container, revenueForecast) {
  container.innerHTML = `
    <div class="scenario-grid">
      <article class="scenario-card">
        <h4>Conservative</h4>
        <p>${usd.format(revenueForecast.scenarios.conservative)}</p>
      </article>
      <article class="scenario-card">
        <h4>Baseline</h4>
        <p>${usd.format(revenueForecast.scenarios.baseline)}</p>
      </article>
      <article class="scenario-card">
        <h4>Aggressive</h4>
        <p>${usd.format(revenueForecast.scenarios.aggressive)}</p>
      </article>
    </div>
    <p class="scenario-note">Model confidence score: ${revenueForecast.confidenceScore}%</p>
  `;
}

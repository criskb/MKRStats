function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function linearRegression(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function round2(value) {
  return Number(value.toFixed(2));
}

export function forecastNextDays(timeline, field, days = 14) {
  const normalizedDays = Number.isFinite(days) ? Math.max(7, Math.min(60, Math.floor(days))) : 14;

  const points = timeline
    .map((row, index) => ({ x: index, y: Number(row[field]) }))
    .filter((point) => Number.isFinite(point.y));

  const { slope, intercept } = linearRegression(points);

  const predictedHistory = points.map((point) => slope * point.x + intercept);
  const residuals = points.map((point, index) => point.y - predictedHistory[index]);
  const sigma = stdDev(residuals);

  const forecast = [];
  const start = points.length;

  for (let i = 0; i < normalizedDays; i += 1) {
    const y = Math.max(0, slope * (start + i) + intercept);
    forecast.push({
      dayOffset: i + 1,
      value: round2(y),
      lower90: round2(Math.max(0, y - 1.64 * sigma)),
      upper90: round2(y + 1.64 * sigma)
    });
  }

  const expectedTotal = round2(forecast.reduce((acc, row) => acc + row.value, 0));
  const baselineHistoryMean = round2(mean(points.map((point) => point.y)));
  const confidenceScore = round2(Math.max(0, Math.min(100, 100 - (sigma / Math.max(baselineHistoryMean, 1)) * 100)));

  return {
    method: 'linear_regression_with_residual_interval',
    field,
    days: normalizedDays,
    slope: Number(slope.toFixed(4)),
    residualStdDev: round2(sigma),
    confidenceScore,
    expectedTotal,
    forecast,
    scenarios: {
      baseline: expectedTotal,
      conservative: round2(expectedTotal * 0.85),
      aggressive: round2(expectedTotal * 1.2)
    }
  };
}

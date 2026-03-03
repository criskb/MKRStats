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

export function forecastNextDays(timeline, field, days = 14) {
  const points = timeline.map((row, index) => ({ x: index, y: row[field] }));
  const { slope, intercept } = linearRegression(points);

  const forecast = [];
  const start = timeline.length;

  for (let i = 0; i < days; i += 1) {
    const projected = Math.max(0, slope * (start + i) + intercept);
    forecast.push(Number(projected.toFixed(2)));
  }

  return {
    method: 'linear_regression',
    field,
    days,
    slope: Number(slope.toFixed(4)),
    forecast
  };
}

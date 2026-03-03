import { renderLineChart } from '../components/chart.js';

export function mountForecastWidget(container, timeline, forecast) {
  const canvas = document.createElement('canvas');
  canvas.style.height = '260px';
  container.append(canvas);

  const futureLabels = Array.from({ length: forecast.revenue.days }, (_, i) => `+${i + 1}`);
  const past = timeline.map((row) => row.revenue);
  const future = forecast.revenue.forecast;

  renderLineChart(canvas, [...timeline.map((d) => d.date.slice(5)), ...futureLabels], [
    {
      label: 'Actual Revenue',
      data: [...past, ...Array(future.length).fill(null)],
      borderColor: '#ffc857',
      backgroundColor: 'rgba(255, 200, 87, 0.2)',
      tension: 0.35
    },
    {
      label: 'Forecast Revenue',
      data: [...Array(past.length).fill(null), ...future],
      borderColor: '#ff7a90',
      backgroundColor: 'rgba(255, 122, 144, 0.2)',
      borderDash: [6, 6],
      tension: 0.35
    }
  ]);
}

import { renderLineChart } from '../components/chart.js';

export function mountForecastWidget(container, timeline = [], forecast = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.height = '260px';
  container.append(canvas);

  const values = forecast.revenue?.forecast ?? [];
  const futureLabels = values.map((row) => `+${row.dayOffset}`);
  const past = timeline.map((row) => Number(row.revenue) || 0);

  renderLineChart(canvas, [...timeline.map((d) => d.date.slice(5)), ...futureLabels], [
    {
      label: 'Actual Revenue',
      data: [...past, ...Array(values.length).fill(null)],
      borderColor: '#ffc857',
      backgroundColor: 'rgba(255, 200, 87, 0.2)',
      tension: 0.35
    },
    {
      label: 'Forecast Revenue',
      data: [...Array(past.length).fill(null), ...values.map((row) => row.value)],
      borderColor: '#ff7a90',
      backgroundColor: 'rgba(255, 122, 144, 0.2)',
      borderDash: [6, 6],
      tension: 0.35
    },
    {
      label: 'Forecast Lower 90%',
      data: [...Array(past.length).fill(null), ...values.map((row) => row.lower90)],
      borderColor: '#5c708f',
      borderDash: [3, 5],
      tension: 0.35
    },
    {
      label: 'Forecast Upper 90%',
      data: [...Array(past.length).fill(null), ...values.map((row) => row.upper90)],
      borderColor: '#5c708f',
      borderDash: [3, 5],
      tension: 0.35
    }
  ]);
}

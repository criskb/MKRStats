import { renderLineChart } from '../components/chart.js';

export function mountPerformanceChart(container, timeline) {
  const canvas = document.createElement('canvas');
  canvas.style.height = '320px';
  container.append(canvas);

  renderLineChart(
    canvas,
    timeline.map((row) => row.date.slice(5)),
    [
      {
        label: 'Downloads',
        data: timeline.map((row) => row.downloads),
        borderColor: '#49a0ff',
        backgroundColor: 'rgba(73, 160, 255, 0.2)',
        tension: 0.35
      },
      {
        label: 'Sales',
        data: timeline.map((row) => row.sales),
        borderColor: '#4dd39d',
        backgroundColor: 'rgba(77, 211, 157, 0.2)',
        tension: 0.35
      }
    ]
  );
}

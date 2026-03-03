import { renderLineChart } from '../components/chart.js';

export function mountPlatformRevenueWidget(container, platformSummaries) {
  const canvas = document.createElement('canvas');
  canvas.style.height = '240px';
  container.append(canvas);

  renderLineChart(canvas, platformSummaries.map((row) => row.name), [
    {
      label: 'Revenue by Platform (30d)',
      data: platformSummaries.map((row) => row.revenue),
      borderColor: '#8f7dff',
      backgroundColor: 'rgba(143, 125, 255, 0.25)',
      tension: 0.2
    }
  ]);
}

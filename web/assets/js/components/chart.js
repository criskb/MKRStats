export function renderLineChart(canvas, labels, datasets) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#c9d3e3' } }
      },
      scales: {
        x: { ticks: { color: '#9aa8bf' } },
        y: { ticks: { color: '#9aa8bf' } }
      }
    }
  });
}

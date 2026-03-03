import { renderLineChart } from '../components/chart.js';

const MODES = {
  commerce: {
    title: 'Downloads vs Sales',
    datasets: [
      {
        key: 'downloads',
        label: 'Downloads',
        borderColor: '#49a0ff',
        backgroundColor: 'rgba(73, 160, 255, 0.2)'
      },
      {
        key: 'sales',
        label: 'Sales',
        borderColor: '#4dd39d',
        backgroundColor: 'rgba(77, 211, 157, 0.2)'
      }
    ]
  },
  awareness: {
    title: 'Views vs Downloads',
    datasets: [
      {
        key: 'views',
        label: 'Views',
        borderColor: '#8f7dff',
        backgroundColor: 'rgba(143, 125, 255, 0.2)'
      },
      {
        key: 'downloads',
        label: 'Downloads',
        borderColor: '#49a0ff',
        backgroundColor: 'rgba(73, 160, 255, 0.2)'
      }
    ]
  },
  revenue: {
    title: 'Revenue Trend',
    datasets: [
      {
        key: 'revenue',
        label: 'Revenue',
        borderColor: '#ffc857',
        backgroundColor: 'rgba(255, 200, 87, 0.2)'
      }
    ]
  }
};

function datasetFromMode(mode, timeline) {
  return mode.datasets.map((dataset) => ({
    label: dataset.label,
    data: timeline.map((row) => row[dataset.key]),
    borderColor: dataset.borderColor,
    backgroundColor: dataset.backgroundColor,
    tension: 0.35
  }));
}

export function mountPerformanceChart(container, timeline = []) {
  const controls = document.createElement('div');
  controls.className = 'segmented-controls';

  controls.innerHTML = `
    <button data-mode="commerce" class="is-active">Commerce</button>
    <button data-mode="awareness">Awareness</button>
    <button data-mode="revenue">Revenue</button>
    <span class="segmented-label" id="trend-mode-label"></span>
  `;

  const canvas = document.createElement('canvas');
  canvas.style.height = '320px';
  container.append(controls, canvas);

  let currentMode = 'commerce';
  const labels = timeline.map((row) => row.date.slice(5));

  if (!timeline.length) {
    container.innerHTML = '<p>No trend data available for this scope yet.</p>';
    return;
  }

  const chart = renderLineChart(canvas, labels, datasetFromMode(MODES[currentMode], timeline));
  const modeLabel = controls.querySelector('#trend-mode-label');

  function setMode(nextMode) {
    currentMode = nextMode;
    const config = MODES[currentMode];
    modeLabel.textContent = config.title;

    chart.data.datasets = datasetFromMode(config, timeline);
    chart.update();

    controls.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === nextMode);
    });
  }

  controls.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const mode = target.dataset.mode;
    if (!mode || mode === currentMode) return;
    setMode(mode);
  });

  setMode(currentMode);
}

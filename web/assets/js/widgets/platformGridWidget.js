import { renderTable } from '../components/table.js';

export function mountPlatformGridWidget(container, platforms) {
  renderTable(
    container,
    ['Platform', 'Mode', 'Tracked Metrics', 'Connected'],
    platforms.map((platform) => [
      platform.name,
      `<span class="pill">${platform.integrationMode}</span>`,
      platform.metrics.join(', '),
      platform.snapshot.connected ? 'Yes' : 'No'
    ])
  );
}

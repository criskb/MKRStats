import { getExportUrl } from '../api/client.js';

export function mountControlsWidget(container, platforms, state, onApply) {
  const wrapper = document.createElement('form');
  wrapper.className = 'control-form';

  const platformOptions = [
    '<option value="all">All connected platforms</option>',
    ...platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`)
  ];

  wrapper.innerHTML = `
    <label class="control-field">
      <span>Platform Scope</span>
      <select name="platform">${platformOptions.join('')}</select>
    </label>
    <label class="control-field">
      <span>Forecast Horizon</span>
      <input name="horizon" type="number" min="7" max="60" step="1" value="${state.horizon}" />
    </label>
    <div class="control-actions">
      <button type="submit" class="button-primary">Apply Filters</button>
      <a class="button-secondary" id="export-link" href="${getExportUrl(state)}">Export CSV</a>
    </div>
  `;

  wrapper.platform.value = state.platform;

  const exportLink = wrapper.querySelector('#export-link');
  const syncExportLink = () => {
    const localState = {
      platform: wrapper.platform.value,
      horizon: Number(wrapper.horizon.value)
    };
    exportLink.setAttribute('href', getExportUrl(localState));
  };

  wrapper.platform.addEventListener('change', syncExportLink);
  wrapper.horizon.addEventListener('input', syncExportLink);

  wrapper.addEventListener('submit', (event) => {
    event.preventDefault();
    onApply({
      platform: wrapper.platform.value,
      horizon: Number(wrapper.horizon.value)
    });
  });

  container.append(wrapper);
}

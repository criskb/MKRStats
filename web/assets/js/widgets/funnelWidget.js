export function mountFunnelWidget(container, funnel) {
  const rows = [
    ['Views', funnel.views],
    ['Downloads', funnel.downloads],
    ['Sales', funnel.sales]
  ];

  const maxValue = Math.max(...rows.map((row) => row[1]), 1);
  const wrapper = document.createElement('div');
  wrapper.className = 'funnel';

  wrapper.innerHTML = rows
    .map(([label, value]) => {
      const width = Math.max(12, Math.round((value / maxValue) * 100));
      return `
        <div class="funnel__row">
          <div class="funnel__meta"><span>${label}</span><strong>${Number(value).toLocaleString()}</strong></div>
          <div class="funnel__bar"><span style="width:${width}%"></span></div>
        </div>
      `;
    })
    .join('');

  wrapper.insertAdjacentHTML(
    'beforeend',
    `<p class="funnel__rates">View→Download: ${funnel.viewToDownloadRate}% · Download→Sale: ${funnel.downloadToSaleRate}%</p>`
  );

  container.append(wrapper);
}

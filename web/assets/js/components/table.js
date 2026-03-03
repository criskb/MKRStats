export function renderTable(container, headers, rows) {
  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;

  const tbody = document.createElement('tbody');
  tbody.innerHTML = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');

  table.append(thead, tbody);
  container.append(table);
}

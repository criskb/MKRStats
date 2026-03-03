export function createWidget(title, columnClass = 'col-12') {
  const template = document.querySelector('#widget-template');
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(columnClass);
  node.querySelector('.widget__header').textContent = title;

  return {
    node,
    content: node.querySelector('.widget__content')
  };
}

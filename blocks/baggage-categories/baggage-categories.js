import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

function buildBreadcrumb(row) {
  const nav = document.createElement('nav');
  nav.className = 'baggage-categories-breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');

  const list = document.createElement('ol');
  row?.cells.forEach((cell) => {
    const item = document.createElement('li');
    moveCellContent(item, cell);
    list.append(item);
  });
  nav.append(list);
  return nav;
}

function buildCategory({ cells }, index) {
  const [imageCell, linkCell] = cells;
  const picture = requireElement(
    imageCell?.querySelector('picture'),
    `Baggage category row ${index + 1} requires an authored image`,
  );
  const link = requireElement(
    linkCell?.querySelector('a'),
    `Baggage category row ${index + 1} requires a link`,
  );

  const title = document.createElement('span');
  title.className = 'baggage-categories-title';
  title.append(...link.childNodes);

  const arrow = document.createElement('span');
  arrow.className = 'baggage-categories-arrow';
  arrow.setAttribute('aria-hidden', 'true');

  picture.classList.add('baggage-categories-picture');
  link.className = 'baggage-categories-link';
  link.replaceChildren(picture, title, arrow);

  const item = document.createElement('li');
  item.className = 'baggage-categories-item';
  item.append(link);
  return item;
}

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const header = document.createElement('div');
  header.className = 'baggage-categories-header';
  header.append(buildBreadcrumb(rowWithLabel(rows, 'breadcrumb')));

  const heading = document.createElement('div');
  heading.className = 'baggage-categories-heading';
  moveCellContent(heading, rowWithLabel(rows, 'heading')?.cells[0]);
  header.append(heading);

  const standfirst = document.createElement('div');
  standfirst.className = 'baggage-categories-standfirst';
  moveCellContent(standfirst, rowWithLabel(rows, 'standfirst')?.cells[0]);
  header.append(standfirst);

  const list = document.createElement('ul');
  rowsWithLabel(rows, 'category').forEach((row, index) => {
    list.append(buildCategory(row, index));
  });

  const panel = document.createElement('div');
  panel.className = 'baggage-categories-panel';
  panel.append(list);
  block.replaceChildren(header, panel);
}

import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

function buildAircraft({ cells }, index) {
  const [descriptionCell, linkCell] = cells;
  const link = requireElement(
    linkCell?.querySelector('a'),
    `Seat guide aircraft row ${index + 1} requires a PDF link`,
  );
  const item = document.createElement('li');
  const linkLine = document.createElement('p');
  const externalNote = document.createElement('span');

  externalNote.className = 'seat-guide-visually-hidden';
  externalNote.textContent = 'PDF file, opens in a new window.';
  link.className = 'seat-guide-pdf';
  link.rel = 'noopener';
  link.target = '_blank';
  link.append(externalNote);
  const description = descriptionCell?.querySelector(':scope > p:only-child')
    || descriptionCell;
  if (description) item.append(...description.childNodes);
  linkLine.append(link);
  item.append(linkLine);
  return item;
}

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const heading = requireElement(
    rowWithLabel(rows, 'heading')?.cells[0]?.querySelector('h2'),
    'Seat guide requires an authored h2',
  );
  const introCell = requireElement(
    rowWithLabel(rows, 'intro')?.cells[0],
    'Seat guide requires an authored introduction',
  );
  const authoredIntro = introCell.querySelector(':scope > p:only-child');
  const intro = authoredIntro || document.createElement('p');
  const list = document.createElement('ul');

  if (!authoredIntro) moveCellContent(intro, introCell);
  rowsWithLabel(rows, 'aircraft').forEach((row, index) => {
    list.append(buildAircraft(row, index));
  });
  block.replaceChildren(heading, intro, list);
}

import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const heading = document.createElement('div');
  heading.className = 'travel-benefits-heading';
  moveCellContent(heading, rowWithLabel(rows, 'heading')?.cells[0]);

  const list = document.createElement('ul');
  rowsWithLabel(rows, 'benefit').forEach(({ cells }, index) => {
    const [imageCell, contentCell] = cells;
    const picture = requireElement(
      imageCell?.querySelector('picture'),
      `Travel benefit row ${index + 1} requires an authored image`,
    );
    const link = requireElement(
      contentCell?.querySelector('a'),
      `Travel benefit row ${index + 1} requires a link`,
    );
    const linkParagraph = link.closest('p');
    const action = document.createElement('span');
    action.className = 'travel-benefits-action';
    action.textContent = link.textContent.trim();
    linkParagraph?.remove();

    const content = document.createElement('div');
    content.className = 'travel-benefits-content';
    moveCellContent(content, contentCell);
    content.append(action);

    link.className = 'travel-benefits-link';
    picture.classList.add('travel-benefits-picture');
    link.replaceChildren(picture, content);

    const item = document.createElement('li');
    item.className = 'travel-benefits-item';
    item.append(link);
    list.append(item);
  });

  block.replaceChildren(heading, list);
}

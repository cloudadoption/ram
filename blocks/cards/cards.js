import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
} from '../../scripts/homepage-blocks.js';

function decorateDefault(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
}

function decorateLoyaltyBenefits(block) {
  const list = document.createElement('ul');
  const benefitRows = rowsWithLabel(readLabeledRows(block), 'benefit');
  benefitRows.forEach(({ cells }, index) => {
    const [imageCell, headingCell, contentCell] = cells;
    const picture = requireElement(
      imageCell?.querySelector('picture'),
      `Loyalty benefit row ${index + 1} requires an authored image`,
    );
    const heading = requireElement(
      headingCell?.querySelector('h3'),
      `Loyalty benefit row ${index + 1} requires a heading`,
    );
    picture.className = 'cards-loyalty-picture';
    heading.className = 'cards-loyalty-heading';

    const content = document.createElement('div');
    content.className = 'cards-loyalty-content';
    content.append(heading);
    moveCellContent(content, contentCell);

    const item = document.createElement('li');
    item.className = 'cards-loyalty-item';
    item.append(picture, content);
    list.append(item);
  });
  block.dataset.benefitCount = String(benefitRows.length);
  block.replaceChildren(list);
}

export default function decorate(block) {
  if (block.classList.contains('loyalty-benefits')) {
    decorateLoyaltyBenefits(block);
    return;
  }
  decorateDefault(block);
}

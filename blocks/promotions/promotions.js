import { addCarouselControls } from '../../scripts/homepage-carousel.js';
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
  heading.className = 'promotions-heading';
  moveCellContent(heading, rowWithLabel(rows, 'heading')?.cells[0]);

  const list = document.createElement('ul');
  list.className = 'promotions-track';
  const items = rowsWithLabel(rows, 'promotion').map(({ cells }, index) => {
    const [desktopCell, mobileCell, linkCell] = cells;
    const desktopPicture = requireElement(
      desktopCell?.querySelector('picture'),
      `Promotion row ${index + 1} requires a desktop image`,
    );
    const mobilePicture = requireElement(
      mobileCell?.querySelector('picture'),
      `Promotion row ${index + 1} requires a mobile image`,
    );
    const link = requireElement(
      linkCell?.querySelector('a'),
      `Promotion row ${index + 1} requires a link`,
    );
    const action = document.createElement('span');
    action.className = 'promotions-action';
    action.textContent = link.textContent.trim();
    desktopPicture.classList.add('promotions-picture', 'is-desktop');
    mobilePicture.classList.add('promotions-picture', 'is-mobile');
    link.classList.add('promotions-link');
    link.replaceChildren(desktopPicture, mobilePicture, action);

    const item = document.createElement('li');
    item.className = 'promotions-item';
    item.append(link);
    list.append(item);
    return item;
  });

  const viewport = document.createElement('div');
  viewport.className = 'promotions-viewport';
  viewport.append(list);
  const controls = addCarouselControls(block, list, items, {
    indicators: true,
    label: 'Offers and updates',
  });
  if (controls) viewport.append(controls);

  block.replaceChildren(heading, viewport);
}

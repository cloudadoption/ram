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
  const headingRow = rowWithLabel(rows, 'heading');
  const seeAllRow = rowWithLabel(rows, 'see all');
  const destinationRows = rowsWithLabel(rows, 'destination');

  const heading = document.createElement('div');
  heading.className = 'destination-deals-heading';
  moveCellContent(heading, headingRow?.cells[0]);

  const seeAll = requireElement(
    seeAllRow?.cells[0]?.querySelector('a'),
    'Destination deals requires a See all link',
  );
  seeAll.classList.add('destination-deals-see-all');

  const list = document.createElement('ul');
  list.className = 'destination-deals-track';
  const items = destinationRows.map(({ cells }, index) => {
    const [imageCell, contentCell, linkCell] = cells;
    const picture = requireElement(
      imageCell?.querySelector('picture'),
      `Destination row ${index + 1} requires an authored image`,
    );
    const link = requireElement(
      linkCell?.querySelector('a'),
      `Destination row ${index + 1} requires a booking link`,
    );
    const title = requireElement(
      contentCell?.querySelector('h2, h3, h4'),
      `Destination row ${index + 1} requires a heading`,
    );

    const content = document.createElement('div');
    content.className = 'destination-deals-card-content';
    moveCellContent(content, contentCell);
    link.classList.add('destination-deals-book');
    content.append(link);

    const item = document.createElement('li');
    item.className = 'destination-deals-card';
    title.id = `destination-deal-${index + 1}`;
    item.setAttribute('aria-labelledby', title.id);
    picture.classList.add('destination-deals-picture');
    item.append(picture, content);
    list.append(item);
    return item;
  });

  const rail = document.createElement('div');
  rail.className = 'destination-deals-rail';
  rail.append(list);
  const controls = addCarouselControls(block, list, items, {
    label: 'Destination deals',
  });
  if (controls) rail.append(controls);

  const inner = document.createElement('div');
  inner.className = 'destination-deals-inner';
  inner.append(heading, rail, seeAll);
  block.replaceChildren(inner);
}

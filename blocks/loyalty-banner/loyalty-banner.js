import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const content = document.createElement('div');
  content.className = 'loyalty-banner-content';
  moveCellContent(content, rowWithLabel(rows, 'heading')?.cells[0]);

  const list = document.createElement('ul');
  rowsWithLabel(rows, 'benefit').forEach(({ cells }) => {
    const icon = document.createElement('span');
    icon.className = 'loyalty-banner-check';
    icon.setAttribute('aria-hidden', 'true');
    const item = document.createElement('li');
    item.append(icon);
    moveCellContent(item, cells[0]);
    list.append(item);
  });
  content.append(list);

  const cta = requireElement(
    rowWithLabel(rows, 'cta')?.cells[0]?.querySelector('a'),
    'Loyalty banner requires a CTA link',
  );
  cta.classList.add('loyalty-banner-cta');

  const picture = requireElement(
    rowWithLabel(rows, 'image')?.cells[0]?.querySelector('picture'),
    'Loyalty banner requires an authored image',
  );
  picture.classList.add('loyalty-banner-picture');

  const media = document.createElement('div');
  media.className = 'loyalty-banner-media';
  media.append(picture);
  block.replaceChildren(content, media, cta);
}

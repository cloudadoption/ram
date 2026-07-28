import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const card = document.createElement('div');
  card.className = 'app-promo-card';

  const content = document.createElement('div');
  content.className = 'app-promo-content';
  moveCellContent(content, rowWithLabel(rows, 'heading')?.cells[0]);

  const stores = document.createElement('div');
  stores.className = 'app-promo-stores';
  rowsWithLabel(rows, 'store link').forEach(({ cells }, index) => {
    const link = requireElement(
      cells[0]?.querySelector('a'),
      `App promo store row ${index + 1} requires a linked badge`,
    );
    stores.append(link);
  });
  content.append(stores);

  const qr = requireElement(
    rowWithLabel(rows, 'qr')?.cells[0]?.querySelector('picture'),
    'App promo requires an authored QR image',
  );
  qr.classList.add('app-promo-qr');
  content.append(qr);

  const phone = requireElement(
    rowWithLabel(rows, 'phone')?.cells[0]?.querySelector('picture'),
    'App promo requires an authored phone image',
  );
  phone.classList.add('app-promo-phone');
  card.append(content, phone);

  const campaign = requireElement(
    rowWithLabel(rows, 'campaign')?.cells[0]?.querySelector('picture'),
    'App promo requires an authored campaign image',
  );
  campaign.classList.add('app-promo-campaign');
  block.replaceChildren(card, campaign);
}

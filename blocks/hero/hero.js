import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

function createElement(tagName, className) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function prepareHomepagePicture(cell, variant, eager = true) {
  const picture = cell?.querySelector('picture');
  const image = picture?.querySelector('img');

  if (!picture || !image) {
    throw new Error(`Homepage hero requires an authored ${variant} image`);
  }

  picture.classList.add('hero-homepage-picture', `is-${variant}`);
  image.decoding = 'async';
  image.fetchPriority = eager ? 'high' : 'auto';
  image.loading = eager ? 'eager' : 'lazy';
  return picture;
}

function decorateHomepage(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const pictureCells = cells.filter((cell) => cell.querySelector('picture'));
  const copyCell = cells.find((cell) => cell.querySelector('h1, h2, h3'));
  const [desktopCell, mobileCell] = pictureCells;
  const heading = copyCell?.querySelector('h1, h2, h3');
  const subtitle = [...(copyCell?.querySelectorAll('p') || [])]
    .find((paragraph) => !paragraph.querySelector('a'));
  const cta = copyCell?.querySelector('a[href]');

  if (!desktopCell || !mobileCell || !heading || !subtitle || !cta) {
    throw new Error('Homepage hero requires two authored images, a heading, subtitle, and CTA');
  }

  const desktop = window.matchMedia('(min-width: 1200px)').matches;
  const desktopPicture = prepareHomepagePicture(desktopCell, 'desktop', desktop);
  const mobilePicture = prepareHomepagePicture(mobileCell, 'mobile', !desktop);
  const media = createElement('div', 'hero-homepage-media');
  const copy = createElement('div', 'hero-homepage-copy');

  heading.className = 'hero-homepage-title';
  subtitle.className = 'hero-homepage-subtitle';
  cta.className = 'hero-homepage-cta';
  cta.removeAttribute('title');
  copy.append(heading, subtitle, cta);
  media.append(
    ...(desktop ? [desktopPicture, mobilePicture] : [mobilePicture, desktopPicture]),
    copy,
  );
  block.replaceChildren(media);
}

function buildInteriorBreadcrumb(row) {
  const nav = createElement('nav', 'hero-interior-breadcrumb');
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

function decorateInterior(block) {
  const rows = readLabeledRows(block);
  const heading = requireElement(
    rowWithLabel(rows, 'heading')?.cells[0]?.querySelector('h1'),
    'Interior hero requires an authored h1',
  );
  const picture = requireElement(
    rowWithLabel(rows, 'image')?.cells[0]?.querySelector('picture'),
    'Interior hero requires an authored image',
  );
  const image = requireElement(
    picture.querySelector('img'),
    'Interior hero picture requires an image',
  );

  const content = createElement('div', 'hero-interior-content');
  content.append(
    buildInteriorBreadcrumb(rowWithLabel(rows, 'breadcrumb')),
    heading,
  );

  picture.className = 'hero-interior-picture';
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.loading = 'eager';
  block.replaceChildren(content, picture);
}

function decorateLoyaltyTier(block) {
  const rows = readLabeledRows(block);
  const breadcrumbRow = rowWithLabel(rows, 'breadcrumb');
  const heading = rowWithLabel(rows, 'heading')?.cells[0]?.querySelector('h1');
  const picture = requireElement(
    rowWithLabel(rows, 'image')?.cells[0]?.querySelector('picture'),
    'Loyalty tier hero requires an authored image',
  );
  const image = requireElement(
    picture.querySelector('img'),
    'Loyalty tier hero picture requires an image',
  );
  picture.className = 'hero-loyalty-tier-picture';
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.loading = 'eager';

  const content = document.createElement('div');
  content.className = 'hero-loyalty-tier-content';
  if (breadcrumbRow?.cells.length) {
    const nav = document.createElement('nav');
    nav.className = 'hero-loyalty-tier-breadcrumb';
    nav.setAttribute('aria-label', 'Breadcrumb');
    const list = document.createElement('ol');
    breadcrumbRow.cells.forEach((cell) => {
      const item = document.createElement('li');
      moveCellContent(item, cell);
      list.append(item);
    });
    nav.append(list);
    content.append(nav);
  }
  if (heading) content.append(heading);

  const children = content.childElementCount ? [content, picture] : [picture];
  block.classList.toggle('has-page-heading', content.childElementCount > 0);
  block.replaceChildren(...children);
}

/**
 * Decorates hero variants.
 * @param {Element} block Hero block
 */
export default function decorate(block) {
  if (block.classList.contains('homepage')) decorateHomepage(block);
  if (block.classList.contains('interior')) decorateInterior(block);
  if (block.classList.contains('loyalty-tier')) decorateLoyaltyTier(block);
}

import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

function decorateLoyaltyContent(block) {
  const row = rowWithLabel(readLabeledRows(block), 'feature');
  const picture = requireElement(
    row?.cells[0]?.querySelector('picture'),
    'Loyalty content requires an authored image',
  );
  picture.className = 'columns-loyalty-picture';

  const media = document.createElement('div');
  media.className = 'columns-loyalty-media';
  media.append(picture);

  const copy = document.createElement('div');
  copy.className = 'columns-loyalty-copy';
  moveCellContent(copy, row.cells[1]);

  const layout = document.createElement('div');
  layout.className = 'columns-loyalty-layout';
  layout.append(media, copy);
  block.replaceChildren(layout);
}

function decorateLoyaltySingleCell(block, label) {
  const cell = rowWithLabel(readLabeledRows(block), label)?.cells[0];
  const content = document.createElement('div');
  content.className = 'columns-loyalty-copy';
  moveCellContent(content, cell);
  block.replaceChildren(content);
}

function decorateLoyaltyStatus(block) {
  const row = requireElement(
    rowWithLabel(readLabeledRows(block), 'status'),
    'Loyalty status requires an authored status row',
  );
  const picture = requireElement(
    row.cells[0]?.querySelector('picture'),
    'Loyalty status requires an authored image',
  );
  const link = requireElement(
    row.cells[1]?.querySelector('a'),
    'Loyalty status requires an authored link',
  );
  picture.className = 'columns-loyalty-status-picture';
  link.className = 'columns-loyalty-status-link';
  link.replaceChildren(picture);
  block.replaceChildren(link);
}

export default function decorate(block) {
  if (block.classList.contains('loyalty-content')) {
    decorateLoyaltyContent(block);
    return;
  }
  if (block.classList.contains('loyalty-status')) {
    decorateLoyaltyStatus(block);
    return;
  }
  if (block.classList.contains('loyalty-standfirst')) {
    decorateLoyaltySingleCell(block, 'standfirst');
    return;
  }
  if (block.classList.contains('loyalty-presentation')) {
    decorateLoyaltySingleCell(block, 'content');
    return;
  }
  if (block.classList.contains('loyalty-cta')) {
    decorateLoyaltySingleCell(block, 'action');
    return;
  }
  if (
    block.classList.contains('loyalty-intro')
    || block.classList.contains('loyalty-heading')
    || block.classList.contains('loyalty-footnote')
  ) {
    decorateLoyaltySingleCell(block, 'content');
    return;
  }

  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
}

import createBaggageIcon from '../../scripts/baggage-icons.js';
import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

function buildSupportLink({ cells }, index) {
  const [iconCell, titleCell, descriptionCell] = cells;
  const link = requireElement(
    titleCell?.querySelector('a'),
    `Baggage support row ${index + 1} requires a link`,
  );
  const iconName = iconCell?.textContent.trim().toLowerCase() || '';

  const icon = document.createElement('span');
  icon.className = 'baggage-support-icon';
  icon.append(createBaggageIcon(iconName));

  const title = document.createElement('strong');
  title.append(...link.childNodes);
  const description = document.createElement('span');
  description.className = 'baggage-support-description';
  description.textContent = descriptionCell?.textContent.trim() || '';
  const content = document.createElement('span');
  content.className = 'baggage-support-content';
  content.append(title, description);

  const arrow = document.createElement('span');
  arrow.className = 'baggage-support-arrow';
  arrow.setAttribute('aria-hidden', 'true');

  link.className = 'baggage-support-link';
  link.replaceChildren(icon, content, arrow);

  const item = document.createElement('li');
  item.append(link);
  return item;
}

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const heading = document.createElement('div');
  heading.className = 'baggage-support-heading';
  moveCellContent(heading, rowWithLabel(rows, 'heading')?.cells[0]);

  const list = document.createElement('ul');
  rowsWithLabel(rows, 'support').forEach((row, index) => {
    list.append(buildSupportLink(row, index));
  });

  block.replaceChildren(heading, list);
}

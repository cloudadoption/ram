import createBaggageIcon from '../../scripts/baggage-icons.js';
import {
  moveCellContent,
  readLabeledRows,
  rowsWithLabel,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

function buildRestriction({ cells }) {
  const [iconCell, contentCell] = cells;
  const iconName = iconCell?.textContent.trim().toLowerCase() || '';
  const icon = document.createElement('span');
  icon.className = 'restricted-items-icon';
  icon.append(createBaggageIcon(iconName));

  const content = document.createElement('div');
  content.className = 'restricted-items-content';
  moveCellContent(content, contentCell);

  const item = document.createElement('li');
  item.append(icon, content);
  return item;
}

export default function decorate(block) {
  const rows = readLabeledRows(block);
  const heading = document.createElement('div');
  heading.className = 'restricted-items-heading';
  moveCellContent(heading, rowWithLabel(rows, 'heading')?.cells[0]);

  const list = document.createElement('ul');
  rowsWithLabel(rows, 'restriction').forEach((row) => {
    list.append(buildRestriction(row));
  });

  const guidance = document.createElement('aside');
  guidance.className = 'restricted-items-guidance';
  moveCellContent(guidance, rowWithLabel(rows, 'guidance')?.cells[0]);

  block.replaceChildren(heading, list, guidance);
}

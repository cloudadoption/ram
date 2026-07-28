import {
  readLabeledRows,
  requireElement,
  rowsWithLabel,
} from '../../scripts/homepage-blocks.js';

export default function decorate(block) {
  const list = document.createElement('ul');

  rowsWithLabel(readLabeledRows(block), 'link').forEach(({ cells }, index) => {
    const [iconCell, linkCell] = cells;
    const link = requireElement(
      linkCell?.querySelector('a'),
      `Quick links row ${index + 1} requires a link`,
    );
    const iconName = iconCell?.textContent.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || '';
    const icon = document.createElement('span');
    icon.className = `quick-links-icon is-${iconName}`;
    icon.setAttribute('aria-hidden', 'true');
    link.classList.add('quick-links-link');
    link.prepend(icon);

    const item = document.createElement('li');
    item.className = 'quick-links-item';
    item.append(link);
    list.append(item);
  });

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Quick links');
  nav.append(list);
  block.replaceChildren(nav);
}

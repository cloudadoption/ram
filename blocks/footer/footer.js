import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const SECTION_DEFINITIONS = {
  navigation: {
    className: 'footer-navigation',
    label: 'Footer navigation',
    errorLabel: 'Navigation',
  },
  search: {
    className: 'footer-search',
    label: 'Footer search',
    errorLabel: 'Search',
  },
  payments: {
    className: 'footer-payments',
    label: 'Payment Methods',
    errorLabel: 'Payment methods',
  },
  social: {
    className: 'footer-social',
    label: 'Follow us on',
    errorLabel: 'Social',
  },
  legal: {
    className: 'footer-legal',
    label: 'Footer legal',
    errorLabel: 'Legal',
  },
};

const SOCIAL_ICON_CLASSES = {
  facebook: 'facebook',
  x: 'x',
  instagram: 'instagram',
  youtube: 'youtube',
  messenger: 'facebook-msn',
};

/**
 * Finds the required authored footer sections after they have been labeled.
 * @param {Element[]} sections Footer fragment sections
 * @returns {Object<string, Element>} Footer sections by role
 */
export function classifyFooterSections(sections) {
  return Object.fromEntries(Object.entries(SECTION_DEFINITIONS).map(([key, definition]) => {
    const section = sections.find((candidate) => (
      candidate.classList.contains(definition.className)
    ));
    if (!section) throw new Error(`Missing footer section: ${definition.errorLabel}`);
    return [key, section];
  }));
}

/**
 * Opens at most one footer navigation group.
 * @param {Object<string, {button: Element, panel: Element}>} groups Footer groups
 * @param {string} activeKey Group to open
 */
export function setActiveFooterGroup(groups, activeKey) {
  Object.entries(groups).forEach(([key, { button, panel }]) => {
    const isOpen = key === activeKey;
    button.setAttribute('aria-expanded', String(isOpen));
    panel.classList.toggle('is-open', isOpen);
    panel.hidden = !isOpen;
  });
}

function labelFooterSections(sections) {
  sections.forEach((section) => {
    const heading = section.querySelector('h2');
    const definition = Object.values(SECTION_DEFINITIONS).find(
      ({ label }) => heading?.textContent.trim() === label,
    );
    if (definition) section.classList.add(definition.className);
  });
}

function createGroupButton(label, key) {
  const button = document.createElement('button');
  button.className = 'footer-group-trigger';
  button.type = 'button';
  button.id = `footer-group-${key}`;
  button.setAttribute('aria-controls', `footer-panel-${key}`);
  button.setAttribute('aria-expanded', 'false');

  const text = document.createElement('span');
  text.textContent = label;
  button.append(text);
  return button;
}

function createDestinationColumns(panel) {
  const columns = [];
  [...panel.children].forEach((child) => {
    if (child.tagName === 'H4') {
      const column = document.createElement('div');
      columns.push(column);
    }
    columns[columns.length - 1]?.append(child);
  });
  panel.replaceChildren(...columns);
}

function decorateNavigation(section) {
  const sectionHeading = section.querySelector('h2');
  sectionHeading.className = 'footer-visually-hidden';

  const nav = document.createElement('nav');
  nav.className = 'footer-nav';
  nav.setAttribute('aria-labelledby', 'footer-navigation-heading');
  sectionHeading.id = 'footer-navigation-heading';

  const groups = {};
  section.querySelectorAll('h3').forEach((heading) => {
    const key = heading.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    const group = document.createElement('div');
    group.className = 'footer-group';
    group.dataset.footerGroup = key;

    const button = createGroupButton(heading.textContent.trim(), key);
    const panel = document.createElement('div');
    panel.className = 'footer-group-panel';
    panel.id = `footer-panel-${key}`;
    panel.setAttribute('aria-labelledby', button.id);
    if (key === 'destinations') panel.classList.add('footer-group-panel-destinations');
    const content = [];
    let sibling = heading.nextElementSibling;
    while (sibling && sibling.tagName !== 'H3') {
      content.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    panel.append(...content);
    if (key === 'destinations') createDestinationColumns(panel);

    groups[key] = { button, panel };
    group.append(button, panel);
    nav.append(group);
  });

  setActiveFooterGroup(groups);
  Object.entries(groups).forEach(([key, { button }]) => {
    button.addEventListener('click', () => {
      const activeKey = button.getAttribute('aria-expanded') === 'true' ? undefined : key;
      setActiveFooterGroup(groups, activeKey);
    });
  });
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setActiveFooterGroup(groups);
  });

  section.replaceChildren(sectionHeading, nav);
}

/**
 * Configures the search input while keeping its visible label until text is entered.
 * @param {HTMLInputElement} input Search input
 */
export function configureFooterSearchInput(input) {
  input.id = 'footer-search-input';
  input.name = 'q';
  input.type = 'search';
  input.placeholder = ' ';
}

function decorateSearch(section) {
  const link = section.querySelector('a[href]');
  if (!link) throw new Error('Missing footer search target');

  const form = document.createElement('form');
  form.className = 'footer-search-form';
  form.action = link.getAttribute('href');
  form.method = 'get';
  form.setAttribute('role', 'search');

  const label = document.createElement('label');
  label.className = 'footer-search-label';
  label.htmlFor = 'footer-search-input';
  label.textContent = link.textContent.trim();

  const input = document.createElement('input');
  configureFooterSearchInput(input);

  const button = document.createElement('button');
  button.className = 'footer-search-button';
  button.type = 'submit';
  button.setAttribute('aria-label', 'Execute search');

  const icon = document.createElement('span');
  icon.className = 'footer-icon footer-icon-search';
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  form.append(label, input, button);
  section.replaceChildren(form);
}

function decoratePayments(section) {
  const heading = section.querySelector('h2');
  const list = section.querySelector('ul');
  if (!heading || !list) throw new Error('Missing footer payment content');

  heading.className = 'footer-section-heading';
  list.className = 'footer-payment-list';
  list.querySelectorAll('li').forEach((item) => {
    const link = item.querySelector('a[href]');
    if (!link) throw new Error('Missing footer payment asset');

    const label = link.textContent.trim();
    const mark = document.createElement('span');
    mark.className = 'footer-payment-mark';
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', label);

    const image = document.createElement('img');
    image.src = link.getAttribute('href');
    image.alt = '';
    image.loading = 'lazy';
    mark.append(image);
    item.className = 'footer-payment-item';
    link.replaceWith(mark);
  });
  section.replaceChildren(heading, list);
}

function decorateSocial(section) {
  const heading = section.querySelector('h2');
  const list = section.querySelector('ul');
  if (!heading || !list) throw new Error('Missing footer social content');

  heading.className = 'footer-section-heading';
  list.className = 'footer-social-list';
  list.querySelectorAll('a[href]').forEach((link) => {
    const label = link.textContent.trim();
    const iconClass = SOCIAL_ICON_CLASSES[label.toLowerCase()];
    if (!iconClass) throw new Error(`Unsupported footer social link: ${label}`);

    link.className = 'footer-social-link';
    link.setAttribute('aria-label', label);
    link.title = link.href;

    const icon = document.createElement('span');
    icon.className = `footer-icon footer-icon-${iconClass}`;
    icon.setAttribute('aria-hidden', 'true');
    link.replaceChildren(icon);
  });
  section.replaceChildren(heading, list);
}

function decorateLegal(section) {
  const heading = section.querySelector('h2');
  const list = section.querySelector('ul');
  const copyright = section.querySelector('p');
  if (!heading || !list || !copyright) throw new Error('Missing footer legal content');

  heading.className = 'footer-visually-hidden';
  list.className = 'footer-legal-list';
  list.querySelectorAll('a[href]').forEach((link) => link.classList.add('footer-legal-link'));
  copyright.className = 'footer-copyright';
  section.replaceChildren(heading, list, copyright);
}

/**
 * Loads and decorates the footer.
 * @param {Element} block Footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);
  if (!fragment) throw new Error(`Unable to load footer fragment: ${footerPath}`);

  const fragmentSections = [...fragment.querySelectorAll(':scope > .section')];
  labelFooterSections(fragmentSections);
  const sections = classifyFooterSections(fragmentSections);

  decorateNavigation(sections.navigation);
  decorateSearch(sections.search);
  decoratePayments(sections.payments);
  decorateSocial(sections.social);
  decorateLegal(sections.legal);

  const shell = document.createElement('div');
  shell.className = 'footer-shell';

  const top = document.createElement('div');
  top.className = 'footer-top';
  top.append(sections.search, sections.navigation);

  const middle = document.createElement('div');
  middle.className = 'footer-middle';
  middle.append(sections.payments, sections.social);

  shell.append(top, middle, sections.legal);
  block.replaceChildren(shell);
}

import { getMetadata } from '../../scripts/aem.js';

const HEADER_SECTIONS = [
  { key: 'alert', label: 'Alert', required: false },
  { key: 'brand', label: 'Brand', required: true },
  { key: 'primary', label: 'Primary navigation', required: true },
  { key: 'utility', label: 'Utility navigation', required: true },
];

const getSectionHeading = (section) => section.querySelector('h2, h3');

/**
 * Classifies authored nav sections by heading instead of document position.
 * @param {Element[]} sections authored nav sections
 * @returns {Object<string, Element>} classified sections
 */
export function classifyHeaderSections(sections) {
  const classified = {};

  sections.forEach((section) => {
    const heading = getSectionHeading(section);
    const label = heading?.textContent.trim().toLowerCase();
    const definition = HEADER_SECTIONS.find(
      ({ label: sectionLabel }) => sectionLabel.toLowerCase() === label,
    );
    if (definition) classified[definition.key] = section;
  });

  HEADER_SECTIONS.filter(({ required }) => required).forEach(({ key, label }) => {
    if (!classified[key]) throw new Error(`Missing header section: ${label}`);
  });

  return classified;
}

function resolveMediaPaths(section, navPath) {
  const navURL = new URL(navPath, window.location);

  [
    ['img[src^="./"]', 'src'],
    ['source[srcset^="./"]', 'srcset'],
  ].forEach(([selector, attribute]) => {
    section.querySelectorAll(selector).forEach((element) => {
      element.setAttribute(
        attribute,
        new URL(element.getAttribute(attribute), navURL).href,
      );
    });
  });
}

function buildRegion(section, tagName, className) {
  const heading = getSectionHeading(section);
  const region = document.createElement(tagName);
  region.className = className;
  if (tagName === 'nav') region.setAttribute('aria-label', heading.textContent.trim());
  heading.remove();
  region.append(...section.childNodes);
  return region;
}

async function loadNavSections(navPath) {
  const response = await fetch(`${navPath}.plain.html`);
  if (!response.ok) {
    throw new Error(`Unable to load navigation from ${navPath}: ${response.status}`);
  }

  const navDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
  const sections = classifyHeaderSections([...navDocument.body.children]);
  Object.values(sections).forEach((section) => resolveMediaPaths(section, navPath));
  return sections;
}

/**
 * Loads and decorates the site header.
 * @param {Element} block header block
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const sections = await loadNavSections(navPath);

  const shell = document.createElement('div');
  shell.className = 'header-shell';

  if (sections.alert) {
    shell.append(buildRegion(sections.alert, 'div', 'nav-alert'));
  }

  const headerBar = document.createElement('div');
  headerBar.className = 'header-bar';

  const brand = buildRegion(sections.brand, 'div', 'nav-brand');
  brand.setAttribute('aria-label', 'Brand');
  brand.querySelectorAll('img').forEach((image) => {
    image.loading = 'eager';
  });

  const primary = buildRegion(sections.primary, 'nav', 'nav-primary');
  const utility = buildRegion(sections.utility, 'nav', 'nav-utility');
  headerBar.append(brand, primary, utility);
  shell.append(headerBar);

  block.replaceChildren(shell);
}

import { getMetadata } from '../../scripts/aem.js';

const HEADER_SECTIONS = [
  { key: 'alert', label: 'Alert', required: false },
  { key: 'brand', label: 'Brand', required: true },
  { key: 'primary', label: 'Primary navigation', required: true },
  { key: 'utility', label: 'Utility navigation', required: true },
];

const HEADER_PANELS = [
  { key: 'book', label: 'Book' },
  { key: 'explore', label: 'Explore' },
  { key: 'experience', label: 'Experience' },
  { key: 'information', label: 'Information' },
  { key: 'safar-flyer', label: 'Safar Flyer' },
];

const getSectionHeading = (section) => section.querySelector('h2, h3');

/**
 * Classifies authored nav sections by heading instead of document position.
 * @param {Element[]} sections authored nav sections
 * @returns {Object<string, Element>} classified sections
 */
export function classifyHeaderSections(sections) {
  const classified = {};
  const panels = {};

  sections.forEach((section) => {
    const heading = getSectionHeading(section);
    const label = heading?.textContent.trim().toLowerCase();
    const definition = HEADER_SECTIONS.find(
      ({ label: sectionLabel }) => sectionLabel.toLowerCase() === label,
    );
    if (definition) {
      classified[definition.key] = section;
      return;
    }

    const panel = HEADER_PANELS.find(
      ({ label: panelLabel }) => `${panelLabel.toLowerCase()} panel` === label,
    );
    if (panel) panels[panel.key] = section;
  });

  HEADER_SECTIONS.filter(({ required }) => required).forEach(({ key, label }) => {
    if (!classified[key]) throw new Error(`Missing header section: ${label}`);
  });
  HEADER_PANELS.forEach(({ key, label }) => {
    if (!panels[key]) throw new Error(`Missing header panel: ${label}`);
  });

  return { ...classified, panels };
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
  Object.entries(sections)
    .filter(([key]) => key !== 'panels')
    .forEach(([, section]) => resolveMediaPaths(section, navPath));
  Object.values(sections.panels).forEach((section) => resolveMediaPaths(section, navPath));
  return sections;
}

function buildPanel(section, key, label) {
  const heading = getSectionHeading(section);
  const panel = document.createElement('div');
  panel.className = `nav-panel nav-panel-${key}`;
  panel.id = `nav-panel-${key}`;
  panel.setAttribute('aria-label', label);
  panel.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('div');
  inner.className = 'nav-panel-inner';
  heading.remove();
  inner.append(...section.childNodes);
  panel.append(inner);
  return panel;
}

/**
 * Opens one panel and synchronizes the primary navigation trigger state.
 * @param {Object<string, Element>} triggers panel triggers by key
 * @param {Object<string, Element>} panels panel elements by key
 * @param {string} activeKey panel to open
 */
export function setActivePanel(triggers, panels, activeKey) {
  Object.entries(panels).forEach(([key, panel]) => {
    const isActive = key === activeKey;
    panel.classList.toggle('is-open', isActive);
    panel.setAttribute('aria-hidden', String(!isActive));
    triggers[key].setAttribute('aria-expanded', String(isActive));
  });
}

/**
 * Synchronizes the mobile drawer and its trigger.
 * @param {Element} drawer mobile drawer
 * @param {Element} trigger drawer toggle
 * @param {boolean} isOpen whether the drawer is open
 */
export function setDrawerState(drawer, trigger, isOpen) {
  drawer.classList.toggle('is-open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  trigger.setAttribute('aria-expanded', String(isOpen));
}

function buildDesktopPanels(shell, primary, panelSections) {
  const panelContainer = document.createElement('div');
  panelContainer.className = 'nav-panels';
  const panels = Object.fromEntries(HEADER_PANELS.map(({ key, label }) => {
    const panel = buildPanel(panelSections[key], key, label);
    panelContainer.append(panel);
    return [key, panel];
  }));
  const triggers = {};
  const desktop = window.matchMedia('(min-width: 1200px)');

  primary.querySelectorAll(':scope > ul > li > a').forEach((trigger) => {
    const definition = HEADER_PANELS.find(
      ({ label }) => label.toLowerCase() === trigger.textContent.trim().toLowerCase(),
    );
    if (!definition) {
      throw new Error(`Missing header panel definition: ${trigger.textContent.trim()}`);
    }

    const { key } = definition;
    triggers[key] = trigger;
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panels[key].id);
    trigger.addEventListener('mouseenter', () => {
      if (desktop.matches) setActivePanel(triggers, panels, key);
    });
    trigger.addEventListener('focus', () => {
      if (desktop.matches) setActivePanel(triggers, panels, key);
    });
    trigger.addEventListener('click', (event) => {
      if (!desktop.matches) return;
      event.preventDefault();
      setActivePanel(triggers, panels, key);
    });
  });

  shell.addEventListener('mouseleave', () => {
    if (desktop.matches) setActivePanel(triggers, panels);
  });
  shell.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setActivePanel(triggers, panels);
    }
  });
  document.addEventListener('click', (event) => {
    if (!shell.contains(event.target)) setActivePanel(triggers, panels);
  });

  return panelContainer;
}

function buildMobileDrawer(primary, utility, brand, desktopPanels) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-drawer-toggle';
  toggle.setAttribute('aria-controls', 'nav-drawer');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.textContent = 'Menu';

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'nav-drawer';
  drawer.setAttribute('aria-hidden', 'true');

  const drawerHeader = document.createElement('div');
  drawerHeader.className = 'nav-drawer-header';
  const drawerBrand = brand.querySelector('a:first-child').cloneNode(true);
  drawerBrand.className = 'nav-drawer-brand';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'nav-drawer-close';
  close.setAttribute('aria-label', 'Close menu');
  close.textContent = 'Close';
  drawerHeader.append(drawerBrand, close);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'nav-drawer-search-wrap';
  const search = utility.querySelector('li:first-child a').cloneNode(true);
  search.className = 'nav-drawer-search';
  searchWrap.append(search);

  const mobilePrimary = primary.cloneNode(true);
  mobilePrimary.className = 'nav-primary nav-primary-drawer';
  mobilePrimary.setAttribute('aria-label', 'Mobile primary navigation');

  const mobileUtility = document.createElement('nav');
  mobileUtility.className = 'nav-drawer-utility';
  mobileUtility.setAttribute('aria-label', 'Mobile utility navigation');
  const utilityList = utility.querySelector('ul').cloneNode(true);
  utilityList.querySelector('li:first-child').remove();
  mobileUtility.append(utilityList);

  const panelContainer = document.createElement('div');
  panelContainer.className = 'nav-drawer-panels';
  const panels = {};
  const triggers = {};

  HEADER_PANELS.forEach(({ key, label }) => {
    const source = desktopPanels.querySelector(`.nav-panel-${key}`);
    const panel = source.cloneNode(true);
    panel.className = `nav-drawer-panel nav-drawer-panel-${key}`;
    panel.id = `nav-drawer-panel-${key}`;
    panel.setAttribute('aria-hidden', 'true');

    const panelHeader = document.createElement('div');
    panelHeader.className = 'nav-drawer-panel-header';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'nav-drawer-back';
    back.setAttribute('aria-label', `Back from ${label}`);
    back.textContent = 'Back';
    const title = document.createElement('span');
    title.textContent = label;
    const panelClose = close.cloneNode(true);
    panelHeader.append(back, title, panelClose);
    panel.prepend(panelHeader);

    back.addEventListener('click', () => setActivePanel(triggers, panels));
    panelClose.addEventListener('click', () => {
      setActivePanel(triggers, panels);
      setDrawerState(drawer, toggle, false);
    });
    panels[key] = panel;
    panelContainer.append(panel);
  });

  mobilePrimary.querySelectorAll(':scope > ul > li > a').forEach((trigger) => {
    const definition = HEADER_PANELS.find(
      ({ label }) => label.toLowerCase() === trigger.textContent.trim().toLowerCase(),
    );
    if (!definition) {
      throw new Error(`Missing mobile header panel definition: ${trigger.textContent.trim()}`);
    }

    const { key } = definition;
    triggers[key] = trigger;
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panels[key].id);
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      setActivePanel(triggers, panels, key);
    });
  });

  const closeDrawer = () => {
    setActivePanel(triggers, panels);
    setDrawerState(drawer, toggle, false);
  };
  toggle.addEventListener('click', () => {
    setDrawerState(drawer, toggle, toggle.getAttribute('aria-expanded') !== 'true');
  });
  close.addEventListener('click', closeDrawer);
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 1200px)').addEventListener('change', ({ matches }) => {
    if (matches) closeDrawer();
  });

  drawer.append(drawerHeader, searchWrap, mobilePrimary, mobileUtility, panelContainer);
  return { drawer, toggle };
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
  const desktopPanels = buildDesktopPanels(shell, primary, sections.panels);
  const mobileDrawer = buildMobileDrawer(primary, utility, brand, desktopPanels);
  headerBar.append(brand, primary, utility, mobileDrawer.toggle);
  shell.append(headerBar, desktopPanels, mobileDrawer.drawer);

  block.replaceChildren(shell);
}

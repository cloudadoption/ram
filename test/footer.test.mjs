import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  document: {},
  URL,
  window: {},
});

const source = await readFile(
  new URL('../blocks/footer/footer.js', import.meta.url),
  'utf8',
);
const footerModule = new vm.SourceTextModule(source, { context });
await footerModule.link(async (specifier) => {
  if (specifier.endsWith('/scripts/aem.js')) {
    return new vm.SyntheticModule(
      ['getMetadata'],
      function setAemExports() {
        this.setExport('getMetadata', () => '');
      },
      { context },
    );
  }

  return new vm.SyntheticModule(
    ['loadFragment'],
    function setFragmentExports() {
      this.setExport('loadFragment', async () => null);
    },
    { context },
  );
});
await footerModule.evaluate();

const {
  classifyFooterSections,
  setActiveFooterGroup,
} = footerModule.namespace;

const createSection = (className) => ({
  classList: {
    contains: (name) => name === className,
  },
});

test('classifies authored footer sections by their section metadata styles', () => {
  const navigation = createSection('footer-navigation');
  const search = createSection('footer-search');
  const payments = createSection('footer-payments');
  const social = createSection('footer-social');
  const legal = createSection('footer-legal');

  const sections = classifyFooterSections([
    social,
    legal,
    navigation,
    payments,
    search,
  ]);

  assert.equal(sections.navigation, navigation);
  assert.equal(sections.search, search);
  assert.equal(sections.payments, payments);
  assert.equal(sections.social, social);
  assert.equal(sections.legal, legal);
});

test('rejects a footer document that omits a required authored section', () => {
  assert.throws(
    () => classifyFooterSections([
      createSection('footer-navigation'),
      createSection('footer-search'),
      createSection('footer-payments'),
      createSection('footer-social'),
    ]),
    /Missing footer section: Legal/,
  );
});

const createToggleTarget = () => {
  const classes = new Set();
  const attributes = new Map();
  return {
    hidden: false,
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
    },
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
};

test('opens one footer group at a time and synchronizes accessible state', () => {
  const groups = Object.fromEntries(['about', 'destinations', 'help'].map((key) => [
    key,
    {
      button: createToggleTarget(),
      panel: createToggleTarget(),
    },
  ]));

  setActiveFooterGroup(groups, 'destinations');

  assert.equal(groups.destinations.panel.hidden, false);
  assert.equal(groups.destinations.panel.classList.contains('is-open'), true);
  assert.equal(groups.destinations.button.getAttribute('aria-expanded'), 'true');
  ['about', 'help'].forEach((key) => {
    assert.equal(groups[key].panel.hidden, true);
    assert.equal(groups[key].panel.classList.contains('is-open'), false);
    assert.equal(groups[key].button.getAttribute('aria-expanded'), 'false');
  });

  setActiveFooterGroup(groups);

  Object.values(groups).forEach(({ button, panel }) => {
    assert.equal(panel.hidden, true);
    assert.equal(panel.classList.contains('is-open'), false);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
  });
});

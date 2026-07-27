import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  document: {},
  URL,
  window: {
    matchMedia: () => ({
      addEventListener() {},
      matches: true,
    }),
  },
});

const source = await readFile(
  new URL('../blocks/header/header.js', import.meta.url),
  'utf8',
);
const headerModule = new vm.SourceTextModule(source, { context });
await headerModule.link(async (specifier) => {
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
await headerModule.evaluate();

const {
  classifyHeaderSections,
  setActivePanel,
  setDrawerState,
} = headerModule.namespace;

const createSection = (label) => ({
  querySelector: () => ({ textContent: label }),
});

const panelLabels = ['Book', 'Explore', 'Experience', 'Information', 'Safar Flyer'];

const createPanelSections = () => Object.fromEntries(panelLabels.map((label) => [
  label.toLowerCase().replace(' ', '-'),
  createSection(`${label} panel`),
]));

test('classifies authored header sections by their semantic labels', () => {
  const alert = createSection('Alert');
  const brand = createSection('Brand');
  const primary = createSection('Primary navigation');
  const utility = createSection('Utility navigation');
  const panels = createPanelSections();

  const sections = classifyHeaderSections([
    utility,
    panels.explore,
    alert,
    panels['safar-flyer'],
    brand,
    panels.book,
    primary,
    panels.information,
    panels.experience,
  ]);

  assert.equal(sections.alert, alert);
  assert.equal(sections.brand, brand);
  assert.equal(sections.primary, primary);
  assert.equal(sections.utility, utility);
  assert.equal(sections.panels.book, panels.book);
  assert.equal(sections.panels.explore, panels.explore);
  assert.equal(sections.panels.experience, panels.experience);
  assert.equal(sections.panels.information, panels.information);
  assert.equal(sections.panels['safar-flyer'], panels['safar-flyer']);
});

test('rejects a nav document that omits a required header section', () => {
  const brand = createSection('Brand');
  const primary = createSection('Primary navigation');
  const panels = createPanelSections();

  assert.throws(
    () => classifyHeaderSections([brand, primary, ...Object.values(panels)]),
    /Missing header section: Utility navigation/,
  );
});

test('rejects a nav document that omits a required panel', () => {
  const brand = createSection('Brand');
  const primary = createSection('Primary navigation');
  const utility = createSection('Utility navigation');
  const panels = createPanelSections();
  delete panels.information;

  assert.throws(
    () => classifyHeaderSections([brand, primary, utility, ...Object.values(panels)]),
    /Missing header panel: Information/,
  );
});

const createToggleTarget = () => {
  const classes = new Set();
  const attributes = new Map();
  return {
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
    },
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
};

test('opens one desktop panel at a time and synchronizes trigger state', () => {
  const panels = Object.fromEntries(panelLabels.map((label) => [
    label.toLowerCase().replace(' ', '-'),
    createToggleTarget(),
  ]));
  const triggers = Object.fromEntries(panelLabels.map((label) => [
    label.toLowerCase().replace(' ', '-'),
    createToggleTarget(),
  ]));

  setActivePanel(triggers, panels, 'experience');

  assert.equal(panels.experience.classList.contains('is-open'), true);
  assert.equal(triggers.experience.getAttribute('aria-expanded'), 'true');
  ['book', 'explore', 'information', 'safar-flyer'].forEach((key) => {
    assert.equal(panels[key].classList.contains('is-open'), false);
    assert.equal(triggers[key].getAttribute('aria-expanded'), 'false');
  });

  setActivePanel(triggers, panels);

  Object.values(panels).forEach((panel) => {
    assert.equal(panel.classList.contains('is-open'), false);
  });
  Object.values(triggers).forEach((trigger) => {
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  });
});

test('synchronizes mobile drawer visibility and trigger state', () => {
  const drawer = createToggleTarget();
  const trigger = createToggleTarget();

  setDrawerState(drawer, trigger, true);

  assert.equal(drawer.classList.contains('is-open'), true);
  assert.equal(drawer.getAttribute('aria-hidden'), 'false');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');

  setDrawerState(drawer, trigger, false);

  assert.equal(drawer.classList.contains('is-open'), false);
  assert.equal(drawer.getAttribute('aria-hidden'), 'true');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
});

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

const { classifyHeaderSections } = headerModule.namespace;

const createSection = (label) => ({
  querySelector: () => ({ textContent: label }),
});

test('classifies authored header sections by their semantic labels', () => {
  const alert = createSection('Alert');
  const brand = createSection('Brand');
  const primary = createSection('Primary navigation');
  const utility = createSection('Utility navigation');

  const sections = classifyHeaderSections([utility, alert, brand, primary]);

  assert.equal(sections.alert, alert);
  assert.equal(sections.brand, brand);
  assert.equal(sections.primary, primary);
  assert.equal(sections.utility, utility);
});

test('rejects a nav document that omits a required header section', () => {
  const brand = createSection('Brand');
  const primary = createSection('Primary navigation');

  assert.throws(
    () => classifyHeaderSections([brand, primary]),
    /Missing header section: Utility navigation/,
  );
});

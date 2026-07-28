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
  new URL('../blocks/hero/hero.js', import.meta.url),
  'utf8',
);
const helpersSource = await readFile(
  new URL('../scripts/homepage-blocks.js', import.meta.url),
  'utf8',
);
const testSource = source.replace(
  'function prepareHomepagePicture(cell, variant, eager = true)',
  'export function prepareHomepagePicture(cell, variant, eager = true)',
);
const heroModule = new vm.SourceTextModule(testSource, { context });
const helpersModule = new vm.SourceTextModule(helpersSource, { context });
await helpersModule.link(() => {});
await helpersModule.evaluate();
await heroModule.link((specifier) => {
  if (specifier === '../../scripts/homepage-blocks.js') return helpersModule;
  throw new Error(`Unexpected import: ${specifier}`);
});
await heroModule.evaluate();

const { prepareHomepagePicture } = heroModule.namespace;

test('keeps the authored homepage picture and alternative text', () => {
  const classes = new Set();
  const image = {
    alt: 'Authored hero alternative text',
    decoding: '',
    fetchPriority: '',
    loading: '',
  };
  const picture = {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
    },
    querySelector: (selector) => (selector === 'img' ? image : null),
  };
  const cell = {
    querySelector: (selector) => (selector === 'picture' ? picture : null),
  };

  const result = prepareHomepagePicture(cell, 'desktop');

  assert.equal(result, picture);
  assert.equal(classes.has('hero-homepage-picture'), true);
  assert.equal(classes.has('is-desktop'), true);
  assert.equal(image.alt, 'Authored hero alternative text');
  assert.equal(image.decoding, 'async');
  assert.equal(image.fetchPriority, 'high');
  assert.equal(image.loading, 'eager');
});

test('defers the inactive authored homepage picture', () => {
  const image = {
    alt: 'Authored hero alternative text',
    decoding: '',
    fetchPriority: '',
    loading: '',
  };
  const picture = {
    classList: {
      add: () => {},
    },
    querySelector: (selector) => (selector === 'img' ? image : null),
  };
  const cell = {
    querySelector: (selector) => (selector === 'picture' ? picture : null),
  };

  prepareHomepagePicture(cell, 'mobile', false);

  assert.equal(image.alt, 'Authored hero alternative text');
  assert.equal(image.fetchPriority, 'auto');
  assert.equal(image.loading, 'lazy');
});

test('rejects linked assets without an authored picture', () => {
  const cell = {
    querySelector: () => null,
  };

  assert.throws(
    () => prepareHomepagePicture(cell, 'desktop'),
    /authored desktop image/,
  );
});

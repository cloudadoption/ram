import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const blockNames = [
  'baggage-categories',
  'baggage-support',
  'restricted-items',
];

test('provides authorable blocks for every baggage landing page collection', async () => {
  const files = await Promise.all(blockNames.flatMap((name) => [
    read(`../blocks/${name}/${name}.js`),
    read(`../blocks/${name}/${name}.css`),
  ]));

  blockNames.forEach((name, index) => {
    const js = files[index * 2];
    const css = files[(index * 2) + 1];

    assert.match(js, /export default function decorate\(block\)/);
    assert.match(js, /readLabeledRows/);
    assert.match(css, new RegExp(`\\.${name}`));
  });
});

test('models repeated baggage content as plain labeled rows', async () => {
  const fixture = await read('../drafts/baggage-information.plain.html');
  const count = (label) => (fixture.match(new RegExp(`<div>${label}</div>`, 'g')) || []).length;

  assert.equal(count('Category'), 6);
  assert.equal(count('Support'), 4);
  assert.equal(count('Restriction'), 9);
  assert.equal(count('Guidance'), 1);
  assert.match(fixture, /<h1>Your complete baggage guide<\/h1>/);
  assert.doesNotMatch(fixture, /<table|<div>Table<\/div>/i);
});

test('keeps authored pictures and corrected editorial links', async () => {
  const fixture = await read('../drafts/baggage-information.plain.html');
  const categories = await read('../blocks/baggage-categories/baggage-categories.js');

  assert.doesNotMatch(categories, /createOptimizedPicture/);
  assert.equal((fixture.match(/<picture>/g) || []).length, 6);
  assert.equal((fixture.match(/href="\/en-gb\//g) || []).length, 8);
  assert.doesNotMatch(fixture, /href="\/en-GB\//);
});

test('injects decorative icons without duplicating authored text', async () => {
  const [support, restrictions, icons] = await Promise.all([
    read('../blocks/baggage-support/baggage-support.js'),
    read('../blocks/restricted-items/restricted-items.js'),
    read('../scripts/baggage-icons.js'),
  ]);

  assert.match(support, /createBaggageIcon/);
  assert.match(restrictions, /createBaggageIcon/);
  assert.match(icons, /aria-hidden/);
  assert.doesNotMatch(`${support}${restrictions}`, /innerHTML/);
});

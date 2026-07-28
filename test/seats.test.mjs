import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('models the seats page as an interior hero and repeatable aircraft rows', async () => {
  const fixture = await read('../drafts/seats.plain.html');
  const count = (label) => (
    fixture.match(new RegExp(`<div>${label}</div>`, 'g')) || []
  ).length;

  assert.match(fixture, /class="hero interior"/);
  assert.equal(count('Breadcrumb'), 1);
  assert.equal(count('Heading'), 2);
  assert.equal(count('Intro'), 1);
  assert.equal(count('Aircraft'), 6);
  assert.equal((fixture.match(/target="_blank"/g) || []).length, 6);
  assert.equal((fixture.match(/<picture>/g) || []).length, 1);
  assert.match(fixture, /src="https:\/\/www\.royalairmaroc\.com\/documents\/d\/ram\/seats"/);
  assert.equal((fixture.match(/href="\/en-gb\//g) || []).length, 2);
  assert.doesNotMatch(fixture, /href="\/en-GB\//);
});

test('decorates the interior hero without rebuilding its authored picture', async () => {
  const [heroJS, heroCSS] = await Promise.all([
    read('../blocks/hero/hero.js'),
    read('../blocks/hero/hero.css'),
  ]);

  assert.match(heroJS, /classList\.contains\('interior'\)/);
  assert.match(heroJS, /querySelector\('picture'\)/);
  assert.doesNotMatch(heroJS, /createOptimizedPicture/);
  assert.match(heroCSS, /\.hero\.interior/);
});

test('provides a semantic seat guide collection with accessible PDF links', async () => {
  const [guideJS, guideCSS] = await Promise.all([
    read('../blocks/seat-guide/seat-guide.js'),
    read('../blocks/seat-guide/seat-guide.css'),
  ]);

  assert.match(guideJS, /export default function decorate\(block\)/);
  assert.match(guideJS, /readLabeledRows/);
  assert.match(guideJS, /rowsWithLabel\(rows, 'aircraft'\)/);
  assert.match(guideJS, /PDF file, opens in a new window\./);
  assert.match(guideCSS, /\.seat-guide/);
});

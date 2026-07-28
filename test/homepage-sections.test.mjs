import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const blockNames = [
  'app-promo',
  'destination-deals',
  'loyalty-banner',
  'newsletter-signup',
  'promotions',
  'quick-links',
  'travel-benefits',
];

test('provides one authorable block for every visible homepage band', async () => {
  const files = await Promise.all(blockNames.flatMap((name) => [
    read(`../blocks/${name}/${name}.js`),
    read(`../blocks/${name}/${name}.css`),
  ]));

  blockNames.forEach((name, index) => {
    const js = files[index * 2];
    const css = files[(index * 2) + 1];

    assert.match(js, /export default function decorate\(block\)/);
    assert.doesNotMatch(js, /createOptimizedPicture/);
    assert.match(css, new RegExp(`\\.${name}`));
  });
});

test('models repeated homepage content as labeled authored rows', async () => {
  const fixture = await read('../drafts/homepage-sections.plain.html');
  const count = (label) => (fixture.match(new RegExp(`<div>${label}</div>`, 'g')) || []).length;

  assert.equal(count('Link'), 5);
  assert.equal(count('Destination'), 6);
  assert.equal(count('Promotion'), 2);
  assert.equal(count('Benefit'), 6);
  assert.match(fixture, /class="newsletter-signup"/);
  assert.match(fixture, /class="app-promo"/);
  assert.doesNotMatch(fixture, /blocks\/homepage-hero\/assets\/hero-/);
});

test('wraps carousel navigation at both ends', async () => {
  const { wrapCarouselIndex } = await import('../scripts/homepage-carousel.js');

  assert.equal(wrapCarouselIndex(-1, 6), 5);
  assert.equal(wrapCarouselIndex(6, 6), 0);
  assert.equal(wrapCarouselIndex(2, 6), 2);
  assert.equal(wrapCarouselIndex(1, 0), 0);
});

test('keeps the newsletter shell named and non-submitting', async () => {
  const source = await read('../blocks/newsletter-signup/newsletter-signup.js');

  assert.match(source, /label\.htmlFor = input\.id/);
  assert.match(source, /button\.type = 'button'/);
  assert.doesNotMatch(source, /\.submit\(|requestSubmit|fetch\(/);
});

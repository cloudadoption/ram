import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('keeps hero and booking launchpad implementation independent', async () => {
  const [
    heroJS,
    heroCSS,
    launchpadJS,
    launchpadCSS,
  ] = await Promise.all([
    read('../blocks/hero/hero.js'),
    read('../blocks/hero/hero.css'),
    read('../blocks/booking-launchpad/booking-launchpad.js'),
    read('../blocks/booking-launchpad/booking-launchpad.css'),
  ]);

  assert.doesNotMatch(heroJS, /booking-launchpad|flight-search/);
  assert.doesNotMatch(heroCSS, /booking-launchpad|flight-search/);
  assert.doesNotMatch(launchpadJS, /homepage-hero|hero-homepage/);
  assert.doesNotMatch(launchpadCSS, /homepage-hero|hero-homepage/);
  await assert.rejects(access(new URL('../blocks/homepage-hero', import.meta.url)));
});

test('provides combined and independently placeable authored fixtures', async () => {
  const [combined, heroOnly, launchpadOnly] = await Promise.all([
    read('../drafts/homepage-hero.plain.html'),
    read('../drafts/homepage-hero-only.plain.html'),
    read('../drafts/booking-launchpad-only.plain.html'),
  ]);

  assert.match(combined, /class="hero homepage"/);
  assert.match(combined, /class="booking-launchpad"/);

  assert.match(heroOnly, /class="hero homepage"/);
  assert.doesNotMatch(heroOnly, /class="booking-launchpad"/);

  assert.match(launchpadOnly, /class="booking-launchpad"/);
  assert.doesNotMatch(launchpadOnly, /class="hero homepage"/);
});

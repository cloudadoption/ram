import assert from 'node:assert/strict';
import test from 'node:test';

import { getPageLocale } from '../scripts/locale.js';

test('derives locale and direction from the page namespace', () => {
  assert.deepEqual(getPageLocale('/'), { lang: 'en-GB', dir: 'ltr' });
  assert.deepEqual(getPageLocale('/baggage-information'), { lang: 'en-GB', dir: 'ltr' });
  assert.deepEqual(getPageLocale('/en-gb/seats'), { lang: 'en-GB', dir: 'ltr' });
  assert.deepEqual(getPageLocale('/en/route-map'), { lang: 'en', dir: 'ltr' });
  assert.deepEqual(getPageLocale('/en_gb/flights-to-gabon'), { lang: 'en-GB', dir: 'ltr' });
  assert.deepEqual(getPageLocale('/ar-ma/information'), { lang: 'ar-MA', dir: 'rtl' });
  assert.deepEqual(getPageLocale('/ar/route-map'), { lang: 'ar', dir: 'rtl' });
});

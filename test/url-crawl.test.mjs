import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RateLimitError,
  buildFamilyClassifier,
  buildSeedEntries,
  createRobotsPolicy,
  extractLinks,
  fetchPage,
  normalizeUrl,
  rebuildProgress,
  summarizeUnion,
} from '../scripts/crawl-url-space.mjs';

const ORIGIN = 'https://www.royalairmaroc.com';

const siteScope = {
  templates: [
    {
      name: 'standard-article',
      prefix: '/en-gb/',
      urls: [`${ORIGIN}/en-gb/information/travel-documents`],
    },
    {
      name: 'route-detail',
      prefix: '/en/',
      urlPattern: '^https://www\\.royalairmaroc\\.com/en/flights-from-[^/]+-to-[^/]+$',
    },
    {
      name: 'origin-landing',
      prefix: '/en/',
      urlPattern: '^https://www\\.royalairmaroc\\.com/en/flights-from-(?!.*-to-)[^/]+$',
    },
  ],
};

test('normalizes only same-host English page URLs', () => {
  assert.equal(
    normalizeUrl('/en/flights-to-asia/?utm_source=nav#offers', `${ORIGIN}/en/`),
    `${ORIGIN}/en/flights-to-asia`,
  );
  assert.equal(normalizeUrl('/en/', ORIGIN), `${ORIGIN}/en/`);
  assert.equal(normalizeUrl('/en-gb/', ORIGIN), `${ORIGIN}/en-gb/`);
  assert.equal(normalizeUrl('/en-GB/seats', ORIGIN), null);
  assert.equal(normalizeUrl('/fr/route-map', ORIGIN), null);
  assert.equal(normalizeUrl('https://cargo.royalairmaroc.com/en/', ORIGIN), null);
  assert.equal(normalizeUrl('/en/image.webp', ORIGIN), null);
});

test('honors robots rules with the longest matching directive', () => {
  const robots = createRobotsPolicy(`
User-agent: *
Disallow: /web/
Disallow: /int/
Disallow: /en/private/
Allow: /en/private/public/
`);

  assert.equal(robots.allows(`${ORIGIN}/web/portal`), false);
  assert.equal(robots.allows(`${ORIGIN}/int/account`), false);
  assert.equal(robots.allows(`${ORIGIN}/en/private/data`), false);
  assert.equal(robots.allows(`${ORIGIN}/en/private/public/page`), true);
  assert.equal(robots.allows(`${ORIGIN}/en/route-map`), true);
});

test('extracts a deterministic set of allowed same-host links', () => {
  const robots = createRobotsPolicy('User-agent: *\nDisallow: /web/\nDisallow: /int/\n');
  const html = `
    <a href="/en/flights-to-asia?source=nav">Asia</a>
    <a href="../en-gb/seats#details">Seats</a>
    <a href="/en/flights-to-asia">Duplicate</a>
    <area href="/en/route-map">
    <a href="/web/private">Blocked</a>
    <a href="/fr/route-map">Other locale</a>
    <a href="https://example.com/en/">External</a>
    <a href="/en/logo.svg">Asset</a>
  `;

  assert.deepEqual(
    extractLinks(html, `${ORIGIN}/en/source`, robots),
    [
      `${ORIGIN}/en-gb/seats`,
      `${ORIGIN}/en/flights-to-asia`,
      `${ORIGIN}/en/route-map`,
    ],
  );
});

test('classifies exact catalog URLs before generated and fallback families', () => {
  const classify = buildFamilyClassifier(siteScope);

  assert.equal(
    classify(`${ORIGIN}/en-gb/information/travel-documents`).name,
    'standard-article',
  );
  assert.equal(
    classify(`${ORIGIN}/en/flights-from-casablanca-to-paris`).name,
    'route-detail',
  );
  assert.equal(
    classify(`${ORIGIN}/en/flights-from-casablanca`).name,
    'origin-landing',
  );
  assert.equal(
    classify(`${ORIGIN}/en/vols-pour-paris`).name,
    'destination-alias',
  );
  assert.equal(
    classify(`${ORIGIN}/en-gb/new-editorial-page`).name,
    'editorial-unclassified',
  );
});

test('builds sorted seeds with every source retained', () => {
  const seeds = buildSeedEntries({
    siteScope,
    sitemapUrls: [
      `${ORIGIN}/en/flights-from-casablanca`,
      `${ORIGIN}/en/`,
    ],
    additionalSeeds: [`${ORIGIN}/en-gb/information/travel-documents`],
  });

  assert.deepEqual(seeds, [
    { url: `${ORIGIN}/en/`, sources: ['root', 'sitemap'] },
    {
      url: `${ORIGIN}/en/flights-from-casablanca`,
      sources: ['sitemap'],
    },
    { url: `${ORIGIN}/en-gb/`, sources: ['root'] },
    {
      url: `${ORIGIN}/en-gb/information/travel-documents`,
      sources: ['catalog', 'known-correction'],
    },
  ]);
});

test('rebuilds the pending frontier from append-only progress', () => {
  const events = [
    {
      type: 'metadata',
      seeds: [
        { url: `${ORIGIN}/en/a`, sources: ['sitemap'] },
        { url: `${ORIGIN}/en/b`, sources: ['sitemap'] },
      ],
    },
    {
      type: 'page',
      url: `${ORIGIN}/en/a`,
      status: 200,
      finalUrl: `${ORIGIN}/en/a`,
      links: [`${ORIGIN}/en/c`, `${ORIGIN}/en/b`],
    },
  ];

  const progress = rebuildProgress(events);

  assert.deepEqual(progress.queue, [`${ORIGIN}/en/b`, `${ORIGIN}/en/c`]);
  assert.deepEqual([...progress.records.keys()], [`${ORIGIN}/en/a`]);
  assert.equal(progress.seen.size, 3);
});

test('records final redirect status, URL, families and discovered links', async () => {
  const robots = createRobotsPolicy('User-agent: *\nDisallow: /web/\n');
  const classify = buildFamilyClassifier(siteScope);
  const response = {
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    status: 200,
    text: async () => '<a href="/en/flights-from-rabat">Rabat</a>',
    url: `${ORIGIN}/en/flights-from-casablanca`,
  };

  const record = await fetchPage(`${ORIGIN}/en/legacy-origin`, {
    classify,
    fetchImpl: async () => response,
    robots,
    timeoutMs: 1000,
    userAgent: 'Desktop Test UA',
  });

  assert.equal(record.status, 200);
  assert.equal(record.finalUrl, `${ORIGIN}/en/flights-from-casablanca`);
  assert.equal(record.family, 'english-static-unclassified');
  assert.equal(record.finalFamily, 'origin-landing');
  assert.deepEqual(record.links, [`${ORIGIN}/en/flights-from-rabat`]);
});

test('stops rather than retrying through a rate-limit response', async () => {
  const robots = createRobotsPolicy('User-agent: *\n');
  const classify = buildFamilyClassifier(siteScope);
  const response = {
    headers: new Headers({ 'content-type': 'text/html', 'retry-after': '60' }),
    status: 429,
    text: async () => '',
    url: `${ORIGIN}/en/route-map`,
  };

  await assert.rejects(
    fetchPage(`${ORIGIN}/en/route-map`, {
      classify,
      fetchImpl: async () => response,
      robots,
      timeoutMs: 1000,
      userAgent: 'Desktop Test UA',
    }),
    RateLimitError,
  );
});

test('reports family deltas with a count pattern for every figure', () => {
  const classify = buildFamilyClassifier(siteScope);
  const sitemapUrls = [
    `${ORIGIN}/en/flights-from-casablanca-to-paris`,
    `${ORIGIN}/en/flights-from-casablanca`,
  ];
  const records = new Map([
    [
      `${ORIGIN}/en/flights-from-casablanca-to-paris`,
      { url: `${ORIGIN}/en/flights-from-casablanca-to-paris` },
    ],
    [
      `${ORIGIN}/en/flights-from-rabat-to-paris`,
      { url: `${ORIGIN}/en/flights-from-rabat-to-paris` },
    ],
    [
      `${ORIGIN}/en/flights-from-casablanca`,
      { url: `${ORIGIN}/en/flights-from-casablanca` },
    ],
  ]);

  const summary = summarizeUnion({ classify, records, sitemapUrls });
  const route = summary.families.find(({ family }) => family === 'route-detail');
  const origin = summary.families.find(({ family }) => family === 'origin-landing');

  assert.equal(summary.unionCount, 3);
  assert.match(summary.unionCountPattern, /unique requested URLs/);
  assert.equal(route.sitemapCount, 1);
  assert.equal(route.unionCount, 2);
  assert.equal(route.delta, 1);
  assert.ok(route.countPattern);
  assert.equal(origin.delta, 0);
  assert.deepEqual(summary.changedFamilies, ['route-detail']);
});

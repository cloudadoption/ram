import assert from 'node:assert/strict';
import test from 'node:test';

/* eslint-disable import/extensions */
import {
  RateLimitError,
  buildFamilyClassifier,
  buildCrawlPlan,
  buildNamespaceSummary,
  buildSeedEntries,
  classifyNamedExclusion,
  createRobotsPolicy,
  extractLinks,
  fetchPage,
  normalizeUrl,
  rebuildProgress,
  summarizeUnion,
  shouldCrawlUrl,
} from '../scripts/crawl-url-space.mjs';
/* eslint-enable import/extensions */

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
      name: 'destination-landing',
      prefix: '/en/',
      urlPattern: '^https://www\\.royalairmaroc\\.com/en/flights-to-[^/]+$',
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
  assert.equal(normalizeUrl('/en_gb/', ORIGIN), `${ORIGIN}/en_gb/`);
  assert.equal(
    normalizeUrl('/en_gb/flights-to-gabon', ORIGIN),
    `${ORIGIN}/en_gb/flights-to-gabon`,
  );
  assert.equal(normalizeUrl('/en-gb/', ORIGIN), `${ORIGIN}/en-gb/`);
  assert.equal(normalizeUrl('/en-GB/seats', ORIGIN), null);
  assert.equal(normalizeUrl('/fr/route-map', ORIGIN), null);
  assert.equal(normalizeUrl('https://cargo.royalairmaroc.com/en/', ORIGIN), null);
  assert.equal(normalizeUrl('/en/image.webp', ORIGIN), null);
});

test('records underscore catalog and hyphen editorial as distinct namespaces', () => {
  const namespaces = buildNamespaceSummary({
    englishGbSitemapLocs: [
      `${ORIGIN}/en_gb/flights-to-gabon`,
      `${ORIGIN}/en_gb/flights-to-senegal`,
    ],
    englishSitemapLocs: [
      `${ORIGIN}/en/`,
      `${ORIGIN}/en/flights-to-gabon`,
    ],
  });

  assert.equal(namespaces.count, 3);
  assert.equal(
    namespaces.entries.find(({ prefix }) => prefix === '/en/').sitemapUrlCount,
    2,
  );
  assert.equal(
    namespaces.entries.find(({ prefix }) => prefix === '/en_gb/').sitemapUrlCount,
    2,
  );
  const editorial = namespaces.entries.find(({ prefix }) => prefix === '/en-gb/');
  assert.equal(editorial.sitemapUrlCount, 0);
  assert.match(editorial.sitemapUrlCountPattern, /case-sensitive.*both/i);
  assert.equal(editorial.discoveryMode, 'chrome-crawl-only');
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

test('samples large generated families while enumerating bounded families', () => {
  const numberedUrls = (prefix, count) => Array.from(
    { length: count },
    (_, index) => `${ORIGIN}/en/${prefix}-${String(index + 1).padStart(2, '0')}`,
  );
  const routeUrls = Array.from(
    { length: 35 },
    (_, index) => (
      `${ORIGIN}/en/flights-from-origin-${String(index + 1).padStart(2, '0')}-to-target`
    ),
  );
  const destinationUrls = numberedUrls('flights-to-destination', 35);
  const originUrls = numberedUrls('flights-from-origin', 35);
  const sitemapIndex = `${ORIGIN}/en/sitemap/to-city/page-1`;
  const staticPage = `${ORIGIN}/en/route-map`;

  const plan = buildCrawlPlan({
    additionalSeeds: [],
    generatedSampleSize: 30,
    sitemapUrls: [
      ...routeUrls,
      ...destinationUrls,
      ...originUrls,
      sitemapIndex,
      staticPage,
    ],
    siteScope,
  });

  assert.equal(plan.generatedSamples['route-detail'].length, 30);
  assert.equal(plan.generatedSamples['destination-landing'].length, 30);
  assert.equal(plan.generatedSamples['origin-landing'].length, 30);
  assert.equal(plan.seeds.some(({ url }) => url === sitemapIndex), true);
  assert.equal(plan.seeds.some(({ url }) => url === staticPage), true);
  assert.equal(
    plan.coverage.find(({ family }) => family === 'route-detail').mode,
    'sampled',
  );
  assert.equal(
    plan.coverage.find(({ family }) => family === 'english-static-unclassified').mode,
    'enumerated',
  );
});

test('crawls editorial and non-sitemap links but skips unsampled generated sitemap URLs', () => {
  const classify = buildFamilyClassifier(siteScope);
  const sampledRoute = `${ORIGIN}/en/flights-from-rabat-to-paris`;
  const unsampledRoute = `${ORIGIN}/en/flights-from-casablanca-to-paris`;
  const sitemapSet = new Set([sampledRoute, unsampledRoute]);
  const sampledSet = new Set([sampledRoute]);

  assert.equal(shouldCrawlUrl(`${ORIGIN}/en-gb/new-page`, {
    classify,
    sampledSet,
    sitemapSet,
  }), true);
  assert.equal(shouldCrawlUrl(`${ORIGIN}/en/vols-pour-paris`, {
    classify,
    sampledSet,
    sitemapSet,
  }), true);
  assert.equal(shouldCrawlUrl(`${ORIGIN}/en_gb/flights-to-gabon`, {
    classify,
    sampledSet,
    sitemapSet,
  }), false);
  assert.equal(shouldCrawlUrl(sampledRoute, {
    classify,
    sampledSet,
    sitemapSet,
  }), true);
  assert.equal(shouldCrawlUrl(unsampledRoute, {
    classify,
    sampledSet,
    sitemapSet,
  }), false);
});

test('names Liferay accordion fragment artifacts without treating them as pages', () => {
  assert.equal(
    classifyNamedExclusion({
      url: `${ORIGIN}/en-gb/accordion-204006-1`,
      status: 404,
    }),
    'liferay-accordion-fragment-artifact',
  );
  assert.equal(
    classifyNamedExclusion({
      url: `${ORIGIN}/en-gb/accordion-204006-1`,
      status: 200,
    }),
    null,
  );
  assert.equal(
    classifyNamedExclusion({
      url: `${ORIGIN}/en-gb/information/travel-documents`,
      status: 404,
    }),
    null,
  );
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
      {
        url: `${ORIGIN}/en/flights-from-casablanca-to-paris`,
        status: 200,
        finalUrl: `${ORIGIN}/en/flights-from-casablanca-to-paris`,
      },
    ],
    [
      `${ORIGIN}/en/flights-from-rabat-to-paris`,
      {
        url: `${ORIGIN}/en/flights-from-rabat-to-paris`,
        status: 200,
        finalUrl: `${ORIGIN}/en/flights-from-casablanca-to-paris`,
      },
    ],
    [
      `${ORIGIN}/en-gb/live-editorial`,
      {
        url: `${ORIGIN}/en-gb/live-editorial`,
        status: 200,
        finalUrl: `${ORIGIN}/en-gb/live-editorial`,
      },
    ],
    [
      `${ORIGIN}/en-gb/dead-editorial`,
      {
        url: `${ORIGIN}/en-gb/dead-editorial`,
        status: 404,
        finalUrl: `${ORIGIN}/en-gb/dead-editorial`,
      },
    ],
  ]);

  const summary = summarizeUnion({
    classify,
    englishSitemapLocs: sitemapUrls,
    records,
    sitemapUrls,
  });
  const route = summary.families.find(({ family }) => family === 'route-detail');
  const origin = summary.families.find(({ family }) => family === 'origin-landing');

  assert.equal(summary.rawUnionCount, 5);
  assert.match(summary.rawUnionCountPattern, /regardless of final status/);
  assert.equal(summary.rawMissingFromSitemapCount, 3);
  assert.equal(summary.livePagesMissingFromSitemapCount, 1);
  assert.match(
    summary.livePagesMissingFromSitemapCountPattern,
    /final status == 200.*exact finalUrl.*exact English sitemap <loc>/,
  );
  assert.equal(summary.redirectAliasesIntoSitemapCount, 1);
  assert.equal(route.sitemapCount, 1);
  assert.equal(route.unionCount, 2);
  assert.equal(route.delta, 1);
  assert.ok(route.countPattern);
  assert.equal(origin.unionCount, 1);
  assert.equal(origin.delta, 0);
  assert.deepEqual(
    summary.changedFamilies,
    ['editorial-unclassified', 'route-detail'],
  );
});

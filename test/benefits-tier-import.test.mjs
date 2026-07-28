import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getMappings,
  transformEditorialDocument,
} from '../tools/importer/editorial-pipeline.js';

const tierPages = [
  {
    slug: 'silver-benefits',
    title: 'Silver benefits - RAM',
    description: 'Your Silver card offers you even more benefits for comfortable and worry-free travel! Bonus miles, complimentary extra baggage, Business Class check-in, etc.',
    ids: {
      hero: '135854',
      intro: '135865',
      status: '135874',
      standfirst: '135884',
      benefitGroups: [['135893', 5], ['135952', 2]],
      footnote: '135971',
      primaryCta: '135980',
      features: [
        ['136008', 'maintain'],
        ['136036', 'upgrade'],
      ],
      heading: '136055',
      compact: ['136064', 3],
      secondaryCta: '136103',
    },
    expectedImages: 14,
  },
  {
    slug: 'gold-benefits',
    title: 'Gold benefits - RAM',
    description: 'The Gold card offers you a range of benefits: Bonus miles, complimentary extra baggage, Business Class check-in, Fast Track, lounge access',
    pageHeading: 'Gold benefits',
    ids: {
      hero: '136112',
      intro: '136123',
      status: '136132',
      standfirst: '136142',
      benefitGroups: [['136160', 6], ['136294', 2], ['136323', 2]],
      footnote: '136342',
      primaryCta: '136351',
      features: [
        ['136369', 'universe'],
        ['136388', 'maintain'],
        ['136407', 'upgrade'],
      ],
      heading: '136426',
      compact: ['136435', 3],
      secondaryCta: '136474',
    },
    expectedImages: 18,
  },
  {
    slug: 'platinum-benefits',
    title: 'Platinum benefits - RAM',
    description: 'The Safar Flyer Platinum card offers you a world of privileges designed exclusively for you, including 3 complimentary upgrades per year! Discover them!',
    pageHeading: 'Platinum benefits',
    ids: {
      hero: '136492',
      intro: '136523',
      status: '136532',
      standfirst: '136542',
      benefitGroups: [['136590', 3], ['136629', 3], ['136687', 3], ['136735', 3]],
      footnote: '136764',
      primaryCta: '136773',
      features: [
        ['136782', 'new-benefits'],
        ['136801', 'upgrade'],
        ['136829', 'maintain'],
      ],
    },
    expectedImages: 17,
  },
];

function benefitItems(id, count) {
  return `<div class="journal-content-article" data-analytics-asset-id="${id}">
    ${Array.from({ length: count }, (_, index) => `<div class="col-12 col-md-4">
      <img src="https://www.royalairmaroc.com/${id}-${index}.jpg" alt="Image">
      <p class="feature-title"><b>Benefit ${index + 1}</b></p>
      <p class="f-fw-l">Benefit copy ${index + 1}</p>
    </div>`).join('')}
  </div>`;
}

function tierSource(page) {
  const { ids } = page;
  const heading = page.pageHeading ? `<section class="page-heading">
    <ul class="breadcrumbs__list">
      <li><a href="https://www.royalairmaroc.com/en/loyalty">Safar Flyer Loyalty</a></li>
      <li><a href="https://www.royalairmaroc.com/en/discover-safar-flyer">Discover Safar Flyer</a></li>
      <li>${page.pageHeading}</li>
    </ul>
    <h2 class="page-heading__title">${page.pageHeading}</h2>
  </section>` : '';
  const compact = ids.compact ? benefitItems(...ids.compact) : '';
  const secondaryCta = ids.secondaryCta ? `<div class="journal-content-article" data-analytics-asset-id="${ids.secondaryCta}">
    <a href="/en/${page.slug}"><button>DISCOVER ALL BENEFITS</button></a>
  </div>` : '';

  return `<!doctype html>
    <html lang="en-GB">
      <head>
        <title>${page.title}</title>
        <meta content="${page.description}" name="description">
      </head>
      <body>
        ${heading}
        <div class="journal-content-article" data-analytics-asset-id="${ids.hero}">
          <section id="food-bg-default" data-import-background-image="https://www.royalairmaroc.com/${page.slug}-hero.jpg"></section>
        </div>
        <div class="journal-content-article" data-analytics-asset-id="${ids.intro}">
          <h2>WELCOME TO SAFAR FLYER ${page.slug.split('-')[0].toUpperCase()}</h2>
          <h2>Tier introduction</h2>
          <p>Tier details from the live page.</p>
        </div>
        <div class="journal-content-article" data-analytics-asset-id="${ids.status}">
          <a href="/en/safar-flyer-and-oneworld">
            <img src="https://www.royalairmaroc.com/${page.slug}-status.jpg" alt="Status equivalent">
          </a>
        </div>
        <div class="journal-content-article" data-analytics-asset-id="${ids.standfirst}">
          <h2>Tier benefits standfirst</h2>
        </div>
        ${ids.benefitGroups.map(([id, count]) => benefitItems(id, count)).join('')}
        <div class="journal-content-article" data-analytics-asset-id="${ids.footnote}">
          <p class="seat-content-body">(1) Live footnote copy</p>
        </div>
        <div class="journal-content-article" data-analytics-asset-id="${ids.primaryCta}">
          <a href="/en/safar-flyer/sign-in"><button>I TAKE ADVANTAGE</button></a>
        </div>
        ${ids.features.map(([id, name], index) => `<div class="journal-content-article" data-analytics-asset-id="${id}">
          <div class="figure-text-overlapped${index % 2 === 0 ? ' figure-text-overlapped-reversed' : ''}">
            <img src="https://www.royalairmaroc.com/${page.slug}-${name}.jpg" alt="">
            <div class="text-overlapped">
              <p class="text-overlapped-title">${name.toUpperCase()}</p>
              <p class="text-overlapped-description">Feature copy from live.</p>
              <a href="/en/${page.slug}">FIND OUT MORE</a>
            </div>
          </div>
        </div>`).join('')}
        ${ids.heading ? `<div class="journal-content-article" data-analytics-asset-id="${ids.heading}">
          <center>Some benefits of the next status</center>
        </div>` : ''}
        ${compact}
        ${secondaryCta}
      </body>
    </html>`;
}

test('maps all three tier siblings through existing loyalty blocks', () => {
  const { profiles } = getMappings();
  const allowedBlocks = new Set(['hero', 'cards', 'columns']);

  tierPages.forEach(({ slug }) => {
    const profile = profiles.find(({ path }) => path === `/en-gb/${slug}`);
    assert.ok(profile, `Missing ${slug} profile`);
    assert.equal(profile.template, 'feature-story');
    assert.ok(profile.blocks.every(({ name }) => allowedBlocks.has(name.split(' ')[0])));
    assert.ok(profile.blocks.some(({ name }) => name === 'hero loyalty-tier'));
    assert.ok(profile.blocks.some(({ name }) => name === 'cards loyalty-benefits'));
    assert.ok(profile.blocks.some(({ name }) => name === 'columns loyalty-intro'));
  });
});

test('imports each tier sibling with authored media and live metadata', () => {
  tierPages.forEach((page) => {
    const result = transformEditorialDocument(tierSource(page), {
      url: `https://www.royalairmaroc.com/en-gb/${page.slug}`,
    });
    const expectedBenefits = page.ids.benefitGroups
      .reduce((total, [, count]) => total + count, 0)
      + (page.ids.compact?.[1] || 0);

    assert.equal(result.path, `/en-gb/${page.slug}`);
    assert.deepEqual(result.metadata.description, {
      source: 'live',
      value: page.description,
    });
    assert.deepEqual(result.metadata.deviations, []);
    assert.equal((result.html.match(/<div>Benefit<\/div>/g) || []).length, expectedBenefits);
    assert.equal(result.metadata.images.length, page.expectedImages);
    assert.match(result.html, /<div>Status<\/div>/);
    assert.match(result.html, /<div>Standfirst<\/div>/);
    assert.doesNotMatch(result.html, /\/en-GB\//);
    if (page.pageHeading) {
      assert.match(result.html, /<div>Breadcrumb<\/div>/);
      assert.match(result.html, /<div>Heading<\/div>/);
    }
  });
});

test('loyalty decorators scale optional tier content and larger benefit sets', async () => {
  const [hero, cards, columns] = await Promise.all([
    readFile(new URL('../blocks/hero/hero.js', import.meta.url), 'utf8'),
    readFile(new URL('../blocks/cards/cards.css', import.meta.url), 'utf8'),
    readFile(new URL('../blocks/columns/columns.js', import.meta.url), 'utf8'),
  ]);
  const loyaltyHero = hero.match(/function decorateLoyaltyTier[\s\S]*?\n}/)?.[0] || '';

  assert.match(loyaltyHero, /'breadcrumb'/);
  assert.match(loyaltyHero, /'heading'/);
  assert.match(columns, /function decorateLoyaltyIntro/);
  assert.match(columns, /'status'/);
  assert.match(columns, /'standfirst'/);
  assert.match(cards, /li:nth-child\(12\)/);
});

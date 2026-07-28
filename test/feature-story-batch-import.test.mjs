import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMappings,
  transformEditorialDocument,
} from '../tools/importer/editorial-pipeline.js';

const image = (name) => `https://www.royalairmaroc.com/${name}.jpg`;

const pageHeading = (heading) => `<section class="page-heading">
  <ul class="breadcrumbs__list">
    <li><a href="/en/information">Information</a></li>
    <li>${heading}</li>
  </ul>
  <div class="journal-content-article"><h2>${heading}</h2></div>
</section>`;

const article = (id, content) => `<div
  class="journal-content-article"
  data-analytics-asset-id="${id}"
>${content}</div>`;

function buyMilesSource() {
  return `<!doctype html>
    <html lang="en-GB">
      <head><title>Buy and transfer miles - RAM</title></head>
      <body>
        ${pageHeading('Buy and transfer miles')}
        ${article('138000', `<section class="middle-paragraph">
          <h3>Do you need Miles to qualify for an award?</h3>
          <p>You do not have to wait for your next trip to earn Award Miles.</p>
        </section>`)}
        ${article('138009', `<section>
          <img src="${image('buy-miles')}" alt="">
          <div class="text-overlapped">
            <p class="text-overlapped-title">Buy Miles!</p>
            <p class="text-overlapped-description">Complete your balance by purchasing Miles.</p>
            <a href="/en/safar-flyer/buy-award-miles">Buy Miles</a>
          </div>
        </section>`)}
        ${article('138048', '<h3>Miles purchase conditions by status:</h3><p>Blue members may purchase Miles.</p>')}
        ${article('138057', `<img src="${image('agency')}" alt="Agency"><p>Service available at a Royal Air Maroc agency.</p>`)}
        ${article('202944', `<section>
          <img src="${image('transfer-miles')}" alt="">
          <div class="text-overlapped">
            <p class="text-overlapped-title">Transfer your Miles!</p>
            <p class="text-overlapped-description">Transfer Award Miles between eligible accounts.</p>
          </div>
        </section>`)}
        ${article('138095', '<h3>How to proceed?</h3><p>Submit your transfer request online.</p>')}
        ${article('138104', '<h3>General conditions:</h3><p>Miles transfer cannot be cancelled.</p>')}
      </body>
    </html>`;
}

function corporateSource() {
  return `<!doctype html>
    <html lang="en-GB">
      <head>
        <title>Corporate program - RAM</title>
        <meta name="description" content="Reduce your company travel budget with Safar Flyer Corporate.">
      </head>
      <body>
        ${pageHeading('Corporate program')}
        ${article('137190', '<section id="food-bg-default" data-import-background-image="https://www.royalairmaroc.com/corporate-banner.jpg"></section>')}
        ${article('315134', '<p>Complete the Safar Corporate form.</p><a href="https://www.royalairmaroc.com/corporate.pdf">Application form</a>')}
        ${article('137201', '<h3>Advantages for your business</h3><p>Reduce your company travel budget.</p>')}
        ${article('137210', Array.from({ length: 4 }, (_, index) => `<div class="col-12 col-md-4">
          <img src="${image(`corporate-benefit-${index}`)}" alt="">
          <p class="feature-title"><strong>Benefit ${index + 1}</strong></p>
          <p>Benefit copy ${index + 1}</p>
        </div>`).join(''))}
        ${article('137279', '<p>Awards are travel benefits.</p>')}
        ${article('137337', `<img src="${image('corporate-members')}" alt=""><h3>Join Safar Flyer</h3><p>Employees can join.</p><a href="/en/register">Join us</a>`)}
        ${article('137356', '<h3>How to create a Safar Flyer Corporate account?</h3>')}
        ${article('137384', `<img src="${image('corporate-account')}" alt=""><strong>Fast membership</strong><p>Complete the form.</p>`)}
        ${article('137403', '<a href="/en/register">Create a Safar Flyer Corporate account</a>')}
        ${article('137421', `<img src="${image('corporate-card')}" alt=""><h3>Present your personal Safar Flyer card</h3><p>Identify yourself when purchasing a ticket.</p>`)}
      </body>
    </html>`;
}

function dreamAfricaSource() {
  return `<!doctype html>
    <html lang="en-GB">
      <head><title>#DREAMAFRICA#MEETMOROCCO</title></head>
      <body>
        ${article('129019', `<img class="banner-image" src="${image('dream-banner')}" alt="">`)}
        ${article('129056', '<h2>A new brand message, carrying forward our mission and our ambitions!</h2><p>Royal Air Maroc is revealing a new brand message.</p>')}
        ${article('129075', `<img src="${image('dream-mission')}" alt=""><h2>Our mission</h2><p>Unveiling the potential of our country and continent.</p>`)}
        ${article('129094', `<h2>Our ambition</h2><p>Contributing to a strong, talented Africa.</p><img src="${image('dream-ambition')}" alt="">`)}
        ${article('129113', '<h2>Our service reflects our mission</h2><p>Bringing you the best of Morocco and Africa.</p>')}
        ${article('129122', '<section id="food-bg" data-import-background-image="https://www.royalairmaroc.com/dream-campaign.jpg"></section>')}
        ${article('129141', '<h2>Our communication campaign</h2><p>An invitation to rediscover the potential of our Kingdom and continent.</p>')}
        ${article('129150', '<h2>The Brand Film</h2><p>A dynamic creation where art blends our ambition and heritage.</p>')}
        ${article('129159', Array.from({ length: 3 }, (_, index) => `<div class="link-card">
          <img src="${image(`dream-card-${index}`)}" alt="">
        </div>`).join(''))}
      </body>
    </html>`;
}

test('maps the first reuse-only feature-story batch without new blocks', () => {
  const paths = [
    '/en-gb/buy-and-transfer-miles',
    '/en-gb/corporate-program',
    '/en-gb/dreamafrica-meetmorocco',
  ];
  const existingBlocks = new Set(['cards', 'columns']);
  const { profiles } = getMappings();

  paths.forEach((path) => {
    const profile = profiles.find((candidate) => candidate.path === path);
    assert.ok(profile, `Missing import profile for ${path}`);
    assert.ok(profile.blocks.some(({ type }) => type === 'default'));
    assert.ok(profile.blocks
      .filter(({ type }) => type !== 'default')
      .every(({ name }) => existingBlocks.has(name.split(' ')[0])));
  });
});

test('imports default content and unlabeled existing blocks for the first batch', () => {
  const pages = [
    {
      slug: 'buy-and-transfer-miles',
      source: buyMilesSource(),
      descriptionSource: 'authored',
      expected: ['Buy Miles!', 'Transfer your Miles!', 'General conditions:'],
    },
    {
      slug: 'corporate-program',
      source: corporateSource(),
      descriptionSource: 'live',
      expected: ['Advantages for your business', 'Benefit 4', 'Fast membership'],
    },
    {
      slug: 'dreamafrica-meetmorocco',
      source: dreamAfricaSource(),
      descriptionSource: 'authored',
      expected: ['A new brand message', 'Our ambition', 'The Brand Film'],
    },
  ];

  pages.forEach((page) => {
    const result = transformEditorialDocument(page.source, {
      url: `https://www.royalairmaroc.com/en-gb/${page.slug}`,
    });

    assert.equal(result.path, `/en-gb/${page.slug}`);
    assert.equal(result.metadata.description.source, page.descriptionSource);
    page.expected.forEach((text) => assert.match(result.html, new RegExp(text)));
    assert.doesNotMatch(result.html, /<div>(Feature|Card|Content)<\/div>/);
  });
});

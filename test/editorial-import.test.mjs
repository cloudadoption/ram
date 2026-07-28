import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildDaDocument,
  classifyEditorialUrl,
  normalizeEditorialHref,
  transformEditorialDocument,
} from '../tools/importer/editorial-pipeline.js';
import validateImageSource from '../tools/importer/lib/media.js';

const readJson = async (path) => JSON.parse(
  await readFile(new URL(path, import.meta.url), 'utf8'),
);

test('wraps imported sections in the DA document skeleton', () => {
  const html = buildDaDocument('<div><div class="hero"></div></div>');

  assert.match(html, /^<body><header><\/header><main>/);
  assert.match(html, /<div><div class="hero"><\/div><\/div>/);
  assert.match(html, /<\/main><footer><\/footer><\/body>$/);
});

test('maps all 79 editorial URLs to the seven catalog templates', async () => {
  const catalog = await readJson('../catalog/site-scope.json');
  const templates = catalog.templates.filter(({ prefix }) => prefix === '/en-gb/');
  const urls = templates.flatMap((template) => template.urls);

  assert.equal(templates.length, 7);
  assert.equal(urls.length, 79);
  assert.equal(new Set(urls).size, 79);
  assert.ok(urls.every((url) => new URL(url).pathname.startsWith('/en-gb/')));
  assert.ok(urls.every((url) => !url.includes('/en-GB/') && !url.includes('/en_gb/')));
  assert.equal(classifyEditorialUrl(
    'https://www.royalairmaroc.com/en-gb/baggage-information',
    catalog,
  ).name, 'feature-story');
  assert.equal(classifyEditorialUrl(
    'https://www.royalairmaroc.com/en-gb/seats',
    catalog,
  ).name, 'standard-article');
});

test('maps the complete live regions represented by Baggage blocks', async () => {
  const mappings = await readJson('../tools/importer/page-mappings.json');
  const profile = mappings.profiles.find(
    ({ path }) => path === '/en-gb/baggage-information',
  );
  const instances = Object.fromEntries(
    profile.blocks.map(({ name, instances: selectors }) => [name, selectors]),
  );

  assert.deepEqual(instances['baggage-categories'], [
    '.bck-pattern-1',
    '.page-heading',
  ]);
  assert.deepEqual(instances['restricted-items'], [
    '.prohibited-section',
    '.prohibited-section + div',
  ]);
});

test('normalizes known editorial links without changing deliberate locale links', () => {
  assert.equal(
    normalizeEditorialHref('/en-GB/checked-baggage', ['/checked-baggage']),
    '/en-gb/checked-baggage',
  );
  assert.equal(
    normalizeEditorialHref('/en/checked-baggage', ['/checked-baggage']),
    '/en-gb/checked-baggage',
  );
  assert.equal(
    normalizeEditorialHref(
      'https://www.royalairmaroc.com/en/checked-baggage',
      ['/checked-baggage'],
    ),
    '/en-gb/checked-baggage',
  );
  assert.equal(
    normalizeEditorialHref(
      'https://www.royalairmaroc.com/ma-en/-bagages-retard%C3%A9s',
      ['/checked-baggage'],
    ),
    'https://www.royalairmaroc.com/ma-en/-bagages-retard%C3%A9s',
  );
  assert.equal(
    normalizeEditorialHref('/en/route-map', ['/checked-baggage']),
    '/en/route-map',
  );
});

test('accepts only source-site HTTPS images with image responses', () => {
  assert.doesNotThrow(() => validateImageSource(
    'https://www.royalairmaroc.com/documents/d/ram/seats',
    'image/png',
  ));
  assert.throws(
    () => validateImageSource('http://www.royalairmaroc.com/image.jpg', 'image/jpeg'),
    /HTTPS/,
  );
  assert.throws(
    () => validateImageSource('https://127.0.0.1/image.jpg', 'image/jpeg'),
    /host/,
  );
  assert.throws(
    () => validateImageSource('https://www.royalairmaroc.com/image.jpg', 'text/html'),
    /image response/,
  );
});

test('imports the baggage hub into its three existing authored blocks', () => {
  const source = `<!doctype html>
    <html lang="en-GB">
      <head>
        <title>Baggage information</title>
        <meta name="description" content="Learn about Royal Air Maroc baggage policies, allowances, and fees for checked and carry-on luggage.">
      </head>
      <body>
        <section class="page-heading">
          <ul class="breadcrumbs__list">
            <li><a href="/en/information">Information</a></li>
            <li><a href="/en/before-travel">Before travel</a></li>
            <li>Baggage information</li>
          </ul>
          <div class="journal-content-article">
            <h2>Your complete baggage guide</h2>
            <h4>Everything you need to know to travel with peace of mind</h4>
          </div>
        </section>
        <div id="main-content">
          <div class="bck-pattern-1">
            <div class="small-card">
              <a href="/en/checked-baggage">
                <img src="https://www.royalairmaroc.com/image.jpg" alt="">
                <span class="small-card__title__text"><h4>Checked baggage</h4></span>
              </a>
            </div>
          </div>
          <div class="support-section">
            <h3>Need help with your baggage?</h3>
            <a class="baggage-card" href="https://www.royalairmaroc.com/ma-en/-bagages-retard%C3%A9s">
              <div><strong>Delayed baggage</strong><p>Track the status of your file in real time.</p></div>
            </a>
          </div>
          <div class="prohibited-section">
            <h3>Restricted or prohibited items</h3>
            <div><p><strong>Explosives:</strong> Firecrackers, fireworks, ammunition.</p></div>
            <div><p>Guidance copy</p><a href="https://www.royalairmaroc.com/goods.pdf">Official document</a></div>
          </div>
        </div>
      </body>
    </html>`;

  const result = transformEditorialDocument(source, {
    url: 'https://www.royalairmaroc.com/en-gb/baggage-information',
    imageSources: {
      'https://www.royalairmaroc.com/image.jpg': './images/baggage-information/image.jpg',
    },
  });

  assert.equal(result.template, 'feature-story');
  assert.equal(result.path, '/en-gb/baggage-information');
  assert.deepEqual(result.metadata.description, {
    source: 'live',
    value: 'Learn about Royal Air Maroc baggage policies, allowances, and fees for checked and carry-on luggage.',
  });
  assert.deepEqual(result.metadata.deviations, []);
  assert.match(result.html, /class="baggage-categories"/);
  assert.match(result.html, /class="baggage-support"/);
  assert.match(result.html, /class="restricted-items"/);
  assert.match(result.html, /href="\/en-gb\/checked-baggage"/);
  assert.match(result.html, /href="https:\/\/www\.royalairmaroc\.com\/ma-en\//);
  assert.match(result.html, /src="\.\/images\/baggage-information\/image\.jpg"/);
  assert.doesNotMatch(result.html, /src="https:\/\/www\.royalairmaroc\.com\/image\.jpg"/);
  assert.match(result.html, /<div>Guidance<\/div><div><p>Guidance copy<\/p>/);
  assert.equal((result.html.match(/<div>Restriction<\/div>/g) || []).length, 1);
  assert.doesNotMatch(result.html, /class="small-card"|class="support-section"/);
});

test('imports seats into the shared interior hero and repeatable seat guide', () => {
  const authoredDescription = 'Choose your preferred seat on Royal Air Maroc flights and enjoy a more comfortable travel experience.';
  const aircraft = Array.from({ length: 6 }, (_, index) => `
    <li>
      Aircraft ${index + 1}: 12C/100Y
      <p><a href="https://www.royalairmaroc.com/aircraft-${index + 1}.pdf">
        Aircraft ${index + 1}<span class="sr-only">PDF file, opens in a new window.</span>
      </a></p>
    </li>`).join('');
  const source = `<!doctype html>
    <html lang="en-GB">
      <head><title>Seat Selection | Royal Air Maroc - RAM</title></head>
      <body>
        <section class="page-heading-container">
          <ul class="breadcrumbs__list">
            <li><a href="/en/experience">Experience</a></li>
            <li><a href="/en/experience/on-board">On board</a></li>
            <li>Seats</li>
          </ul>
          <h2 class="page-heading__title">Seat Selection | Royal Air Maroc</h2>
          <div class="page-heading-clip" style="background-image: url('https://www.royalairmaroc.com/seats.jpg')">
            <img src="https://www.royalairmaroc.com/seats.jpg" alt="">
          </div>
        </section>
        <div id="main-content">
          <div class="container seat-content">
            <h2>Seats cabin map</h2>
            <p class="seat-content-body">Choose an aircraft.</p>
            <ul>${aircraft}</ul>
          </div>
        </div>
      </body>
    </html>`;

  const result = transformEditorialDocument(source, {
    url: 'https://www.royalairmaroc.com/en-gb/seats',
  });

  assert.equal(result.template, 'standard-article');
  assert.equal(result.path, '/en-gb/seats');
  assert.equal(result.metadata.description.source, 'authored');
  assert.equal(result.metadata.description.value, authoredDescription);
  assert.equal(result.metadata.deviations.length, 1);
  assert.equal(result.metadata.deviations[0].type, 'authored-meta-description');
  assert.equal(result.metadata.deviations[0].value, authoredDescription);
  assert.equal((result.html.match(new RegExp(authoredDescription, 'g')) || []).length, 1);
  assert.match(result.html, /class="hero interior"/);
  assert.match(result.html, /class="seat-guide"/);
  assert.equal((result.html.match(/<div>Aircraft<\/div>/g) || []).length, 6);
  assert.match(result.html, /<picture>/);
  assert.doesNotMatch(result.html, />PDF file, opens in a new window\.<\/a>/);
  assert.doesNotMatch(result.html, /target="_blank"|class="page-heading-clip"/);
});

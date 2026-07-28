import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transformEditorialDocument } from '../tools/importer/editorial-pipeline.js';

const source = `<!doctype html>
  <html lang="en-GB">
    <head>
      <title>Safar Flyer Blue | Benefits - RAM</title>
      <meta name="description" content="Discover Safar Flyer Blue membership benefits including miles earning, rewards, and exclusive travel perks.">
    </head>
    <body>
      <div class="journal-content-article" data-analytics-asset-id="135464">
        <section id="food-bg" data-import-background-image="https://www.royalairmaroc.com/blue-hero.jpg"></section>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135504">
        <h2>WELCOME TO SAFAR FLYER BLUE</h2>
        <h2>Your trip starts here!</h2>
        <p>As a member of the Safar Flyer program, you receive several exclusive benefits upon joining!</p>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135513">
        <div class="col-12 col-md-4">
          <img src="https://www.royalairmaroc.com/welcome.png" alt="Image">
          <p class="feature-title"><b>Welcome Bonus:</b></p>
          <p class="f-fw-l">Receive 4,000 Award Miles.</p>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135570">
        <div class="col-12 col-md-4">
          <img src="https://www.royalairmaroc.com/support.png" alt="Image">
          <p class="feature-title"><b>Dedicated support:</b></p>
          <p class="f-fw-l">Take advantage of priority service.</p>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135599">
        <div class="col-12 col-md-4">
          <img src="https://www.royalairmaroc.com/cash-miles.png" alt="Image">
          <p class="feature-title"><b>Cash &amp; Miles Service</b></p>
          <p class="f-fw-l"><a href="https://www.royalairmaroc.com/int-en/cash-miles">Find out more &gt;&gt;</a></p>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135618">
        <a href="/en/safar-flyer/join-us"><button>CREATE MY ACCOUNT NOW</button></a>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135627">
        <div class="figure-text-overlapped figure-text-overlapped-reversed">
          <div class="figure-overlapped"><img src="https://www.royalairmaroc.com/new-benefits.jpg" alt=""></div>
          <div class="text-overlapped">
            <p class="text-overlapped-title">YOUR SAFAR FLYER BLUE CARD NOW OFFERS NEW BENEFITS!</p>
            <p class="text-overlapped-description">Earn Award Miles and Status Miles.</p>
            <a href="/en/safar-flyer-and-oneworld">I WANT TO FIND OUT MORE</a>
          </div>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135673">
        <div class="figure-text-overlapped">
          <div class="figure-overlapped-reverse"><img src="https://www.royalairmaroc.com/card-system.jpg" alt=""></div>
          <div class="text-overlapped">
            <p class="text-overlapped-title">CHOOSE THE SAFAR FLYER SYSTEM</p>
            <p class="text-overlapped-description">Present your individual Safar Flyer card.</p>
          </div>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135692">
        <div class="figure-text-overlapped figure-text-overlapped-reversed">
          <div class="figure-overlapped"><img src="https://www.royalairmaroc.com/silver.jpg" alt=""></div>
          <div class="text-overlapped">
            <p class="text-overlapped-title">UPGRADE TO SILVER STATUS</p>
            <p class="text-overlapped-description">Earn 20,000 Status Miles.</p>
            <a href="/en/silver-benefits">I WANT TO FIND OUT MORE</a>
          </div>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135720">
        <center>Some advantages of Silver status</center>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135729">
        <div class="col-12 col-md-4">
          <img src="https://www.royalairmaroc.com/bonus.png" alt="Image">
          <p class="feature-title">Additional 50% bonus on Award Miles earned*</p>
        </div>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135768">
        <p class="seat-content-body">(*) After a flight with Royal Air Maroc or any other <strong>one</strong>world company</p>
      </div>
      <div class="journal-content-article" data-analytics-asset-id="135777">
        <a href="/en/silver-benefits"><button>I WANT TO DISCOVER ALL OF SILVER'S BENEFITS</button></a>
      </div>
    </body>
  </html>`;

test('imports Blue benefits with reusable block variants and authored media', () => {
  const result = transformEditorialDocument(source, {
    url: 'https://www.royalairmaroc.com/en-gb/blue-benefits',
    imageSources: {
      'https://www.royalairmaroc.com/blue-hero.jpg': './images/blue-benefits/hero.jpg',
    },
  });

  assert.equal(result.template, 'feature-story');
  assert.equal(result.path, '/en-gb/blue-benefits');
  assert.deepEqual(result.metadata.description, {
    source: 'live',
    value: 'Discover Safar Flyer Blue membership benefits including miles earning, rewards, and exclusive travel perks.',
  });
  assert.deepEqual(result.metadata.deviations, []);
  assert.match(result.html, /class="hero loyalty-tier"/);
  assert.match(result.html, /class="cards loyalty-benefits"/);
  assert.match(result.html, /class="columns loyalty-content image-right"/);
  assert.match(result.html, /class="columns loyalty-content image-left"/);
  assert.match(result.html, /src="\.\/images\/blue-benefits\/hero\.jpg"/);
  assert.match(result.html, /href="\/en-gb\/safar-flyer-and-oneworld"/);
  assert.match(result.html, /href="\/en-gb\/silver-benefits"/);
  assert.match(result.html, /href="\/en\/safar-flyer\/join-us"/);
  assert.match(result.html, /href="https:\/\/www\.royalairmaroc\.com\/int-en\/cash-miles"/);
  assert.equal(result.metadata.images.length, 11);
});

test('decorates labeled Blue content through existing block variants', async () => {
  const [hero, cards, columns] = await Promise.all([
    readFile(new URL('../blocks/hero/hero.js', import.meta.url), 'utf8'),
    readFile(new URL('../blocks/cards/cards.js', import.meta.url), 'utf8'),
    readFile(new URL('../blocks/columns/columns.js', import.meta.url), 'utf8'),
  ]);

  assert.match(hero, /classList\.contains\('loyalty-tier'\)/);
  assert.match(cards, /classList\.contains\('loyalty-benefits'\)/);
  assert.match(columns, /classList\.contains\('loyalty-content'\)/);
  assert.doesNotMatch(hero, /createOptimizedPicture/);
  assert.doesNotMatch(cards, /createOptimizedPicture/);
});

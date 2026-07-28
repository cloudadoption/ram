import assert from 'node:assert/strict';

const origin = process.env.HEAD_TEST_ORIGIN || 'http://localhost:3010';
const pageSpec = process.env.HEAD_TEST_PAGES
  || '/drafts/homepage-hero:en-GB,/drafts/baggage-information:en-GB,/drafts/seats:en-GB';

const pages = pageSpec.split(',').map((entry) => {
  const separator = entry.lastIndexOf(':');
  return {
    path: entry.slice(0, separator),
    lang: entry.slice(separator + 1),
  };
});

for (const { path, lang } of pages) {
  const url = new URL(path, origin);
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} returned ${response.status}`);

  const html = await response.text();
  const openingTag = html.match(/<html[^>]*>/i)?.[0];
  assert.ok(openingTag, `${url} has no served html element`);
  assert.match(
    openingTag,
    new RegExp(`\\blang=["']${lang}["']`, 'i'),
    `${url} served ${openingTag}`,
  );
  console.log(`${url} ${openingTag}`);
}

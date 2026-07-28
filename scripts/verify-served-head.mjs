import assert from 'node:assert/strict';

const origin = process.env.HEAD_TEST_ORIGIN;
assert.ok(origin, 'Set HEAD_TEST_ORIGIN to an AEM preview or live origin');

const pageSpec = process.env.HEAD_TEST_PAGES
  || '/:en-GB,/baggage-information:en-GB,/seats:en-GB';

const pages = pageSpec.split(',').map((entry) => {
  const separator = entry.lastIndexOf(':');
  return {
    path: entry.slice(0, separator),
    lang: entry.slice(separator + 1),
  };
});

const results = await Promise.all(pages.map(async ({ path, lang }) => {
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
  return `${url} ${openingTag}`;
}));

process.stdout.write(`${results.join('\n')}\n`);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(
  await readFile(new URL(path, import.meta.url), 'utf8'),
);

test('accepts the known-good 33 percent text control', async () => {
  const { assertCaptureCompleteness } = await import(
    '../tools/parity/parity.js'
  );

  const result = assertCaptureCompleteness({
    liveTextCharacters: 10000,
    targetTextCharacters: 3300,
  });

  assert.equal(result.minimumRatio, 0.3);
  assert.equal(result.ratio, 0.33);
  assert.equal(result.passed, true);
});

test('rejects the observed partial Gold capture', async () => {
  const { assertCaptureCompleteness } = await import(
    '../tools/parity/parity.js'
  );

  assert.throws(() => assertCaptureCompleteness({
    liveTextCharacters: 9903,
    targetTextCharacters: 497,
  }), /5\.0%.*30\.0%/);
});

test('does not round a capture up to the completeness floor', async () => {
  const { evaluateCaptureCompleteness } = await import(
    '../tools/parity/parity.js'
  );

  const result = evaluateCaptureCompleteness({
    liveTextCharacters: 1000,
    targetTextCharacters: 299,
  });

  assert.equal(result.ratio, 0.299);
  assert.equal(result.passed, false);
});

test('rejects a capture that redirects to a different page', async () => {
  const { assertExpectedNavigation } = await import(
    '../tools/parity/parity.js'
  );

  assert.doesNotThrow(() => assertExpectedNavigation(
    'https://example.com/en-gb/blue-benefits',
    'https://example.com/en-gb/blue-benefits/',
  ));
  assert.throws(() => assertExpectedNavigation(
    'https://example.com/en-gb/blue-benefits',
    'https://example.com/en/blue-benefits',
  ), /Navigation left requested page/);
});

test('compares normalized block geometry from deterministic fixtures', async () => {
  const { compareCaptures } = await import('../tools/parity/parity.js');
  const [live, target] = await Promise.all([
    readJson('./fixtures/parity/full-live.json'),
    readJson('./fixtures/parity/complete-target.json'),
  ]);

  const result = compareCaptures(live, target, {
    maxContentHeightDelta: 4,
    maxBlockHeightDelta: 4,
    maxPositionDelta: 4,
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.missingBlocks, []);
  assert.equal(result.text.ratio, 0.485);
  assert.equal(result.geometry.contentHeightDelta, -2);
  assert.equal(result.geometry.maxBlockHeightDelta, 2);
  assert.equal(result.geometry.maxPositionDelta, 1);
  assert.equal(result.geometry.maxHorizontalDelta, 0);
  assert.equal(result.geometry.passed, true);
});

test('records non-comparable horizontal wrapper deltas as evidence', async () => {
  const { compareCaptures } = await import('../tools/parity/parity.js');
  const [live, target] = await Promise.all([
    readJson('./fixtures/parity/full-live.json'),
    readJson('./fixtures/parity/complete-target.json'),
  ]);
  target.blocks[0].box.x = 20;
  target.blocks[0].box.width = 335;

  const result = compareCaptures(live, target, {
    maxContentHeightDelta: 4,
    maxBlockHeightDelta: 4,
    maxPositionDelta: 4,
  });

  assert.equal(result.geometry.maxHorizontalDelta, 40);
  assert.equal(result.geometry.passed, true);
});

test('reports a large delta instead of zero for a partial target', async () => {
  const { compareCaptures } = await import('../tools/parity/parity.js');
  const [live, target] = await Promise.all([
    readJson('./fixtures/parity/full-live.json'),
    readJson('./fixtures/parity/partial-target.json'),
  ]);

  const result = compareCaptures(live, target);

  assert.equal(result.passed, false);
  assert.deepEqual(result.missingBlocks, ['content', 'support']);
  assert.equal(result.geometry.contentHeightDelta, -3880);
  assert.equal(result.geometry.passed, false);
  assert.equal(result.text.passed, false);
});

test('the importer enforces a fresh completeness control', async () => {
  const source = await readFile(
    new URL('../tools/importer/import-editorial.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /assertCaptureCompleteness/);
  assert.match(source, /captureFreshLiveText/);
  assert.match(source, /capture-completeness\.json/);
});

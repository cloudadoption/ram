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

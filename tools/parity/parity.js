export const PARITY_WIDTHS = [375, 900, 1440];
export const DEFAULT_COMPLETENESS_RATIO = 0.3;

const round = (value, precision = 3) => Number(value.toFixed(precision));
const absoluteMaximum = (values) => (
  values.length ? Math.max(...values.map((value) => Math.abs(value))) : 0
);

export function evaluateCaptureCompleteness({
  liveTextCharacters,
  targetTextCharacters,
  minimumRatio = DEFAULT_COMPLETENESS_RATIO,
}) {
  if (!Number.isFinite(liveTextCharacters) || liveTextCharacters <= 0) {
    throw new Error('Fresh live capture has no measurable main text');
  }
  if (!Number.isFinite(targetTextCharacters) || targetTextCharacters < 0) {
    throw new Error('Target capture has an invalid main-text count');
  }
  const rawRatio = targetTextCharacters / liveTextCharacters;
  const ratio = round(rawRatio);
  return {
    liveTextCharacters,
    targetTextCharacters,
    minimumRatio,
    ratio,
    passed: rawRatio >= minimumRatio,
  };
}

export function assertCaptureCompleteness(options) {
  const result = evaluateCaptureCompleteness(options);
  if (!result.passed) {
    throw new Error(
      `Capture completeness ${round(result.ratio * 100, 1).toFixed(1)}% is below `
      + `${round(result.minimumRatio * 100, 1).toFixed(1)}% `
      + `(${result.targetTextCharacters}/${result.liveTextCharacters} characters)`,
    );
  }
  return result;
}

export function assertExpectedNavigation(requestedUrl, finalUrl) {
  const requested = new URL(requestedUrl);
  const final = new URL(finalUrl);
  const normalizePath = (pathname) => pathname.replace(/\/+$/, '') || '/';
  if (
    requested.origin !== final.origin
    || normalizePath(requested.pathname) !== normalizePath(final.pathname)
  ) {
    throw new Error(
      `Navigation left requested page: ${requestedUrl} resolved to ${finalUrl}`,
    );
  }
}

function normalizeBlockPositions(blocks) {
  const origin = blocks[0]?.box.y || 0;
  return blocks.map((block) => ({
    ...block,
    normalizedY: block.box.y - origin,
  }));
}

function compareComputedStyles(liveStyles = {}, targetStyles = {}) {
  return Object.fromEntries(
    Object.keys({ ...liveStyles, ...targetStyles })
      .filter((key) => liveStyles[key] !== targetStyles[key])
      .map((key) => [key, {
        live: liveStyles[key],
        target: targetStyles[key],
      }]),
  );
}

export function compareCaptures(live, target, thresholds = {}) {
  if (live.width !== target.width) {
    throw new Error(`Capture widths differ: ${live.width} and ${target.width}`);
  }
  const limits = {
    minimumTextRatio: DEFAULT_COMPLETENESS_RATIO,
    maxContentHeightDelta: 8,
    maxBlockHeightDelta: 4,
    maxPositionDelta: 4,
    ...thresholds,
  };
  const text = evaluateCaptureCompleteness({
    liveTextCharacters: live.textCharacters,
    targetTextCharacters: target.textCharacters,
    minimumRatio: limits.minimumTextRatio,
  });
  const liveBlocks = normalizeBlockPositions(live.blocks);
  const targetBlocks = normalizeBlockPositions(target.blocks);
  const targetByName = new Map(targetBlocks.map((block) => [block.name, block]));
  const liveNames = new Set(liveBlocks.map(({ name }) => name));
  const rows = liveBlocks.flatMap((liveBlock) => {
    const targetBlock = targetByName.get(liveBlock.name);
    if (!targetBlock) return [];
    return [{
      name: liveBlock.name,
      live: {
        box: liveBlock.box,
        normalizedY: liveBlock.normalizedY,
        computedStyle: liveBlock.computedStyle,
      },
      target: {
        box: targetBlock.box,
        normalizedY: targetBlock.normalizedY,
        computedStyle: targetBlock.computedStyle,
      },
      delta: {
        x: targetBlock.box.x - liveBlock.box.x,
        y: targetBlock.normalizedY - liveBlock.normalizedY,
        width: targetBlock.box.width - liveBlock.box.width,
        height: targetBlock.box.height - liveBlock.box.height,
      },
      computedStyleDifferences: compareComputedStyles(
        liveBlock.computedStyle,
        targetBlock.computedStyle,
      ),
    }];
  });
  const missingBlocks = liveBlocks
    .filter(({ name }) => !targetByName.has(name))
    .map(({ name }) => name);
  const unexpectedBlocks = targetBlocks
    .filter(({ name }) => !liveNames.has(name))
    .map(({ name }) => name);
  const geometry = {
    contentHeightDelta: target.contentBox.height - live.contentBox.height,
    maxBlockHeightDelta: absoluteMaximum(rows.map(({ delta }) => delta.height)),
    maxPositionDelta: absoluteMaximum(rows.map(({ delta }) => delta.y)),
    maxHorizontalDelta: absoluteMaximum(rows.flatMap(({ delta }) => [
      delta.x,
      delta.width,
    ])),
    rows,
  };
  // Legacy portlet wrappers and EDS block roots are not equivalent horizontal boxes.
  // Keep x and width deltas as evidence, but gate comparable height and vertical flow.
  const geometryPassed = missingBlocks.length === 0
    && unexpectedBlocks.length === 0
    && Math.abs(geometry.contentHeightDelta) <= limits.maxContentHeightDelta
    && geometry.maxBlockHeightDelta <= limits.maxBlockHeightDelta
    && geometry.maxPositionDelta <= limits.maxPositionDelta;
  geometry.passed = geometryPassed;
  const passed = text.passed && geometryPassed;

  return {
    width: live.width,
    liveUrl: live.url,
    liveFinalUrl: live.finalUrl || live.url,
    liveStatus: live.status,
    targetUrl: target.url,
    targetFinalUrl: target.finalUrl || target.url,
    targetStatus: target.status,
    thresholds: limits,
    text,
    geometry,
    missingBlocks,
    unexpectedBlocks,
    passed,
  };
}

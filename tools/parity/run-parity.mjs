#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { launch } from 'puppeteer-core';

import {
  assertExpectedNavigation,
  compareCaptures,
  PARITY_WIDTHS,
} from './parity.js';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

function parseArguments(argv) {
  const options = { output: 'parity-results' };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--')) throw new Error(`Unexpected argument: ${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    options[name.slice(2)] = value;
    index += 1;
  }
  if (!options.config) throw new Error('--config is required');
  return options;
}

async function findChrome(explicitPath) {
  const candidates = [explicitPath, ...CHROME_CANDIDATES].filter(Boolean);
  const findCandidate = async ([candidate, ...remaining]) => {
    if (!candidate) return null;
    try {
      await access(candidate);
      return candidate;
    } catch {
      return findCandidate(remaining);
    }
  };
  const candidate = await findCandidate(candidates);
  if (candidate) return candidate;
  const command = spawnSync('sh', ['-c', 'command -v google-chrome || command -v chromium'], {
    encoding: 'utf8',
  });
  if (command.status === 0 && command.stdout.trim()) return command.stdout.trim();
  throw new Error('Chrome not found. Set CHROME_PATH or pass --chrome.');
}

async function settle(page) {
  await page.evaluate(async () => {
    const removeOverlays = () => [
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '.onetrust-pc-dark-filter',
      '#ot-sdk-btn-floating',
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    });
    removeOverlays();
    try {
      await document.fonts.ready;
    } catch {
      // Font readiness is best effort on the legacy source.
    }
    const scrollPage = async (y, height) => {
      if (y >= height) return;
      window.scrollTo(0, y);
      await new Promise((done) => { setTimeout(done, 100); });
      await scrollPage(y + 700, height);
    };
    await scrollPage(0, Math.min(document.body.scrollHeight, 32000));
    window.scrollTo(0, 0);
    await new Promise((done) => { setTimeout(done, 1200); });
    removeOverlays();
    document.querySelectorAll('body *').forEach((element) => {
      const styles = getComputedStyle(element);
      if (styles.position === 'fixed' && parseInt(styles.zIndex, 10) >= 50) {
        const box = element.getBoundingClientRect();
        if (
          box.width > window.innerWidth * 0.6
          && box.height > window.innerHeight * 0.5
        ) {
          element.remove();
        }
      }
    });
  });
}

function resolveBlocks(pageConfig, mappings) {
  if (pageConfig.blocks) return pageConfig.blocks;
  const profile = mappings.profiles.find(({ path }) => path === pageConfig.profilePath);
  if (!profile) throw new Error(`No import profile for ${pageConfig.profilePath}`);
  return profile.blocks.map(({ name, instances }) => ({
    name,
    liveSelectors: instances,
  }));
}

async function capturePage(browser, {
  url,
  width,
  textSelector,
  blocks,
  side,
  screenshot,
}) {
  const page = await browser.newPage();
  const errors = {
    console: [],
    page: [],
    request: [],
    response: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => {
    errors.request.push({
      url: request.url(),
      error: request.failure()?.errorText,
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.response.push({ url: response.url(), status: response.status() });
    }
  });

  try {
    await page.setViewport({ width, height: width === 375 ? 812 : 900, deviceScaleFactor: 1 });
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    if (!response || response.status() >= 400) {
      throw new Error(`${url} returned ${response?.status() || 'no response'}`);
    }
    assertExpectedNavigation(url, page.url());
    await settle(page);
    const capture = await page.evaluate((options) => {
      const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const textElements = [...document.querySelectorAll(options.textSelector)];
      if (!textElements.length) {
        throw new Error(`No text content matches ${options.textSelector}`);
      }
      const targetBlocks = [...document.querySelectorAll('main .block')];
      const usesBlockOrder = options.side === 'target'
        && options.blocks.every(({ targetSelectors }) => !targetSelectors?.length);
      if (usesBlockOrder && targetBlocks.length !== options.blocks.length) {
        throw new Error(
          `Expected ${options.blocks.length} target blocks, found ${targetBlocks.length}`,
        );
      }
      const toBox = (elements) => {
        const boxes = elements
          .map((element) => element.getBoundingClientRect())
          .filter(({ width: boxWidth, height }) => boxWidth > 0 && height > 0);
        if (!boxes.length) return null;
        const left = Math.min(...boxes.map(({ left: value }) => value));
        const top = Math.min(...boxes.map(({ top: value }) => value));
        const right = Math.max(...boxes.map(({ right: value }) => value));
        const bottom = Math.max(...boxes.map(({ bottom: value }) => value));
        return {
          x: Math.round(left),
          y: Math.round(top + window.scrollY),
          width: Math.round(right - left),
          height: Math.round(bottom - top),
        };
      };
      const measurements = options.blocks.map((block, index) => {
        const selectors = options.side === 'live'
          ? block.liveSelectors
          : block.targetSelectors;
        const elements = selectors?.length
          ? [...new Set(selectors.flatMap(
            (selector) => [...document.querySelectorAll(selector)],
          ))]
          : [targetBlocks[index]].filter(Boolean);
        const visibleElements = elements.filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        });
        const box = toBox(visibleElements);
        if (!box) throw new Error(`No visible ${options.side} geometry for ${block.name}`);
        const styles = getComputedStyle(visibleElements[0]);
        return {
          name: block.name,
          box,
          computedStyle: {
            font: `${styles.fontFamily.split(',')[0]} ${styles.fontSize}/${styles.lineHeight} ${styles.fontWeight}`,
            color: styles.color,
            background: styles.backgroundColor,
            margin: `${styles.marginTop} ${styles.marginRight} ${styles.marginBottom} ${styles.marginLeft}`,
            padding: `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`,
          },
        };
      });
      return {
        finalUrl: window.location.href,
        title: document.title,
        blockCount: options.side === 'target' ? targetBlocks.length : measurements.length,
        textCharacters: normalizeText(
          textElements.map((element) => element.innerText).join(' '),
        ).length,
        contentBox: toBox(measurements.map(({ name }) => {
          const block = options.blocks.find((candidate) => candidate.name === name);
          const selectors = options.side === 'live'
            ? block.liveSelectors
            : block.targetSelectors;
          return selectors?.length
            ? [...new Set(selectors.flatMap(
              (selector) => [...document.querySelectorAll(selector)],
            ))]
            : [targetBlocks[
              options.blocks.findIndex((candidate) => candidate.name === name)
            ]].filter(Boolean);
        }).flat()),
        blocks: measurements,
      };
    }, {
      textSelector,
      blocks,
      side,
    });
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      url,
      width,
      status: response.status(),
      ...capture,
      errors,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const config = JSON.parse(await readFile(resolve(options.config), 'utf8'));
  const mappings = JSON.parse(await readFile(
    new URL('../importer/page-mappings.json', import.meta.url),
    'utf8',
  ));
  const widths = config.widths || PARITY_WIDTHS;
  if (JSON.stringify(widths) !== JSON.stringify(PARITY_WIDTHS)) {
    throw new Error('Parity widths must be 375, 900, and 1440');
  }
  const selectedPages = options.page
    ? config.pages.filter(({ slug }) => slug === options.page)
    : config.pages;
  if (!selectedPages.length) throw new Error(`No configured page matches ${options.page}`);

  const output = resolve(options.output);
  await mkdir(output, { recursive: true });
  const browser = await launch({
    executablePath: await findChrome(options.chrome),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const reports = [];
  try {
    await selectedPages.reduce(async (pageSequence, pageConfig) => {
      await pageSequence;
      const directory = join(output, pageConfig.slug);
      await mkdir(directory, { recursive: true });
      const blocks = resolveBlocks(pageConfig, mappings);
      await widths.reduce(async (widthSequence, width) => {
        await widthSequence;
        const live = await capturePage(browser, {
          url: pageConfig.liveUrl,
          width,
          textSelector: pageConfig.liveTextSelector || '.inner-layout',
          blocks,
          side: 'live',
          screenshot: join(directory, `live-${width}.png`),
        });
        const target = await capturePage(browser, {
          url: pageConfig.targetUrl,
          width,
          textSelector: pageConfig.targetTextSelector || 'main',
          blocks,
          side: 'target',
          screenshot: join(directory, `target-${width}.png`),
        });
        await Promise.all([
          writeFile(
            join(directory, `live-${width}.json`),
            `${JSON.stringify(live, null, 2)}\n`,
          ),
          writeFile(
            join(directory, `target-${width}.json`),
            `${JSON.stringify(target, null, 2)}\n`,
          ),
        ]);
        reports.push({
          slug: pageConfig.slug,
          ...compareCaptures(live, target, pageConfig.thresholds),
        });
      }, Promise.resolve());
    }, Promise.resolve());
  } finally {
    await browser.close();
  }

  await writeFile(
    join(output, 'parity-report.json'),
    `${JSON.stringify(reports, null, 2)}\n`,
  );
  const summary = [
    [
      'page',
      'width',
      'text-ratio',
      'content-height-delta',
      'block-height-delta',
      'position-delta',
      'horizontal-delta',
      'text-status',
      'text-passed',
      'geometry-passed',
      'passed',
    ].join('\t'),
    ...reports.map((report) => [
      report.slug,
      report.width,
      report.text.ratio,
      report.geometry.contentHeightDelta,
      report.geometry.maxBlockHeightDelta,
      report.geometry.maxPositionDelta,
      report.geometry.maxHorizontalDelta,
      report.text.status,
      report.text.passed,
      report.geometry.passed,
      report.passed,
    ].join('\t')),
  ];
  await writeFile(join(output, 'parity-summary.tsv'), `${summary.join('\n')}\n`);
  process.stdout.write(`${summary.join('\n')}\n`);
  if (reports.some(({ passed }) => !passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

import { parseHTML } from 'linkedom';
import { launch } from 'puppeteer-core';

import {
  buildDaDocument,
  classifyEditorialUrl,
  findImportProfile,
  transformEditorialDocument,
} from './editorial-pipeline.js';
import validateImageSource from './lib/media.js';
import cleanupDocument from './transformers/cleanup.js';
import {
  assertCaptureCompleteness,
  assertExpectedNavigation,
  evaluateCaptureCompleteness,
} from '../parity/parity.js';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

function parseArguments(argv) {
  const options = { phase: 'all', format: 'local' };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--')) throw new Error(`Unexpected argument: ${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    options[name.slice(2)] = value;
    index += 1;
  }
  if (!options.url) throw new Error('--url is required');
  if (!['all', 'analyze', 'map', 'import'].includes(options.phase)) {
    throw new Error('--phase must be all, analyze, map, or import');
  }
  if (!['local', 'da'].includes(options.format)) {
    throw new Error('--format must be local or da');
  }
  if (options.format === 'da' && !options['media-base']) {
    throw new Error('--media-base is required when --format is da');
  }
  return options;
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next portable browser location.
    }
  }
  const command = spawnSync('sh', ['-c', 'command -v google-chrome || command -v chromium'], {
    encoding: 'utf8',
  });
  if (command.status === 0 && command.stdout.trim()) return command.stdout.trim();
  throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.');
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
      // Font readiness is best effort on legacy pages.
    }
    const height = Math.min(document.body.scrollHeight, 32000);
    for (let y = 0; y < height; y += 700) {
      window.scrollTo(0, y);
      await new Promise((done) => { setTimeout(done, 100); });
    }
    window.scrollTo(0, 0);
    await new Promise((done) => { setTimeout(done, 1200); });
    removeOverlays();
  });
}

async function captureTextCharacters(page, selector) {
  return page.evaluate((textSelector) => {
    const elements = [...document.querySelectorAll(textSelector)];
    if (!elements.length) throw new Error(`No live content matches ${textSelector}`);
    return elements
      .map((element) => element.innerText || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .length;
  }, selector);
}

async function captureLive(url, workDir, textSelector) {
  const browser = await launch({
    executablePath: await findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    if (!response || response.status() >= 400) {
      throw new Error(`${url} returned ${response?.status() || 'no response'}`);
    }
    assertExpectedNavigation(url, page.url());
    await settle(page);
    await page.evaluate(() => {
      document.querySelectorAll('body *').forEach((element) => {
        const background = getComputedStyle(element).backgroundImage;
        const match = background.match(/^url\(["']?(.+?)["']?\)$/);
        if (match) {
          element.setAttribute(
            'data-import-background-image',
            new URL(match[1], document.baseURI).href,
          );
        }
      });
    });
    const html = await page.content();
    const textCharacters = await captureTextCharacters(page, textSelector);
    await page.screenshot({ path: join(workDir, 'screenshot.png'), fullPage: true });
    return { html, textCharacters };
  } finally {
    await browser.close();
  }
}

async function captureFreshLiveText(url, textSelector) {
  const browser = await launch({
    executablePath: await findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    try {
      if (!response || response.status() >= 400) {
        throw new Error(`${url} returned ${response?.status() || 'no response'}`);
      }
      assertExpectedNavigation(url, page.url());
      await settle(page);
      return await captureTextCharacters(page, textSelector);
    } catch (error) {
      throw new Error(`Fresh live completeness capture failed: ${error.message}`, {
        cause: error,
      });
    }
  } finally {
    await browser.close();
  }
}

function cleanHtml(sourceHtml) {
  const { document } = parseHTML(sourceHtml);
  cleanupDocument(document);
  return document.toString();
}

function htmlTextCharacters(html) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  return (document.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

async function validateCaptureCompleteness({
  url,
  result,
  workDir,
  textSelector,
  initialCaptureTextCharacters,
}) {
  const liveTextCharacters = await captureFreshLiveText(url, textSelector);
  const targetTextCharacters = htmlTextCharacters(result.html);
  const options = {
    liveTextCharacters,
    targetTextCharacters,
  };
  const completeness = evaluateCaptureCompleteness(options);
  const artifact = {
    sourceUrl: url,
    textSelector,
    initialCaptureTextCharacters,
    ...completeness,
  };
  await writeFile(
    join(workDir, 'capture-completeness.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  assertCaptureCompleteness(options);
  return artifact;
}

function contentTypeExtension(contentType) {
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('gif')) return '.gif';
  return '.jpg';
}

async function downloadImages(urls, directory) {
  await mkdir(directory, { recursive: true });
  const results = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    validateImageSource(url, 'image/pending');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image returned ${response.status}: ${url}`);
    const contentType = response.headers.get('content-type') || '';
    validateImageSource(response.url || url, contentType);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 25 * 1024 * 1024) {
      throw new Error(`Image exceeds the 25 MB import limit: ${url}`);
    }
    const sourceName = basename(new URL(url).pathname);
    const sourceExtension = extname(sourceName);
    const extension = sourceExtension || contentTypeExtension(contentType);
    const file = `${String(index + 1).padStart(2, '0')}-${sourceName.replace(/\.[^.]+$/, '') || 'image'}${extension}`;
    const content = Buffer.from(await response.arrayBuffer());
    if (content.byteLength > 25 * 1024 * 1024) {
      throw new Error(`Image exceeds the 25 MB import limit: ${url}`);
    }
    await writeFile(join(directory, file), content);
    results.push({ source: url, file });
  }
  return results;
}

async function writeMappingArtifacts(result, workDir) {
  await Promise.all([
    writeFile(
      join(workDir, 'page-structure.json'),
      `${JSON.stringify(result.pageStructure, null, 2)}\n`,
    ),
    writeFile(
      join(workDir, 'authoring-analysis.json'),
      `${JSON.stringify(result.authoringAnalysis, null, 2)}\n`,
    ),
    writeFile(
      join(workDir, 'visual-trees.json'),
      `${JSON.stringify(result.visualTrees, null, 2)}\n`,
    ),
  ]);

  await Promise.all(Object.entries(result.blockContexts).map(async ([name, html]) => {
    const blockDirectory = join(workDir, 'block-context', name.replace(/\s+/g, '-'));
    await mkdir(blockDirectory, { recursive: true });
    await writeFile(join(blockDirectory, 'source.html'), html);
  }));
}

function buildImageSources(downloadedImages, slug, mediaBase) {
  const prefix = mediaBase
    ? `${mediaBase.replace(/\/$/, '')}/${slug}/`
    : `./images/${slug}/`;
  return Object.fromEntries(downloadedImages.map(({ source, file }) => [
    source,
    `${prefix}${file}`,
  ]));
}

async function copyOutputImages(downloadedImages, workDir, output, slug) {
  const directory = join(dirname(output), 'images', slug);
  await mkdir(directory, { recursive: true });
  await Promise.all(downloadedImages.map(({ file }) => (
    copyFile(join(workDir, 'images', file), join(directory, file))
  )));
}

async function validateCatalog(url, expectedTemplate) {
  const catalogPath = new URL('../../catalog/site-scope.json', import.meta.url);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const template = classifyEditorialUrl(url, catalog);
  if (expectedTemplate && template.name !== expectedTemplate) {
    throw new Error(
      `Catalog assigns ${url} to ${template.name}, not ${expectedTemplate}`,
    );
  }
  return template;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const url = new URL(options.url).href.replace(/\/$/, '');
  const profile = findImportProfile(url);
  const catalogTemplate = await validateCatalog(url, options.template);
  if (profile && profile.template !== catalogTemplate.name) {
    throw new Error(`Mapping and catalog disagree for ${url}`);
  }

  const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  const workDir = resolve(options['work-dir'] || join('migration-work', slug));
  const defaultOutput = join('content', `${new URL(url).pathname}.plain.html`);
  const output = resolve(options.output || defaultOutput);
  await mkdir(workDir, { recursive: true });

  let sourceHtml;
  let metadata;
  const textSelector = profile?.completeness?.liveTextSelector || '.inner-layout';
  if (options.phase === 'all' || options.phase === 'analyze') {
    const capture = await captureLive(url, workDir, textSelector);
    sourceHtml = capture.html;
    const cleaned = cleanHtml(sourceHtml);
    await writeFile(join(workDir, 'cleaned.html'), cleaned);
    const preliminary = transformEditorialDocument(cleaned, { url });
    await validateCaptureCompleteness({
      url,
      result: preliminary,
      workDir,
      textSelector,
      initialCaptureTextCharacters: capture.textCharacters,
    });
    const downloadedImages = await downloadImages(
      preliminary.metadata.images,
      join(workDir, 'images'),
    );
    metadata = {
      ...preliminary.metadata,
      catalogTemplate: catalogTemplate.name,
      downloadedImages,
      capture: {
        textSelector,
        textCharacters: capture.textCharacters,
      },
    };
    await writeFile(
      join(workDir, 'metadata.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  } else {
    sourceHtml = await readFile(join(workDir, 'cleaned.html'), 'utf8');
    metadata = JSON.parse(await readFile(join(workDir, 'metadata.json'), 'utf8'));
  }

  if (options.phase === 'analyze') {
    console.log(`Analyzed ${url} into ${workDir}`);
    return;
  }

  const imageSources = buildImageSources(
    metadata.downloadedImages,
    slug,
    options['media-base'],
  );
  const result = transformEditorialDocument(sourceHtml, { url, imageSources });
  if (options.phase === 'import') {
    await validateCaptureCompleteness({
      url,
      result,
      workDir,
      textSelector,
      initialCaptureTextCharacters: metadata.capture?.textCharacters,
    });
  }
  if (options.phase === 'all' || options.phase === 'map') {
    await writeMappingArtifacts(result, workDir);
  }
  if (options.phase === 'map') {
    console.log(`Mapped ${result.authoringAnalysis.contentSequences.length} blocks in ${workDir}`);
    return;
  }

  await mkdir(dirname(output), { recursive: true });
  await copyOutputImages(metadata.downloadedImages, workDir, output, slug);
  const outputHtml = options.format === 'da'
    ? buildDaDocument(result.html)
    : result.html;
  await writeFile(output, `${outputHtml}\n`);
  await writeFile(join(workDir, 'import-report.json'), `${JSON.stringify({
    sourceUrl: url,
    output,
    path: result.path,
    template: result.template,
    blocks: result.authoringAnalysis.contentSequences.map(({ blockName }) => blockName),
    description: result.metadata.description,
    deviations: result.metadata.deviations,
    linkOverrides: result.metadata.linkOverrides,
    images: metadata.downloadedImages.map(({ source, file }) => ({
      source,
      file,
      reference: imageSources[source],
    })),
    handEdits: 0,
  }, null, 2)}\n`);
  await copyFile(output, join(workDir, 'imported.plain.html'));
  await copyOutputImages(
    metadata.downloadedImages,
    workDir,
    join(workDir, 'imported.plain.html'),
    slug,
  );
  console.log(JSON.stringify({
    sourceUrl: url,
    template: result.template,
    output,
    workDir,
    blocks: result.authoringAnalysis.contentSequences.map(({ blockName }) => blockName),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

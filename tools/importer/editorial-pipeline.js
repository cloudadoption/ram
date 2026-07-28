import { readFileSync } from 'node:fs';

import { parseHTML } from 'linkedom';

import parseLabeledBlock from './lib/labeled-block.js';
import cleanupDocument from './transformers/cleanup.js';

export { normalizeEditorialHref } from './transformers/links.js';

const mappingFile = new URL('./page-mappings.json', import.meta.url);
const mappings = JSON.parse(readFileSync(mappingFile, 'utf8'));

const normalizeUrl = (value) => value.replace(/\/$/, '');

export function classifyEditorialUrl(url, catalog) {
  const normalized = normalizeUrl(url);
  const parsed = new URL(normalized);

  if (parsed.origin !== 'https://www.royalairmaroc.com') {
    throw new Error(`Editorial imports only accept www.royalairmaroc.com URLs: ${url}`);
  }
  if (!parsed.pathname.startsWith('/en-gb/')) {
    throw new Error(`Editorial import URL must use lowercase /en-gb/: ${url}`);
  }

  const template = catalog.templates.find(({ prefix, urls }) => (
    prefix === '/en-gb/'
    && urls.some((candidate) => normalizeUrl(candidate) === normalized)
  ));
  if (!template) throw new Error(`URL is not assigned by the editorial catalog: ${url}`);
  return template;
}

export function findImportProfile(url) {
  const normalized = normalizeUrl(url);
  return mappings.profiles.find((profile) => normalizeUrl(profile.url) === normalized);
}

function appendValueCell(row, document, value) {
  const cell = document.createElement('div');
  cell.textContent = value;
  row.append(cell);
}

function buildMetadataBlock(document, sourceDocument) {
  const block = document.createElement('div');
  block.className = 'metadata';
  const values = [
    ['Title', sourceDocument.title],
    [
      'Description',
      sourceDocument.querySelector('meta[name="description"], meta[property="og:description"]')
        ?.getAttribute('content'),
    ],
    ['HTML Lang', sourceDocument.documentElement.getAttribute('lang') || 'en-GB'],
  ].filter(([, value]) => value);

  values.forEach(([label, value]) => {
    const row = document.createElement('div');
    appendValueCell(row, document, label);
    appendValueCell(row, document, value);
    block.append(row);
  });
  return block;
}

function appendSection(root, document, block) {
  const section = document.createElement('div');
  section.append(block);
  root.append(section);
}

function buildAnalysis(profile, outputDocument, sourceHtml) {
  const blocks = profile.blocks.map((block, index) => ({
    id: `section-${index + 1}`,
    name: block.name,
    selector: block.instances[0],
    instances: block.instances,
    decision: 'block',
    blockName: block.name,
  }));
  const images = [...outputDocument.querySelectorAll('img[src]')]
    .map((image) => image.getAttribute('src'));

  return {
    metadata: {
      sourceUrl: profile.url,
      documentPath: profile.path,
      template: profile.template,
      images,
    },
    pageStructure: {
      sourceUrl: profile.url,
      sections: blocks.map((block) => ({
        id: block.id,
        name: block.name,
        selector: block.selector,
        styling: {},
      })),
    },
    authoringAnalysis: {
      sourceUrl: profile.url,
      template: profile.template,
      contentSequences: blocks,
    },
    visualTrees: {
      sourceUrl: profile.url,
      nodeMap: Object.fromEntries(
        blocks.map((block) => [block.name, block.instances]),
      ),
    },
    blockContexts: Object.fromEntries(profile.blocks.map((block) => {
      const { document } = parseHTML(sourceHtml);
      const source = block.instances
        .map((selector) => document.querySelector(selector))
        .find(Boolean);
      return [block.name, source?.outerHTML || ''];
    })),
  };
}

export function transformEditorialDocument(sourceHtml, { url, imageSources = {} }) {
  const profile = findImportProfile(url);
  if (!profile) {
    throw new Error(
      `No declarative block mapping exists for ${url}. Add a profile to tools/importer/page-mappings.json.`,
    );
  }

  const { document } = parseHTML(sourceHtml);
  cleanupDocument(document);

  const output = document.createElement('main');
  profile.blocks.forEach((definition) => {
    appendSection(
      output,
      document,
      parseLabeledBlock(
        document,
        definition,
        profile.editorialPaths,
        imageSources,
      ),
    );
  });
  appendSection(output, document, buildMetadataBlock(document, document));

  const analysis = buildAnalysis(profile, output, sourceHtml);
  return {
    template: profile.template,
    path: profile.path,
    html: output.innerHTML,
    ...analysis,
  };
}

export function getMappings() {
  return structuredClone(mappings);
}

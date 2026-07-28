import { normalizeEditorialHref } from '../transformers/links.js';

const ALLOWED_TAGS = new Set([
  'A',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'OL',
  'P',
  'STRONG',
  'UL',
]);
const BLOCK_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'OL', 'P', 'UL']);

const normalizeSpace = (value = '') => value.replace(/\s+/g, ' ').trim();

function selectors(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function selectFirst(root, value) {
  return selectors(value)
    .map((selector) => (selector === ':scope' ? root : root.querySelector(selector)))
    .find(Boolean) || null;
}

function selectAll(root, value) {
  return selectors(value)
    .map((selector) => [...root.querySelectorAll(selector)])
    .find((matches) => matches.length) || [];
}

function copyAllowedNode(node, document, editorialPaths) {
  if (node.nodeType === 3) return document.createTextNode(node.textContent);
  if (node.nodeType !== 1) return null;

  if (!ALLOWED_TAGS.has(node.tagName)) {
    const fragment = document.createDocumentFragment();
    [...node.childNodes].forEach((child) => {
      const copied = copyAllowedNode(child, document, editorialPaths);
      if (copied) fragment.append(copied);
    });
    return fragment;
  }

  const copy = document.createElement(node.tagName.toLowerCase());
  if (node.tagName === 'A') {
    copy.setAttribute(
      'href',
      normalizeEditorialHref(node.getAttribute('href'), editorialPaths),
    );
  }
  [...node.childNodes].forEach((child) => {
    const copied = copyAllowedNode(child, document, editorialPaths);
    if (copied) copy.append(copied);
  });
  if (node.tagName === 'A' && !normalizeSpace(copy.textContent)) return null;
  return copy;
}

function buildTextCell(document, source) {
  return document.createTextNode(normalizeSpace(source?.textContent));
}

function buildElementCell(document, source, specification) {
  const element = document.createElement(specification.tag);
  element.textContent = normalizeSpace(source?.textContent);
  return element;
}

function buildLinkCell(document, root, specification, editorialPaths) {
  const source = selectFirst(root, specification.selectors);
  if (!source) throw new Error(`Missing link for selectors ${selectors(specification.selectors).join(', ')}`);

  const link = document.createElement('a');
  link.setAttribute(
    'href',
    specification.href || normalizeEditorialHref(source.getAttribute('href'), editorialPaths),
  );
  const textSource = selectFirst(root, specification.textSelectors) || source;
  const textClone = textSource.cloneNode(true);
  selectors(specification.excludeSelectors).forEach((selector) => {
    textClone.querySelectorAll(selector).forEach((element) => element.remove());
  });
  link.textContent = normalizeSpace(textClone.textContent);
  return link;
}

function buildPictureCell(document, source, specification, imageSources) {
  if (!source) throw new Error(`Missing image for selectors ${selectors(specification.selectors).join(', ')}`);

  const picture = document.createElement('picture');
  const image = document.createElement('img');
  const sourceUrl = source.getAttribute('src');
  image.setAttribute('loading', specification.loading || 'lazy');
  image.setAttribute('src', imageSources[sourceUrl] || sourceUrl);
  image.setAttribute('alt', source.getAttribute('alt') || '');
  picture.append(image);
  return picture;
}

function buildBackgroundPictureCell(document, source, specification, imageSources) {
  if (!source) {
    throw new Error(
      `Missing background image for selectors ${selectors(specification.selectors).join(', ')}`,
    );
  }
  const sourceUrl = source.getAttribute('data-import-background-image');
  if (!sourceUrl) {
    throw new Error(
      `Missing captured background image for selectors ${selectors(specification.selectors).join(', ')}`,
    );
  }
  const image = document.createElement('img');
  image.setAttribute('loading', specification.loading || 'lazy');
  image.setAttribute('src', imageSources[sourceUrl] || sourceUrl);
  image.setAttribute('alt', specification.alt || '');
  const picture = document.createElement('picture');
  picture.append(image);
  return picture;
}

function buildYoutubeThumbnailCell(document, source, specification, imageSources) {
  if (!source) {
    throw new Error(
      `Missing YouTube embed for selectors ${selectors(specification.selectors).join(', ')}`,
    );
  }
  const embed = new URL(source.getAttribute('src'));
  const match = embed.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)$/);
  if (!['www.youtube.com', 'youtube.com'].includes(embed.hostname) || !match) {
    throw new Error(`Unsupported YouTube embed URL: ${embed.href}`);
  }

  const videoId = match[1];
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const image = document.createElement('img');
  image.setAttribute('loading', specification.loading || 'lazy');
  image.setAttribute('src', imageSources[thumbnailUrl] || thumbnailUrl);
  image.setAttribute('alt', specification.alt);

  const picture = document.createElement('picture');
  picture.append(image);
  const link = document.createElement('a');
  link.setAttribute('href', `https://www.youtube.com/watch?v=${videoId}`);
  link.append(picture);
  return link;
}

function buildRichCell(document, source, specification, editorialPaths) {
  if (!source) return document.createDocumentFragment();
  const clone = source.cloneNode(true);
  selectors(specification.excludeSelectors).forEach((selector) => {
    clone.querySelectorAll(selector).forEach((element) => element.remove());
  });
  if (specification.stripLinks) {
    clone.querySelectorAll('a').forEach((link) => link.replaceWith(...link.childNodes));
  }
  const copied = copyAllowedNode(clone, document, editorialPaths);
  if (copied.nodeType !== 11) return copied;

  const content = document.createDocumentFragment();
  let paragraph;
  [...copied.childNodes].forEach((node) => {
    if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName)) {
      paragraph = undefined;
      content.append(node);
      return;
    }
    if (node.nodeType === 3 && !normalizeSpace(node.textContent)) return;
    if (!paragraph) {
      paragraph = document.createElement('p');
      content.append(paragraph);
    }
    paragraph.append(node);
  });
  return content;
}

function buildDirectTextCell(document, root) {
  const value = [...root.childNodes]
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent)
    .join(' ');
  return document.createTextNode(normalizeSpace(value));
}

function buildMappedTextCell(document, source, specification) {
  const value = normalizeSpace(source?.textContent);
  const match = Object.entries(specification.map)
    .find(([label]) => value.startsWith(label));
  if (!match) throw new Error(`No mapped value for "${value}"`);
  return document.createTextNode(match[1]);
}

function buildLinkOrTextCell(document, root, editorialPaths) {
  const sourceLink = root.matches?.('a[href]') ? root : root.querySelector('a[href]');
  if (!sourceLink) return buildTextCell(document, root);
  return buildLinkCell(document, sourceLink, { selectors: ':scope' }, editorialPaths);
}

function buildCell(document, root, specification, editorialPaths, imageSources) {
  let source = root;
  if (
    specification.kind !== 'link'
    && specification.kind !== 'link-or-text'
    && specification.selectors
  ) {
    source = selectFirst(root, specification.selectors);
  }

  switch (specification.kind) {
    case 'direct-text':
      return buildDirectTextCell(document, root);
    case 'element':
      return buildElementCell(document, source, specification);
    case 'link':
      return buildLinkCell(document, root, specification, editorialPaths);
    case 'link-or-text':
      return buildLinkOrTextCell(document, root, editorialPaths);
    case 'mapped-text':
      return buildMappedTextCell(document, source, specification);
    case 'picture':
      return buildPictureCell(document, source, specification, imageSources);
    case 'background-picture':
      return buildBackgroundPictureCell(document, source, specification, imageSources);
    case 'youtube-thumbnail':
      return buildYoutubeThumbnailCell(document, source, specification, imageSources);
    case 'rich':
      return buildRichCell(document, source, specification, editorialPaths);
    case 'text':
      return buildTextCell(document, source);
    default:
      throw new Error(`Unsupported cell kind "${specification.kind}"`);
  }
}

function appendCell(row, document, content) {
  const cell = document.createElement('div');
  if (content) cell.append(content);
  row.append(cell);
}

function appendRow(
  block,
  document,
  definition,
  roots,
  editorialPaths,
  imageSources,
  includeLabel,
) {
  roots.forEach((root) => {
    const row = document.createElement('div');
    if (includeLabel) {
      appendCell(row, document, document.createTextNode(definition.label));
    }
    definition.cells.forEach((cell) => {
      appendCell(
        row,
        document,
        buildCell(document, root, cell, editorialPaths, imageSources),
      );
    });
    block.append(row);
  });
}

export default function parseLabeledBlock(
  document,
  definition,
  editorialPaths = [],
  imageSources = {},
) {
  const block = document.createElement('div');
  block.className = definition.name;
  const includeLabel = definition.labeled !== false;

  definition.rows.forEach((rowDefinition) => {
    if (rowDefinition.repeatAsCells) {
      const row = document.createElement('div');
      if (includeLabel) {
        appendCell(row, document, document.createTextNode(rowDefinition.label));
      }
      selectAll(document, rowDefinition.repeatAsCells).forEach((root) => {
        appendCell(
          row,
          document,
          buildCell(
            document,
            root,
            rowDefinition.cell,
            editorialPaths,
            imageSources,
          ),
        );
      });
      block.append(row);
      return;
    }

    const roots = rowDefinition.repeat
      ? selectAll(document, rowDefinition.repeat)
      : [document];
    appendRow(
      block,
      document,
      rowDefinition,
      roots,
      editorialPaths,
      imageSources,
      includeLabel,
    );
  });

  return block;
}

export function parseDefaultContent(
  document,
  definition,
  editorialPaths = [],
  imageSources = {},
) {
  const content = document.createDocumentFragment();

  definition.rows.forEach((rowDefinition) => {
    let roots = [document];
    if (rowDefinition.repeatAsCells) {
      roots = selectAll(document, rowDefinition.repeatAsCells);
    } else if (rowDefinition.repeat) {
      roots = selectAll(document, rowDefinition.repeat);
    }
    const cells = rowDefinition.repeatAsCells
      ? [rowDefinition.cell]
      : rowDefinition.cells;

    roots.forEach((root) => {
      cells.forEach((cell) => {
        const value = buildCell(
          document,
          root,
          cell,
          editorialPaths,
          imageSources,
        );
        if (value) content.append(value);
      });
    });
  });

  return content;
}

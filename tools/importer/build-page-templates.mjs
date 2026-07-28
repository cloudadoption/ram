#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const catalogPath = new URL('../../catalog/site-scope.json', import.meta.url);
const mappingsPath = new URL('./page-mappings.json', import.meta.url);
const outputPath = new URL('./page-templates.json', import.meta.url);

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const mappings = JSON.parse(await readFile(mappingsPath, 'utf8'));
const editorial = catalog.templates.filter(({ prefix }) => prefix === '/en-gb/');

const output = {
  metadata: {
    projectType: mappings.metadata.projectType,
    sourceCatalog: mappings.metadata.sourceCatalog,
    editorialPrefix: mappings.metadata.editorialPrefix,
    generatedBy: 'tools/importer/build-page-templates.mjs',
  },
  templates: editorial.map((template) => {
    const profiles = mappings.profiles.filter(({ template: name }) => name === template.name);
    const blocks = new Map();
    profiles.flatMap(({ blocks: mappedBlocks }) => mappedBlocks).forEach((block) => {
      const current = blocks.get(block.name) || new Set();
      block.instances.forEach((selector) => current.add(selector));
      blocks.set(block.name, current);
    });

    return {
      name: template.name,
      description: template.description,
      urls: template.urls,
      blockPalette: template.blocks,
      blocks: [...blocks].map(([name, instances]) => ({
        name,
        instances: [...instances],
      })),
    };
  }),
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${output.templates.length} templates to ${outputPath.pathname}`);

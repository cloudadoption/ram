#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const templates = JSON.parse(await readFile(new URL('page-templates.json', root), 'utf8'));
const mappings = JSON.parse(await readFile(new URL('page-mappings.json', root), 'utf8'));
const urls = templates.templates.flatMap((template) => template.urls);
const errors = [];

if (templates.templates.length !== 7) errors.push('Expected seven editorial templates');
if (urls.length !== 79) errors.push(`Expected 79 editorial URLs, found ${urls.length}`);
if (new Set(urls).size !== 79) errors.push('Editorial URLs must be unique');
if (urls.some((url) => !new URL(url).pathname.startsWith('/en-gb/'))) {
  errors.push('Every editorial URL must use lowercase /en-gb/');
}
if (urls.some((url) => url.includes('/en-GB/') || url.includes('/en_gb/'))) {
  errors.push('Uppercase or underscore editorial namespaces are forbidden');
}

mappings.profiles.forEach((profile) => {
  const template = templates.templates.find(({ name }) => name === profile.template);
  if (!template) errors.push(`Unknown template for ${profile.url}: ${profile.template}`);
  if (!template?.urls.includes(profile.url)) {
    errors.push(`Mapped URL is not assigned to ${profile.template}: ${profile.url}`);
  }
  profile.blocks.forEach((block) => {
    if (!block.name || !block.instances?.length || !block.rows?.length) {
      errors.push(`Incomplete block mapping in ${profile.url}`);
    }
  });
});

await Promise.all([
  access(new URL('parsers/labeled-block.js', root)),
  access(new URL('transformers/cleanup.js', root)),
  access(new URL('transformers/links.js', root)),
]);

await Promise.all(templates.templates.map(({ name }) => (
  access(new URL(`import-${name}.js`, root))
)));

try {
  await access(new URL('import.js', root));
  errors.push('Generic tools/importer/import.js must not exist');
} catch {
  // A generic import script would hide which catalog template is running.
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    valid: true,
    templates: templates.templates.length,
    urls: urls.length,
    profiles: mappings.profiles.length,
    parser: 'labeled-block',
    transformers: ['cleanup', 'links'],
  }, null, 2));
}

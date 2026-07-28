import { transformEditorialDocument } from './editorial-pipeline.js';

export default function createTemplateImport(templateName) {
  return {
    transform: ({ document, params }) => {
      const sourceUrl = params.originalURL;
      const result = transformEditorialDocument(document.toString(), { url: sourceUrl });
      if (result.template !== templateName) {
        throw new Error(
          `Template ${templateName} cannot import ${sourceUrl}, which maps to ${result.template}`,
        );
      }

      const main = document.createElement('main');
      main.innerHTML = result.html;
      return [{
        element: main,
        path: result.path,
        report: {
          title: document.title,
          template: result.template,
          blocks: result.authoringAnalysis.contentSequences.map(({ blockName }) => blockName),
        },
      }];
    },
  };
}

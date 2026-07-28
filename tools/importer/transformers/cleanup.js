const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '.onetrust-pc-dark-filter',
  '#ot-sdk-btn-floating',
  '.sr-only',
];

export default function cleanupDocument(document) {
  document.querySelectorAll(REMOVE_SELECTORS.join(',')).forEach((element) => element.remove());
  return document;
}

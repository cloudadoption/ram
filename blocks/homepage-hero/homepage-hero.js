import {
  decorateBlock,
  loadBlock,
} from '../../scripts/aem.js';

function createBlock(name, rows, ...variants) {
  const block = document.createElement('div');
  block.classList.add(name, ...variants);
  block.append(...rows);
  return block;
}

/**
 * Splits legacy homepage content while code and authored tables roll out separately.
 * @param {Element} block Legacy homepage hero block
 */
export default async function decorate(block) {
  const [heroRow, ...launchpadRows] = [...block.children];
  if (!heroRow || launchpadRows.length === 0) {
    throw new Error('Legacy homepage hero requires hero and booking launchpad rows');
  }

  const hero = createBlock('hero', [heroRow], 'homepage');
  const launchpad = createBlock('booking-launchpad', launchpadRows);
  const legacyWrapper = block.parentElement;
  const launchpadWrapper = document.createElement('div');

  block.replaceWith(hero);
  legacyWrapper.classList.remove('homepage-hero-wrapper');
  launchpadWrapper.append(launchpad);
  legacyWrapper.after(launchpadWrapper);
  decorateBlock(hero);
  decorateBlock(launchpad);
  await Promise.all([loadBlock(hero), loadBlock(launchpad)]);
}

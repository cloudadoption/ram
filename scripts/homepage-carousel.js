let carouselId = 0;

/**
 * Wraps a carousel index in either direction.
 * @param {number} index requested index
 * @param {number} count item count
 * @returns {number} wrapped index
 */
export function wrapCarouselIndex(index, count) {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function createControl(label, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * Adds shared previous, next, and optional indicator controls to a carousel track.
 * @param {Element} block block element
 * @param {Element} track scrollable track
 * @param {Element[]} items carousel items
 * @param {{ label: string, indicators?: boolean }} options control options
 * @returns {Element | null} controls element
 */
export function addCarouselControls(
  block,
  track,
  items,
  { label, indicators = false },
) {
  if (items.length < 2) return null;

  carouselId += 1;
  const trackId = `${block.classList[0]}-track-${carouselId}`;
  track.id = trackId;
  track.setAttribute('aria-label', label);
  track.setAttribute('tabindex', '0');

  const controls = document.createElement('div');
  controls.className = 'carousel-controls';

  const previous = createControl('Previous slide', 'carousel-control is-previous');
  const next = createControl('Next slide', 'carousel-control is-next');
  previous.setAttribute('aria-controls', trackId);
  next.setAttribute('aria-controls', trackId);

  let activeIndex = 0;
  let indicatorButtons = [];
  const showItem = (requestedIndex) => {
    activeIndex = wrapCarouselIndex(requestedIndex, items.length);
    track.scrollTo({
      behavior: 'smooth',
      left: items[activeIndex].offsetLeft,
      top: 0,
    });
    indicatorButtons.forEach((button, index) => {
      if (index === activeIndex) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  };

  previous.addEventListener('click', () => showItem(activeIndex - 1));
  next.addEventListener('click', () => showItem(activeIndex + 1));
  controls.append(previous, next);

  if (indicators) {
    const indicatorList = document.createElement('div');
    indicatorList.className = 'carousel-indicators';
    indicatorList.setAttribute('aria-label', 'Choose slide');
    indicatorButtons = items.map((item, index) => {
      const button = createControl(`Show slide ${index + 1} of ${items.length}`, 'carousel-indicator');
      button.addEventListener('click', () => showItem(index));
      indicatorList.append(button);
      return button;
    });
    indicatorButtons[0].setAttribute('aria-current', 'true');
    controls.append(indicatorList);
  }

  return controls;
}

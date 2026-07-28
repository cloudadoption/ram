const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  alert: [
    ['path', {
      d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    }],
    ['line', {
      x1: '12', y1: '9', x2: '12', y2: '13',
    }],
    ['line', {
      x1: '12', y1: '17', x2: '12.01', y2: '17',
    }],
  ],
  battery: [
    ['rect', {
      x: '4', y: '8', width: '16', height: '8', rx: '2',
    }],
    ['path', { d: 'M22 10v4' }],
  ],
  clock: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['polyline', {
      points: '12 6 12 12 16 14',
    }],
  ],
  'compressed-gas': [
    ['path', { d: 'M12 2v20M5 12h14' }],
  ],
  corrosive: [
    ['path', { d: 'M5 22h14v-4H5v4zM12 2 6 14h12L12 2z' }],
  ],
  explosives: [
    ['path', { d: 'M12 2l4 7-2 11H8L6 9l4-7zM12 2l-2 3M12 2l2 3' }],
  ],
  flammable: [
    ['path', { d: 'M17 10c0-2.76-2.24-5-5-5s-5 2.24-5 5c0 3 2.5 5.5 5 8s5-5 5-8z' }],
  ],
  magnetism: [
    ['path', { d: 'M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 2v12m0 0 4-4m-4 4-4-4' }],
  ],
  package: [
    ['path', {
      d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    }],
    ['polyline', {
      points: '3.27 6.96 12 12.01 20.73 6.96',
    }],
    ['line', {
      x1: '12', y1: '22.08', x2: '12', y2: '12',
    }],
  ],
  radioactive: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 2v10l8.66 5M12 12l-8.66 5' }],
  ],
  search: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['line', {
      x1: '21', y1: '21', x2: '16.65', y2: '16.65',
    }],
  ],
  'sharp-objects': [
    ['path', { d: 'M2 12h10M17 12h5M12 7l5 5-5 5' }],
  ],
};

/**
 * Builds one of the decorative baggage icons copied from the live page.
 * @param {string} name icon name authored in the block
 * @returns {SVGElement} decorative icon
 */
export default function createBaggageIcon(name) {
  const shapes = ICONS[name];
  if (!shapes) throw new Error(`Unsupported baggage icon: ${name}`);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('viewBox', '0 0 24 24');

  shapes.forEach(([tag, attributes]) => {
    const shape = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
    svg.append(shape);
  });

  return svg;
}

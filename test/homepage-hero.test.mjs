import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  document: {},
  URL,
  window: {},
});

const source = await readFile(
  new URL('../blocks/homepage-hero/homepage-hero.js', import.meta.url),
  'utf8',
);
const testSource = source
  .replace(
    "const SWAP_LABEL = 'Swap origin and destination';",
    "export const SWAP_LABEL = 'Swap origin and destination';",
  )
  .replace(
    'function getPanelSubTabs(panelKey)',
    'export function getPanelSubTabs(panelKey)',
  )
  .replace(
    'function panelFields(panelKey)',
    'export function panelFields(panelKey)',
  )
  .replace(
    'function prepareHeroPicture(cell, variant)',
    'export function prepareHeroPicture(cell, variant)',
  )
  .replace(
    'function swapFlightSearchValues(values)',
    'export function swapFlightSearchValues(values)',
  );
const heroModule = new vm.SourceTextModule(testSource, { context });
await heroModule.link(() => {});
await heroModule.evaluate();

const {
  getPanelSubTabs,
  panelFields,
  prepareHeroPicture,
  setActiveFlightSearchPanel,
  submitFlightSearch,
  swapFlightSearchValues,
  SWAP_LABEL,
  validateFlightSearchPanel,
} = heroModule.namespace;

const plainObject = (value) => JSON.parse(JSON.stringify(value));

const authoredValidationMessages = {
  booking: {
    destination: 'Destination is required',
    origin: 'Origin is required',
  },
  manage: {
    reservationCode: 'Booking reference is required',
    surname: "Passenger's name is required",
  },
  status: {
    destination: 'Destination is required',
  },
};

const createToggleTarget = () => {
  const classes = new Set();
  const attributes = new Map();
  return {
    hidden: false,
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
    },
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
};

test('switches the visible flight search panel and synchronizes tab state', () => {
  const tabs = Object.fromEntries(['booking', 'manage', 'status'].map((key) => [
    key,
    createToggleTarget(),
  ]));
  const panels = Object.fromEntries(['booking', 'manage', 'status'].map((key) => [
    key,
    createToggleTarget(),
  ]));

  setActiveFlightSearchPanel(tabs, panels, 'manage');

  assert.equal(tabs.manage.classList.contains('is-active'), true);
  assert.equal(tabs.manage.getAttribute('aria-selected'), 'true');
  assert.equal(tabs.manage.getAttribute('aria-expanded'), 'true');
  assert.equal(panels.manage.hidden, false);
  assert.equal(panels.manage.classList.contains('is-active'), true);

  ['booking', 'status'].forEach((key) => {
    assert.equal(tabs[key].classList.contains('is-active'), false);
    assert.equal(tabs[key].getAttribute('aria-selected'), 'false');
    assert.equal(tabs[key].getAttribute('aria-expanded'), 'false');
    assert.equal(panels[key].hidden, true);
    assert.equal(panels[key].classList.contains('is-active'), false);
  });
});

test('reports the required fields for each flight search panel', () => {
  assert.deepEqual(
    plainObject(validateFlightSearchPanel('booking', {
      destination: '',
      origin: '',
    }, authoredValidationMessages)),
    {
      destination: 'Destination is required',
      origin: 'Origin is required',
    },
  );
  assert.deepEqual(
    plainObject(validateFlightSearchPanel('manage', {
      reservationCode: '',
      surname: '',
    }, authoredValidationMessages)),
    {
      reservationCode: 'Booking reference is required',
      surname: "Passenger's name is required",
    },
  );
  assert.deepEqual(
    plainObject(validateFlightSearchPanel('status', {
      destination: '',
      origin: 'Casablanca, Morocco',
    }, authoredValidationMessages)),
    {
      destination: 'Destination is required',
    },
  );
});

test('uses the field labels visible in the open live panels', () => {
  const labels = (panelKey) => plainObject(panelFields(panelKey))
    .map(({ label, name }) => ({ label, name }));

  assert.deepEqual(labels('manage'), [
    { label: 'Reservation Code', name: 'reservationCode' },
    { label: 'Surname', name: 'surname' },
  ]);
  assert.deepEqual(labels('status'), [
    { label: 'Select origin', name: 'origin' },
    { label: 'Select destination', name: 'destination' },
  ]);
});

test('uses the Manage booking and Check-in sub-tab row from live', () => {
  assert.deepEqual(
    plainObject(getPanelSubTabs('manage')),
    ['Manage booking', 'Check-in'],
  );
});

test('uses the Flight route and Flight number sub-tab row from live', () => {
  assert.deepEqual(
    plainObject(getPanelSubTabs('status')),
    ['Flight route', 'Flight number'],
  );
});

test('keeps the authored hero picture and its alternative text', () => {
  const classes = new Set();
  const image = {
    alt: 'Authored hero alternative text',
    decoding: '',
    fetchPriority: '',
    loading: '',
  };
  const picture = {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
    },
    querySelector: (selector) => (selector === 'img' ? image : null),
  };
  const cell = {
    querySelector: (selector) => (selector === 'picture' ? picture : null),
  };

  const result = prepareHeroPicture(cell, 'desktop');

  assert.equal(result, picture);
  assert.equal(classes.has('homepage-hero-picture'), true);
  assert.equal(classes.has('is-desktop'), true);
  assert.equal(image.alt, 'Authored hero alternative text');
  assert.equal(image.decoding, 'async');
  assert.equal(image.fetchPriority, 'high');
  assert.equal(image.loading, 'eager');
});

test('swaps origin and destination locally with the live accessible name', () => {
  const values = {
    destination: 'Marrakech, Morocco',
    origin: 'Casablanca, Morocco',
  };

  assert.equal(SWAP_LABEL, 'Swap origin and destination');
  assert.deepEqual(
    plainObject(swapFlightSearchValues(values)),
    {
      destination: 'Casablanca, Morocco',
      origin: 'Marrakech, Morocco',
    },
  );
  assert.deepEqual(values, {
    destination: 'Marrakech, Morocco',
    origin: 'Casablanca, Morocco',
  });
});

test('returns the authored empty state without calling a search service', () => {
  assert.deepEqual(
    plainObject(submitFlightSearch(
      'booking',
      {
        destination: 'Marrakech',
        origin: 'Casablanca, Morocco',
      },
      'No flights found!',
      authoredValidationMessages,
    )),
    {
      errors: {},
      message: 'No flights found!',
      submitted: true,
    },
  );
});

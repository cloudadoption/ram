import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const createTestElement = (tagName) => {
  const classes = new Set();
  const attributes = new Map();
  return {
    attributes,
    children: [],
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      contains: (name) => classes.has(name),
    },
    className: '',
    tagName: tagName.toUpperCase(),
    textContent: '',
    append(...children) {
      this.children.push(...children);
    },
    getAttribute(name) {
      return attributes.get(name);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
};

const context = vm.createContext({
  console,
  document: {
    createElement: createTestElement,
  },
  URL,
  window: {},
});

const source = await readFile(
  new URL('../blocks/booking-launchpad/booking-launchpad.js', import.meta.url),
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
    'function createField({',
    'export function createField({',
  )
  .replace(
    'function createPanelSubTabs(panelKey)',
    'export function createPanelSubTabs(panelKey)',
  )
  .replace(
    'function panelFields(panelKey)',
    'export function panelFields(panelKey)',
  )
  .replace(
    'function swapFlightSearchValues(values)',
    'export function swapFlightSearchValues(values)',
  );
const heroModule = new vm.SourceTextModule(testSource, { context });
await heroModule.link(() => {});
await heroModule.evaluate();

const {
  createField,
  createPanelSubTabs,
  getPanelSubTabs,
  panelFields,
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

test('associates every form label with a unique input id', () => {
  const ids = [];

  ['booking', 'manage', 'status'].forEach((panelKey) => {
    panelFields(panelKey).forEach((fieldConfig) => {
      const { field, input } = createField({ ...fieldConfig, panelKey });
      assert.equal(field.tagName, 'LABEL');
      assert.ok(input.id);
      assert.equal(field.htmlFor, input.id);
      ids.push(input.id);
    });

    const group = createPanelSubTabs(panelKey);
    group.children.slice(1).forEach((option) => {
      const [input] = option.children;
      assert.equal(option.tagName, 'LABEL');
      assert.ok(input.id);
      assert.equal(option.htmlFor, input.id);
      ids.push(input.id);
    });
  });

  assert.equal(ids.length, 13);
  assert.equal(new Set(ids).size, ids.length);
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

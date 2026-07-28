const PANEL_DEFINITIONS = [
  {
    icon: 'plane',
    key: 'booking',
    label: 'Booking',
  },
  {
    icon: 'calendar',
    key: 'manage',
    label: 'Manage/Check-in',
  },
  {
    icon: 'clock',
    key: 'status',
    label: 'Flight Status',
  },
];

const REQUIRED_FIELDS = {
  booking: ['destination', 'origin'],
  manage: ['reservationCode', 'surname'],
  status: ['destination'],
};

const PANEL_SUBTABS = {
  booking: ['Round trip', 'One-way', 'Multi-city'],
  manage: ['Manage booking', 'Check-in'],
  status: ['Flight route', 'Flight number'],
};

const SWAP_LABEL = 'Swap origin and destination';

/**
 * Returns the visible sub-tabs for a flight search panel.
 * @param {string} panelKey Flight search panel name
 * @returns {string[]} Panel sub-tab labels
 */
function getPanelSubTabs(panelKey) {
  const subTabs = PANEL_SUBTABS[panelKey];
  if (!subTabs) throw new RangeError(`Unknown flight search panel: ${panelKey}`);
  return [...subTabs];
}

/**
 * Swaps origin and destination without mutating the supplied values.
 * @param {Object<string, string>} values Form values keyed by field name
 * @returns {Object<string, string>} Form values with the route reversed
 */
function swapFlightSearchValues(values) {
  return {
    ...values,
    destination: values.origin || '',
    origin: values.destination || '',
  };
}

/**
 * Synchronizes the selected flight search tab and its visible panel.
 * @param {Object<string, HTMLElement>} tabs Tab buttons keyed by panel name
 * @param {Object<string, HTMLElement>} panels Panels keyed by panel name
 * @param {string} activeKey Panel to activate
 */
export function setActiveFlightSearchPanel(tabs, panels, activeKey) {
  if (!tabs[activeKey] || !panels[activeKey]) {
    throw new RangeError(`Unknown flight search panel: ${activeKey}`);
  }

  Object.entries(panels).forEach(([key, panel]) => {
    const active = key === activeKey;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });

  Object.entries(tabs).forEach(([key, tab]) => {
    const active = key === activeKey;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('aria-expanded', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
  });
}

/**
 * Validates the required fields for a flight search panel.
 * @param {string} panelKey Flight search panel name
 * @param {Object<string, string>} values Form values keyed by field name
 * @param {Object<string, Object<string, string>>} messages Authored validation messages
 * @returns {Object<string, string>} Validation messages keyed by field name
 */
export function validateFlightSearchPanel(panelKey, values, messages) {
  const fields = REQUIRED_FIELDS[panelKey];
  if (!fields) throw new RangeError(`Unknown flight search panel: ${panelKey}`);

  fields.forEach((name) => {
    if (!messages?.[panelKey]?.[name]) {
      throw new Error(`Missing authored validation message: ${panelKey}.${name}`);
    }
  });

  return Object.fromEntries(fields
    .filter((name) => !String(values[name] || '').trim())
    .map((name) => [name, messages[panelKey][name]]));
}

/**
 * Completes a shell-only submission without requesting fare or schedule data.
 * @param {string} panelKey Flight search panel name
 * @param {Object<string, string>} values Form values keyed by field name
 * @param {string} emptyMessage Authored empty-state message
 * @param {Object<string, Object<string, string>>} messages Authored validation messages
 * @returns {{ errors: Object<string, string>, message: string, submitted: boolean }}
 */
export function submitFlightSearch(panelKey, values, emptyMessage, messages) {
  const errors = validateFlightSearchPanel(panelKey, values, messages);
  const submitted = Object.keys(errors).length === 0;
  return {
    errors,
    message: submitted ? emptyMessage : '',
    submitted,
  };
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createField({
  label,
  name,
  panelKey,
  readOnly = false,
  suffix = '',
  type = 'text',
  value = '',
}) {
  const field = createElement('label', 'flight-search-field');
  const labelText = createElement('span', 'flight-search-field-label', label);
  const control = createElement('span', 'flight-search-field-control');
  const input = createElement('input', 'flight-search-input');
  const error = createElement('span', 'flight-search-error');
  const errorId = `flight-search-${panelKey}-${name}-error`;

  input.name = name;
  input.type = type;
  input.value = value;
  input.required = true;
  input.readOnly = readOnly;
  input.setAttribute('aria-describedby', errorId);
  input.setAttribute('aria-invalid', 'false');
  if (name === 'reservationCode') {
    input.minLength = 3;
    input.maxLength = 6;
  }
  if (name === 'surname') {
    input.minLength = 3;
    input.maxLength = 14;
    input.pattern = "[ A-Za-zÀ-ǿ'.-]+";
  }

  error.id = errorId;
  error.setAttribute('aria-live', 'polite');
  control.append(input);
  let suffixElement;
  if (suffix) {
    suffixElement = createElement('span', 'flight-search-field-suffix', suffix);
    control.append(suffixElement);
  }
  field.append(labelText, control, error);

  return {
    control,
    error,
    field,
    input,
    suffix: suffixElement,
  };
}

function createPanelSubTabs(panelKey) {
  const labels = getPanelSubTabs(panelKey);
  const group = createElement('fieldset', 'flight-search-trip-types');
  const panelLabel = PANEL_DEFINITIONS.find(({ key }) => key === panelKey)?.label;
  const legend = createElement(
    'legend',
    'flight-search-sr-only',
    panelKey === 'booking' ? 'Trip type' : panelLabel,
  );
  group.classList.add(`has-${labels.length}`);
  group.append(legend);

  labels.forEach((label, index) => {
    const option = createElement('label', 'flight-search-trip-type');
    const input = createElement('input');
    const text = createElement('span', '', label);
    input.type = 'radio';
    input.name = `${panelKey}SubTab`;
    input.value = label;
    input.checked = index === 0;
    option.append(input, text);
    group.append(option);
  });

  return group;
}

function panelFields(panelKey) {
  if (panelKey === 'booking') {
    return [
      {
        label: 'Select origin',
        name: 'origin',
        readOnly: true,
        suffix: 'CMN',
        value: 'Casablanca, Morocco',
      },
      {
        label: 'Select destination',
        name: 'destination',
      },
    ];
  }
  if (panelKey === 'manage') {
    return [
      {
        label: 'Reservation Code',
        name: 'reservationCode',
      },
      {
        label: 'Surname',
        name: 'surname',
      },
    ];
  }
  return [
    {
      label: 'Select origin',
      name: 'origin',
      readOnly: true,
      suffix: 'CMN',
      value: 'Casablanca, Morocco',
    },
    {
      label: 'Select destination',
      name: 'destination',
    },
  ];
}

function readFormValues(form) {
  return Object.fromEntries([...form.querySelectorAll('[name]')]
    .filter((input) => input.type !== 'radio' || input.checked)
    .map((input) => [input.name, input.value]));
}

function renderErrors(fields, errors) {
  Object.entries(fields).forEach(([name, { error, input }]) => {
    const message = errors[name] || '';
    error.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
  });
}

function buildPanel(panelKey, emptyState, validationMessages) {
  const panel = createElement('section', 'flight-search-panel');
  const form = createElement('form', 'flight-search-form');
  const fieldGrid = createElement('div', 'flight-search-fields');
  const fields = {};
  const submitLabel = panelKey === 'booking' ? 'Search' : 'Retrieve';
  const submit = createElement('button', 'flight-search-submit', submitLabel);

  panel.id = `flight-search-panel-${panelKey}`;
  panel.setAttribute('aria-labelledby', `flight-search-tab-${panelKey}`);
  panel.setAttribute('role', 'tabpanel');
  form.noValidate = true;
  form.append(createPanelSubTabs(panelKey));

  panelFields(panelKey).forEach((fieldConfig) => {
    const field = createField({ ...fieldConfig, panelKey });
    fields[fieldConfig.name] = field;
    fieldGrid.append(field.field);
  });

  let swap;
  if (panelKey === 'booking' || panelKey === 'status') {
    swap = createElement('button', 'flight-search-swap');
    swap.type = 'button';
    swap.setAttribute('aria-label', SWAP_LABEL);
    fields.origin.control.append(swap);
  }

  submit.type = 'submit';
  if (panelKey === 'booking') {
    submit.hidden = true;
  } else {
    submit.disabled = true;
  }
  fieldGrid.append(submit);
  form.append(fieldGrid);
  panel.append(form);

  const updateState = () => {
    const errors = validateFlightSearchPanel(
      panelKey,
      readFormValues(form),
      validationMessages,
    );
    if (panelKey === 'booking') {
      submit.hidden = Boolean(errors.destination);
    } else {
      submit.disabled = Object.keys(errors).length > 0;
    }
  };

  Object.entries(fields).forEach(([name, { input }]) => {
    input.addEventListener('input', updateState);
    input.addEventListener('blur', () => {
      const errors = validateFlightSearchPanel(
        panelKey,
        readFormValues(form),
        validationMessages,
      );
      renderErrors(fields, errors[name] ? { [name]: errors[name] } : {});
    });
  });

  swap?.addEventListener('click', () => {
    const values = swapFlightSearchValues(readFormValues(form));
    fields.origin.input.value = values.origin;
    fields.destination.input.value = values.destination;
    const { suffix } = fields.origin;
    if (suffix) {
      const suffixOwner = fields.origin.control.contains(suffix)
        ? fields.destination.control
        : fields.origin.control;
      suffixOwner.append(suffix);
    }
    renderErrors(fields, {});
    updateState();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = submitFlightSearch(
      panelKey,
      readFormValues(form),
      emptyState.textContent,
      validationMessages,
    );
    renderErrors(fields, result.errors);
    emptyState.hidden = !result.submitted;
    if (result.submitted) emptyState.focus();
  });

  return panel;
}

function buildFlightSearch(emptyMessage, validationMessages) {
  const search = createElement('div', 'flight-search');
  const items = createElement('div', 'flight-search-items');
  const emptyState = createElement('p', 'flight-search-empty', emptyMessage);
  const tabs = {};
  const panels = {};

  search.setAttribute('aria-label', 'Flight search');
  search.setAttribute('role', 'region');
  items.setAttribute('role', 'tablist');
  emptyState.hidden = true;
  emptyState.tabIndex = -1;

  PANEL_DEFINITIONS.forEach(({ icon, key, label }) => {
    const item = createElement('div', 'flight-search-item');
    const tab = createElement('button', 'flight-search-tab');
    const iconElement = createElement('span', `flight-search-icon is-${icon}`);
    const labelElement = createElement('span', 'flight-search-tab-label', label);
    const chevron = createElement('span', 'flight-search-chevron');
    const panel = buildPanel(key, emptyState, validationMessages);

    tab.id = `flight-search-tab-${key}`;
    tab.type = 'button';
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('role', 'tab');
    iconElement.setAttribute('aria-hidden', 'true');
    chevron.setAttribute('aria-hidden', 'true');
    tab.append(iconElement, labelElement, chevron);
    tab.addEventListener('click', () => {
      setActiveFlightSearchPanel(tabs, panels, key);
      emptyState.hidden = true;
    });

    tabs[key] = tab;
    panels[key] = panel;
    item.append(tab, panel);
    items.append(item);
  });

  search.append(items, emptyState);
  setActiveFlightSearchPanel(tabs, panels, 'booking');
  return search;
}

function readValidationMessages(rows) {
  const messages = {};
  const expectedKeys = new Set(Object.entries(REQUIRED_FIELDS)
    .flatMap(([panelKey, fields]) => fields.map((name) => `${panelKey}.${name}`)));

  rows.forEach((row) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent.trim();
    const message = cells[1]?.textContent.trim();

    if (cells.length !== 2 || !expectedKeys.has(key) || !message) {
      throw new Error(`Invalid booking launchpad validation message row: ${key || 'unnamed'}`);
    }

    const [panelKey, name] = key.split('.');
    messages[panelKey] ||= {};
    if (messages[panelKey][name]) {
      throw new Error(`Duplicate booking launchpad validation message: ${key}`);
    }
    messages[panelKey][name] = message;
  });

  const missingKeys = [...expectedKeys].filter((key) => {
    const [panelKey, name] = key.split('.');
    return !messages[panelKey]?.[name];
  });
  if (missingKeys.length) {
    throw new Error(`Missing booking launchpad validation messages: ${missingKeys.join(', ')}`);
  }

  return messages;
}

/**
 * Decorates the shell-only booking launchpad.
 * @param {Element} block Booking launchpad block
 */
export default function decorate(block) {
  const [emptyRow, ...validationRows] = [...block.children];
  const emptyMessage = emptyRow?.textContent.trim();

  if (!emptyMessage) {
    throw new Error('Booking launchpad requires an authored empty state');
  }

  const validationMessages = readValidationMessages(validationRows);
  block.replaceChildren(buildFlightSearch(emptyMessage, validationMessages));
}

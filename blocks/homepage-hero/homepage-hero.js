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
  booking: {
    destination: 'Select destination',
    origin: 'Select origin',
  },
  manage: {
    reservationCode: 'Reservation Code',
    surname: 'Surname',
  },
  status: {
    departureDate: 'Departure date',
    destination: 'Select destination',
    origin: 'Select origin',
  },
};

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
 * @returns {Object<string, string>} Validation messages keyed by field name
 */
export function validateFlightSearchPanel(panelKey, values) {
  const fields = REQUIRED_FIELDS[panelKey];
  if (!fields) throw new RangeError(`Unknown flight search panel: ${panelKey}`);

  return Object.fromEntries(Object.entries(fields)
    .filter(([name]) => !String(values[name] || '').trim())
    .map(([name, label]) => [name, `${label} is required`]));
}

/**
 * Completes a shell-only submission without requesting fare or schedule data.
 * @param {string} panelKey Flight search panel name
 * @param {Object<string, string>} values Form values keyed by field name
 * @param {string} emptyMessage Authored empty-state message
 * @returns {{ errors: Object<string, string>, message: string, submitted: boolean }}
 */
export function submitFlightSearch(panelKey, values, emptyMessage) {
  const errors = validateFlightSearchPanel(panelKey, values);
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
  if (suffix) control.append(createElement('span', 'flight-search-field-suffix', suffix));
  field.append(labelText, control, error);

  return { error, field, input };
}

function createTripTypes() {
  const group = createElement('fieldset', 'flight-search-trip-types');
  const legend = createElement('legend', 'flight-search-sr-only', 'Trip type');
  group.append(legend);

  ['Round trip', 'One-way', 'Multi-city'].forEach((label, index) => {
    const option = createElement('label', 'flight-search-trip-type');
    const input = createElement('input');
    const text = createElement('span', '', label);
    input.type = 'radio';
    input.name = 'tripType';
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
    {
      label: 'Departure date',
      name: 'departureDate',
      type: 'date',
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

function buildPanel(panelKey, emptyState) {
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
  if (panelKey === 'booking') form.append(createTripTypes());

  panelFields(panelKey).forEach((fieldConfig) => {
    const field = createField({ ...fieldConfig, panelKey });
    fields[fieldConfig.name] = field;
    fieldGrid.append(field.field);
  });

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
    const errors = validateFlightSearchPanel(panelKey, readFormValues(form));
    if (panelKey === 'booking') {
      submit.hidden = Boolean(errors.destination);
    } else {
      submit.disabled = Object.keys(errors).length > 0;
    }
  };

  Object.entries(fields).forEach(([name, { input }]) => {
    input.addEventListener('input', updateState);
    input.addEventListener('blur', () => {
      const errors = validateFlightSearchPanel(panelKey, readFormValues(form));
      renderErrors(fields, errors[name] ? { [name]: errors[name] } : {});
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = submitFlightSearch(panelKey, readFormValues(form), emptyState.textContent);
    renderErrors(fields, result.errors);
    emptyState.hidden = !result.submitted;
    if (result.submitted) emptyState.focus();
  });

  return panel;
}

function buildFlightSearch(emptyMessage) {
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
    const panel = buildPanel(key, emptyState);

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

function buildHeroMedia(desktopUrl, mobileUrl, copyCell) {
  const media = createElement('div', 'homepage-hero-media');
  const picture = createElement('picture', 'homepage-hero-picture');
  const source = createElement('source');
  const image = createElement('img');
  const copy = createElement('div', 'homepage-hero-copy');
  const heading = copyCell.querySelector('h1, h2, h3');
  const subtitle = [...copyCell.querySelectorAll('p')].find((paragraph) => !paragraph.querySelector('a'));
  const cta = copyCell.querySelector('a[href]');

  if (!heading || !subtitle || !cta) {
    throw new Error('Homepage hero copy requires a heading, subtitle, and CTA link');
  }

  source.media = '(min-width: 1200px)';
  source.srcset = desktopUrl;
  image.alt = 'Royal Air Maroc';
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.loading = 'eager';
  image.src = mobileUrl;
  picture.append(source, image);

  heading.className = 'homepage-hero-title';
  heading.id = heading.id || 'homepage-hero-title';
  subtitle.className = 'homepage-hero-subtitle';
  cta.className = 'homepage-hero-cta';
  cta.removeAttribute('title');
  copy.append(heading, subtitle, cta);
  media.append(picture, copy);
  return media;
}

/**
 * Decorates the authored homepage hero and shell-only flight search widget.
 * @param {Element} block Homepage hero block
 */
export default function decorate(block) {
  const [contentRow, emptyRow] = [...block.children];
  const [desktopCell, mobileCell, copyCell] = contentRow ? [...contentRow.children] : [];
  const desktopAsset = desktopCell?.querySelector('a[href]');
  const mobileAsset = mobileCell?.querySelector('a[href]');
  const emptyMessage = emptyRow?.textContent.trim();

  if (!desktopAsset || !mobileAsset || !copyCell || !emptyMessage) {
    throw new Error('Homepage hero requires desktop and mobile assets, hero copy, and an empty state');
  }

  const media = buildHeroMedia(desktopAsset.href, mobileAsset.href, copyCell);
  const search = buildFlightSearch(emptyMessage);
  block.replaceChildren(media, search);
}

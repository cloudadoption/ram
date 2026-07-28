import {
  moveCellContent,
  readLabeledRows,
  requireElement,
  rowWithLabel,
} from '../../scripts/homepage-blocks.js';

let newsletterId = 0;

export default function decorate(block) {
  newsletterId += 1;
  const rows = readLabeledRows(block);
  const picture = requireElement(
    rowWithLabel(rows, 'image')?.cells[0]?.querySelector('picture'),
    'Newsletter signup requires an authored image',
  );
  picture.classList.add('newsletter-signup-picture');

  const media = document.createElement('div');
  media.className = 'newsletter-signup-media';
  media.append(picture);

  const form = document.createElement('form');
  form.className = 'newsletter-signup-form';
  form.addEventListener('submit', (event) => event.preventDefault());

  const heading = document.createElement('div');
  heading.className = 'newsletter-signup-heading';
  moveCellContent(heading, rowWithLabel(rows, 'heading')?.cells[0]);

  const labelText = rowWithLabel(rows, 'email label')?.cells[0]?.textContent.trim();
  const buttonText = rowWithLabel(rows, 'button label')?.cells[0]?.textContent.trim();
  if (!labelText || !buttonText) {
    throw new Error('Newsletter signup requires email and button labels');
  }

  const field = document.createElement('div');
  field.className = 'newsletter-signup-field';
  const input = document.createElement('input');
  input.id = `newsletter-email-${newsletterId}`;
  input.type = 'email';
  input.autocomplete = 'email';
  input.required = true;
  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.textContent = labelText;
  field.append(input, label);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = buttonText;
  form.append(heading, field, button);

  block.replaceChildren(media, form);
}

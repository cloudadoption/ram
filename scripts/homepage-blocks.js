/**
 * Reads the plain label in the first cell and returns the remaining authored cells.
 * @param {Element} block block element
 * @returns {{ label: string, cells: Element[] }[]} labeled rows
 */
export function readLabeledRows(block) {
  return [...block.children].map((row) => {
    const [labelCell, ...cells] = [...row.children];
    return {
      cells,
      label: labelCell?.textContent.trim().toLowerCase() || '',
    };
  });
}

/**
 * Finds every row with the requested label.
 * @param {{ label: string, cells: Element[] }[]} rows labeled rows
 * @param {string} label row label
 * @returns {{ label: string, cells: Element[] }[]} matching rows
 */
export function rowsWithLabel(rows, label) {
  return rows.filter((row) => row.label === label.toLowerCase());
}

/**
 * Finds the first row with the requested label.
 * @param {{ label: string, cells: Element[] }[]} rows labeled rows
 * @param {string} label row label
 * @returns {{ label: string, cells: Element[] } | undefined} matching row
 */
export function rowWithLabel(rows, label) {
  return rowsWithLabel(rows, label)[0];
}

/**
 * Moves authored child nodes into a decorated element.
 * @param {Element} target destination element
 * @param {Element} cell authored cell
 */
export function moveCellContent(target, cell) {
  if (cell) target.append(...cell.childNodes);
}

/**
 * Returns an expected authored element or raises a visible block loading error.
 * @param {Element | null} element authored element
 * @param {string} message error message
 * @returns {Element} authored element
 */
export function requireElement(element, message) {
  if (!element) throw new Error(message);
  return element;
}

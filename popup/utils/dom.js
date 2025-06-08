/**
 * Utility: Get an element by ID and log an error if missing.
 * @param {string} id - The element's ID.
 * @returns {HTMLElement|null}
 */
export function getElement(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`Element with id "${id}" not found.`);
  return el;
}

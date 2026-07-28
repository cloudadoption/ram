const DEFAULT_LOCALE = 'en-GB';
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

/**
 * Returns the BCP 47 locale and text direction for a page path.
 * @param {string} pathname Page pathname
 * @returns {{lang: string, dir: string}} Page locale
 */
export function getPageLocale(pathname) {
  const match = pathname.match(/^\/([a-z]{2})(?:[-_]([a-z]{2}))?(?:\/|$)/i);
  const lang = match
    ? `${match[1].toLowerCase()}${match[2] ? `-${match[2].toUpperCase()}` : ''}`
    : DEFAULT_LOCALE;
  const language = lang.split('-')[0];

  return {
    lang,
    dir: RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr',
  };
}

/**
 * Applies the current page locale before page decoration starts.
 * @param {Document} doc Page document
 * @param {string} pathname Page pathname
 */
export function setDocumentLocale(doc, pathname) {
  const { lang, dir } = getPageLocale(pathname);
  doc.documentElement.lang = lang;
  doc.documentElement.dir = dir;
}

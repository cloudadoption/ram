const normalizePath = (value) => {
  const decoded = decodeURI(value);
  return decoded.endsWith('/') && decoded !== '/' ? decoded.slice(0, -1) : decoded;
};

export function normalizeEditorialHref(href, editorialPaths = []) {
  if (!href) return '';
  const value = href.trim();

  let parsed;
  try {
    parsed = new URL(value, 'https://www.royalairmaroc.com');
  } catch {
    return value;
  }

  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value);
  if (isAbsolute && parsed.origin !== 'https://www.royalairmaroc.com') return value;

  const pathname = normalizePath(parsed.pathname);
  const match = pathname.match(/^\/(?:en|en-GB|en-gb)(\/.*)$/);
  if (!match || !editorialPaths.includes(normalizePath(match[1]))) return value;

  return `/en-gb${match[1]}${parsed.search}${parsed.hash}`;
}

export default function transformLinks(root, editorialPaths = []) {
  root.querySelectorAll('a[href]').forEach((link) => {
    link.setAttribute(
      'href',
      normalizeEditorialHref(link.getAttribute('href'), editorialPaths),
    );
  });
}

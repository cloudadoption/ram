const SOURCE_HOSTS = new Set([
  'www.royalairmaroc.com',
  'i.ytimg.com',
]);

export default function validateImageSource(value, contentType) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`Image source must use HTTPS: ${value}`);
  }
  if (!SOURCE_HOSTS.has(url.hostname)) {
    throw new Error(`Image source must use an approved host: ${value}`);
  }
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Image source did not return an image response: ${value}`);
  }
  return url;
}

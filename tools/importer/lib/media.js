const SOURCE_HOST = 'www.royalairmaroc.com';

export default function validateImageSource(value, contentType) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`Image source must use HTTPS: ${value}`);
  }
  if (url.hostname !== SOURCE_HOST) {
    throw new Error(`Image source must use the ${SOURCE_HOST} host: ${value}`);
  }
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Image source did not return an image response: ${value}`);
  }
  return url;
}

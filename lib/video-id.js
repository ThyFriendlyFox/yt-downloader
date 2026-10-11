const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const PATH_PREFIXES = ['/shorts/', '/embed/', '/live/', '/v/', '/e/'];

// Returns the 11-character video ID, or null when the input names no video.
export function parseVideoId(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (ID.test(value)) return value;

  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return ID.test(id) ? id : null;
  }
  if (!HOSTS.has(host)) return null;

  const v = url.searchParams.get('v');
  if (v && ID.test(v)) return v;

  for (const prefix of PATH_PREFIXES) {
    if (url.pathname.startsWith(prefix)) {
      const id = url.pathname.slice(prefix.length).split('/')[0];
      return ID.test(id) ? id : null;
    }
  }
  return null;
}

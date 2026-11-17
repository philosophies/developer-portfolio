export function validateImageUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid HTTPS image URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.'))
    throw new Error('Use an HTTPS URL with a hostname and no embedded credentials');
  return url.href;
}
export function boxStyle(box) {
  const keys = ['left', 'top', 'right', 'bottom'];
  if (
    !box ||
    keys.some((k) => !Number.isFinite(box[k]) || box[k] < 0 || box[k] > 1) ||
    box.left >= box.right ||
    box.top >= box.bottom
  )
    throw new Error('Invalid detection bounds');
  return {
    left: `${box.left * 100}%`,
    top: `${box.top * 100}%`,
    width: `${(box.right - box.left) * 100}%`,
    height: `${(box.bottom - box.top) * 100}%`,
  };
}
// Synthetic adapter: never calls Clarifai or fetches a user URL.
export async function detectFixture(value, { signal, fixture = 'single' } = {}) {
  validateImageUrl(value);
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const samples = {
    single: [{ left: 0.3, top: 0.2, right: 0.7, bottom: 0.75 }],
    pair: [
      { left: 0.1, top: 0.15, right: 0.4, bottom: 0.7 },
      { left: 0.6, top: 0.25, right: 0.9, bottom: 0.8 },
    ],
    empty: [],
  };
  if (!Object.hasOwn(samples, fixture)) throw new Error('Choose a supported synthetic sample');
  return { source: 'synthetic fixture', boxes: samples[fixture] };
}

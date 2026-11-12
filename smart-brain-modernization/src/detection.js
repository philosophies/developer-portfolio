export function validateImageUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid HTTPS image URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error('Use a public HTTPS URL without credentials');
  return url.href;
}
export function boxStyle(box) {
  const keys = ['left','top','right','bottom'];
  if (!box || keys.some(k=>!Number.isFinite(box[k]) || box[k]<0 || box[k]>1) || box.left>=box.right || box.top>=box.bottom) throw new Error('Invalid detection bounds');
  return { left:`${box.left*100}%`, top:`${box.top*100}%`, width:`${(box.right-box.left)*100}%`, height:`${(box.bottom-box.top)*100}%` };
}
// Synthetic adapter: never calls Clarifai or fetches a user URL.
export async function detectFixture(value, {signal}={}) {
  validateImageUrl(value);
  if (signal?.aborted) throw new DOMException('Cancelled','AbortError');
  return {source:'synthetic fixture', boxes:[{left:.3,top:.2,right:.7,bottom:.75}]};
}

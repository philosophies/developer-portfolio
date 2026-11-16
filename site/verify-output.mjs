import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative, isAbsolute } from 'node:path';

const root = fileURLToPath(
  new URL('./.cloudflare/output/v0/workers/default/assets/', import.meta.url),
);
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    result.push(...(entry.isDirectory() ? await files(path) : [path]));
  }
  return result;
}
let checked = 0;
for (const path of await files(root)) {
  if (!/\.(html|css)$/.test(path)) continue;
  const text = await readFile(path, 'utf8');
  const matches = path.endsWith('.html')
    ? [...text.matchAll(/(?:href|src)=["']([^"']+)["']/g)]
    : [...text.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
  for (const match of matches) {
    const link = match[1];
    if (/^(?:https?:|data:|mailto:|#)/.test(link)) continue;
    const clean = decodeURIComponent(link.split(/[?#]/)[0]);
    if (!clean) continue;
    let target = resolve(clean.startsWith('/') ? root : dirname(path), clean.replace(/^\//, ''));
    const inside = relative(root, target);
    if (inside.startsWith('..') || isAbsolute(inside))
      throw new Error('Built asset escaped output root');
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = resolve(target, 'index.html');
    if (!(await stat(target).catch(() => null))?.isFile())
      throw new Error(`Broken local link from ${relative(root, path)}: ${link}`);
    checked++;
  }
}
console.log(`Verified ${checked} built routes, stylesheet references, scripts and font links.`);

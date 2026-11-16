import { cp, mkdir, readdir, realpath, lstat, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = new URL('./', import.meta.url);
const rootPath = await realpath(fileURLToPath(root));
const allowed = new Set([
  'public/fonts/',
  'public/demos/smart-brain/',
  'public/demos/reporting/',
  '.cloudflare/output/v0/',
]);

async function clearGenerated(name) {
  if (!allowed.has(name)) throw new Error('Unexpected generated directory');
  const destination = fileURLToPath(new URL(name, root));
  await mkdir(dirname(destination), { recursive: true });
  const parent = await realpath(dirname(destination));
  const inside = relative(rootPath, parent);
  if (inside.startsWith('..') || isAbsolute(inside))
    throw new Error('Generated directory escaped the site checkout');
  const existing = await lstat(destination).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (existing?.isSymbolicLink())
    throw new Error('Refusing to replace a linked generated directory');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  return new URL(name, root);
}

const fonts = await clearGenerated('public/fonts/');
for (const name of await readdir(new URL('./fonts/', root))) {
  if (name.endsWith('.woff2') || name.endsWith('LICENSE.txt'))
    await cp(new URL('./fonts/' + name, root), new URL(name, fonts));
}
await cp(new URL('./style.css', root), new URL('./public/theme.css', root));
if (!process.env.npm_execpath)
  throw new Error('Use npm run build so child builds use the same npm runtime');

for (const [project, script, destination] of [
  ['smart-brain-modernization', 'build', 'public/demos/smart-brain/'],
  ['reporting-ui', 'build:portfolio', 'public/demos/reporting/'],
]) {
  const source = new URL('../' + project + '/', root);
  execFileSync(
    process.execPath,
    [process.env.npm_execpath, '--prefix', fileURLToPath(source), 'run', script],
    { stdio: 'inherit' },
  );
  const target = await clearGenerated(destination);
  await cp(new URL('./dist/', source), target, { recursive: true });
}
// A clean output directory prevents obsolete hashed bundles from being republished.
await clearGenerated('.cloudflare/output/v0/');
console.log('Prepared shared theme, compressed fonts and both demos from source.');

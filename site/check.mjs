import {readFile,access} from 'node:fs/promises';import assert from 'node:assert/strict';
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
for(const match of html.matchAll(/href="#([^"\s]+)"/g))assert.ok(html.includes(`id="${match[1]}"`),`Missing anchor ${match[1]}`);
assert.ok(html.includes('synthetic')&&html.includes('AI-assisted'));console.log('Portfolio anchors and publication/provenance checks passed');

for(const match of html.matchAll(/href="(\/projects\/[^"?#]+)"/g))await access(new URL('./public'+match[1]+(match[1].endsWith('/')?'index.html':''),import.meta.url));
assert.equal((html.match(/class="project-links"/g)??[]).length,4,'Every project needs project/source links');

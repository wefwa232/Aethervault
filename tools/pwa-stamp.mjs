// Regenerates the precache list and content hash inside sw.js, so the worker's bytes (and cache name)
// change whenever any shell file changes. Usage: node tools/pwa-stamp.mjs [--check]
// --check exits non-zero if sw.js is stale or if the version/manifest/icon wiring is inconsistent.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');

const refs = [...html.matchAll(/(?:src|href)="([^"#?:]+)"/g)].map(m => m[1]).filter(p => !/^(https?:|data:)/.test(p));
const fonts = fs.readdirSync(path.join(root, 'vendor/fonts')).filter(f => f.endsWith('.woff2')).map(f => 'vendor/fonts/' + f);
const icons = fs.readdirSync(path.join(root, 'icons')).map(f => 'icons/' + f);
const list = [...new Set(['index.html', 'manifest.webmanifest', ...refs, ...fonts, ...icons])].sort();

const problems = [];
for (const f of list) if (!fs.existsSync(path.join(root, f))) problems.push('precache entry missing on disk: ' + f);
if (list.some(f => f.startsWith('music/'))) problems.push('music must not be precached');

const hash = crypto.createHash('sha256');
for (const f of list) {
  const buf = fs.readFileSync(path.join(root, f));
  hash.update(f + '\0').update(/\.(html|css|js|json|webmanifest|svg|txt)$/.test(f) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n')) : buf);
}
const build = (read('js/util.js').match(/build:\s*'([^']+)'/) || [])[1];
if (!build) problems.push('AV.VERSION.build not found in js/util.js');

const block = `/* PWA:BEGIN */\nconst BUILD = ${JSON.stringify(build || '')};\nconst HASH = '${hash.digest('hex').slice(0, 12)}';\nconst PRECACHE = ${JSON.stringify(list, null, 2)};\n/* PWA:END */`;
const sw = read('sw.js');
const next = sw.replace(/\/\* PWA:BEGIN \*\/[\s\S]*?\/\* PWA:END \*\//, block);

const man = JSON.parse(read('manifest.webmanifest'));
for (const i of man.icons) if (!fs.existsSync(path.join(root, i.src))) problems.push('manifest icon missing: ' + i.src);
if (!html.includes('rel="manifest"')) problems.push('index.html does not link the manifest');

if (process.argv.includes('--check')) {
  if (next.replace(/\r\n/g, '\n') !== sw.replace(/\r\n/g, '\n')) problems.push('sw.js is stale — run: node tools/pwa-stamp.mjs');
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`PWA check OK · build ${build} · ${list.length} precached files`);
} else {
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  fs.writeFileSync(path.join(root, 'sw.js'), next);
  console.log(`sw.js stamped · build ${build} · hash ${block.match(/HASH = '(\w+)'/)[1]} · ${list.length} files`);
}

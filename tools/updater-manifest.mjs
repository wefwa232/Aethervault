// Writes latest.json for the Tauri updater from a signed NSIS build. Usage: node tools/updater-manifest.mjs [--notes "text"] [--out path]
// The file is uploaded to the GitHub release next to the installer; the app reads
// https://github.com/wefwa232/Aethervault/releases/latest/download/latest.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const conf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = conf.version;
const util = readFileSync(resolve(root, 'js/util.js'), 'utf8').match(/number:\s*'([^']+)'/)[1];
if (util !== version) { console.error(`Version mismatch: tauri.conf.json ${version} vs js/util.js ${util}`); process.exit(1); }
const file = `Aethervault_${version}_x64-setup.exe`;
const sigPath = resolve(root, 'src-tauri/target/release/bundle/nsis', file + '.sig');
if (!existsSync(sigPath)) { console.error('Missing ' + sigPath + ' — build with TAURI_SIGNING_PRIVATE_KEY set.'); process.exit(1); }
const manifest = {
  version,
  notes: arg('--notes') || `Aethervault ${version}`,
  pub_date: new Date().toISOString(),
  platforms: { 'windows-x86_64': { signature: readFileSync(sigPath, 'utf8').trim(), url: `https://github.com/wefwa232/Aethervault/releases/download/v${version}/${file}` } },
};
const out = resolve(arg('--out') || resolve(root, 'src-tauri/target/release/bundle/nsis/latest.json'));
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote ' + out);

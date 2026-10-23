// One canonical app version: AV.VERSION.number in js/util.js. Everything else must equal it.
//   node tools/version.mjs check [--tag vX.Y.Z]   exits 1 on any mismatch
//   node tools/version.mjs set X.Y.Z              rewrites tauri.conf.json, Cargo.toml, Cargo.lock, js/util.js and restamps sw.js
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  util: resolve(root, 'js/util.js'),
  conf: resolve(root, 'src-tauri/tauri.conf.json'),
  cargo: resolve(root, 'src-tauri/Cargo.toml'),
  lock: resolve(root, 'src-tauri/Cargo.lock'),
};
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const read = p => readFileSync(p, 'utf8');
const utilRe = /(number:\s*')([^']+)(')/;
const cargoRe = /(\[package\][^\[]*?\nversion\s*=\s*")([^"]+)(")/;
const lockRe = /(name = "aethervault"\nversion = ")([^"]+)(")/;
const get = {
  util: () => read(P.util).match(utilRe)[2],
  conf: () => JSON.parse(read(P.conf)).version,
  cargo: () => read(P.cargo).match(cargoRe)[2],
  lock: () => read(P.lock).match(lockRe)[2],
};

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'check') {
  const found = Object.fromEntries(Object.keys(get).map(k => [k, get[k]()]));
  const canon = found.util, bad = [];
  if (!SEMVER.test(canon)) bad.push(`js/util.js version "${canon}" is not X.Y.Z`);
  for (const [k, v] of Object.entries(found)) if (v !== canon) bad.push(`${k} is ${v}, expected ${canon}`);
  const t = process.argv.indexOf('--tag');
  if (t > 0 && process.argv[t + 1] !== 'v' + canon) bad.push(`tag ${process.argv[t + 1]} does not match v${canon}`);
  if (bad.length) { console.error('Version check FAILED:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('Version check OK: ' + canon);
} else if (cmd === 'set' && SEMVER.test(arg || '')) {
  writeFileSync(P.util, read(P.util).replace(utilRe, `$1${arg}$3`));
  writeFileSync(P.conf, read(P.conf).replace(/("version":\s*")[^"]+(")/, `$1${arg}$2`));
  writeFileSync(P.cargo, read(P.cargo).replace(cargoRe, `$1${arg}$3`));
  writeFileSync(P.lock, read(P.lock).replace(lockRe, `$1${arg}$3`));
  execFileSync(process.execPath, [resolve(root, 'tools/pwa-stamp.mjs')], { stdio: 'inherit' });
  console.log('Version set to ' + arg);
} else { console.error('usage: version.mjs check [--tag vX.Y.Z] | set X.Y.Z'); process.exit(2); }

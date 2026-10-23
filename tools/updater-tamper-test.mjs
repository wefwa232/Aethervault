// Proves the desktop updater rejects bad updates. Needs a TEST build whose updater endpoint is http://127.0.0.1:9444/latest.json
// (see UPDATER.md "Tamper test") plus the real signed installer and its .sig. Never runs an installer: every case must be rejected.
// Usage: node tools/updater-tamper-test.mjs <test-exe> <release-dir> <other-key-path>
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [exe, relDir, otherKey] = process.argv.slice(2).map(p => path.resolve(p));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'av-upd-'));
const PORT = 9334, sleep = ms => new Promise(r => setTimeout(r, ms));
const setup = 'Aethervault_0.6.2_x64-setup.exe';
const real = fs.readFileSync(path.join(relDir, setup));
const realSig = fs.readFileSync(path.join(relDir, setup + '.sig'), 'utf8').trim();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'av-upd-files-'));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { (ok ? pass++ : fail++); console.log((ok ? '  ok   ' : '  FAIL ') + n + (ok ? '' : '  ' + JSON.stringify(d))); };

const tampered = Buffer.concat([real, Buffer.from('tampered')]);
const flipped = Buffer.from(real); flipped[flipped.length >> 1] ^= 0xff;
fs.writeFileSync(path.join(work, 'real.exe'), real);
execSync(`npx --prefix tools tauri signer sign -f "${otherKey}" -p "" "${path.join(work, 'real.exe')}"`, { stdio: 'ignore', cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..') });
const otherSig = fs.readFileSync(path.join(work, 'real.exe.sig'), 'utf8').trim();

let served = { version: '9.9.9', body: real, sig: realSig }, hits = [];
const server = http.createServer((q, r) => {
  hits.push(q.url);
  if (q.url === '/latest.json') {
    r.setHeader('content-type', 'application/json');
    return r.end(JSON.stringify({ version: served.version, notes: 'test', pub_date: new Date().toISOString(), platforms: { 'windows-x86_64': { signature: served.sig, url: 'http://127.0.0.1:9444/pkg.exe' } } }));
  }
  if (q.url === '/pkg.exe') return r.end(served.body);
  r.statusCode = 404; r.end();
}).listen(9444, '127.0.0.1');

const proc = spawn(exe, [], { stdio: 'ignore', env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: profile, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + PORT } });
let page;
for (let i = 0; i < 60 && !page; i++) {
  try { const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null }); page = (await b.pages()).find(p => p.url().includes('tauri.localhost')); if (!page) b.disconnect(); } catch (e) { await sleep(500); }
}
if (!page) throw new Error('no window');
await page.waitForFunction(() => window.AV && AV.desktop && AV.desktop.updates && AV.state && AV.state.get(), { timeout: 60000 });
await sleep(1500);

const run = async () => page.evaluate(async () => {
  const U = AV.desktop.updates; const o = {};
  await U.check(); o.checked = U.status; o.version = U.version;
  if (U.status === 'available') { o.installed = await U.install(); o.after = U.status; o.err = U.error; }
  o.alive = true; return o;
});
const cases = [
  ['control: a correctly signed, newer package IS offered (check only)', { version: '9.9.9', body: real, sig: realSig }, async () => page.evaluate(async () => { await AV.desktop.updates.check(); return { s: AV.desktop.updates.status, v: AV.desktop.updates.version }; }), r => r.s === 'available' && r.v === '9.9.9'],
  ['tampered installer (bytes appended, real signature) is rejected', { version: '9.9.9', body: tampered, sig: realSig }, run, r => r.after === 'error' && /signature/i.test(r.err || '')],
  ['tampered installer (one byte flipped) is rejected', { version: '9.9.9', body: flipped, sig: realSig }, run, r => r.after === 'error' && /signature/i.test(r.err || '')],
  ['garbage signature is rejected', { version: '9.9.9', body: real, sig: Buffer.from('not a signature').toString('base64') }, run, r => r.after === 'error'],
  ['valid signature from a different key is rejected', { version: '9.9.9', body: real, sig: otherSig }, run, r => r.after === 'error'],
  ['same version (0.6.2) is not offered', { version: '0.6.2', body: real, sig: realSig }, run, r => r.checked === 'none'],
  ['older version (0.1.0) is not offered (no downgrade)', { version: '0.1.0', body: real, sig: realSig }, run, r => r.checked === 'none'],
];
for (const [name, s, fn, ok] of cases) {
  served = s; const r = await fn();
  console.log('   ', JSON.stringify(r));
  check(name, ok(r), r);
}
// After every rejection the app is still running, the installer was never launched.
const stillUp = await page.evaluate(() => !!(AV.state && AV.state.get())); 
check('app still running after all rejections (installer never ran)', stillUp && proc.exitCode === null);

server.close();
try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* gone */ }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

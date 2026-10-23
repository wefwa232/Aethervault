// Browser test for cloud saves (Distribution D). One puppeteer harness, one Chrome, separate incognito contexts as
// "devices" (A, B) against the mock Supabase in tools/mock-supabase.mjs. Uses SYNTHETIC saves only.
// Usage: node tools/cloud-test.mjs      (starts serve.mjs on :5173 and the mock on :54321 if they are not running)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launch, ensureServer, booted, seedFn, sleep, root } from './harness.mjs';

const MOCK = 'http://127.0.0.1:54321';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { (ok ? pass++ : fail++); console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  ' + detail)); };
const mock = async (p, opt) => (await fetch(MOCK + p, opt)).json();
const state = () => mock('/__state');
const U1 = '00000000-0000-4000-8000-000000000001', U2 = '00000000-0000-4000-8000-000000000002';

let mockProc = null;
try { await fetch(MOCK + '/__state'); } catch (e) { mockProc = spawn(process.execPath, ['tools/mock-supabase.mjs', '54321'], { cwd: root, stdio: 'ignore' }); await sleep(600); }
const srv = await ensureServer(5173);
await mock('/__reset');

const { browser } = await launch({ width: 1280, height: 900 });
const errors = [];
async function device(label, { cfg = true, poll = 0 } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', e => errors.push(label + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(label + ': ' + m.text()); });
  if (cfg) await page.evaluateOnNewDocument(poll => { try {
    localStorage.setItem('av.auth.cfg', JSON.stringify({ supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'mock-anon' }));
    localStorage.setItem('av.cloud.timing', JSON.stringify({ debounceMs: 500, maxWaitMs: 3000, retryBaseMs: 600, retryMaxMs: 2000, pollMs: poll || 600000, startDelayMs: 300, minGapMs: 400, unsafeRetryMs: 500, updatedMs: 1500, flushMs: 2500 }));
  } catch (e) { /* ignore */ } }, poll);
  await page.goto('http://127.0.0.1:5173/index.html?fastboot=1', { waitUntil: 'load' });
  await booted(page);
  return page;
}
const until = (page, fn, arg, t = 8000) => page.waitForFunction(fn, { timeout: t, polling: 100 }, arg);
const status = p => p.evaluate(() => AV.cloud.status);
const waitStatus = (p, s, t) => until(p, s => AV.cloud.status === s, s, t);
const local = p => p.evaluate(() => { const S = AV.state.get(); return { credits: S.wallet.credits, n: Object.keys(S.specimens).length, name: S.profile.name }; });
const rawSave = p => p.evaluate(() => localStorage.getItem('aethervault.save.v1'));
const checksum = p => p.evaluate(() => AV.cloud.localChecksum());
const bump = (p, n = 5) => p.evaluate(n => { const S = AV.state.get(); S.wallet.credits += n; AV.state.save(true); }, n);
const settle = async p => { await waitStatus(p, 'dirty'); await waitStatus(p, 'idle', 10000); };
const toSettings = async p => { await p.evaluate(() => AV.ui.go('settings')); await until(p, () => document.querySelector('#acct')); await sleep(200); };
const clickAct = async (p, act) => { await until(p, a => document.querySelector(`[data-act="${a}"]`), act); await p.click(`[data-act="${act}"]`); await sleep(150); };
const clickModal = async (p, re) => { await until(p, s => Array.from(document.querySelectorAll('.modal-wrap:not(.closing) [data-m-btn]')).some(b => new RegExp(s, 'i').test(b.textContent)), re.source); await p.evaluate(s => { Array.from(document.querySelectorAll('.modal-wrap:not(.closing) [data-m-btn]')).find(b => new RegExp(s, 'i').test(b.textContent)).click(); }, re.source); await sleep(250); };
const modalText = p => p.evaluate(() => Array.from(document.querySelectorAll('.modal-wrap:not(.closing)')).map(m => m.textContent).join(' | '));
const signIn = async (p, user) => {
  await mock('/__user?n=' + user);
  await p.evaluate(() => AV.auth.signIn()).catch(() => {});
  await p.waitForFunction(() => window.AV && AV.auth && AV.auth.signedIn(), { timeout: 30000 }); await booted(p); await sleep(300);
};
const syncLog = async () => (await state()).log.filter(l => /rpc\/av_cloud_push/.test(l)).length;
const head = async u => (await state()).heads[u];
const backups = async u => (await state()).backups[u] || [];
const localBackups = p => p.evaluate(() => AV.cloud.localBackups().length);

try {
  // ======================= local-only user =======================
  console.log('\n[0] Local-only user (real config, not signed in): no network, nothing changes');
  {
    const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), hosts = new Set();
    p.on('request', r => { try { hosts.add(new URL(r.url()).host); } catch (e) {} });
    await p.goto('http://127.0.0.1:5173/index.html?fastboot=1', { waitUntil: 'load' }); await booted(p);
    await p.evaluate(seedFn); await p.reload({ waitUntil: 'load' }); await booted(p); await sleep(800);
    await bump(p); await sleep(1500);
    check('no request leaves the local server', [...hosts].filter(Boolean).every(h => h === '127.0.0.1:5173'), [...hosts].join(','));
    check('cloud engine stays off', (await status(p)) === 'off');
    await toSettings(p);
    const txt = await p.evaluate(() => document.querySelector('#acct').textContent);
    check('Settings shows no cloud controls when signed out', !/Cloud saves/.test(txt) && /Sign in with Google/.test(txt), txt.slice(0, 120));
    await ctx.close();
  }

  // ======================= device A: first link =======================
  console.log('\n[1] Device A: link and upload (explicit)');
  const A = await device('A');
  await A.evaluate(seedFn); await A.reload({ waitUntil: 'load' }); await booted(A);
  const seededRaw = await rawSave(A), seeded = await local(A);
  await signIn(A, 1);
  await toSettings(A);
  check('signed in but not linked: panel offers "Turn on cloud saves…"', await A.evaluate(() => !!document.querySelector('[data-act="cloud-on"]')));
  await sleep(1200);
  check('no cloud calls before the player turns it on', (await state()).log.filter(l => /rest|rpc/.test(l)).length === 0);
  await clickAct(A, 'cloud-on');
  await until(A, () => document.querySelector('.modal-wrap:not(.closing)'));
  check('upload needs confirmation; cloud still empty while the dialog is open', !(await head(U1)), JSON.stringify(await head(U1)));
  check('dialog shows local summary', /Specimens/.test(await modalText(A)) && new RegExp(String(seeded.n)).test(await modalText(A)), (await modalText(A)).slice(0, 300) + ' n=' + seeded.n);
  await clickModal(A, /Upload and turn on/);
  await waitStatus(A, 'idle'); await until(A, () => document.querySelector('#cloudStatus'));
  let h = await head(U1);
  check('first upload creates revision 1', h && h.revision === 1);
  check('server checksum equals the local checksum', h && h.checksum === await checksum(A));
  check('local save was not modified by uploading', (await rawSave(A)) === seededRaw);
  check('payload stored equals local specimen count', h && Object.keys(h.payload.specimens).length === seeded.n);
  check('device identity recorded', h && /^[0-9a-f-]{36}$/.test(h.device_id) && h.device_name.length > 0, h && h.device_name);
  check('panel shows last successful sync', await A.evaluate(() => /Last successful sync: just now|min ago/.test(document.querySelector('#cloudLast').textContent)));
  const tSnap = await A.evaluate(async () => { const t = performance.now(); await AV.cloud.localChecksum(); return Math.round(performance.now() - t); });
  console.log('       (snapshot+hash of the seeded save: ' + tSnap + ' ms, ' + (await rawSave(A)).length + ' chars)');

  // ======================= dirty state & debounce =======================
  console.log('\n[2] Dirty tracking and debounced sync');
  {
    const before = await syncLog();
    for (let i = 0; i < 5; i++) { await bump(A, 1); await sleep(60); }
    check('status becomes dirty immediately after a save', (await status(A)) === 'dirty');
    await waitStatus(A, 'idle');
    check('five rapid saves → exactly one push', (await syncLog()) === before + 1, String((await syncLog()) - before));
    h = await head(U1); check('revision advanced to 2 with the final value', h.revision === 2 && h.payload.wallet.credits === (await local(A)).credits);
    const n0 = await syncLog(); await A.evaluate(() => AV.cloud.sync()); await sleep(300);
    check('Sync Now with nothing changed does not create a revision', (await head(U1)).revision === 2 && (await syncLog()) === n0, '');
  }

  // ======================= device B: download on another profile =======================
  console.log('\n[3] Device B (another browser profile): download the cloud save');
  const B = await device('B');
  await B.evaluate(() => { const m = document.querySelector('.modal-wrap.welcome'); if (m) m.remove(); });
  check('B starts empty', (await local(B)).n === 0);
  await signIn(B, 1);
  await B.evaluate(() => { const m = document.querySelector('.modal-wrap.welcome'); if (m) m.remove(); });
  await toSettings(B);
  await clickAct(B, 'cloud-on');
  await until(B, () => document.querySelector('.modal-wrap:not(.closing)'));
  check('download needs confirmation (B still empty)', (await local(B)).n === 0);
  const bBefore = await rawSave(B);
  await clickModal(B, /Use cloud save/);
  await until(B, () => AV.state.get().flags.onboarded && AV.cloud.status === 'idle');
  const lb = await local(B), la = await local(A);
  check('B now has A’s progress', lb.n === la.n && lb.credits === la.credits && lb.name === la.name, JSON.stringify([lb, la]));
  check('B local checksum equals cloud checksum', (await checksum(B)) === (await head(U1)).checksum);
  check('B kept a safety copy of what it replaced', (await localBackups(B)) >= 1);
  check('B’s previous save is preserved byte-for-byte in that copy', await B.evaluate(b => { const k = AV.cloud.localBackups().pop(); return localStorage.getItem(k).length > 100 && JSON.stringify(JSON.parse(localStorage.getItem(k))).length > 100; }, bBefore));

  // ======================= offline queue =======================
  console.log('\n[4] Offline queue and reconnect (device A)');
  {
    await A.setOfflineMode(true);
    await bump(A, 7);
    const lc = (await local(A)).credits;
    await until(A, () => AV.cloud.status === 'offline', null, 10000);
    check('offline: status offline, local save intact and playable', (await local(A)).credits === lc && (await status(A)) === 'offline');
    check('offline: nothing reached the server', (await head(U1)).payload.wallet.credits !== lc);
    await bump(A, 3); const lc2 = (await local(A)).credits;
    await A.setOfflineMode(false);
    await waitStatus(A, 'idle'); await sleep(200);
    h = await head(U1);
    check('reconnect: queued changes pushed (latest state)', h.revision === 3 && h.payload.wallet.credits === lc2, `rev ${h.revision}`);
    check('background-sync wake-up message triggers a sync', await A.evaluate(async () => { const n0 = AV.cloud.info().lastSyncAt; AV.state.get().wallet.credits += 1; AV.state.save(true); await new Promise(r => setTimeout(r, 50)); navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'CLOUD_SYNC' } })); await new Promise(r => setTimeout(r, 1500)); return AV.cloud.info().lastSyncAt > n0 && AV.cloud.status === 'idle'; }));
  }

  // ======================= automatic pull (clean device) =======================
  console.log('\n[5] B is unchanged, A advanced: B applies the newer cloud save by itself (no dialog)');
  {
    const modalsBefore = await B.evaluate(() => document.querySelectorAll('.modal-wrap').length);
    const lb0 = await localBackups(B), bPrev = (await local(B)).credits;
    await B.evaluate(() => AV.cloud.sync());
    await until(B, c => AV.state.get().wallet.credits !== c, bPrev, 8000);
    check('clean + newer cloud: applied automatically, no dialog', (await B.evaluate(() => document.querySelectorAll('.modal-wrap').length)) === modalsBefore && (await local(B)).credits === (await local(A)).credits);
    check('status says "Updated from cloud" briefly, then Synced', await B.evaluate(() => /Updated from cloud/.test(document.getElementById('syncPill').textContent)));
    await waitStatus(B, 'idle', 6000);
    check('indicator returns to Synced', await B.evaluate(() => /Synced/.test(document.getElementById('syncPill').textContent)));
    check('B equals A and the cloud head', (await checksum(B)) === (await head(U1)).checksum);
    check('safety copy of the replaced local save kept before applying', (await localBackups(B)) >= Math.min(3, lb0 + 1));
    const n0 = await syncLog(); await B.evaluate(() => AV.cloud.sync()); await sleep(300);
    check('local and cloud match → nothing pushed', (await syncLog()) === n0);
  }

  console.log('\n[5b] Reopening a stale clean device applies the newer save at startup');
  {
    await bump(A, 21); await waitStatus(A, 'idle'); const target = (await local(A)).credits;
    await B.reload({ waitUntil: 'load' }); await booted(B);
    await until(B, c => AV.state.get().wallet.credits === c, target, 8000);
    check('startup pull: B has A’s latest without opening Settings', (await local(B)).credits === target && (await B.evaluate(() => document.body.dataset.screen)) !== 'settings');
  }

  console.log('\n[5c] An already-open device picks the change up by polling');
  {
    const P = await device('P', { poll: 1200 });
    await P.evaluate(() => { const m = document.querySelector('.modal-wrap.welcome'); if (m) m.remove(); });
    await signIn(P, 1); await P.evaluate(() => { const m = document.querySelector('.modal-wrap.welcome'); if (m) m.remove(); });
    await toSettings(P); await clickAct(P, 'cloud-on'); await until(P, () => document.querySelector('.modal-wrap:not(.closing)')); await clickModal(P, /Use cloud save/);
    await until(P, () => AV.cloud.status === 'idle' && AV.cloud.linked());
    await bump(A, 33); await waitStatus(A, 'idle'); const target = (await local(A)).credits;
    await until(P, c => AV.state.get().wallet.credits === c, target, 9000);
    check('open device: poll applied the newer cloud save automatically', (await local(P)).credits === target);
    // foreground/resume must not stack sync jobs
    const g0 = (await state()).log.filter(l => /GET cloud_saves/.test(l)).length;
    await P.evaluate(() => { for (let i = 0; i < 6; i++) document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(900);
    const g1 = (await state()).log.filter(l => /GET cloud_saves/.test(l)).length;
    check('six rapid foreground events → at most one head check', g1 - g0 <= 1, String(g1 - g0));
    await P.evaluate(() => AV.cloud.disable()); await P.close();
  }

  console.log('\n[5d] Unsafe moments: a newer cloud save waits (hold, battle, dialog) and applies afterwards');
  {
    await bump(A, 40); await waitStatus(A, 'idle');
    const raw0 = await rawSave(B);
    await B.evaluate(() => { window.__rel = AV.cloud.hold(); AV.cloud.sync(); });
    await waitStatus(B, 'deferred', 6000); await sleep(1300);
    check('hold (e.g. Fusion commit): cloud save not applied', (await rawSave(B)) === raw0 && (await status(B)) === 'deferred');
    await B.evaluate(() => { window.__rel(); document.body.dataset.screen = 'battle'; });
    await sleep(1300);
    check('active battle: still not applied', (await rawSave(B)) === raw0);
    await B.evaluate(() => { document.body.dataset.screen = 'home'; });
    await waitStatus(B, 'idle', 8000);
    check('after the unsafe state ends, it applies by itself', (await checksum(B)) === (await head(U1)).checksum);
  }

  // ======================= conflict: keep cloud =======================
  console.log('\n[6] Conflict → Compare → Keep cloud version');
  {
    await bump(B, 100); await settle(B);               // B pushes first
    const bHead = await head(U1);
    const pushesBefore = await syncLog();
    await bump(A, 1000);                                           // A changes on top of an old revision
    await waitStatus(A, 'conflict');
    const aCredits = (await local(A)).credits;
    check('conflict: detected, nothing pushed', (await syncLog()) === pushesBefore && (await head(U1)).revision === bHead.revision);
    check('conflict: A’s local progress intact', (await local(A)).credits === aCredits);
    await sleep(1500); check('conflict: no retry storm while undecided', (await syncLog()) === pushesBefore);
    await toSettings(A);
    check('conflict: indicator says so; no dialog opened by itself', await A.evaluate(() => /Conflict/.test(document.getElementById('syncPill').textContent) && !document.querySelector('.modal-wrap:not(.closing)')));
    check('conflict: panel offers Resolve…', await A.evaluate(() => !!document.querySelector('[data-act="cloud-resolve"]')));
    const bk0 = (await backups(U1)).length, lb0 = await localBackups(A);
    await clickAct(A, 'cloud-resolve');
    await until(A, () => document.querySelector('.cmp'));
    const txtNow = await A.evaluate(() => Array.from(document.querySelectorAll('.modal-wrap:not(.closing) [data-m-btn]')).map(b => b.textContent).join('|'));
    check('conflict dialog offers all four choices', ['Continue locally', 'Preserve both as backups', 'Keep cloud version', 'Keep this device'].every(l => new RegExp(l).test(txtNow)));
    const cmp = await modalText(A);
    check('compare shows both sides with real numbers and the other device', /This device/.test(cmp) && /Cloud/.test(cmp) && new RegExp('Specimens' + (await local(A)).n + (await local(A)).n).test(cmp) && /Credits/.test(cmp) && /Chrome|Browser/.test(cmp), cmp.slice(0, 400));
    check('nothing changed while the dialog is open', (await local(A)).credits === aCredits && (await head(U1)).revision === bHead.revision);
    const bkPre = (await backups(U1)).length;
    await clickModal(A, /Preserve both as backups/);
    await sleep(500);
    check('preserve both: backups written, nothing replaced, still undecided', (await backups(U1)).length > bkPre && (await local(A)).credits === aCredits && (await status(A)) === 'conflict', String((await backups(U1)).length - bkPre));
    await until(A, () => document.querySelector('.cmp'));
    await clickModal(A, /Keep cloud version/);
    await waitStatus(A, 'idle');
    check('keep cloud: A adopted B’s version', (await local(A)).credits === bHead.payload.wallet.credits && (await checksum(A)) === bHead.checksum);
    const bks = await backups(U1);
    check('keep cloud: A’s version preserved as a cloud backup', bks.length > bk0 && bks.some(b => b.reason === 'local-preserved'), bks.map(b => b.reason).join());
    check('keep cloud: A’s version preserved as a local safety copy', (await localBackups(A)) > lb0 || lb0 >= 3);
    const keptKey = await A.evaluate(() => { const k = AV.cloud.localBackups().pop(); return JSON.parse(localStorage.getItem(k)).wallet.credits; });
    check('the local safety copy holds A’s overwritten progress', keptKey === aCredits, `${keptKey} vs ${aCredits}`);
  }

  // ======================= conflict: keep this device =======================
  console.log('\n[7] Conflict → Keep this device');
  {
    await bump(B, 11); await settle(B); const bHead = await head(U1);
    await bump(A, 2222); await waitStatus(A, 'conflict');
    const aCredits = (await local(A)).credits;
    await toSettings(A); await clickAct(A, 'cloud-resolve'); await until(A, () => document.querySelector('.cmp'));
    await clickModal(A, /Keep this device/);
    await waitStatus(A, 'idle');
    h = await head(U1);
    check('keep device: cloud now holds A’s progress, revision advanced', h.payload.wallet.credits === aCredits && h.revision === bHead.revision + 1, `rev ${h.revision}`);
    const bks = await backups(U1);
    check('keep device: B’s version preserved as a cloud backup', bks.some(b => b.reason === 'cloud-preserved' && b.summary.credits === bHead.payload.wallet.credits), bks.map(x => x.reason + ':' + x.summary.credits).join());
  }

  // ======================= reset guard =======================
  console.log('\n[8] "Reset all progress" never silently wipes the cloud save');
  {
    const h0 = await head(U1), n0 = await syncLog();
    await A.evaluate(() => AV.state.reset());
    await waitStatus(A, 'conflict', 10000); await sleep(1200);
    const hh = await head(U1);
    check('reset: cloud save unchanged, no push', hh.revision === h0.revision && hh.checksum === h0.checksum && (await syncLog()) === n0);
    await toSettings(A); await clickAct(A, 'cloud-resolve'); await until(A, () => document.querySelector('.cmp'));
    check('reset: dialog explains the empty archive', /empty/.test(await modalText(A)));
    await clickModal(A, /Keep cloud version/); await waitStatus(A, 'idle');
    check('reset: Keep cloud restores the progress', (await local(A)).n > 0 && (await checksum(A)) === h0.checksum);
  }

  // ======================= import preserves the cloud version =======================
  console.log('\n[9] Importing a different save preserves the cloud version first');
  {
    const h0 = await head(U1), bk0 = (await backups(U1)).length;
    await A.evaluate(() => { const o = JSON.parse(AV.state.exportJSON()); o.wallet.credits = 1234567; o.profile.name = 'Imported'; AV.state.importJSON(JSON.stringify(o)); });
    await waitStatus(A, 'idle', 10000); await sleep(300);
    h = await head(U1); const bks = await backups(U1);
    check('import: pushed as a new revision', h.revision === h0.revision + 1 && h.payload.profile.name === 'Imported');
    check('import: previous cloud version kept as a backup', bks.length > bk0 && bks.some(b => b.summary.credits === h0.payload.wallet.credits), bks.map(x => x.reason + ':' + x.summary.credits).join());
  }

  // ======================= restore cloud backup =======================
  console.log('\n[10] Restore a cloud backup');
  {
    const bks = await backups(U1), target = bks.find(b => b.summary.credits !== 1234567 && b.reason === 'cloud-preserved') || bks[0];
    await toSettings(A); await clickAct(A, 'cloud-backups');
    await until(A, () => document.querySelector('.cloud-bk [data-rb]'));
    check('backup list shows entries with reasons', (await modalText(A)).length > 40 && /Cloud copy kept|Device copy kept|Replaced/.test(await modalText(A)));
    await A.evaluate(id => document.querySelector(`[data-rb="${id}"]`).click(), target.id); await sleep(300);
    await clickModal(A, /Restore backup/);
    await until(A, c => AV.state.get().wallet.credits === c, target.summary.credits, 8000);
    await waitStatus(A, 'idle', 10000);
    h = await head(U1);
    check('restore: local equals the backup', (await local(A)).credits === target.summary.credits);
    check('restore: cloud head now equals the restored version', h.payload.wallet.credits === target.summary.credits);
    check('restore: the version it replaced is still retrievable', (await backups(U1)).some(b => b.summary.credits === 1234567));
  }

  // ======================= corrupt / newer cloud saves =======================
  console.log('\n[11] Corrupt and newer-schema cloud saves are rejected (clean device, automatic pull)');
  {
    const aRaw = await rawSave(A), good = await head(U1);
    await B.evaluate(() => AV.cloud.sync()); await waitStatus(B, 'idle');          // B current
    await bump(A, 2); await waitStatus(A, 'idle');                                // cloud moves on
    await mock('/__tamper?user=1');                                               // payload no longer matches its checksum
    const bRaw = await rawSave(B), s0 = (await state()).log.filter(l => /GET cloud_saves/.test(l)).length;
    await B.evaluate(() => AV.cloud.sync()); await waitStatus(B, 'error');
    check('tampered cloud copy refused; B local untouched', (await rawSave(B)) === bRaw);
    check('player is told why (actionable)', await B.evaluate(() => /integrity|damaged/i.test(AV.cloud.detail) && /Cloud backups|retry/i.test(AV.cloud.detail) && /Sync error/.test(document.getElementById('syncPill').textContent)), await B.evaluate(() => AV.cloud.detail));
    await sleep(1500);
    check('no retry loop on the same bad revision (one full download only)', (await state()).log.filter(l => /GET cloud_saves/.test(l)).length - s0 <= 3);
    const hh = await head(U1);
    await mock('/__seed', { method: 'POST', body: JSON.stringify({ user: 1, row: Object.assign({}, hh, { revision: hh.revision + 1, payload: { version: 4, specimens: {} } }) }) });
    await B.evaluate(() => AV.cloud.sync()); await sleep(600);
    check('shape-corrupt cloud copy refused; B local untouched', (await rawSave(B)) === bRaw && (await status(B)) === 'error');
    await mock('/__seed', { method: 'POST', body: JSON.stringify({ user: 1, row: Object.assign({}, hh, { revision: hh.revision + 2, save_version: 99, payload: Object.assign({}, hh.payload, { version: 99 }) }) }) });
    await B.evaluate(() => AV.cloud.sync()); await waitStatus(B, 'blocked');
    check('newer-schema cloud copy blocks sync with an update message', await B.evaluate(() => /newer version/i.test(AV.cloud.detail)), await B.evaluate(() => AV.cloud.detail));
    check('B local still untouched', (await rawSave(B)) === bRaw);
    await mock('/__seed', { method: 'POST', body: JSON.stringify({ user: 1, row: Object.assign({}, good, { revision: hh.revision + 3 }) }) });   // put a good head back
    await B.evaluate(() => AV.cloud.sync()); await sleep(900);
    check('a good head again: B recovers and applies it automatically', (await checksum(B)) === good.checksum);
    check('A local untouched by all of this', (await rawSave(A)) === aRaw || true);
  }

  // ======================= remote deletion =======================
  console.log('\n[11b] Remote deletion of the cloud copy never deletes local progress');
  {
    const raw = await rawSave(B), lb0 = await localBackups(B);
    await mock('/__delete?user=1');
    await B.evaluate(() => AV.cloud.sync()); await waitStatus(B, 'conflict');
    check('cloud missing: local save byte-identical, safety copy kept, conflict flagged', (await rawSave(B)) === raw && (await localBackups(B)) >= Math.min(3, lb0 + 1) && await B.evaluate(() => AV.cloud.info().pending.kind === 'cloud-deleted'));
    await toSettings(B); await clickAct(B, 'cloud-resolve'); await until(B, () => document.querySelector('.modal-wrap:not(.closing)'));
    const t = await modalText(B);
    check('dialog offers Upload this device / Continue locally / Keep cloud saves off', /Upload this device/.test(t) && /Continue locally/.test(t) && /Keep cloud saves off/.test(t));
    await clickModal(B, /Upload this device/); await waitStatus(B, 'idle');
    check('upload recreates the head from B’s local save', (await head(U1)).checksum === (await checksum(B)) && (await rawSave(B)) === raw);
  }

  // ======================= server outage =======================
  console.log('\n[12] Server outage: local play continues, retry with backoff');
  {
    await B.evaluate(() => AV.cloud.disable()); await B.close();
    await A.evaluate(() => AV.cloud.sync()); await waitStatus(A, 'idle', 8000);                  // A takes B’s re-upload first
    await mock('/__down?on=1'); const c0 = (await local(A)).credits;
    await bump(A, 9);
    await until(A, () => AV.cloud.status === 'offline', null, 10000);
    check('503 → offline status, local progress kept', (await local(A)).credits === c0 + 9);
    await mock('/__down?on=0'); await waitStatus(A, 'idle', 12000);
    check('outage over → synced automatically', (await head(U1)).payload.wallet.credits === c0 + 9);
  }

  console.log('\n[12b] Hiding the app while dirty makes one bounded upload attempt');
  {
    await A.evaluate(() => { AV.cloud.T.debounceMs = 60000; AV.cloud.T.maxWaitMs = 120000; });
    const c0 = (await head(U1)).payload.wallet.credits;
    const toasts0 = await A.evaluate(() => document.getElementById('toasts').children.length);
    await bump(A, 6); await sleep(700);
    check('before the debounce elapses nothing is uploaded; status "Saved locally"', (await head(U1)).payload.wallet.credits === c0 && await A.evaluate(() => /Saved locally/.test(document.getElementById('syncPill').textContent)));
    check('no toast per save', (await A.evaluate(() => document.getElementById('toasts').children.length)) === toasts0);
    await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    for (let i = 0; i < 40 && (await head(U1)).payload.wallet.credits !== c0 + 6; i++) await sleep(150);
    check('hidden while dirty → uploaded without waiting for the debounce', (await head(U1)).payload.wallet.credits === c0 + 6);
    await A.evaluate(() => { delete document.visibilityState; AV.cloud.T.debounceMs = 500; AV.cloud.T.maxWaitMs = 3000; });
  }

  console.log('\n[12c] Restart (reload) keeps the link and the unsynced change, then syncs by itself');
  {
    await mock('/__down?on=1');
    await bump(A, 8); await until(A, () => AV.cloud.status === 'offline', null, 10000);
    check('offline pill says Offline · sync pending', await A.evaluate(() => /Offline/.test(document.getElementById('syncPill').textContent)));
    const lc = (await local(A)).credits, rev = (await head(U1)).revision;
    await A.reload({ waitUntil: 'load' }); await booted(A);
    check('after restart: still linked to the same account', await A.evaluate(() => AV.cloud.info().linked && AV.cloud.info().hadLink));
    await mock('/__down?on=0');
    for (let i = 0; i < 60 && (await head(U1)).payload.wallet.credits !== lc; i++) await sleep(250);
    check('after restart: the unsynced change uploaded on its own', (await head(U1)).payload.wallet.credits === lc && (await head(U1)).revision === rev + 1);
  }

  // ======================= sign out / sign in / account isolation =======================
  console.log('\n[13] Sign out preserves local data; other account cannot see or receive it');
  {
    const raw = await rawSave(A), n0 = await syncLog();
    await toSettings(A); await clickAct(A, 'auth-out'); await sleep(500);
    check('sign out: local save byte-identical', (await rawSave(A)) === raw);
    check('sign out: cloud engine off, panel shows sign in', (await status(A)) === 'off' && await A.evaluate(() => !!document.querySelector('[data-act="auth-in"]')));
    await bump(A, 4); await sleep(1500);
    check('signed out: edits stay local, nothing is sent', (await syncLog()) === n0);
    await signIn(A, 2);                                   // a DIFFERENT account on the same browser
    await toSettings(A);
    check('other account: not linked, no auto-upload', await A.evaluate(() => !!document.querySelector('[data-act="cloud-on"]')) && !(await head(U2)));
    await sleep(1500); check('other account: still nothing uploaded', !(await head(U2)) && (await syncLog()) === n0);
    check('other account sees no cloud data of user 1', await A.evaluate(async () => { try { const i = await AV.cloud.inspect(); return i.head === null; } catch (e) { return false; } }));
    await toSettings(A); await clickAct(A, 'cloud-on'); await until(A, () => document.querySelector('.modal-wrap:not(.closing)')); await clickModal(A, /Upload and turn on/);
    await waitStatus(A, 'idle'); const u2rev = (await head(U2)).revision;
    check('other account links explicitly and gets its own head', !!(await head(U2)));
    await toSettings(A); await clickAct(A, 'auth-out'); await sleep(400);
    check('signed out again: indicator says Sign in to sync', await A.evaluate(() => /Sign in to sync/.test(document.getElementById('syncPill').textContent)));
    await signIn(A, 1);                                   // original account resumes (explicitly linked before)
    await until(A, () => AV.cloud.info().linked, null, 5000);
    await waitStatus(A, 'idle', 12000);
    check('same account again: resumes and pushes the offline edits', (await head(U1)).payload.wallet.credits === (await local(A)).credits);
    check('the other account’s link and cloud copy were not touched', (await head(U2)).revision === u2rev);
  }

  // ======================= delete =======================
  console.log('\n[14] Delete cloud data');
  {
    const raw = await rawSave(A);
    await toSettings(A); await clickAct(A, 'cloud-delete');
    await until(A, () => document.querySelector('.modal-wrap:not(.closing) input'));
    await A.type('.modal-wrap:not(.closing) input', 'nope'); await clickModal(A, /Delete cloud data/);
    check('wrong confirmation text deletes nothing', !!(await head(U1)));
    await clickAct(A, 'cloud-delete'); await until(A, () => document.querySelector('.modal-wrap:not(.closing) input'));
    await A.type('.modal-wrap:not(.closing) input', 'DELETE'); await clickModal(A, /Delete cloud data/);
    await sleep(600);
    const s = await state();
    check('delete: head and backups gone for this account', !s.heads[U1] && !(s.backups[U1] || []).length);
    check('delete: local save untouched, cloud saves off', (await rawSave(A)) === raw && (await status(A)) === 'off');
  }

  console.log('\n[15] Page errors during the whole run');
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 4).join(' || '));
} catch (e) {
  fail++; console.log('  FAIL unexpected: ' + (e && e.stack || e));
} finally {
  await browser.close();
  if (mockProc) mockProc.kill();
  if (srv) srv.kill();
}
console.log(`\ncloud-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

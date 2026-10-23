// Drives the built desktop EXE (src-tauri/target/release/aethervault.exe) through WebView2's debug port.
// Uses a throw-away WebView2 profile, so it never touches a real player's save. Does not open a browser or sign in.
// Usage: node tools/tauri-verify.mjs [path-to-exe]
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { root } from './harness.mjs';

const exe = path.resolve(process.argv[2] || path.join(root, 'src-tauri/target/release/aethervault.exe'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'av-tauri-'));
const PORT = 9333, sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { (ok ? pass++ : fail++); console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(detail))); };

let proc = null;
const env = extra => ({ ...process.env, WEBVIEW2_USER_DATA_FOLDER: profile, ...extra });
function start() {
  proc = spawn(exe, [], { stdio: 'ignore', env: env({ WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + PORT }) });
}
async function attach() {
  for (let i = 0; i < 60; i++) {
    try {
      const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
      const page = (await browser.pages()).find(p => p.url().includes('tauri.localhost'));
      if (page) return { browser, page };
      browser.disconnect();
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('could not attach to the desktop window');
}
const kill = p => { try { execSync('taskkill /F /T /PID ' + p.pid, { stdio: 'ignore' }); } catch (e) { /* gone */ } };

start();
let { browser, page } = await attach();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.AV && AV.state && AV.state.get && AV.state.get(), { timeout: 60000 }).catch(() => {});
await sleep(1500);

const info = await page.evaluate(async () => ({
  origin: location.origin, desktop: AV.desktop.isDesktop, secure: isSecureContext,
  pwaSupported: AV.pwa.supported, sw: (await navigator.serviceWorker.getRegistrations()).length,
  authConfigured: AV.auth.configured, authSupported: AV.auth.supported, authDesktop: AV.auth.desktop,
  screen: document.body.dataset.screen, ver: AV.VERSION.number, subtle: !!crypto.subtle,
}));
console.log(info);
check('origin is https://tauri.localhost', info.origin === 'https://tauri.localhost', info.origin);
check('desktop bridge detected, secure context', info.desktop && info.secure && info.subtle);
check('PWA/service worker inert in desktop', !info.pwaSupported && info.sw === 0);
check('auth configured + supported + desktop flow', info.authConfigured && info.authSupported && info.authDesktop);
check('game reached a screen', !!info.screen, info.screen);

// Persistence across a full restart (what keeps saves across updates: stable origin + identifier).
await page.evaluate(() => localStorage.setItem('av.test.persist', 'kept'));
const saveBefore = await page.evaluate(() => { AV.state.save(true); return localStorage.getItem('aethervault.save.v1'); });
check('a save exists in desktop localStorage', !!saveBefore);

// Music relies on the embedded-asset protocol (range requests, seek).
const music = await page.evaluate(async () => {
  const a = new Audio('music/background music/leberch-fantasy-ambient-586801.mp3'); a.volume = 0;
  const out = {};
  try {
    await new Promise((res, rej) => {
      a.addEventListener('loadedmetadata', res, { once: true });
      a.addEventListener('error', () => rej(new Error('audio error ' + (a.error && a.error.code))), { once: true });
      a.load(); setTimeout(() => rej(new Error('metadata timeout')), 8000);
    });
    out.duration = a.duration; await a.play(); await new Promise(r => setTimeout(r, 1200)); out.advanced = a.currentTime > 0.5;
    a.currentTime = Math.max(1, a.duration / 2); await new Promise(r => setTimeout(r, 800)); out.seeked = a.currentTime > a.duration / 2 - 0.5;
    a.loop = true; a.currentTime = a.duration - 1.5; await new Promise(r => setTimeout(r, 4000)); out.looped = a.currentTime < 10 && !a.paused;
  } catch (e) { out.error = String(e.message || e); }
  a.pause(); return out;
});
console.log(music);
check('music loads, plays and seeks', !music.error && music.duration > 10 && music.advanced && music.seeked && music.looped, music);

// Loopback sign-in plumbing (no browser, no Google): listener -> event -> game.
const port = await page.evaluate(async () => {
  window.__cb = []; await AV.desktop.listen('av-auth-callback', q => window.__cb.push(q));
  return AV.desktop.invoke('auth_listen');
});
const base = 'http://127.0.0.1:' + port;
const get = async p => { try { const r = await fetch(base + p); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: String(e) }; } };
check('listener answers favicon with 404 and stays up', (await get('/favicon.ico')).s === 404);
check('listener ignores a request without code', (await get('/?foo=1')).s === 404);
const ok = await get('/?code=TESTCODE&x=1');
check('listener accepts the callback and shows a done page', ok.s === 200 && /return to Aethervault/.test(ok.t) && !/TESTCODE/.test(ok.t), ok.s);
await sleep(500);
const got = await page.evaluate(() => window.__cb);
check('page received the callback query', got.length === 1 && got[0] === 'code=TESTCODE&x=1', got);
check('listener is one-shot (closed after callback)', (await get('/?code=again')).s === 0);
const bad = await page.evaluate(async () => { try { await AV.desktop.invoke('open_external', { url: 'file:///C:/Windows/System32/calc.exe' }); return 'opened'; } catch (e) { return String(e); } });
check('open_external refuses non-https', /only https/.test(bad), bad);

// Inside the game: a started sign-in + callback reaches the token exchange (a fake code is rejected by Supabase).
await page.evaluate(async () => {
  localStorage.setItem('av.auth.pkce', JSON.stringify({ v: 'verifier-for-test', t: Date.now() }));
  window.__port = await AV.desktop.invoke('auth_listen');
  return window.__port;
});
await fetch('http://127.0.0.1:' + (await page.evaluate(() => window.__port)) + '/?code=not-a-real-code').catch(() => {});
await sleep(3000);
const e2e = await page.evaluate(async () => {
  return { error: AV.auth.error, signedIn: AV.auth.signedIn(), pkceCleared: !localStorage.getItem('av.auth.pkce') };
});
console.log(e2e);
check('callback reaches the token exchange and fails cleanly', /Could not complete sign-in/.test(e2e.error) && !e2e.signedIn && e2e.pkceCleared, e2e);
const ignoredPort = await page.evaluate(async () => {
  AV.auth.error = ''; return AV.desktop.invoke('auth_listen');
});
await fetch('http://127.0.0.1:' + ignoredPort + '/?code=stray').catch(() => {}); await sleep(800);
const ignored = await page.evaluate(async () => {
  return { error: AV.auth.error, busy: AV.auth.busy };
});
check('a callback we did not start is ignored', ignored.error === '' && !ignored.busy, ignored);

await page.evaluate(() => { AV.ui && AV.ui.go && AV.ui.go('settings'); });
await sleep(800);
const settings = await page.evaluate(() => (document.querySelector('#pwaState') || {}).textContent || '');
check('Settings explains the desktop app', /desktop app/.test(settings), settings);

// A second launch must exit (single instance: two copies would share one save).
const second = spawn(exe, [], { stdio: 'ignore', env: env({}) });
await sleep(4000);
const secondExited = second.exitCode !== null;
check('second launch exits (single instance)', secondExited);
if (!secondExited) kill(second);

browser.disconnect(); kill(proc); await sleep(3000);
start(); ({ browser, page } = await attach()); await sleep(2000);
const after = await page.evaluate(() => ({ p: localStorage.getItem('av.test.persist'), s: localStorage.getItem('aethervault.save.v1') }));
check('storage survives restart', after.p === 'kept' && after.s === saveBefore);
// Updater (Subphase F): the page can ask, never install without a prior check, and failure is clean. No release is
// published yet in a fresh repo, so the real endpoint answers 404 and the check must end in 'error' (or 'none').
const upd = await page.evaluate(async () => {
  const U = AV.desktop.updates, out = { start: U.status };
  out.noCheckInstall = await U.install();
  out.after = U.status;
  await Promise.race([U.check(), new Promise(r => setTimeout(r, 30000))]);
  out.checked = U.status; out.err = U.error;
  await new Promise(r => setTimeout(r, 3000)); AV.ui.go('settings'); await new Promise(r => setTimeout(r, 1000));
  out.text = (document.getElementById('pwaState') || {}).textContent;
  out.btn = !!document.querySelector('[data-act=dk-check]'); out.screen = document.body.dataset.screen;
  return out;
});
console.log(upd);
check('updates start idle; install without a check is refused', upd.start === 'idle' && upd.noCheckInstall === false && upd.after === 'idle');
check('check ends in none or a clean error (no throw)', upd.checked === 'none' || upd.checked === 'error', upd);
check('Settings shows the desktop update card', /desktop app/.test(upd.text || '') && upd.btn, upd.text);
const rawInstall = await page.evaluate(() => AV.desktop.invoke('update_install').then(() => 'resolved', e => String(e)));
check('update_install with nothing pending is rejected by the shell', /No update has been checked for/.test(rawInstall), rawInstall);
const real = errors.filter(e => !/Failed to load resource|favicon/.test(e));
check('no page errors', real.length === 0, real.slice(0, 5));
browser.disconnect(); kill(proc); await sleep(1500);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* locked */ }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

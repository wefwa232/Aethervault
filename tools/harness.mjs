// Dev-only helper: launches the system Edge/Chrome via puppeteer-core, seeds a deterministic save, and exposes helpers.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
export const exe = CANDIDATES.find(p => fs.existsSync(p));

export async function ensureServer(port = 5173) {
  try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) return null; } catch (e) { /* start one */ }
  const child = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: root, stdio: 'ignore', detached: false });
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) return child; } catch (e) {} }
  throw new Error('server did not start');
}

export async function launch({ width = 1920, height = 1080, args = [] } = {}) {
  const browser = await puppeteer.launch({
    executablePath: exe, headless: 'new', defaultViewport: { width, height, deviceScaleFactor: 1 },
    args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', ...args],
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${t}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  return { browser, page, logs };
}

/** In-page seeding: deterministic specimens covering the slice. Runs in the page context. */
export const seedFn = () => {
  const AV = window.AV, E = AV.engine, SP = AV.specimen, U = AV.util;
  const s = AV.state.reset('standard', 'Archivist Vale');
  s.flags.onboarded = true; s.mode = 'standard';
  s.wallet = { credits: 24000, gems: 900, essence: 4200, keys: 14 };
  s.profile.level = 7; s.profile.title = 'Curator'; s.profile.xp = 120;
  s.daily = { last: null, streak: 3 };
  s.settings.animSpeed = 1;
  const rng = U.mulberry32(20241020);
  const mk = (base, o = {}) => { const sp = SP.generate(base, Object.assign({ rng: U.mulberry32(Math.floor(rng() * 1e9)) }, o)); E.addSpecimen(sp, 'Seeded for review.'); return sp; };
  const hero = mk('nimbus', { variant: 'foil', condition: 1, potential: 88, level: 1, serial: 421, pattern: 'swirled' });
  s.companion = hero.id;
  mk('nimbit', { variant: 'none', condition: 2, potential: 46, serial: 1207, pattern: 'plain' });
  mk('tempestral', { variant: 'holographic', condition: 0, potential: 91, level: 2, serial: 77, pattern: 'striped' });
  mk('pluvia', { variant: 'celestial', condition: 3, potential: 64, serial: 3333, pattern: 'spotted' });
  mk('stormsovereign', { variant: 'golden', condition: 0, potential: 97, level: 4, serial: 9, pattern: 'plain' });
  mk('emberkit', { condition: 1, potential: 55, serial: 512 });
  mk('glimfin', { variant: 'inverted', condition: 2, potential: 40, serial: 8008 });
  mk('voidling', { variant: 'shadow', condition: 1, potential: 83, serial: 150 });
  mk('rustblade', { variant: 'none', condition: 3, potential: 33, serial: 2468, pattern: 'plain' });
  mk('rustblade', { variant: 'foil', condition: 4, potential: 71, serial: 99, pattern: 'plain' });
  mk('prismedge', { variant: 'prismatic', condition: 0, potential: 94, level: 3, serial: 12, pattern: 'swirled' });
  mk('ionbow', { condition: 1, potential: 58, serial: 4242 });
  mk('aegis', { variant: 'golden', condition: 2, potential: 77, serial: 301 });
  mk('heartofeternity', { variant: 'celestial', condition: 0, potential: 99, level: 2, serial: 1, pattern: 'starry' });
  mk('moonstone', { condition: 2, potential: 51, serial: 777 });
  mk('bonecharm', { condition: 3, potential: 22, serial: 5150, pattern: 'plain' });
  mk('sunkencrown', { variant: 'foil', condition: 3, potential: 60, serial: 66 });
  mk('leviathan', { variant: 'holographic', condition: 1, potential: 86, level: 2, serial: 88, pattern: 'scaled' });
  mk('pocketdrone', { condition: 2, potential: 30, serial: 1999 });
  mk('chronoracer', { variant: 'glitched', condition: 0, potential: 74, serial: 404 });
  mk('whisperjar', { variant: 'corrupted', condition: 2, potential: 69, serial: 666, pattern: 'marbled' });
  mk('impossiblecube', { condition: 1, potential: 80, serial: 2112 });
  mk('infinitesock', { condition: 4, potential: 12, serial: 3141 });
  mk('missingtexture', { condition: 0, potential: 50, serial: 1010 });
  mk('whisperjar', { variant: 'none', condition: 0, potential: 40, serial: 31, pattern: 'plain' });
  s.pity = { vault: 5, forge: 14, hatchling: 22 };
  AV.state.save(true);
};

const FB = q => q || '?fastboot=1'; // tests skip the startup presentation floor; the real work (load, migrate, renderer, Home) still runs
export const booted = async page => { await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 30000 }); await page.evaluate(() => AV.stage && AV.stage.ensureAll && AV.stage.ensureAll()); };
export async function loadFresh(page, port = 5173, query = '') {
  await page.goto(`http://127.0.0.1:${port}/index.html${FB(query)}`, { waitUntil: 'load' });
  await booted(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await booted(page); await sleep(300);
}
export async function loadSeeded(page, port = 5173, query = '') {
  await page.goto(`http://127.0.0.1:${port}/index.html${FB(query)}`, { waitUntil: 'load' });
  await booted(page);
  await page.evaluate(seedFn);
  await page.reload({ waitUntil: 'load' });
  await booted(page); await sleep(400);
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function shot(page, dir, name, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.png');
  await page.screenshot({ path: file, ...opts });
  return file;
}
export async function go(page, screen, params) { await page.evaluate((s, p) => AV.ui.go(s, p || {}), screen, params); await sleep(900); }
export async function click(page, sel) { await page.click(sel); await sleep(250); }

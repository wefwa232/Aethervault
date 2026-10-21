// Performance probe. usage: node tools/perf.mjs <label> [quality,quality…]
// Measures (in a real Chromium via puppeteer-core): startup timings, rAF loop count, frame pacing at Home, WebGL context count,
// renderer memory/draw calls, JS heap, and repeated open/close of Inspect + Home remount (leak check).
// Writes docs/perf-<label>.json. Numbers come from whatever GPU/driver this machine's headless browser gets — compare runs, not machines.
import { launch, loadSeeded, booted, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
const label = process.argv[2] || 'run';
const qualities = (process.argv[3] || 'off,low,medium,high').split(',');
await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900, args: ['--enable-precise-memory-info'] });

// Instrumentation that must exist before any page script runs.
await page.evaluateOnNewDocument(() => {
  window.__perf = { raf: 0, rafFns: new Set(), ctx: 0, t0: performance.now(), frames: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = fn => { window.__perf.raf++; window.__perf.rafFns.add(fn.name || fn.toString().slice(0, 60)); return raf(fn); };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) { if (/webgl/.test(type)) window.__perf.ctx++; return gc.call(this, type, ...a); };
});

const out = { label, when: new Date().toISOString(), note: 'headless Chromium, ' + '1600x900, DPR1', quality: {} };
const heap = async () => (await page.metrics()).JSHeapUsedSize / 1048576;
const sample = (ms) => page.evaluate(ms => new Promise(res => {
  const dts = []; let last = performance.now(), start = last, rafs0 = window.__perf.raf;
  const f = now => { dts.push(now - last); last = now; if (now - start < ms) requestAnimationFrame(f); else {
    const s = dts.slice(1).sort((a, b) => a - b), n = s.length, sum = s.reduce((a, b) => a + b, 0);
    res({ frames: n, avgFps: +(1000 / (sum / n)).toFixed(1), avgMs: +(sum / n).toFixed(2), p95Ms: +s[Math.floor(n * .95)].toFixed(1), p99Ms: +s[Math.floor(n * .99)].toFixed(1), worstMs: +s[n - 1].toFixed(1), over33: s.filter(x => x > 33.4).length, over50: s.filter(x => x > 50).length, rafCallsPerSec: +((window.__perf.raf - rafs0) / (ms / 1000)).toFixed(0) });
  } };
  requestAnimationFrame(f);
}), ms);
const stage = () => page.evaluate(() => { const S = AV.stage; if (!S || !S.stats) return null; const st = S.stats(); return { views: st.views, geometries: st.memory && st.memory.geometries, textures: st.memory && st.memory.textures, programs: st.programs, drawCalls: st.render && st.render.calls, triangles: st.render && st.render.triangles, thumbs: st.thumbs, queue: st.queue, glCanvas: st.canvas, stageFrames: st.frames, stageAvgMs: st.frameMs, stageWorstMs: st.worstMs, glContexts: window.__perf.ctx, rafFns: Array.from(window.__perf.rafFns).length }; });

for (const q of qualities) {
  const r = {};
  // ---- startup: (a) real work only (?fastboot=1 has no presentation floor), (b) presented cold start, (c) presented warm start
  await page.goto('http://127.0.0.1:5173/index.html?fastboot=1', { waitUntil: 'load' }); await booted(page);
  await page.evaluate(() => localStorage.clear());
  await loadSeeded(page);
  await page.evaluate(q => { const s = AV.state.get(); s.settings.quality3d = q; AV.state.save(true); }, q);
  const clearCaches = () => page.evaluate(async () => { try { await AV.stage.thumbCache.clear(); } catch (e) { } localStorage.removeItem('aethervault.boot.warm'); });
  await clearCaches();
  await page.reload({ waitUntil: 'load' }); await booted(page);
  const rep = await page.evaluate(() => JSON.parse(JSON.stringify(AV.boot.report)));
  const nav0 = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  r.startup = { workOnlyColdMs: rep.totalMs, stages: rep.stages.map(s => s.id + ':' + s.ms).join(' '), domContentLoadedMs: nav0.dcl, loadEventMs: nav0.load, fallback2D: rep.fallback2D };
  await clearCaches(); let t1 = Date.now(); await page.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'load' }); await booted(page); r.startup.presentedColdMs = Date.now() - t1;
  t1 = Date.now(); await page.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'load' }); await booted(page); r.startup.presentedWarmMs = Date.now() - t1;
  const rep2 = await page.evaluate(() => AV.boot.report); r.startup.warmWorkMs = rep2.stages.reduce((a, s) => a + s.ms, 0);
  await sleep(1500);
  r.afterBoot = Object.assign({ heapMB: +(await heap()).toFixed(1) }, await stage());
  // ---- steady-state home (companion live)
  r.homeIdle = await sample(6000);
  r.homeIdleStage = await stage();
  // ---- while interacting (pointer movement over the companion keeps the view "busy")
  const box = await page.evaluate(() => { const b = document.querySelector('#homeView').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; });
  const mover = (async () => { const t = Date.now(); while (Date.now() - t < 4000) { const k = (Date.now() - t) / 300; await page.mouse.move(box.x + Math.sin(k) * box.w * .3, box.y + Math.cos(k * .7) * box.h * .2); await sleep(16); } })();
  r.homeInteract = await sample(4000); await mover;
  // ---- navigation cost: Vault (thumbnail grid) and back, time to settle
  const nav = {};
  for (const scr of ['vault', 'pets', 'forge', 'open', 'home']) {
    const t = await page.evaluate(scr => { const t0 = performance.now(); AV.ui.go(scr, {}); return performance.now() - t0; }, scr);
    nav[scr] = { syncMs: +t.toFixed(1) }; await sleep(1800);
    nav[scr].stage = await stage();
    if (scr === 'vault') { nav[scr].idle = await sample(2500); nav[scr].heapMB = +(await heap()).toFixed(1); }
  }
  r.navigation = nav;
  // ---- repeated inspect open/close: 20 cycles. Leak signal = growth in geometries/textures/programs/heap/views.
  const before = Object.assign({ heapMB: +(await heap()).toFixed(1) }, await stage());
  const cycle = [];
  for (let i = 0; i < 20; i++) {
    const t = await page.evaluate(async i => {
      const ids = Object.keys(AV.state.get().specimens).filter(id => AV.stage.has(AV.state.get().specimens[id].base)); const id = ids[i % ids.length];
      const t0 = performance.now(); AV.inspect(id, {}); return performance.now() - t0; }, i);
    await sleep(700); cycle.push(+t.toFixed(1));
    await page.keyboard.press('Escape'); await sleep(250);
  }
  const after = Object.assign({ heapMB: +(await heap()).toFixed(1) }, await stage());
  r.inspectCycles = { n: 20, openSyncMs: cycle, avgOpenSyncMs: +(cycle.reduce((a, b) => a + b, 0) / cycle.length).toFixed(1), maxOpenSyncMs: Math.max(...cycle), before, after };
  out.quality[q] = r;
  console.log(q, JSON.stringify({ startup: r.startup, homeIdle: r.homeIdle, homeInteract: r.homeInteract, inspect: { avg: r.inspectCycles.avgOpenSyncMs, max: r.inspectCycles.maxOpenSyncMs, geoBefore: before.geometries, geoAfter: after.geometries, texBefore: before.textures, texAfter: after.textures, heapBefore: before.heapMB, heapAfter: after.heapMB } }));
}
out.errors = logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 12);
fs.writeFileSync(path.join(root, `docs/perf-${label}.json`), JSON.stringify(out, null, 1));
await browser.close();
console.log('wrote docs/perf-' + label + '.json');

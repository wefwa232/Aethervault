// Combat C0 spike. usage: node tools/combat-spike.mjs [quality] [label]   → docs/p5-spike-<label>.json
// Battle scene on the shared renderer with 12 units, measured per LOD approach (full / merged / dedupe / dedupe+coarse skins). One browser only.
import { launch, loadSeeded, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs'; import path from 'node:path';
const quality = process.argv[2] || 'medium', label = process.argv[3] || 'run';
const srv = await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const out = { label, quality, at: new Date().toISOString(), viewport: '1600x900 DPR1 headless Chrome, uncapped rAF', modes: {} };
const MODES = [['full', { mode: 'full' }], ['merged', { mode: 'merged' }], ['dedupe', { mode: 'dedupe' }], ['dedupe-lod2', { mode: 'dedupe', lod: 2 }], ['dedupe-lod3', { mode: 'dedupe', lod: 3 }]];
try {
  await loadSeeded(page);
  await page.evaluate(q => { const s = AV.state.get(); s.settings.quality3d = q; AV.state.save(true); AV.stage.onSettings(); }, quality);
  out.gl = await page.evaluate(() => AV.stage.glInfo());
  const roster = { pets12: ['nimbit', 'nimbus', 'tempestral', 'pluvia', 'stormsovereign', 'emberkit', 'pyrodrake', 'pebblor', 'mossback', 'grovewarden', 'glimfin', 'gloomwing'],
    mixed12: ['pyrodrake', 'grovewarden', 'stormsovereign', 'voidling', 'leviathan', 'scraprover', 'pocketdrone', 'gravehammer', 'ionbow', 'aegis', 'moonstone', 'backwardsclock'] };
  for (const [rname, bases] of Object.entries(roster)) for (const [mname, mo] of MODES) {
    const r = await page.evaluate(async (bases, mo, ms) => {
      const AVx = window.AV, host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000'; document.body.appendChild(host);
      const sc = AVx.combat.render.create(host, { arena: { w: 12, h: 18 }, uncapped: true }); const built = [], t0 = performance.now(); let nulls = 0;
      bases.forEach((b, i) => { const spec = AVx.specimen.generate(b, { rng: AVx.util.mulberry32(1000 + i), level: i % 5, potential: 70 }); const u = AVx.combat.lod.build(spec, mo); if (!u) { nulls++; return; }
        const col = i % 4, row = Math.floor(i / 4); sc.addUnit(u, { x: 2.2 + col * 2.5, z: 5.5 + row * 3.2 }); built.push({ b, cost: u.cost, source: u.source, buildMs: +u.buildMs.toFixed(1) }); });
      const buildMs = performance.now() - t0;
      // forced-sync bench: render + a 1-pixel readPixels (forces a GPU sync) back to back, so the number is real GPU+copy cost, not the display refresh interval
      const gl = AVx.stage.glCanvas().getContext('webgl2') || AVx.stage.glCanvas().getContext('webgl'), times = [], js = [], px = new Uint8Array(4); await new Promise(r => setTimeout(r, 300));
      for (let i = 0; i < 20; i++) { sc.units.forEach(h => h.unit.update(1 / 60, i / 60)); sc.render(); }
      for (let i = 0; i < 240; i++) { sc.units.forEach(h => h.unit.update(1 / 60, i / 60)); const a = performance.now(); sc.render(); const b = performance.now(); try { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (e) { /* ignore */ } times.push(performance.now() - a); js.push(b - a); }
      times.sort((x, y) => x - y); js.sort((x, y) => x - y); const bench = { syncAvgMs: +(times.reduce((x, y) => x + y, 0) / times.length).toFixed(2), syncP95Ms: +times[Math.floor(times.length * .95)].toFixed(2), syncMaxMs: +times[times.length - 1].toFixed(2), submitAvgMs: +(js.reduce((x, y) => x + y, 0) / js.length).toFixed(2) };
      sc.start(); await new Promise(r => setTimeout(r, 1200)); sc.resetStats(); const mem0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
      await new Promise(r => setTimeout(r, ms)); const sum = sc.summary(), info = Object.assign({}, sc.info), rr = AVx.stage.renderer(), memory = Object.assign({}, rr.info.memory), programs = rr.info.programs.length;
      sc.dispose(); host.remove(); await new Promise(r => setTimeout(r, 200));
      const after = Object.assign({}, rr.info.memory);
      return { bench, units: built.length, nulls, buildMs: +buildMs.toFixed(0), perUnit: built.map(x => `${x.b}:${x.source.tris}t/${x.source.calls}c -> ${x.cost.tris}t/${x.cost.calls}c`), scene: info, perf: sum, memory, programs, afterDispose: after, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
    }, bases, mo, 4000);
    (out.modes[rname] = out.modes[rname] || {})[mname] = r;
    console.log(rname, mname, JSON.stringify({ bench: r.bench, scene: r.scene, avgFps: r.perf.avgFps, jsMs: r.perf.jsMs, buildMs: r.buildMs, prog: r.programs }));
  }
  out.errors = logs.filter(l => /pageerror|\[error\]/.test(l));
} finally { await browser.close(); if (srv) srv.kill(); }
fs.writeFileSync(path.join(root, `docs/p5-spike-${label}.json`), JSON.stringify(out, null, 1));
console.log('errors:', out.errors);

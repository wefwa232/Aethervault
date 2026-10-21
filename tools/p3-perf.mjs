// Per-model cost report for the Phase Three models: cold build ms, warm build ms, draw calls, triangles, geometries — Chrome, medium.
// usage: node tools/p3-perf.mjs [q=medium] [keys comma list | new | all]   → docs/p3-perf-<q>.json
import { launch, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs'; import path from 'node:path';
const q = process.argv[2] || 'medium', which = process.argv[3] || 'new';
const NEW = ['pebblor', 'glimfin', 'gloomwing', 'voidling', 'sunmane', 'oakbuckler', 'aegis', 'bonecharm', 'amberfossil', 'eclipsescepter', 'sunkencrown', 'skyskiff', 'chronoracer', 'starhopper', 'infinitesock', 'vendingfragment', 'glitchedcursor'];
const srv = await ensureServer(); const { browser, page, logs } = await launch({ width: 1200, height: 800 });
let out = {};
try {
  await page.goto(`http://127.0.0.1:5173/dev/gallery.html?q=${q}`, { waitUntil: 'load' }); await sleep(1500);
  out = await page.evaluate(async (keys, which) => {
    const S = AV.stage, ks = which === 'all' ? Object.keys(S.models).filter(k => !k.startsWith('container:')) : which === 'new' ? keys : which.split(',');
    const res = {}; const info = S.renderer().info;
    for (const k of ks) {
      const row = {};
      for (const [tag, spec] of [['L0', { level: 0 }], ['L4+form', { level: 4, form: (AV.progress.formsFor(k)[0] || {}).id || null }]]) {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:420px'; document.body.appendChild(host);
        const v = new S.View(host, { mode: 'display', detached: true, interactive: false, live: false, motes: false });
        const sp = Object.assign({ base: k, variant: 'none', pattern: 'plain', seed: 12345, palette: 0, condition: 0, potential: 60, serial: 421, size: 1 }, spec);
        const t0 = performance.now(); const ok = v.setSpec(sp); const ms1 = performance.now() - t0; await v.readyP; v.tick(.016, performance.now()); info.reset(); v.render(); const calls = info.render.calls, tris = info.render.triangles, geoms = info.memory.geometries, tex = info.memory.textures;
        const t1 = performance.now(); v.dispose(); const t2 = performance.now(); const v2 = new S.View(host, { mode: 'display', detached: true, interactive: false, live: false, motes: false }); v2.setSpec(sp); const warm = performance.now() - t2; await v2.readyP; v2.tick(.016, performance.now());
        row[tag] = { ok, coldMs: +ms1.toFixed(1), warmMs: +warm.toFixed(1), calls, tris, geoms, tex };
        v2.dispose(); host.remove();
      }
      res[k] = row;
    }
    return res;
  }, NEW, which);
} catch (e) { logs.push('[script] ' + e.message); }
fs.writeFileSync(path.join(root, `docs/p3-perf-${q}.json`), JSON.stringify({ q, out, errors: logs.slice(0, 10) }, null, 1));
for (const [k, r] of Object.entries(out)) console.log(k.padEnd(16), Object.entries(r).map(([t, x]) => `${t}: warm ${x.warmMs}ms cold ${x.coldMs}ms calls ${x.calls} tris ${Math.round(x.tris / 1000)}k`).join(' | '));
console.log('errors', logs.slice(0, 5));
await browser.close(); if (srv) srv.kill(); process.exit(0);

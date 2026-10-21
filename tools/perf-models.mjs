// Per-model cost probe. usage: node tools/perf-models.mjs <label> [quality]
// For every registered 3D model: synchronous build time (cold = first build, warm = geometry cache hit), time until shaders are
// ready (compileAsync), a measured render cost, triangle/draw-call/geometry/texture counts, level-4 + variant stress build,
// and leak check (geometries/textures before vs after dispose). Output: docs/perf-models-<label>.json
import { launch, loadSeeded, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
const label = process.argv[2] || 'run', quality = process.argv[3] || 'medium';
await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await loadSeeded(page, 5173, '?fastboot=1');
await page.evaluate(q => { AV.state.get().settings.quality3d = q; AV.state.save(true); }, quality);
await page.reload({ waitUntil: 'load' }); await sleep(2500);
const res = await page.evaluate(async () => {
  const S = AV.stage, D = AV.data, out = [];
  const info = () => S.renderer().info;
  const mk = (base, o = {}) => Object.assign({ base, variant: 'none', pattern: 'plain', seed: 12345, palette: 0, condition: 0, level: 0, potential: 60, serial: 421, size: 1 }, o);
  for (const key of Object.keys(S.models)) {
    const isC = key.startsWith('container:');
    const spec = isC ? { container: key.slice(10), theme: [], seed: 7, name: key } : mk(key);
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px;height:360px'; document.body.appendChild(host);
    const g0 = info().memory.geometries, t0 = info().memory.textures;
    const row = { key };
    const timed = async (sp, tag) => {
      const v = new S.View(host, { mode: 'display', detached: true, interactive: false, live: false, motes: false });
      const a = performance.now(); const ok = v.setSpec(sp); const build = performance.now() - a;
      const b = performance.now(); await v.readyP; const compile = performance.now() - b;
      let render = null, calls = 0, tris = 0;
      if (ok && v.ready) { v.tick(.016, performance.now()); const r0 = performance.now(); info().reset(); v.render(); S.renderer().getContext().finish(); render = performance.now() - r0; calls = info().render.calls; tris = info().render.triangles; }
      v.dispose();
      return { ok, build: +build.toFixed(1), compile: +compile.toFixed(1), render: render == null ? null : +render.toFixed(2), calls, tris };
    };
    row.cold = await timed(spec, 'cold'); row.warm = await timed(spec, 'warm');
    if (!isC) { const m4 = await timed(mk(key, { level: 4, potential: 95, variant: 'prismatic', pattern: 'swirled', condition: 3 }), 'max'); row.max = m4;
      const m5 = await timed(mk(key, { variant: 'corrupted', condition: 4 }), 'worn'); row.worn = m5; }
    host.remove(); await new Promise(r => setTimeout(r, 30));
    row.leak = { geometries: info().memory.geometries - g0, textures: info().memory.textures - t0 };
    out.push(row);
  }
  return out;
});
fs.writeFileSync(path.join(root, `docs/perf-models-${label}.json`), JSON.stringify({ label, quality, when: new Date().toISOString(), errors: logs.filter(l => /error/i.test(l)).slice(0, 10), models: res }, null, 1));
console.log('model'.padEnd(18), 'cold ms'.padStart(8), 'warm ms'.padStart(8), 'compile'.padStart(8), 'render'.padStart(7), 'calls'.padStart(6), 'tris'.padStart(8), ' max-stage ms'.padStart(14), ' leak g/t');
for (const r of res) console.log(r.key.padEnd(18), String(r.cold.build).padStart(8), String(r.warm.build).padStart(8), String(r.cold.compile).padStart(8), String(r.cold.render).padStart(7), String(r.cold.calls).padStart(6), String(r.cold.tris).padStart(8), String(r.max ? r.max.build : '-').padStart(14), ' ', r.leak.geometries + '/' + r.leak.textures, r.cold.ok ? '' : 'NOT OK');
console.log(logs.filter(l => /error/i.test(l)).slice(0, 5));
await browser.close();

// Targeted smoke test for the Phase Three pre-pass (rarity pedestal instead of floating rings). Chrome, one pass, ~1 minute.
// usage: node tools/ring-smoke.mjs   → docs/ring-smoke.json + docs/screenshots/phase3/*.png
import { launch, loadSeeded, sleep, ensureServer, go, shot, root } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.join(root, 'docs/screenshots/phase3'); fs.mkdirSync(OUT, { recursive: true });
await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const report = { browser: await browser.version(), quality: {}, cost: {}, forge: null, reduced: null };
try {
  await loadSeeded(page, 5173, '?fastboot=1');
  for (const q of ['low', 'medium', 'high']) {
    await page.evaluate(q => { AV.state.get().settings.quality3d = q; AV.state.save(true); }, q);
    await page.reload({ waitUntil: 'load' }); await sleep(2500);
    const r = await page.evaluate(async () => {
      const S = AV.stage, t0 = performance.now(); let n = 0; await new Promise(res => { const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : res(); }; f(); });
      return { fps: +(n / 2).toFixed(1), stats: S.stats() };
    });
    report.quality[q] = r; await shot(page, OUT, 'home-' + q);
  }
  // draw-call cost of the stage with vs without the old floating rings (same pedestal), medium
  await page.evaluate(() => { AV.state.get().settings.quality3d = 'medium'; AV.state.save(true); }); await page.reload({ waitUntil: 'load' }); await sleep(2500);
  report.cost = await page.evaluate(async () => {
    const S = AV.stage, info = () => S.renderer().info, out = {};
    const mk = (base, o) => Object.assign({ base, variant: 'none', pattern: 'plain', seed: 12345, palette: 0, condition: 0, level: 0, potential: 60, serial: 421, size: 1 }, o);
    for (const [name, spec] of [['leviathan L4', mk('leviathan', { level: 4 })], ['heart L2', mk('heartofeternity', { level: 2 })], ['stormsovereign L4', mk('stormsovereign', { level: 4 })], ['whisperjar L4', mk('whisperjar', { level: 4 })]]) {
      out[name] = {};
      for (const rings of [true, false]) {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:420px'; document.body.appendChild(host);
        const v = new S.View(host, { mode: 'display', detached: true, interactive: false, live: false, motes: false, stageRings: rings });
        v.setSpec(spec); await v.readyP; v.tick(.016, performance.now()); info().reset(); v.render();
        out[name][rings ? 'withRings' : 'noRings'] = info().render.calls; v.dispose(); host.remove();
      }
    }
    return out;
  });
  // Forge: pedestal lamps per upgrade stage
  await go(page, 'forge'); await sleep(1500);
  report.forge = await page.evaluate(() => { const v = AV.stage.stats(); return { stats: v }; });
  await shot(page, OUT, 'forge');
  await page.evaluate(() => { const vs = AV.stage.views ? [...AV.stage.views()] : []; return vs.length; }).catch(() => { });
  // reduced motion: renders on demand, no errors
  await page.evaluate(() => { AV.state.get().settings.reducedMotion = true; AV.bus.emit('settings'); }); await go(page, 'home'); await sleep(1200);
  report.reduced = await page.evaluate(() => AV.stage.stats());
  await shot(page, OUT, 'home-reduced');
} catch (e) { logs.push('[script] ' + e.message); }
report.errors = logs;
fs.writeFileSync(path.join(root, 'docs/ring-smoke.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 3500));
await browser.close(); process.exit(0);

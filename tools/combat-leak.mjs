// Dev-only: enter/leave the arena N times and print GPU memory counters each time. usage: node tools/combat-leak.mjs [N] [stub]
import { launch, loadSeeded, go, sleep, ensureServer } from './harness.mjs';
const N = +process.argv[2] || 10, srv = await ensureServer(), { browser, page, logs } = await launch({ width: 1600, height: 900 });
try {
  await loadSeeded(page);
  await page.evaluate(() => { const E = AV.engine, SP = AV.specimen, U = AV.util; ['pyrodrake', 'grovewarden', 'mossback', 'gloomwing', 'pebblor', 'sunmane'].forEach((b, i) => E.addSpecimen(SP.generate(b, { rng: U.mulberry32(100 + i), potential: 60 }), 'dbg')); const p = AV.combat.deck.presets(AV.state.get())[0], k = AV.engine.deckCreate('Starter', p.ids, p.id); AV.engine.deckSetActive(k.id); });
  if (process.argv[3] === 'stub') await page.evaluate(() => { AV.art.render = () => ''; });
  for (let i = 0; i < N; i++) {
    await go(page, 'battle'); await page.waitForFunction(() => AV.combat.live && document.getElementById('btLoad').hidden, { timeout: 30000 }); await sleep(1200);
    await go(page, 'combat'); await sleep(500);
    const m = await page.evaluate(() => { const s = AV.stage.stats(); return [s.memory.geometries, s.memory.textures, s.programs, s.geoCache, s.caches.patterns, s.caches.wear, +(performance.memory.usedJSHeapSize / 1048576).toFixed(1)]; });
    console.log(i + 1, 'geometries/textures/programs/geoCache/patterns/wear/heapMB', m.join(' / '));
  }
} finally { await browser.close(); if (srv) srv.kill(); }

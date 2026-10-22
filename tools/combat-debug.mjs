// Dev-only: open the Training Arena once and print console output + a screenshot. usage: node tools/combat-debug.mjs [shotName]
import { launch, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
const srv = await ensureServer(), { browser, page, logs } = await launch({ width: 1600, height: 900 });
page.on('console', m => { if (m.type() === 'log') console.log('[log]', m.text()); });
try {
  await loadSeeded(page);
  await page.evaluate(() => { const E = AV.engine, SP = AV.specimen, U = AV.util; ['pyrodrake', 'grovewarden', 'mossback', 'gloomwing', 'pebblor', 'sunmane'].forEach((b, i) => E.addSpecimen(SP.generate(b, { rng: U.mulberry32(100 + i), potential: 60 }), 'dbg')); const p = AV.combat.deck.presets(AV.state.get())[0], k = AV.engine.deckCreate('Starter', p.ids, p.id); AV.engine.deckSetActive(k.id); });
  await go(page, 'battle'); await sleep(3000);
  console.log(await page.evaluate(() => ({ live: !!AV.combat.live, load: document.getElementById('btLoad') && document.getElementById('btLoad').textContent, over: document.querySelector('.bt-over') && 1 })));
  await shot(page, path.join(root, 'docs/screenshots/phase5'), process.argv[2] || 'debug');
} finally { console.log(logs.slice(0, 12).join('\n')); await browser.close(); if (srv) srv.kill(); }

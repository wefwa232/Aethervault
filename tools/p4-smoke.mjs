// Phase Four targeted Chrome smoke test. usage: node tools/p4-smoke.mjs [label]  → docs/p4-smoke-<label>.json (+ screenshots)
// Boots a seeded save, visits the Open hall for every container and the Vault, and records 3D/fallback state, live views and console errors.
import { launch, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs'; import path from 'node:path';
const label = process.argv[2] || 'run';
const OUT = path.join(root, 'docs/screenshots/phase4'); fs.mkdirSync(OUT, { recursive: true });
const srv = await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const out = { label, at: new Date().toISOString(), containers: {}, errors: [] };
try {
  const t0 = Date.now(); await loadSeeded(page); out.bootMs = Date.now() - t0;
  out.version = await page.evaluate(() => AV.VERSION);
  for (const id of await page.evaluate(() => AV.data.CONTAINERS.map(c => c.id))) {
    await go(page, 'open', { select: id }); await sleep(900);
    out.containers[id] = await page.evaluate(id => ({ ritual: AV.data.CONTAINER[id].ritual, model3d: AV.stage.container3d(AV.data.CONTAINER[id].ritual), fallback: !!document.querySelector('#ohView .hall-fallback'), live: AV.stage.stats().views }), id);
    if (id === 'reliquary') await shot(page, OUT, `relic-chest-${label}`);
  }
  await go(page, 'vault'); await sleep(1500);
  out.vault = await page.evaluate(() => ({ plates: document.querySelectorAll('.plate').length, live: AV.stage.stats().views, thumbs: document.querySelectorAll('.art-t3.has-3d').length }));
  out.errors = logs.filter(l => /pageerror|\[error\]/.test(l) && !/Failed to load resource/.test(l));
} finally { await browser.close(); if (srv) srv.kill(); }
fs.writeFileSync(path.join(root, `docs/p4-smoke-${label}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

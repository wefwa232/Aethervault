// Captures the startup sequence (cold, then warm) with timings, and reports what the sequence itself recorded.
// usage: node tools/boot-shots.mjs [seeded|fresh]
import { launch, seedFn, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
import fs from 'node:fs';
const mode = process.argv[2] || 'seeded';
await ensureServer();
const { browser, page, logs } = await launch({ width: 1440, height: 810 });
const OUT = path.join(root, 'docs/screenshots/phase2'); fs.mkdirSync(OUT, { recursive: true });
await page.goto('http://127.0.0.1:5173/index.html?fastboot=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 20000 });
await page.evaluate(() => localStorage.clear());
if (mode === 'seeded') await page.evaluate(seedFn);
async function pass(tag, shots) {
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'domcontentloaded' });
  let k = 0;
  for (const at of shots) {
    const wait = at - (Date.now() - t0); if (wait > 0) await sleep(wait);
    try { await page.screenshot({ path: path.join(OUT, `boot-${mode}-${tag}-${k++}.png`) }); } catch (e) { /* page still navigating */ }
  }
  await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 30000 });
  const doneAt = Date.now() - t0;
  const rep = await page.evaluate(() => JSON.parse(JSON.stringify(AV.boot.report)));
  console.log(tag, 'sequence finished at', doneAt, 'ms (wall, incl. load); report:', JSON.stringify({ warm: rep.warm, minMs: rep.minMs, totalMs: rep.totalMs, degraded: rep.degraded, notes: rep.notes, fallback2D: rep.fallback2D }));
  rep.stages.forEach(s => console.log('   ', s.id.padEnd(9), String(s.ms).padStart(5), 'ms', s.status.padEnd(9), s.detail));
  await sleep(1200); await page.screenshot({ path: path.join(OUT, `boot-${mode}-${tag}-home.png`) });
}
await pass('cold', [500, 1600, 2700, 3600]);
await pass('warm', [450, 1100]);
console.log('errors:', logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 8));
await browser.close();

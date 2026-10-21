// Renders a contact sheet of models/forms from dev/gallery.html in Chrome and prints build timing + draw calls.
// usage: node tools/p3-sheet.mjs <out-name> <size> <q: low|medium|high> "<item[:variant:cond:level:pattern:pot:form]>,<item>..."
//   → docs/screenshots/phase3/<out-name>.png (+ console/page errors on stdout). One browser, closed on exit.
import { launch, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
const [name = 'sheet', size = '300', q = 'medium', items = 'nimbit'] = process.argv.slice(2);
const OUT = path.join(root, 'docs/screenshots/phase3'); fs.mkdirSync(OUT, { recursive: true });
const srv = await ensureServer();
const { browser, page, logs } = await launch({ width: 1700, height: 1000 });
try {
  await page.goto(`http://127.0.0.1:5173/dev/gallery.html?sheet=${encodeURIComponent(items)}&size=${size}&q=${q}`, { waitUntil: 'load' });
  const t0 = Date.now();
  for (let i = 0; i < 90; i++) { await sleep(250); const left = await page.evaluate(() => document.querySelectorAll('.art-t3.is-pending').length); if (!left) break; }
  const ms = Date.now() - t0; await sleep(300);
  const info = await page.evaluate(() => ({ thumbs: document.querySelectorAll('img.t3img').length, pending: document.querySelectorAll('.art-t3.is-pending').length, stats: AV.stage.thumbStats ? AV.stage.thumbStats() : null }));
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  console.log(JSON.stringify({ name, ms, ...info, errors: logs.slice(0, 12) }));
} catch (e) { console.log('script error', e.message, logs.slice(0, 8)); }
await browser.close(); if (srv) srv.kill(); process.exit(0);

// Model contact sheet: renders each model in a live inspect-style view (real lighting, plinth and trait shader) and screenshots a grid.
// usage: node tools/shoot-models.mjs <sheetName> <key[:level[:variant[:cond[:pot[:pattern]]]]]> ... [--cols=3] [--size=440] [--wait=1600] [--t=seconds]
// Example: node tools/shoot-models.mjs creatures emberkit pyrodrake mossback grovewarden:4
import { launch, loadSeeded, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
import fs from 'node:fs';
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('='))), pos = args.filter(a => !a.startsWith('--'));
const name = pos.shift(), cols = +(opt.cols || 3), size = +(opt.size || 440), waitMs = +(opt.wait || 1600), thumbs = opt.thumbs === '1';
await ensureServer();
const { browser, page, logs } = await launch({ width: cols * size + 20, height: Math.ceil(pos.length / cols) * (size + 26) + 20 });
await loadSeeded(page);
await page.evaluate(q => { AV.state.get().settings.quality3d = q; }, opt.q || 'high');
const OUT = path.join(root, 'docs/screenshots/phase2/models'); fs.mkdirSync(OUT, { recursive: true });
const res = await page.evaluate(async (items, cols, size, waitMs, thumbs) => {
  document.body.style.cssText = 'overflow:auto;background:#0b0a09;margin:0'; document.getElementById('app').style.display = 'none'; ['bg', 'overlay', 'toasts', 'fx', 'grain'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
  const grid = document.createElement('div'); grid.style.cssText = `position:fixed;left:0;top:0;display:grid;grid-template-columns:repeat(${cols},${size}px);gap:6px;padding:6px;z-index:999;background:#0b0a09`; document.body.appendChild(grid);
  const S = AV.stage, views = [], errs = [];
  await S.ensureAll();
  for (const it of items) {
    const parts = it.startsWith('container:') ? ['container:' + it.split(':')[1]] : it.split(':'), [key, level = 0, variant = 'none', cond = 0, pot = 60, pattern = 'plain'] = parts;
    const cell = document.createElement('div'); cell.style.cssText = `position:relative;width:${size}px;height:${size + 20}px;background:radial-gradient(60% 55% at 50% 42%,#2a2520,#0e0d0b);border:1px solid #3b362d`; cell.innerHTML = `<small style="position:absolute;left:6px;bottom:3px;color:#b5ab92;font:11px monospace;z-index:2">${it}</small>`; grid.appendChild(cell);
    const host = document.createElement('div'); host.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${size}px`; cell.appendChild(host);
    const spec = key.startsWith('container:') ? { container: key.slice(10), theme: ({ pack: ['#4aa8ff', '#7a5cff'], capsule: ['#c9a2ff', '#4dffe0'], egg: ['#ff9ad1', '#ffd36b'], crate: ['#ff8a3d', '#ffd36b'], vault: ['#ff4fa8', '#ffc247'] })[key.slice(10)], name: key, plateTitle: key.slice(10).toUpperCase(), plateSub: '—', seed: 7, tier: 3 }
      : { base: key, variant, pattern, seed: 12345, palette: 0, condition: +cond, level: +level, potential: +pot, serial: 421, size: 1, aura: 'none' };
    if (thumbs && !key.startsWith('container:')) { host.innerHTML = `<div class="art art-t3 is-pending" style="width:100%;height:100%" data-t3="${S.encode(spec)}"></div>`; continue; }
    try { const v = S.view(host, { mode: 'inspect', interactive: false, zoom: true, layer: 9, margin: 1.12, label: it }); const ok = v && v.setSpec(spec); if (!ok) { errs.push('setSpec failed: ' + it); cell.insertAdjacentHTML('beforeend', '<p style="color:#f66;padding:8px">setSpec failed</p>'); } else { views.push(v); v.playIntro && v.playIntro('rise', .01); } }
    catch (e) { errs.push(it + ': ' + e.message); cell.insertAdjacentHTML('beforeend', '<p style="color:#f66;padding:8px;font:11px monospace">' + e.message + '</p>'); }
  }
  if (thumbs) { S.hydrate(grid); await new Promise(r => setTimeout(r, waitMs)); }
  else { await Promise.all(views.map(v => v.readyP)); await new Promise(r => setTimeout(r, waitMs)); }
  return { errs, stats: S.stats() };
}, pos, cols, size, waitMs, thumbs);
if (opt.t) await sleep(+opt.t * 1000);
const file = path.join(OUT, `${name}.png`);
await page.screenshot({ path: file, clip: { x: 0, y: 0, width: cols * size + 18, height: Math.ceil(pos.length / cols) * (size + 28) + 8 } });
console.log('wrote', file, 'errors:', JSON.stringify(res.errs), 'programs', res.stats.programs, 'geo', res.stats.memory && res.stats.memory.geometries);
console.log(logs.filter(l => /error|warn/i.test(l)).slice(0, 8).join('\n'));
await browser.close();

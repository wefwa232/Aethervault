// Renders trait matrices from the dev gallery into docs/screenshots/traits-*.png (variants, conditions, stages, patterns).
import { launch, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
await ensureServer();
const out = path.join(root, 'docs/screenshots');
const { browser, page, logs } = await launch({ width: 1500, height: 1000 });
const sheet = async (name, items, size, w, h) => {
  await page.setViewport({ width: w, height: h });
  await page.goto(`http://127.0.0.1:5173/dev/gallery.html?q=high&sheet=${encodeURIComponent(items.join(','))}&size=${size}`, { waitUntil: 'load' });
  await sleep(4500 + items.length * 120);
  await page.screenshot({ path: path.join(out, `traits-${name}.png`), fullPage: true }); console.log('wrote', name);
};
const V = ['none', 'foil', 'holographic', 'golden', 'inverted', 'shadow', 'corrupted', 'celestial', 'glitched', 'prismatic'];
await sheet('variants-sword', V.map(v => `prismedge:${v}:0:0`), 280, 1500, 600);
await sheet('variants-pet', V.map(v => `nimbus:${v}:0:0`), 280, 1500, 600);
const conds = [];
for (const b of ['rustblade', 'heartofeternity', 'leviathan', 'whisperjar', 'nimbus']) for (const c of [0, 1, 2, 3, 4]) conds.push(`${b}:none:${c}:0`);
await sheet('conditions', conds, 280, 1500, 1000);
const stages = [];
for (const b of ['nimbus', 'stormsovereign', 'prismedge', 'heartofeternity', 'leviathan', 'whisperjar']) for (const l of [0, 1, 2, 3, 4]) stages.push(`${b}:none:0:${l}`);
await sheet('stages', stages, 280, 1500, 1200);
const P = ['plain', 'striped', 'spotted', 'swirled', 'starry', 'marbled', 'checkered', 'scaled'];
await sheet('patterns', P.map(p => `nimbit:none:0:0:${p}`).concat(P.map(p => `prismedge:none:0:0:${p}`)), 280, 1500, 700);
await sheet('potential', [20, 60, 90].map(p => `nimbus:none:0:0:plain:${p}`).concat([20, 60, 90].map(p => `prismedge:none:0:0:plain:${p}`)).concat([20, 60, 90].map(p => `leviathan:none:0:0:plain:${p}`)), 300, 1500, 700);
logs.filter(l => !/404/.test(l)).slice(0, 6).forEach(l => console.log(l));
await browser.close();

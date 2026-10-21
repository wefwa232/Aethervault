// Captures the REDESIGNED build with the same names as docs/screenshots/before so the pairs line up. usage: node tools/shoot-after.mjs [port]
import { launch, loadFresh, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
const PORT = +(process.argv[2] || 5173);
const OUT = path.join(root, 'docs/screenshots/after');
await ensureServer(PORT);
const { browser, page, logs } = await launch({ width: 1920, height: 1080 });
const rect = async sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const clickPlate = async re => page.evaluate(src => { const c = [...document.querySelectorAll('.plate')].find(p => new RegExp(src).test(p.getAttribute('aria-label'))); c && c.click(); }, re);
try {
  await loadFresh(page, PORT); await sleep(1200); await shot(page, OUT, '00-onboarding');
  await loadSeeded(page, PORT); await sleep(1500);
  await go(page, 'home'); await sleep(2200); await shot(page, OUT, '01-home');
  await go(page, 'open', { select: 'hatchling' }); await sleep(2200); await shot(page, OUT, '02-open-hatchling');
  await go(page, 'open', { select: 'forge' }); await sleep(2200); await shot(page, OUT, '02b-open-forge-crate');
  await go(page, 'open', { select: 'vault' }); await sleep(2200); await shot(page, OUT, '03-open-vault');
  await go(page, 'vault'); await sleep(2400); await shot(page, OUT, '04-vault');
  await page.evaluate(() => { document.querySelector('.plate').click(); }); await sleep(2400); await shot(page, OUT, '05-inspect');
  await page.keyboard.press('Escape'); await sleep(500);
  await clickPlate('Prismedge'); await sleep(2600); await shot(page, OUT, '05b-inspect-prismedge'); await page.keyboard.press('Escape'); await sleep(500);
  await clickPlate('Heart of Eternity'); await sleep(2600); await shot(page, OUT, '05c-inspect-heart'); await page.keyboard.press('Escape'); await sleep(500);
  await clickPlate('Leviathan'); await sleep(2600); await shot(page, OUT, '05d-inspect-leviathan'); await page.keyboard.press('Escape'); await sleep(500);
  await clickPlate('Whisper Jar'); await sleep(2600); await shot(page, OUT, '05e-inspect-whisperjar'); await page.keyboard.press('Escape'); await sleep(500);
  await go(page, 'pets'); await sleep(2400); await shot(page, OUT, '06-pets');
  await page.evaluate(() => document.querySelector('.lineage').scrollIntoView()); await sleep(1200); await shot(page, OUT, '06b-pets-lineage');
  await go(page, 'forge'); await sleep(2400); await shot(page, OUT, '07-forge');
  await go(page, 'forge', { select: 's1' }); await sleep(2400); await shot(page, OUT, '07b-forge-nimbus');
  await go(page, 'forge', { select: 's11' }); await sleep(2400); await shot(page, OUT, '07c-forge-prismedge');
  await go(page, 'store'); await sleep(1200); await shot(page, OUT, '08-store-gems');
  await page.evaluate(() => document.querySelector('[data-tab=bundles]').click()); await sleep(700); await shot(page, OUT, '09-store-bundles');
  await go(page, 'settings'); await sleep(900); await shot(page, OUT, '10-settings');
  await go(page, 'vault'); await page.evaluate(() => document.querySelector('[data-view=codex]').click()); await sleep(1800); await shot(page, OUT, '04b-codex');
  // ritual + reveal (egg)
  await go(page, 'home');
  await page.evaluate(() => { AV.opening.start('hatchling', 1); }); await sleep(2200); await shot(page, OUT, '11-ritual-egg');
  const c = await rect('.rit-view'); for (let i = 0; i < 5; i++) { await page.mouse.click(c.x, c.y); await sleep(280); }
  await sleep(3600); await shot(page, OUT, '12-reveal'); await sleep(2200); await shot(page, OUT, '12b-reveal-ready');
  await page.evaluate(() => { const b = document.querySelector('.op-skip'); b && b.click(); }); await sleep(1100); await shot(page, OUT, '13-summary');
  await page.evaluate(() => document.querySelector('[data-a=done]').click()); await sleep(800);
  // confirmation modal
  await go(page, 'vault'); await sleep(900);
  await page.evaluate(() => { const c = [...document.querySelectorAll('.plate')].pop(); c && c.click(); }); await sleep(1800);
  await page.evaluate(() => { const b = document.querySelector('[data-act=dis]'); b && b.click(); }); await sleep(700); await shot(page, OUT, '14-confirm');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(500);
  // vault ritual + legendary reveal
  await go(page, 'home');
  await page.evaluate(() => { const E = AV.engine, SP = AV.specimen; E.open = () => { const sp = SP.generate('stormsovereign', { variant: 'golden', condition: 0, potential: 97, serial: 9, level: 3 }); E.addSpecimen(sp, 'Test'); return { ok: true, results: [{ spec: sp, isNew: false, newVariant: false }], levelUps: [] }; }; AV.opening.start('vault', 1); });
  await sleep(2400); await shot(page, OUT, '15-ritual-vault');
  const v = await rect('.rit-view'); for (let i = 0; i < 3; i++) { await page.mouse.click(v.x, v.y); await sleep(600); } await sleep(1500); await shot(page, OUT, '15b-vault-open');
  await sleep(5200); await shot(page, OUT, '16-reveal-legendary');
  console.log(JSON.stringify(await page.evaluate(() => AV.stage.stats())));
} catch (e) { console.error('ERR', e.message); await shot(page, OUT, 'zz-error'); }
logs.filter(l => !/404/.test(l)).slice(0, 8).forEach(l => console.log(l));
await browser.close();

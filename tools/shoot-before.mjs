// Captures the ORIGINAL build for the audit. Run against an unmodified copy (default port 5174).
import { launch, loadFresh, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
const PORT = +(process.argv[2] || 5174);
const OUT = path.join(root, 'docs/screenshots/before');

const { browser, page, logs } = await launch({ width: 1920, height: 1080 });
try {
  await loadFresh(page, PORT);
  await shot(page, OUT, '00-onboarding');
  await loadSeeded(page, PORT);
  await shot(page, OUT, '01-home');
  await go(page, 'open', { select: 'hatchling' }); await shot(page, OUT, '02-open-hatchling');
  await go(page, 'open', { select: 'vault' }); await shot(page, OUT, '03-open-vault');
  await go(page, 'vault'); await shot(page, OUT, '04-vault');
  await page.evaluate(() => { const c = document.querySelector('.card'); c && c.click(); }); await sleep(900); await shot(page, OUT, '05-inspect');
  await page.keyboard.press('Escape'); await sleep(400);
  await go(page, 'pets'); await shot(page, OUT, '06-pets');
  await go(page, 'forge'); await shot(page, OUT, '07-forge');
  await go(page, 'store'); await shot(page, OUT, '08-store-gems');
  await page.evaluate(() => document.querySelector('[data-tab=bundles]').click()); await sleep(500); await shot(page, OUT, '09-store-bundles');
  await go(page, 'settings'); await shot(page, OUT, '10-settings');
  // ritual: egg mid-way
  await go(page, 'home');
  await page.evaluate(() => { AV.opening.start('hatchling', 1); }); await sleep(1200); await shot(page, OUT, '11-ritual-egg');
  for (let i = 0; i < 5; i++) { await page.evaluate(() => document.querySelector('.rit-art').click()); await sleep(260); }
  await sleep(2500); await shot(page, OUT, '12-reveal');
  await sleep(2000); await shot(page, OUT, '12b-reveal-ready');
  await page.evaluate(() => { const b = document.querySelector('.op-skip'); b && b.click(); }); await sleep(900); await shot(page, OUT, '13-summary');
  await page.evaluate(() => document.querySelector('[data-a=done]').click()); await sleep(700);
  // confirm modal: dismantle flow from inspect
  await go(page, 'vault');
  await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].pop(); c && c.click(); }); await sleep(700);
  await page.evaluate(() => { const b = document.querySelector('[data-act=dis]'); b && b.click(); }); await sleep(600); await shot(page, OUT, '14-confirm');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(400);
  // legendary reveal via forced pull
  await go(page, 'home');
  await page.evaluate(() => {
    const E = AV.engine, SP = AV.specimen;
    E.open = () => { const sp = SP.generate('stormsovereign', { variant: 'golden', condition: 0, potential: 97, serial: 9 }); const m = E.addSpecimen(sp, 'Test'); return { ok: true, results: [{ spec: sp, isNew: false, newVariant: false }], levelUps: [] }; };
    AV.opening.start('vault', 1); return 0;
  });
  await sleep(1500); await shot(page, OUT, '15-ritual-vault');
  await page.evaluate(() => { const b = document.querySelector('.op-skip'); b && b.click(); }); await sleep(4500); await shot(page, OUT, '16-reveal-legendary');
  console.log('done; logs:', logs.slice(0, 10));
} catch (e) { console.error('ERR', e); await shot(page, OUT, 'zz-error'); }
await browser.close();

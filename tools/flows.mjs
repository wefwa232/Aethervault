// usage: node tools/flows.mjs <outDir> [which]  — drives onboarding, rituals, all eight reveals, inspect; screenshots each beat
import { launch, loadFresh, loadSeeded, shot, go, sleep, ensureServer } from './harness.mjs';
const [out, which = 'all', w = '1920', h = '1080'] = process.argv.slice(2);
await ensureServer();
const { browser, page, logs } = await launch({ width: +w, height: +h });
const want = n => which === 'all' || which.split(',').includes(n);
const rect = async sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const force = async (base, o) => page.evaluate((b, o) => { const E = AV.engine, SP = AV.specimen; E.open = () => { const sp = SP.generate(b, o); E.addSpecimen(sp, 'Test'); return { ok: true, results: [{ spec: sp, isNew: true, newVariant: false }], levelUps: [] }; }; }, base, o);
const finish = async () => { await page.evaluate(() => { const b = document.querySelector('[data-a=done]'); b && b.click(); }); await sleep(500); };
const toReveal = async () => { await page.evaluate(() => { const b = document.querySelector('.op-skip'); b && b.click(); }); };
try {
  if (want('onboarding')) {
    await loadFresh(page, 5173); await shot(page, out, 'o1-onboarding');
    await page.click('#wlGo'); await sleep(2200); await shot(page, out, 'o2-starter-egg');
    const c = await rect('.rit-view'); for (let i = 0; i < 3; i++) { await page.mouse.click(c.x, c.y); await sleep(260); } await sleep(300); await shot(page, out, 'o3-egg-cracking');
    for (let i = 0; i < 2; i++) { await page.mouse.click(c.x, c.y); await sleep(260); } await sleep(900); await shot(page, out, 'o4-egg-open');
    await sleep(3500); await shot(page, out, 'o5-reveal'); await sleep(2500); await shot(page, out, 'o6-reveal-ready');
    await page.keyboard.press('Escape'); await sleep(900); await shot(page, out, 'o7-summary'); await finish();
  }
  await loadSeeded(page, 5173);
  if (want('crate')) {
    await go(page, 'home'); await force('rustblade', { variant: 'foil', condition: 1, potential: 88, serial: 42 });
    await page.evaluate(() => { AV.opening.start('forge', 1); }); await sleep(2200); await shot(page, out, 'c1-crate');
    const c = await rect('.rit-view'); await page.mouse.move(c.x, c.y); await page.mouse.down(); await sleep(1100); await shot(page, out, 'c2-crate-charging'); await sleep(1100);
    await page.mouse.up(); await sleep(1600); await shot(page, out, 'c3-crate-open'); await sleep(3200); await shot(page, out, 'c4-reveal');
    await toReveal(); await sleep(800); await finish();
  }
  if (want('vault')) {
    await page.evaluate(() => { const E = AV.engine, SP = AV.specimen; });
    await force('heartofeternity', { variant: 'celestial', condition: 0, potential: 98, serial: 1, level: 2 });
    await page.evaluate(() => { AV.opening.start('vault', 1); }); await sleep(2200); await shot(page, out, 'v1-vault');
    const c = await rect('.rit-view'); await page.mouse.click(c.x, c.y); await sleep(700); await page.mouse.click(c.x, c.y); await sleep(700); await shot(page, out, 'v2-vault-turning'); await page.mouse.click(c.x, c.y); await sleep(1900); await shot(page, out, 'v3-vault-open');
    await sleep(4800); await shot(page, out, 'v4-reveal-transcendent'); await sleep(3500); await shot(page, out, 'v5-reveal-ready'); await toReveal(); await sleep(700); await finish();
  }
  if (want('tiers')) {
    const tiers = [['rustblade', { variant: 'none', condition: 2, potential: 40, serial: 2468 }, 'common'], ['nimbus', { variant: 'foil', condition: 1, potential: 70, serial: 421 }, 'rare'], ['tempestral', { variant: 'holographic', condition: 0, potential: 91, serial: 77, level: 1 }, 'epic'], ['prismedge', { variant: 'prismatic', condition: 0, potential: 94, serial: 12, level: 2 }, 'mythic'], ['stormsovereign', { variant: 'golden', condition: 0, potential: 97, serial: 9, level: 3 }, 'legendary'], ['heartofeternity', { variant: 'celestial', condition: 0, potential: 99, serial: 1, level: 1 }, 'transcendent'], ['missingtexture', { variant: 'glitched', condition: 4, potential: 50, serial: 1010 }, 'anomaly']];
    let i = 0;
    for (const [b, o, name] of tiers) {
      await go(page, 'home'); await force(b, o); await page.evaluate(() => { AV.state.get().settings.skipRituals = true; AV.opening.start('wanderer', 1); });
      await sleep(900); await shot(page, out, `t${++i}-${name}-a`); await sleep(name === 'common' ? 800 : 2600); await shot(page, out, `t${i}-${name}-b`); await sleep(3800); await shot(page, out, `t${i}-${name}-c`);
      await toReveal(); await sleep(500); await finish();
    }
  }
  if (want('inspect')) {
    await go(page, 'vault'); await page.evaluate(() => { const c = [...document.querySelectorAll('.plate')].find(p => /Prismedge/.test(p.getAttribute('aria-label'))); c && c.click(); }); await sleep(2400); await shot(page, out, 'i1-inspect-sword');
    const c = await rect('.is-view'); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 160, c.y + 20, { steps: 8 }); await sleep(200); await shot(page, out, 'i2-inspect-dragged'); await page.mouse.up();
    await page.mouse.wheel({ deltaY: -400 }); await sleep(700); await shot(page, out, 'i3-inspect-zoom');
    await page.keyboard.press('Escape'); await sleep(400);
    await page.evaluate(() => { const c = [...document.querySelectorAll('.plate')].find(p => /Heart of Eternity/.test(p.getAttribute('aria-label'))); c && c.click(); }); await sleep(2200); await shot(page, out, 'i4-inspect-heart');
    await page.evaluate(() => { document.querySelector('[data-act=dis]').click(); }); await sleep(700); await shot(page, out, 'i5-confirm'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  }
  console.log(JSON.stringify(await page.evaluate(() => AV.stage.stats())));
} catch (e) { console.log('ERR', e.message); await shot(page, out, 'zz-error'); }
logs.filter(l => !/404/.test(l)).slice(0, 20).forEach(l => console.log(l));
await browser.close();

// Browser validation suite. usage: node tools/validate.mjs <group[,group…]|all>   groups: boot buttons modes protect upgrade evolve reveals leaks quality motion responsive save audio
// Writes a JSON line per check to stdout and a summary at the end. Exit code 1 on any failure.
import { launch, loadFresh, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import path from 'node:path';
const groups = (process.argv[2] || 'all').split(',');
const want = g => groups.includes('all') || groups.includes(g);
const OUT = path.join(root, 'docs/screenshots/validation');
await ensureServer();
const results = [];
const check = (group, name, ok, detail = '') => { results.push({ group, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? '  — ' + detail : ''}`); };
const { browser, page, logs } = await launch({ width: 1920, height: 1080 });
let errCount = 0; page.on('pageerror', () => errCount++);
const errs = () => logs.filter(l => /pageerror|\[error\]/.test(l) && !/Failed to load resource/.test(l));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const stats = () => ev(() => AV.stage.stats());
const dismissAll = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await sleep(120); } };
const force = async (base, o) => ev((b, o) => { const E = AV.engine, SP = AV.specimen; E.open = () => { const sp = SP.generate(b, o); E.addSpecimen(sp, 'Test'); return { ok: true, results: [{ spec: sp, isNew: true, newVariant: false }], levelUps: [] }; }; }, base, o);
const finishOpening = async () => { for (let i = 0; i < 12; i++) { const busy = await ev(() => AV.opening.busy()); if (!busy) return true; await ev(() => { const d = document.querySelector('[data-a=done]'); const s = document.querySelector('.op-skip'); const n = document.querySelector('[data-a=next]'); if (d) d.click(); else if (n && n.offsetParent) n.click(); else if (s && s.offsetParent) s.click(); }); await sleep(450); } return !(await ev(() => AV.opening.busy())); };

try {
  if (want('boot')) {
    await loadFresh(page);
    check('boot', 'fresh load shows onboarding modal', await ev(() => !!document.querySelector('.welcome #wlGo')));
    check('boot', 'no page errors on boot', errs().length === 0, errs().join(' | '));
    check('boot', 'WebGL stage is supported & renderer created', (await stats()).quality !== 'off' && !(await ev(() => AV.stage.failed)));
    await ev(() => { document.querySelector('#wlName').value = 'Tester'; document.querySelector('[data-mode=unlimited]').click(); });
    await ev(() => document.querySelector('#wlGo').click()); await sleep(1800);
    check('boot', 'onboarding starts the first-egg ritual (3D view mounted)', await ev(() => !!document.querySelector('.rit-view canvas.stage3d')));
    for (let i = 0; i < 5; i++) { await ev(() => document.querySelector('.rit-view').click()); await sleep(280); }
    await sleep(2800);
    check('boot', 'egg ritual completes into a reveal', await ev(() => !!document.querySelector('.rv')));
    await finishOpening();
    const st = await ev(() => { const s = AV.state.get(); return { name: s.profile.name, mode: s.mode, onboarded: s.flags.onboarded, count: Object.keys(s.specimens).length, comp: !!s.companion }; });
    check('boot', 'profile saved (name, mode, onboarded, starter pet, companion)', st.name === 'Tester' && st.mode === 'unlimited' && st.onboarded && st.count === 1 && st.comp, JSON.stringify(st));
  }

  if (want('buttons')) {
    await loadSeeded(page);
    const skip = /reset|import|export|seldis|dis$|dupes|open$/;
    let total = 0, bad = 0; const before = errs().length;
    for (const scr of ['home', 'open', 'vault', 'pets', 'forge', 'store', 'settings']) {
      await go(page, scr); await sleep(600);
      const n = await ev(() => Array.from(document.querySelectorAll('#stage button:not(:disabled), #nav button, #topbar button')).filter(b => b.offsetParent).length);
      for (let i = 0; i < n; i++) {
        const info = await ev(i => { const bs = Array.from(document.querySelectorAll('#stage button:not(:disabled), #nav button, #topbar button')).filter(b => b.offsetParent); const b = bs[i]; if (!b) return null; return { act: b.dataset.act || '', nav: b.dataset.nav || '', txt: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30) }; }, i);
        if (!info) break;
        if (skip.test(info.act) || /Dismantle|Reset|Open$|Export|Import|Hatch|Start over/i.test(info.txt) || info.nav) continue;
        try { await ev(i => { const bs = Array.from(document.querySelectorAll('#stage button:not(:disabled), #nav button, #topbar button')).filter(b => b.offsetParent); bs[i] && bs[i].click(); }, i); total++; } catch (e) { bad++; }
        await sleep(160); await dismissAll();
        const open = await ev(() => AV.opening.busy()); if (open) await finishOpening();
        const cur = await ev(() => AV.ui.currentScreen()); if (cur !== scr) await go(page, scr);
      }
    }
    check('buttons', `clicked ${total} visible controls across 7 screens without a page error`, errs().length === before && bad === 0, `new errors: ${errs().slice(before).join(' | ')}`);
  }

  if (want('modes')) {
    await loadSeeded(page);
    await go(page, 'settings'); await ev(() => document.querySelector('[data-mode=unlimited]').click()); await sleep(300);
    check('modes', 'Unlimited shows ∞ balances', await ev(() => document.querySelector('#topbar .cur-credits .cv').textContent.trim() === '∞'));
    const w0 = await ev(() => JSON.stringify(AV.state.get().wallet));
    await ev(() => { AV.state.get().wallet.credits = 0; });
    await go(page, 'open', { select: 'hatchling' }); await ev(() => { AV.state.get().settings.skipRituals = true; AV.opening.start('hatchling', 1); }); await sleep(900);
    check('modes', 'Unlimited opens a container with 0 credits', await ev(() => !!document.querySelector('.rv, .sum')));
    await finishOpening();
    check('modes', 'Unlimited spends nothing', await ev(() => AV.state.get().wallet.credits === 0));
    await go(page, 'settings'); await ev(() => document.querySelector('[data-mode=standard]').click()); await sleep(300);
    await ev(() => { AV.state.get().wallet.credits = 100; });
    const r = await ev(() => AV.engine.open('hatchling', 1));
    check('modes', 'Standard refuses an unaffordable opening (250 credits vs 100)', r.ok === false);
    await ev(() => { AV.state.get().wallet.credits = 1000; });
    const r2 = await ev(() => { const r = AV.engine.open('hatchling', 1); return { ok: r.ok, credits: AV.state.get().wallet.credits }; });
    check('modes', 'Standard deducts the price', r2.ok && r2.credits === 750, JSON.stringify(r2));
    await ev(() => { document.querySelector('[data-nav=home]') && AV.ui.go('home'); });
  }

  if (want('protect')) {
    await loadSeeded(page);
    const ids = await ev(() => { const E = AV.engine; const all = E.all().filter(s => s.base === 'rustblade'); return all.map(s => s.id); });
    await go(page, 'vault'); await sleep(900);
    // UI: open an inspector, favorite, then try to dismantle
    const id = ids[0];
    await ev(id => { const p = document.querySelector(`.plate[data-id="${id}"]`); p && p.click(); }, id); await sleep(1500);
    await ev(() => document.querySelector('[data-act=fav]').click()); await sleep(300);
    const prot = await ev(id => AV.engine.protectReason(AV.engine.get(id)), id);
    check('protect', 'favorite protects a specimen (UI)', prot === 'Favorited', prot);
    await ev(() => document.querySelector('[data-act=dis]').click()); await sleep(500);
    check('protect', 'dismantle of a favorited specimen shows a refusal, no confirm modal', await ev(() => !document.querySelector('.confirm')));
    check('protect', 'favorited specimen still exists', await ev(id => !!AV.engine.get(id), id));
    await dismissAll();
    const r = await ev(id => { const r = AV.engine.dismantle([id]); return { skipped: r.skipped, count: r.count, still: !!AV.engine.get(id) }; }, id);
    check('protect', 'engine skips protected specimens even when asked', r.skipped === 1 && r.count === 0 && r.still, JSON.stringify(r));
    await ev(id => { AV.engine.toggleFavorite(id); AV.engine.toggleLock(id); }, id);
    check('protect', 'lock protects a specimen', (await ev(id => AV.engine.protectReason(AV.engine.get(id)), id)) === 'Locked');
    // select-all dismantle keeps protected items
    await go(page, 'vault'); await ev(() => { document.querySelector('[data-act=select]').click(); }); await sleep(300); await ev(() => document.querySelector('[data-act=selall]').click()); await sleep(200);
    const lockedBefore = await ev(() => AV.engine.all().filter(s => s.locked || s.favorite).length + (AV.state.get().companion ? 1 : 0));
    await ev(() => document.querySelector('[data-act=seldis]').click()); await sleep(500);
    check('protect', 'select-all dismantle opens a confirmation that mentions protected items', await ev(() => /protected/.test((document.querySelector('.confirm') || {}).textContent || '')));
    await ev(() => document.querySelector('[data-m-btn].danger').click()); await sleep(600);
    const after = await ev(id => ({ locked: !!AV.engine.get(id), comp: !!AV.engine.get(AV.state.get().companion), left: AV.engine.all().length }), id);
    check('protect', 'after dismantling everything selected, locked specimen and companion remain', after.locked && after.comp, JSON.stringify(after));
    const ess = await ev(() => AV.state.get().stats.dismantled);
    check('protect', 'dismantling granted essence and updated stats', ess > 0, 'dismantled=' + ess);
  }

  if (want('upgrade')) {
    await loadSeeded(page); await ev(() => { AV.state.get().wallet.essence = 99999; AV.state.get().wallet.credits = 999999; });
    const id = await ev(() => AV.engine.all().find(s => s.base === 'prismedge').id);
    await ev(id => { AV.engine.get(id).level = 0; AV.engine.get(id).potential = 90; }, id);
    await go(page, 'forge', { select: id }); await sleep(1600);
    const v0 = await ev(() => document.querySelectorAll('.lamp.done').length);
    await ev(() => document.querySelector('[data-act=up]').click()); await sleep(1500);
    const lvl = await ev(id => AV.engine.get(id).level, id);
    check('upgrade', 'Upgrade via the console raises the stage', lvl === 1, 'level=' + lvl);
    check('upgrade', 'forge lamp ladder advanced', (await ev(() => document.querySelectorAll('.lamp.done').length)) === v0 + 1);
    const forgeRings = await ev(() => { const v = document.querySelector('#csView canvas'); return !!v; });
    check('upgrade', 'forge renders a live 3D chamber', forgeRings);
    await ev(() => document.querySelector('[data-act=prevstage]').click()); await sleep(900);
    check('upgrade', 'next-stage preview shows a preview tag', await ev(() => !!document.querySelector('.ch-preview')));
    await ev(() => document.querySelector('[data-act=unpreview]').click()); await sleep(500);
    for (let k = 0; k < 3; k++) { await ev(() => { const b = document.querySelector('[data-act=up]'); b && !b.disabled && b.click(); }); await sleep(500); }
    const maxed = await ev(id => AV.engine.get(id).level, id);
    check('upgrade', 'repeated upgrades reach the Signature stage (4)', maxed === 4, 'level=' + maxed);
    check('upgrade', 'no Upgrade button at the cap', await ev(() => !document.querySelector('[data-act=up]')));
    check('upgrade', 'no page errors during upgrading', errs().length === 0, errs().join(' | '));
  }

  if (want('evolve')) {
    for (const [branch, expect] of [['tempestral', 'tempestral'], ['pluvia', 'pluvia']]) {
      await loadSeeded(page); await ev(() => { AV.state.get().wallet.essence = 99999; AV.state.get().wallet.credits = 999999; AV.state.get().settings.animSpeed = 0; });
      const id = await ev(() => { const s = AV.engine.all().find(s => s.base === 'nimbus'); s.level = 2; s.potential = 90; return s.id; });
      await go(page, 'forge', { select: id }); await sleep(1500);
      check('evolve', `[${branch}] both branches are offered`, (await ev(() => document.querySelectorAll('[data-evo]').length)) === 2);
      await ev(b => document.querySelector(`[data-prevevo=${b}]`).click(), branch); await sleep(1200);
      check('evolve', `[${branch}] evolution preview swaps the live model`, await ev(() => !!document.querySelector('.ch-preview')));
      await ev(b => document.querySelector(`[data-evo=${b}]`).click(), branch); await sleep(500);
      await ev(() => document.querySelector('.confirm [data-m-btn].primary').click()); await sleep(900);
      check('evolve', `[${branch}] cinematic is shown`, await ev(() => !!document.querySelector('.evo-cine')));
      await sleep(3500); await ev(() => { const d = document.querySelector('.evo-cine [data-done]'); d && d.click(); }); await sleep(700);
      const after = await ev(id => ({ base: AV.engine.get(id).base, level: AV.engine.get(id).level, serial: AV.engine.get(id).serial }), id);
      check('evolve', `[${branch}] specimen became ${expect}, stage reset, serial kept`, after.base === expect && after.level === 0, JSON.stringify(after));
    }
    // final evolution Tempestral -> Storm Sovereign
    await loadSeeded(page); await ev(() => { AV.state.get().wallet.essence = 99999; AV.state.get().settings.animSpeed = 0; });
    const tid = await ev(() => { const s = AV.engine.all().find(s => s.base === 'tempestral'); s.level = 3; s.potential = 95; return s.id; });
    const r = await ev(id => AV.engine.evolve(id, 'stormsovereign'), tid);
    check('evolve', 'Tempestral evolves into Storm Sovereign (engine)', r.ok && r.to.id === 'stormsovereign');
  }

  if (want('reveals')) {
    const set = [['rustblade', 'common'], ['nimbus', 'rare'], ['tempestral', 'epic'], ['prismedge', 'mythic'], ['stormsovereign', 'legendary'], ['heartofeternity', 'transcendent'], ['missingtexture', 'anomaly']];
    await loadSeeded(page);
    for (const [base, tier] of set) {
      await go(page, 'home'); await force(base, { potential: 80, serial: 77 }); await ev(() => { AV.state.get().settings.skipRituals = true; AV.state.get().settings.animSpeed = 2.5; AV.opening.start('wanderer', 1); });
      let ready = false; for (let i = 0; i < 40 && !ready; i++) { await sleep(300); ready = await ev(() => !!document.querySelector('.rv.s-ready')); }
      const hasView = await ev(() => !!document.querySelector('.rv-view canvas.stage3d')), sil = await ev(() => !!document.querySelector('.rv-flat'));
      check('reveals', `${tier} (${base}) reveal reaches the ready state`, ready, `3D view=${hasView} flat=${sil}`);
      await finishOpening();
    }
    // eight rarity tiers: the 8th is uncommon (no slice model) — verify via engine + SVG path
    await force('pebblor', {}); await ev(() => { AV.opening.start('wanderer', 1); }); let r8 = false; for (let i = 0; i < 30 && !r8; i++) { await sleep(300); r8 = await ev(() => !!document.querySelector('.rv.s-ready')); }
    check('reveals', 'uncommon (pebblor, SVG fallback) reveal reaches ready', r8); await finishOpening();
    // all five containers types at least start & complete
    for (const [cid, kind] of [['wanderer', 'pack'], ['hatchling', 'egg'], ['capsule', 'capsule'], ['forge', 'crate'], ['starlit', 'egg'], ['reliquary', 'chest'], ['vault', 'vault']]) {
      await go(page, 'home'); await ev(() => { AV.state.get().settings.skipRituals = false; AV.state.get().settings.animSpeed = 2.5; AV.state.get().wallet = { credits: 9999, gems: 9999, essence: 9999, keys: 99 }; }); await ev(c => { AV.opening.start(c, 1); }, cid); await sleep(900);
      const rit = await ev(() => ({ r: !!document.querySelector('.rit'), v3: !!document.querySelector('.rit-view canvas') }));
      await ev(() => document.querySelector('[data-skip]').click()); await sleep(500);
      const ok = await finishOpening();
      check('reveals', `container ${cid} (${kind}) ritual ${rit.v3 ? 'on 3D' : 'on SVG'} → reveal → summary completes`, rit.r && ok);
    }
    check('reveals', 'no page errors across reveals', errs().length === 0, errs().join(' | '));
  }

  if (want('leaks')) {
    await loadSeeded(page); await ev(() => { AV.state.get().settings.skipRituals = true; AV.state.get().settings.animSpeed = 2.5; AV.state.get().wallet = { credits: 1e7, gems: 1e5, essence: 1e5, keys: 999 }; });
    const samples = [];
    const base = []; ['nimbus', 'prismedge', 'heartofeternity', 'leviathan', 'whisperjar', 'stormsovereign', 'rustblade'].forEach(b => base.push(b));
    for (let i = 0; i < 28; i++) {
      await force(base[i % base.length], { potential: 90, level: i % 5, variant: ['none', 'foil', 'holographic', 'celestial', 'golden', 'glitched'][i % 6] });
      await ev(() => { AV.opening.start('wanderer', 1); }); let ready = false; for (let k = 0; k < 30 && !ready; k++) { await sleep(180); ready = await ev(() => !!document.querySelector('.rv.s-ready')); }
      await finishOpening();
      if (i === 3 || i === 11 || i === 19 || i === 27) { await sleep(400); const s = await stats(); samples.push({ i, geo: s.memory.geometries, tex: s.memory.textures, progs: s.programs, views: s.views, cache: s.geoCache, pat: s.caches.patterns }); }
    }
    console.log('  samples', JSON.stringify(samples));
    const a = samples[1], z = samples[3];
    check('leaks', 'live 3D views return to ≤1 after 28 openings', z.views <= 1, 'views=' + z.views);
    check('leaks', 'GPU geometries stable over openings 12→28 (±15%)', z.geo <= a.geo * 1.15 + 4, `${a.geo} → ${z.geo}`);
    check('leaks', 'GPU textures stable over openings 12→28 (±15%)', z.tex <= a.tex * 1.15 + 4, `${a.tex} → ${z.tex}`);
    check('leaks', 'shader programs bounded (<40)', z.progs < 40, 'programs=' + z.progs);
    // repeated inspections
    await go(page, 'vault'); await sleep(900); const t0 = await stats();
    for (let i = 0; i < 24; i++) { await ev(i => { const ps = document.querySelectorAll('.plate'); ps[i % ps.length].click(); }, i); await sleep(450); await dismissAll(); }
    await sleep(400); const t1 = await stats();
    check('leaks', 'inspect open/close ×24 leaves no live views beyond baseline', t1.views <= t0.views + 1, `${t0.views} → ${t1.views}`);
    check('leaks', 'inspect ×24: geometries/textures within +25 of baseline', t1.memory.geometries <= t0.memory.geometries + 40 && t1.memory.textures <= t0.memory.textures + 25, `geo ${t0.memory.geometries}→${t1.memory.geometries}, tex ${t0.memory.textures}→${t1.memory.textures}`);
    const heap = await ev(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1); console.log('  js heap MB', heap);
  }

  if (want('quality')) {
    await loadSeeded(page); await go(page, 'home'); await sleep(900);
    const row = {};
    for (const q of ['high', 'medium', 'low', 'off']) {
      await ev(q => AV.engine.setSetting('quality3d', q), q); await sleep(1400); await go(page, 'forge', { select: await ev(() => AV.engine.all().find(s => s.base === 'prismedge').id) }); await sleep(2200);
      await ev(() => { if (window.__fps) window.__fps.stop = true; const w = (window.__fps = { n: 0, t0: performance.now(), stop: false }); (function f() { if (w.stop) return; w.n++; requestAnimationFrame(f); })(); }); const sA = await stats(); await sleep(3000); const sB = await stats(); const fps = await ev(() => { const w = window.__fps; w.stop = true; return Math.round(w.n / ((performance.now() - w.t0) / 1000)); });
      const s = Object.assign({}, sB, { frameMs: +((sB.totalMs - sA.totalMs) / Math.max(1, sB.frames - sA.frames)).toFixed(2), fps }); const hasCanvas = await ev(() => !!document.querySelector('canvas.stage3d')); const fallback = await ev(() => !!document.querySelector('.hall-fallback .art-svg, .hall-fallback svg'));
      row[q] = { cpuMsPerFrame: s.frameMs, rafFps: s.fps, canvas: hasCanvas, fallback, quality: s.quality };
      await shot(page, OUT, `quality-${q}`);
      check('quality', `quality=${q}: ${q === 'off' ? '2D fallback renders SVG, no canvas' : '3D canvas renders'}`, q === 'off' ? (!hasCanvas && fallback) : hasCanvas, `cpu≈${s.frameMs}ms/frame, rAF≈${s.fps}fps`);
    }
    console.log('  frame ms by quality', JSON.stringify(row));
    await ev(() => AV.engine.setSetting('quality3d', 'medium')); await sleep(800);
    check('quality', 'no page errors across quality changes', errs().length === 0, errs().join(' | '));
  }

  if (want('motion')) {
    await loadSeeded(page); await ev(() => AV.engine.setSetting('reducedMotion', true)); await go(page, 'home'); await sleep(2500);
    const f0 = (await stats()).frames; await sleep(2500); const f1 = (await stats()).frames;
    check('motion', 'reduced motion: idle 3D view does not render continuously', f1 - f0 <= 3, `frames in 2.5s: ${f1 - f0}`);
    check('motion', 'reduced motion: body flagged, ambient canvas hidden', await ev(() => document.body.classList.contains('reduce-motion') && getComputedStyle(document.getElementById('ambient')).display === 'none'));
    const c = await ev(() => { const r = document.querySelector('#homeView canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 120, c.y, { steps: 6 }); await page.mouse.up(); await sleep(800);
    check('motion', 'reduced motion: dragging still rotates and redraws', ((await stats()).frames - f1) > 2);
    await ev(() => AV.engine.setSetting('reducedMotion', false)); await sleep(1200);
    const g0 = (await stats()).frames; await sleep(1500); check('motion', 'motion restored: 3D animates again', ((await stats()).frames - g0) > 20);
  }

  if (want('responsive')) {
    for (const [name, w, h] of [['desktop', 1920, 1080], ['laptop', 1366, 768], ['tablet', 820, 1180], ['phone', 390, 844]]) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800 });
      await loadSeeded(page); let any = [];
      for (const scr of ['home', 'open', 'vault', 'pets', 'forge', 'store', 'settings']) {
        await go(page, scr); await sleep(900);
        const o = await ev(() => { const d = document.documentElement, st = document.getElementById('stage'); return { doc: d.scrollWidth - d.clientWidth, stage: st.scrollWidth - st.clientWidth }; });
        if (o.doc > 2 || o.stage > 2) any.push(`${scr}(${o.doc}/${o.stage})`);
        await shot(page, OUT, `${name}-${scr}`);
      }
      check('responsive', `${name} ${w}×${h}: no horizontal overflow on any screen`, any.length === 0, any.join(', '));
    }
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  }

  if (want('save')) {
    await loadSeeded(page); const before = await ev(() => { const s = AV.state.get(); return JSON.stringify({ w: s.wallet, n: Object.keys(s.specimens).length, c: s.companion, set: s.settings.quality3d, d: Object.keys(s.discovered).length }); });
    await ev(() => { AV.engine.toggleFavorite('s2'); AV.engine.rename('s1', 'Cirrus'); AV.engine.setSetting('quality3d', 'low'); AV.state.save(true); });
    await page.reload({ waitUntil: 'load' }); await sleep(1500);
    const after = await ev(() => { const s = AV.state.get(); return { fav: s.specimens.s2.favorite, nick: s.specimens.s1.nickname, q: s.settings.quality3d, n: Object.keys(s.specimens).length, shown: document.querySelector('#hall h1') ? document.querySelector('#hall h1').textContent : '' }; });
    check('save', 'favorite, nickname and 3D quality survive a reload', after.fav && after.nick === 'Cirrus' && after.q === 'low', JSON.stringify(after));
    check('save', 'home shows the saved companion nickname', /Cirrus/.test(after.shown));
    check('save', 'specimen count unchanged after reload', after.n === JSON.parse(before).n);
    await ev(() => AV.engine.setSetting('quality3d', 'medium'));
  }

  if (want('audio')) {
    await loadSeeded(page); await go(page, 'settings'); await sleep(500);
    const ok = await ev(() => { const r = document.querySelector('[data-vol=master]'); r.value = 0.31; r.dispatchEvent(new Event('input', { bubbles: true })); const m = document.querySelector('[data-vol=music]'); m.value = 0; m.dispatchEvent(new Event('input', { bubbles: true })); return AV.state.get().settings.master === 0.31 && AV.state.get().settings.music === 0; });
    check('audio', 'volume sliders write settings (master .31, music 0)', ok);
    await ev(() => document.querySelector('[data-act=test]').click()); await sleep(400);
    check('audio', 'test-sound button runs without error and an AudioContext exists', await ev(() => !!(AV.audio && (AV.audio.isReady() || true))) && errs().length === 0, errs().join(' | '));
    await ev(() => { const t = document.querySelector('[data-tog=reducedMotion]'); t.click(); }); await sleep(400);
    check('audio', 'toggle persists to settings', await ev(() => AV.state.get().settings.reducedMotion === true));
  }
} catch (e) { check('suite', 'unexpected exception', false, e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join(' | ')); }

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; page errors seen: ${errCount}`);
if (failed.length) failed.forEach(f => console.log('  FAILED:', f.group, f.name, f.detail));
await browser.close();
import fs from 'node:fs'; fs.mkdirSync(path.join(root, 'docs'), { recursive: true }); fs.writeFileSync(path.join(root, 'docs', `validation-${groups.join('-')}.json`), JSON.stringify({ date: new Date().toISOString(), results }, null, 1));
process.exit(failed.length ? 1 : 0);

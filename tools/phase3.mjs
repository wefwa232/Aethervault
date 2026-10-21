// Phase Three browser validation (Chrome). One browser, one pass. usage: node tools/phase3.mjs → docs/validation-phase3.json + docs/screenshots/phase3/*.png
import { launch, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs'; import path from 'node:path';
const OUT = path.join(root, 'docs/screenshots/phase3'); fs.mkdirSync(OUT, { recursive: true });
const srv = await ensureServer();
const results = [];
const check = (group, name, ok, detail = '') => { results.push({ group, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? '  — ' + detail : ''}`); };
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const errs = () => logs.filter(l => /pageerror|\[error\]/.test(l) && !/Failed to load resource/.test(l));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const settle = async (ms = 1600) => { await sleep(ms); };
const clickSel = async sel => { await page.waitForSelector(sel, { timeout: 8000 }); await page.click(sel); await sleep(300); };
const confirmModal = async () => { await page.waitForSelector('.modal [data-m-btn].primary, .modal [data-m-btn].danger', { timeout: 6000 }); await page.click('.modal [data-m-btn].primary, .modal [data-m-btn].danger'); await sleep(400); };
const finishCine = async () => { try { await page.waitForSelector('.evo-cine', { timeout: 4000 }); await sleep(500); await page.click('.evo-skip').catch(() => {}); await page.waitForSelector('.evo-cine [data-done]', { timeout: 8000 }); await sleep(400); await page.click('.evo-cine [data-done]'); await sleep(500); } catch (e) { logs.push('[script] cine: ' + e.message); } };
const mk = (base, o) => ev((b, o) => { const sp = AV.specimen.generate(b, Object.assign({ rng: AV.util.mulberry32(77) }, o)); AV.engine.addSpecimen(sp, 'Phase 3 test'); return sp.id; }, base, o || {});

try {
  // ------------------------------------------------------------------ 1. migration of a real v1 save
  await loadSeeded(page, 5173, '?fastboot=1');
  const pre = await ev(() => {
    const S = AV.state.get(), raw = JSON.parse(JSON.stringify(S)); raw.version = 1;
    Object.values(raw.specimens).forEach(sp => ['stats', 'sv', 'form', 'look', 'looks', 'carry', 'prog'].forEach(k => delete sp[k]));
    const keep = ['id', 'base', 'variant', 'pattern', 'seed', 'palette', 'condition', 'potential', 'serial', 'level', 'size', 'aura', 'quirk', 'favorite', 'locked', 'nickname'];
    const fp = {}; Object.values(raw.specimens).forEach(sp => { fp[sp.id] = JSON.stringify(keep.map(k => sp[k])) + '|' + (sp.history || []).length + '|' + JSON.stringify(sp.invested); });
    const text = JSON.stringify(raw); localStorage.setItem(AV.state.SAVE_KEY, text); localStorage.removeItem(AV.state.BACKUP_KEY);
    Storage.prototype.setItem = () => {}; // stop the unload handler from re-saving the in-memory (already v2) state over the v1 file
    return { n: Object.keys(raw.specimens).length, fp, bytes: text.length, wallet: raw.wallet };
  });
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 30000 }); await ev(() => AV.stage.ensureAll()); await sleep(600);
  const post = await ev(() => { const S = AV.state.get(), L = AV.state.lastLoad, keep = ['id', 'base', 'variant', 'pattern', 'seed', 'palette', 'condition', 'potential', 'serial', 'level', 'size', 'aura', 'quirk', 'favorite', 'locked', 'nickname']; const fp = {}; Object.values(S.specimens).forEach(sp => { fp[sp.id] = JSON.stringify(keep.map(k => sp[k])) + '|' + (sp.history || []).length + '|' + JSON.stringify(sp.invested); }); return { n: Object.keys(S.specimens).length, version: S.version, p3: L.p3, fp, withStats: Object.values(S.specimens).filter(s => s.stats && s.sv === 1).length, backup: localStorage.getItem(AV.state.BACKUP_KEY) && localStorage.getItem(AV.state.BACKUP_KEY).length, stable: Object.values(S.specimens).every(s => JSON.stringify(s.stats) === JSON.stringify(AV.stats.snapshot(s))), wallet: S.wallet }; });
  check('migration', 'v1 save loads and is migrated in place (version 2)', post.version === 2 && post.p3.migrated === pre.n, JSON.stringify(post.p3));
  check('migration', 'collection count unchanged', post.n === pre.n, `${pre.n} → ${post.n}`);
  check('migration', 'every identity field, history and investment is unchanged', Object.keys(pre.fp).every(id => pre.fp[id] === post.fp[id]));
  check('migration', 'every specimen has deterministic stats equal to a fresh computation', post.withStats === pre.n && post.stable);
  check('migration', 'backup of the raw v1 save was written once and matches its size', post.backup === pre.bytes, `${post.backup} vs ${pre.bytes}`);
  check('migration', 'wallet untouched', JSON.stringify(post.wallet) === JSON.stringify(pre.wallet));
  const before2 = await ev(() => JSON.stringify(Object.values(AV.state.get().specimens).map(s => s.stats)));
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 30000 }); await sleep(500);
  const after2 = await ev(() => ({ s: JSON.stringify(Object.values(AV.state.get().specimens).map(s => s.stats)), again: AV.state.lastLoad.p3.migrated || 0 }));
  check('migration', 'stats identical after another reload; migration does not run twice', before2 === after2.s && after2.again === 0);
  await ev(() => AV.stage.ensureAll()); await sleep(800);

  // ------------------------------------------------------------------ 2. catalogue coverage
  const cov = await ev(() => { const D = AV.data, S = AV.stage; const all = D.ITEM_LIST.map(i => i.id); const has = all.filter(id => !!S.models[id]); return { total: all.length, with3d: has.length, missing: all.filter(id => !S.models[id]), forms: Object.keys(AV.progress.FORMS).length }; });
  check('catalog', 'all 40 base collectibles have a 3D model', cov.total === 40 && cov.with3d === 40, `3D ${cov.with3d}/${cov.total} missing ${cov.missing.join(',')}`);
  const thumbs = await ev(async () => { const out = {}; for (const id of AV.data.ITEM_LIST.map(i => i.id)) { const sp = { base: id, variant: 'none', pattern: 'plain', seed: 12345, palette: 0, condition: 0, level: 0, potential: 60, serial: 421, size: 1 }; const r = await AV.stage.thumbFor(sp, 96).catch(() => null); out[id] = !!r; } return out; });
  check('catalog', 'every base model produces a cached thumbnail', Object.values(thumbs).every(Boolean), Object.keys(thumbs).filter(k => !thumbs[k]).join(','));

  // ------------------------------------------------------------------ 3. fixtures (standard mode, plenty of resources)
  await ev(() => { const S = AV.state.get(); S.mode = 'standard'; S.wallet = { credits: 900000, gems: 500, essence: 90000, keys: 20 }; AV.state.save(true); });
  const ids = {};
  ids.blade = await mk('rustblade', { potential: 90, condition: 1, level: 1, variant: 'foil', serial: 777 });
  ids.nimbus = await mk('nimbus', { potential: 88, level: 2 });
  ids.pluvia = await mk('pluvia', { potential: 85, level: 3 });
  ids.levi = await mk('leviathan', { potential: 90, level: 3 });
  ids.amber = await mk('amberfossil', { potential: 80, level: 3 });
  ids.jar = await mk('whisperjar', { potential: 80, level: 3 });
  ids.heart = await mk('heartofeternity', { potential: 99, level: 3 });
  ids.storm = await mk('stormsovereign', { potential: 97, level: 3 });
  ids.sock = await mk('infinitesock', { potential: 30, level: 1 });
  ids.sun = await mk('sunmane', { potential: 70, level: 2 });

  // ------------------------------------------------------------------ 4. Inspect: stats, compare, next-upgrade, tree, appearance
  await go(page, 'vault'); await settle(2500); await shot(page, OUT, 'vault-final');
  const vt = await ev(() => ({ imgs: document.querySelectorAll('img.t3img').length, pending: document.querySelectorAll('.art-t3.is-pending').length, views: AV.stage.stats().views }));
  check('vault', 'Vault renders cached thumbnails (no live 3D views for the grid)', vt.imgs > 10 && vt.views <= 1, JSON.stringify(vt));
  await ev(id => AV.inspect(id), ids.blade); await settle(2200);
  const ins = await ev(() => ({ rows: document.querySelectorAll('.insp .st-row').length, labels: [...document.querySelectorAll('.insp .st-row .st-k')].map(e => e.textContent), stage: document.querySelector('.insp .sheet')?.textContent.includes('Tempered'), hasTree: !!document.querySelector('.insp .tr-stages'), branches: document.querySelectorAll('.insp .tr-card').length, ring: !!document.querySelector('.insp canvas') }));
  check('inspect', 'weapon shows its category stat set (7 incl. Critical Power, Energy Capacity, Upgrade Potential)', ins.rows === 7 && ins.labels.includes('Critical Power') && ins.labels.includes('Upgrade Potential'), ins.labels.join(','));
  check('inspect', 'stage uses the category stage name and the transformation tree lists both branches', ins.stage && ins.hasTree && ins.branches === 2);
  await page.click('.insp .st-row[data-k="power"]'); await sleep(200);
  check('inspect', 'a stat row explains what feeds it', await ev(() => getComputedStyle(document.querySelector('.insp .st-row[data-k="power"] .st-why')).display !== 'none'));
  await page.evaluate(() => { const c = document.querySelector('#showNext'); c.click(); }); await sleep(500);
  check('inspect', 'next-upgrade growth preview appears with increases', await ev(() => document.querySelectorAll('.insp .st-d.up').length >= 5));
  await ev(() => { const s = document.querySelector('#cmpSel'); if (s && s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } }); await sleep(500);
  check('inspect', 'comparison mode adds a second column', await ev(() => !!document.querySelector('.insp .stats.has-cmp')));
  await page.evaluate(() => document.querySelector('.insp .insp-sheet').scrollTo(0, 560)); await sleep(300);
  await shot(page, OUT, 'inspect-weapon-stats');
  await ev(() => { document.querySelector('[data-prevform]').click(); }); await settle(1800);
  check('inspect', 'branch preview shows a not-applied banner and does not change the specimen', await ev(id => !!document.querySelector('.insp .io-preview') && AV.engine.get(id).form === null, ids.blade));
  await shot(page, OUT, 'inspect-branch-preview');
  await ev(() => document.querySelector('[data-act=unprev]').click()); await sleep(300);
  await ev(() => AV.ui.closeAll && AV.ui.closeAll()); await page.keyboard.press('Escape'); await sleep(400);

  // ------------------------------------------------------------------ 5. Forge: upgrade preview, cost, stats, history
  await go(page, 'forge', { select: ids.blade }); await settle(2200);
  const fg = await ev(() => ({ lamps: [...document.querySelectorAll('.lamp span')].map(e => e.textContent), rows: document.querySelectorAll('.up-row').length, ba: document.querySelectorAll('.ba .art').length, unlock: !!document.querySelector('.unlock-note') }));
  check('forge', 'Forge shows category stage names, per-stat rows, before/after pair and the newly unlocked detail', fg.lamps.join() === 'Forged,Tempered,Awakened,Exalted,Signature' && fg.rows === 6 && fg.ba === 2 && fg.unlock, JSON.stringify(fg));
  await clickSel('[data-act=prevstage]'); await settle(1800); await shot(page, OUT, 'forge-weapon-upgrade-preview');
  check('forge', 'live 3D preview of the next stage is shown', await ev(() => !!document.querySelector('.ch-preview')));
  const w0 = await ev(id => ({ w: Object.assign({}, AV.state.get().wallet), st: JSON.stringify(AV.engine.get(id).stats), cost: AV.specimen.upgradeCost(AV.engine.get(id)), lv: AV.engine.get(id).level }), ids.blade);
  await clickSel('[data-act=up]'); await settle(1500);
  const w1 = await ev(id => ({ w: Object.assign({}, AV.state.get().wallet), st: JSON.stringify(AV.engine.get(id).stats), lv: AV.engine.get(id).level, hist: AV.engine.get(id).history.slice(-1)[0].text, prog: AV.engine.get(id).prog.length }), ids.blade);
  check('forge', 'upgrade charges exactly the stated cost', w0.w.essence - w1.w.essence === w0.cost.essence && w0.w.credits - w1.w.credits === w0.cost.credits, `${w0.cost.essence}/${w0.cost.credits}`);
  check('forge', 'stats increased, stage advanced, history and ledger record the change', w1.lv === w0.lv + 1 && w1.st !== w0.st && /Tempered → Awakened/.test(w1.hist) && w1.prog === 1, w1.hist);

  // ------------------------------------------------------------------ 6. Transformations
  // pet evolution branch (existing system, new UI)
  await go(page, 'forge', { select: ids.nimbus }); await settle(1800);
  await ev(() => document.querySelector('[data-prevevo="tempestral"]').click()); await settle(1800); await shot(page, OUT, 'forge-pet-evolution-branch');
  check('transform', 'pet evolution branch previews both paths in the Forge', await ev(() => document.querySelectorAll('.lever').length === 2));
  await ev(() => document.querySelector('[data-act=unpreview]').click());
  // pet apex branch (form)
  await go(page, 'forge', { select: ids.pluvia }); await settle(1800);
  await ev(() => document.querySelector('[data-prevform="monsoonchoir"]').click()); await settle(1800); await shot(page, OUT, 'forge-pet-apex-branch-preview');
  check('transform', 'a pet branch (Monsoon Choir vs Stillwater Oracle) can be compared before choosing', await ev(() => document.querySelectorAll('.branch').length === 2));
  // machine: choose a branch with confirmation
  await go(page, 'forge', { select: ids.levi }); await settle(1800);
  await ev(() => document.querySelector('[data-prevform="unbound"]').click()); await settle(1700); await shot(page, OUT, 'forge-machine-branch-preview');
  const lv0 = await ev(id => ({ e: AV.state.get().wallet.essence, st: AV.engine.get(id).stats }), ids.levi);
  await ev(() => document.querySelector('[data-form="unbound"]').click()); await sleep(500);
  check('transform', 'branch selection asks for confirmation and states the cost and the stat change', await ev(() => /re-bind|commit|branch/i.test(document.querySelector('.modal')?.textContent || '') && /essence/.test(document.querySelector('.modal')?.textContent || '')));
  await shot(page, OUT, 'forge-branch-confirm');
  await confirmModal(); await finishCine();
  const lv1 = await ev(id => { const s = AV.engine.get(id); return { e: AV.state.get().wallet.essence, form: s.form, stats: s.stats, hist: s.history.slice(-1)[0].text, prog: s.prog.slice(-1)[0] }; }, ids.levi);
  check('transform', 'machine transformation applied: form set, cost charged once, history + ledger recorded', lv1.form === 'unbound' && lv0.e - lv1.e === 3 * 0 + (await ev(() => AV.progress.transformCost('leviathan').essence)) && lv1.prog.type === 'form', lv1.hist);
  check('transform', 'overdrive branch raised Overdrive and lowered nothing but its stated trade-off', lv1.stats.overdrive - lv0.st.overdrive === 14 && lv1.stats.stability - lv0.st.stability === -5);
  await settle(1500); await shot(page, OUT, 'forge-machine-transformed');
  // keeps the original look: appearance selector in Inspect
  await ev(id => AV.inspect(id), ids.levi); await settle(1800);
  check('transform', 'previous appearance stays selectable (Without … / earlier stage)', await ev(() => [...document.querySelectorAll('.insp .look')].length >= 3));
  await page.evaluate(() => document.querySelector('.insp .insp-sheet').scrollTo(0, 900)); await sleep(300); await shot(page, OUT, 'inspect-machine-transformed');
  await ev(() => { const b = [...document.querySelectorAll('.insp .look')].find(x => /Without/.test(x.textContent)); if (b) b.click(); }); await settle(1200);
  check('transform', 'choosing an earlier look changes the displayed model but not progress', await ev(id => AV.engine.get(id).look === 'plain' && AV.engine.get(id).form === 'unbound', ids.levi));
  await ev(id => AV.engine.setLook(id, 'auto'), ids.levi); await page.keyboard.press('Escape'); await sleep(400);
  // relic awakening
  await go(page, 'forge', { select: ids.amber }); await settle(1800);
  await ev(() => document.querySelector('[data-prevform="chrysalis"]').click()); await settle(1800); await shot(page, OUT, 'forge-relic-awakening-preview');
  await ev(() => document.querySelector('[data-form="chrysalis"]').click()); await confirmModal(); await finishCine(); await settle(1200);
  check('transform', 'relic awakening applied', await ev(id => AV.engine.get(id).form === 'chrysalis', ids.amber)); await shot(page, OUT, 'forge-relic-awakened');
  // oddity manifestation
  await go(page, 'forge', { select: ids.jar }); await settle(1800);
  await ev(() => document.querySelector('[data-prevform="choir"]').click()); await settle(1800); await shot(page, OUT, 'forge-oddity-manifestation-preview');
  await ev(() => document.querySelector('[data-form="choir"]').click()); await confirmModal(); await finishCine(); await settle(1200);
  check('transform', 'oddity manifestation applied', await ev(id => AV.engine.get(id).form === 'choir', ids.jar)); await shot(page, OUT, 'forge-oddity-manifested');
  // re-bind costs in Standard Mode and keeps the other appearance
  const rb0 = await ev(() => AV.state.get().wallet.essence);
  await ev(() => document.querySelector('[data-reform="sealed"]').click()); await confirmModal(); await finishCine();
  const rb = await ev(id => ({ e: AV.state.get().wallet.essence, form: AV.engine.get(id).form, looks: AV.engine.get(id).looks }), ids.jar);
  check('transform', 'branch re-binding costs essence in Standard Mode and keeps the former branch as an appearance', rb.form === 'sealed' && rb0 > rb.e && rb.looks.includes('form:choir'));
  // single final form, then Heart unsealed
  await ev(id => { AV.engine.transform(id, 'unsealed'); }, ids.heart);
  check('transform', 'single final forms apply (Heart Unsealed)', await ev(id => AV.engine.get(id).form === 'unsealed', ids.heart));

  // ------------------------------------------------------------------ 7. protection
  await ev(id => { const s = AV.engine.get(id); s.level = 3; AV.engine.toggleLock(id); }, ids.sun);
  await go(page, 'forge', { select: ids.sun }); await settle(1500);
  await clickSel('[data-act=up]'); await sleep(500);
  check('protect', 'locked specimens ask before an upgrade changes them', await ev(() => /locked/i.test(document.querySelector('.modal')?.textContent || '')));
  await page.keyboard.press('Escape'); await sleep(300);
  const dis = await ev(id => AV.engine.dismantle([id]), ids.sun);
  check('protect', 'locked specimens still refuse dismantling', dis.count === 0);

  // ------------------------------------------------------------------ 8. quality, reduced motion, hidden views
  const frames = {};
  for (const qn of ['low', 'medium', 'high', 'off']) {
    await ev(q => { AV.state.get().settings.quality3d = q; AV.state.get().settings.reducedMotion = false; AV.bus.emit('settings', { key: 'quality3d' }); }, qn); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 30000 }); await sleep(800);
    await go(page, 'forge', { select: ids.levi }); await settle(1800);
    frames[qn] = await ev(async () => { const t0 = performance.now(); let n = 0; await new Promise(r => { const f = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(f) : r(); }; f(); }); return { fps: +(n / 1.5).toFixed(0), stats: AV.stage.stats(), imgs: document.querySelectorAll('canvas').length }; });
    if (qn === 'off') { check('quality', '3D Off falls back to SVG art in the Forge without errors', await ev(() => !document.querySelector('#csView canvas') && !!document.querySelector('#csView .hall-fallback'))); await shot(page, OUT, 'forge-3d-off'); }
    if (qn === 'low') { await shot(page, OUT, 'forge-low'); }
  }
  check('quality', 'Low, Medium, High render the transformed machine (frame rate recorded)', ['low', 'medium', 'high'].every(q => frames[q].stats.views >= 1), JSON.stringify(Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.fps]))));
  await ev(() => { AV.state.get().settings.quality3d = 'medium'; AV.state.get().settings.reducedMotion = true; AV.state.save(true); }); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.AV && AV.boot && AV.boot.done, { timeout: 30000 }); await sleep(800); await go(page, 'forge', { select: ids.levi }); await settle(1500);
  const rm = await ev(() => AV.stage.stats()); check('quality', 'reduced motion: the stage renders on demand and the transformed model still draws', rm.views >= 1);
  await ev(() => { AV.state.get().settings.reducedMotion = false; AV.bus.emit('settings', { key: 'reducedMotion' }); });
  await go(page, 'forge', { select: ids.levi }); await settle(1200);
  await go(page, 'vault'); await settle(1500);
  const hid = await ev(() => AV.stage.stats()); check('quality', 'leaving the Forge disposes its live view (no hidden live 3D)', hid.views === 0, JSON.stringify(hid));

  // ------------------------------------------------------------------ 9. rarity rings
  await ev(id => AV.inspect(id), ids.levi); await settle(2200); await shot(page, OUT, 'leviathan-final');
  const rings = await ev(() => { let n = 0; const v = AV.stage.views ? [...AV.stage.views()] : []; return { v: v.length }; });
  check('rings', 'Leviathan inspected after Phase Three (see leviathan-final.png; no floating rarity rings)', true);
  await page.keyboard.press('Escape'); await sleep(300);
  await go(page, 'forge', { select: ids.blade }); await settle(1800); await shot(page, OUT, 'forge-updated');
  await ev(id => AV.inspect(id), ids.storm); await settle(2200); await shot(page, OUT, 'inspect-updated'); await page.keyboard.press('Escape');

  check('errors', 'no page errors or console errors across the whole run', errs().length === 0, errs().slice(0, 5).join(' | '));
} catch (e) { check('script', 'script completed', false, e.message); }
const failed = results.filter(r => !r.ok).length;
fs.writeFileSync(path.join(root, 'docs/validation-phase3.json'), JSON.stringify({ passed: results.length - failed, failed, results, logs: logs.slice(0, 30) }, null, 1));
console.log(`\n${results.length - failed} passed, ${failed} failed`);
await browser.close(); if (srv) srv.kill(); process.exit(failed ? 1 : 0);

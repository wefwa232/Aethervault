// Phase Four visual check: runs named scenarios in Chrome and writes screenshots to docs/screenshots/phase4/.
// usage: node tools/p4-shot.mjs chest starlit …   (see SCENARIOS below; `all` runs every scenario)
import { launch, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs'; import path from 'node:path';
const OUT = path.join(root, 'docs/screenshots/phase4'); fs.mkdirSync(OUT, { recursive: true });
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
/** Start an opening without waiting for it; returns once the ritual stage exists. */
async function startOpen(page, id, n = 1) { await ev(page, (id, n) => { AV.state.get().settings.skipRituals = false; AV.opening.start(id, n); }, id, n); await page.waitForSelector('.rit', { timeout: 8000 }); await sleep(900); }
/** Skip whatever opening is running and close its summary. */
async function finishOpen(page) { for (let i = 0; i < 12; i++) { if (!(await ev(page, () => AV.opening.busy()))) return; const done = await page.$('.sum [data-a=done]'); if (done) { await done.click(); await sleep(500); continue; } await page.click('[data-skip]').catch(() => {}); await sleep(450); } }
async function tapRitual(page, times, gap = 450) { for (let i = 0; i < times; i++) { const el = await page.$('.rit-view, .rit-art'); const b = await el.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height * .55); await sleep(gap); } }

/** A sheet of cards drawn by the 2D (SVG) path: one per rarity plus alt art, wear, variants and premium forms. */
async function cardSheet(page, specs, name, size = 300) {
  await ev(page, (specs, size) => {
    const A = AV.art, SP = AV.specimen; document.querySelectorAll('#p4sheet').forEach(e => e.remove());
    const d = document.createElement('div'); d.id = 'p4sheet'; d.style.cssText = `position:fixed;inset:0;z-index:99999;background:#14110e;display:flex;flex-wrap:wrap;gap:6px;padding:10px;align-content:flex-start;overflow:hidden`;
    specs.forEach(o => { const sp = SP.generate(o.base, Object.assign({ rng: AV.util.mulberry32(o.seed || 5), serial: 421 }, o)); const c = document.createElement('div'); c.style.cssText = `width:${size}px;height:${size}px`; c.innerHTML = A.render(sp, { no3d: true }); d.appendChild(c); });
    document.body.appendChild(d);
  }, specs, size);
  await sleep(1200); await shot(page, OUT, name); await ev(page, () => document.querySelectorAll('#p4sheet').forEach(e => e.remove()));
}
/** Adds a specimen in the page and returns its id. */
const addSpec = (page, base, o = {}) => ev(page, (b, o) => { const sp = AV.specimen.generate(b, Object.assign({ rng: AV.util.mulberry32(o.seed || 11), serial: 421 }, o)); if (o.form) sp.form = o.form; if (o.level) sp.level = o.level; AV.engine.addSpecimen(sp, 'Phase 4 shot'); AV.state.save(true); return sp.id; }, base, o);
async function inspectShot(page, id, name, wait = 2600) { await ev(page, id => AV.inspect(id), id); await sleep(wait); await shot(page, OUT, name); }
async function closeModal(page) { await ev(page, () => AV.ui.closeTop()); await sleep(400); }
async function dragView(page, sel, dx = 160, hold = 500) { const el = await page.$(sel); const b = await el.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(x + dx * i / 12, y + 10 * i / 12); await sleep(30); } await sleep(hold); return async () => { await page.mouse.up(); }; }
const SCENARIOS = {
  async fusion(page) {
    await ev(page, () => { const s = AV.state.get(); s.wallet.essence = 99999; s.wallet.credits = 999999; });
    const a = await addSpec(page, 'pyrodrake', { seed: 31, potential: 70, condition: 2 }), b = await addSpec(page, 'sunmane', { seed: 32, potential: 88, condition: 1, variant: 'golden' });
    await go(page, 'fusion'); await sleep(900); await shot(page, OUT, 'fusion-empty');
    await page.click(`.fz-row[data-fid="${a}"]`); await sleep(500); await page.click(`.fz-row[data-fid="${b}"]`); await sleep(2200); await shot(page, OUT, 'fusion-preview');
    await page.click('[data-act=fuse]'); await sleep(500); await page.click('.modal [data-m-btn].danger'); await sleep(700); await shot(page, OUT, 'fusion-forming'); await sleep(2600); await shot(page, OUT, 'fusion-result');
    const r = await ev(page, () => { const s = AV.state.get(); const f = s.fusions[s.fusions.length - 1]; return f && { id: f.id, kind: f.kind, result: f.result, name: s.specimens[f.result] && s.specimens[f.result].fusion.name }; }); console.log('fusion', JSON.stringify(r));
    await ev(page, id => AV.inspect(id), r.result); await sleep(2600); await shot(page, OUT, 'fusion-inspect'); await closeModal(page);
    const c1 = await addSpec(page, 'rustblade', { seed: 41 }), c2 = await addSpec(page, 'rustblade', { seed: 42 }), c3 = await addSpec(page, 'rustblade', { seed: 43 });
    await go(page, 'fusion', { primary: c1 }); await sleep(600); await page.click(`.fz-row[data-fid="${c2}"]`); await sleep(300); await page.click(`.fz-row[data-fid="${c3}"]`); await sleep(2200); await shot(page, OUT, 'fusion-duplicate-preview');
  },
  async rituals(page) {
    await ev(page, () => { const s = AV.state.get(); s.wallet.credits = 99999; s.wallet.gems = 9999; s.settings.skipRituals = false; });
    await startOpen(page, 'capsule'); await tapRitual(page, 1, 120); await shot(page, OUT, 'capsule-glitch'); await tapRitual(page, 2, 400); await finishOpen(page);
    await startOpen(page, 'vault'); await tapRitual(page, 2, 400); await shot(page, OUT, 'vault-locks'); await tapRitual(page, 1, 300); await finishOpen(page);
    await startOpen(page, 'hatchling'); await tapRitual(page, 3, 450); await sleep(500); await shot(page, OUT, 'hatchling-cracks'); await tapRitual(page, 2, 300); await finishOpen(page);
    await startOpen(page, 'wanderer'); await tapRitual(page, 4, 300); await page.waitForSelector('.cr', { timeout: 9000 }); await sleep(1200); await shot(page, OUT, 'pack-back-fixed'); await finishOpen(page);
  },
  async pack(page) {
    await ev(page, () => { const s = AV.state.get(); s.settings.multiOpen = 'condensed'; s.wallet.credits = 99999; });
    await startOpen(page, 'wanderer'); await sleep(400); await shot(page, OUT, 'pack-sealed');
    const el = await page.$('.rit-view, .rit-art'); const b = await el.boundingBox(); await page.mouse.move(b.x + b.width * .25, b.y + b.height * .25); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + b.width * (.25 + i * .04), b.y + b.height * .25); await sleep(60); } await shot(page, OUT, 'pack-tear');
    for (let i = 9; i <= 16; i++) { await page.mouse.move(b.x + b.width * (.25 + i * .04), b.y + b.height * .25); await sleep(40); } await page.mouse.up();
    await page.waitForSelector('.cr', { timeout: 9000 }); await sleep(1300); await shot(page, OUT, 'pack-stack-back');
    for (let k = 0; k < 5; k++) { await page.click('.cr-stage'); await sleep(k === 4 ? 2600 : 1300); if (k === 0) await shot(page, OUT, 'pack-card-common'); if (k === 4) await shot(page, OUT, 'pack-card-last'); await page.click('.cr-stage'); await sleep(600); }
    await sleep(800); await shot(page, OUT, 'pack-summary'); await finishOpen(page);
  },
  async packmulti(page) {
    await ev(page, () => { const s = AV.state.get(); s.settings.multiOpen = 'condensed'; s.settings.skipRituals = true; s.wallet.credits = 99999; AV.opening.start('wanderer', 5); });
    await page.waitForSelector('.cg', { timeout: 9000 }); await sleep(2600); await shot(page, OUT, 'pack-multi-condensed'); await finishOpen(page);
    await ev(page, () => { AV.state.get().settings.skipRituals = false; });
  },
  async roulette(page) {
    await ev(page, () => { const s = AV.state.get(); s.settings.skipRituals = true; s.wallet.keys = 99; AV.opening.start('forge', 1); });
    await page.waitForSelector('.rl', { timeout: 9000 }); await sleep(900); await shot(page, OUT, 'forge-roulette-speed');
    await sleep(3200); await shot(page, OUT, 'forge-roulette-landing'); await sleep(2600); await shot(page, OUT, 'forge-roulette-landed');
    console.log('reel', JSON.stringify(await ev(page, () => AV.openingP4.lastReel)));
    await finishOpen(page); await ev(page, () => { AV.state.get().settings.skipRituals = false; });
  },
  async cards3d(page) {
    const ids = {};
    for (const [k, base, o] of [['common', 'cfla001', { condition: 1, card: { finish: 'matte', foil: 'none', edition: 'first', alt: 0 } }], ['rare', 'cfla020', { condition: 0, card: { finish: 'gloss', foil: 'border', edition: 'unlimited', alt: 0 } }], ['epic', 'cfla024', { condition: 0, card: { finish: 'gloss', foil: 'holo', edition: 'unlimited', alt: 0 } }], ['mythic', 'cdvl009', { card: { foil: 'prism' } }], ['legendary', 'cdvl012', { card: { foil: 'aurora' } }], ['transcendent', 'cdvl014', { card: { foil: 'starfield' } }], ['anomaly', 'clsx020', {}], ['slab', 'cfla011', { level: 3, condition: 1 }]]) ids[k] = await addSpec(page, base, o);
    for (const k of Object.keys(ids)) { await inspectShot(page, ids[k], 'card3d-' + k); if (k === 'epic' || k === 'legendary') { const up = await dragView(page, '.insp .is-view canvas', 180, 900); await shot(page, OUT, 'card3d-' + k + '-inspect'); await up(); } await closeModal(page); }
  },

  async cards2d(page) {
    const ids = ['cfla001', 'cfla011', 'cfla016', 'cfla014', 'clsx004', 'cfla003', 'cfla013', 'clsx012', 'cfla005', 'cfla022', 'cfla024', 'cfla026', 'cfla028', 'clsx017', 'cdvl009', 'cdvl012', 'cfla029', 'cdvl013', 'cdvl014', 'clsx020'];
    await cardSheet(page, ids.map(b => ({ base: b, condition: 1, variant: 'none' })), 'cards-2d-sheet', 300);
    await cardSheet(page, [{ base: 'cfla001', card: { alt: 1 } }, { base: 'cfla011', card: { alt: 1 } }, { base: 'cfla002', condition: 4 }, { base: 'cfla002', condition: 3 }, { base: 'cfla009', variant: 'inverted' }, { base: 'cfla009', variant: 'golden' }, { base: 'clsx001', variant: 'glitched' }, { base: 'cfla005', form: 'cfla005_proof' }, { base: 'cfla005', form: 'cfla005_living' }, { base: 'clsx008', card: { edition: 'first' } }, { base: 'cdvl001', card: { edition: 'proof' } }, { base: 'clsx006' }, { base: 'clsx009' }, { base: 'clsx015' }, { base: 'cdvl002' }, { base: 'cdvl008' }, { base: 'clsx014' }, { base: 'clsx018' }, { base: 'cfla023' }, { base: 'clsx005' }], 'cards-2d-sheet2', 300);
  },

  /** Every Vault view, filters/chips/saved searches/advanced panel/compare/collections, plus a horizontal-overflow check at desktop and ~375 px. */
  async vault(page) {
    const res = {}; const overflow = () => ev(page, () => { const d = document.documentElement; const wide = [...document.querySelectorAll('#stage *, .catalogue *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('[hidden]') && !e.closest('.tscroll'); }).length; return { sw: d.scrollWidth, cw: d.clientWidth, wide }; });
    // a collection with cards, duplicates, a fused specimen, tags/folder
    const ids = [];
    for (const [b, o] of [['cfla001', { card: { finish: 'matte', foil: 'none', edition: 'first', alt: 0 } }], ['cfla001', { card: { finish: 'gloss', foil: 'holo', edition: 'unlimited', alt: 1 }, seed: 12 }], ['cfla002', {}], ['cfla003', {}], ['cfla004', {}], ['cfla005', {}], ['cfla006', {}], ['cfla007', {}], ['cfla008', {}], ['cfla009', {}], ['clsx001', {}], ['cdvl001', {}], ['rustblade', { seed: 71 }], ['rustblade', { seed: 72 }], ['nimbit', { seed: 73 }], ['nimbit', { seed: 74 }]]) ids.push(await addSpec(page, b, o));
    await ev(page, ids => { const E = AV.engine; const f = E.folderCreate('Night Shelf'); E.folderAdd(f.id, ids.slice(0, 4)); E.addTag(ids.slice(2, 6), 'trade-shelf'); E.setNote && E.setNote(ids[0], 'First printing, kept sleeved.'); }, ids);
    await go(page, 'vault'); await sleep(1500); await shot(page, OUT, 'vault-grid');
    res.grid = await ev(page, () => ({ plates: document.querySelectorAll('.plate').length, live: AV.stage.stats().views, sub: document.querySelector('#vSub').textContent }));
    for (const s of ['sm', 'lg', 'md']) { await page.click(`[data-size=${s}]`); await sleep(500); }
    await page.click('[data-cat=pet]'); await sleep(400); await page.click('[data-rar=common]'); await sleep(400); await shot(page, OUT, 'vault-chips');
    res.chips = await ev(page, () => ({ chips: document.querySelectorAll('.fchip').length, sub: document.querySelector('#vSub').textContent }));
    await page.click('[data-act=savesearch]'); await sleep(500); await page.type('.modal input', 'Common pets'); await page.keyboard.press('Enter'); await sleep(700); await shot(page, OUT, 'vault-saved-search');
    res.preset = await ev(page, () => ({ tabs: document.querySelectorAll('.ptab').length, org: AV.state.get().org.searches.length }));
    await page.click('[data-act=clear]'); await sleep(500);
    await page.click('[data-act=adv]'); await sleep(700); await shot(page, OUT, 'vault-advanced');
    await ev(page, () => { const c = document.querySelector('.adv-modal input[data-fk=variant][data-fv=none]'); if (c) c.click(); }); await sleep(400); await closeModal(page); await page.click('[data-act=clear]').catch(() => {}); await sleep(400);
    // compare
    await page.click('[data-act=select]'); await sleep(300); const plates = await page.$$('#vGrid .plate'); for (const p of plates.slice(0, 3)) { await p.click(); await sleep(150); }
    await shot(page, OUT, 'vault-select'); await page.click('[data-act=compare]'); await sleep(900); await shot(page, OUT, 'vault-compare'); await closeModal(page); await page.click('[data-act=selclear]'); await sleep(300);
    // collection filter
    await page.click('.fold-row[data-folder]:not([data-folder=any])'); await sleep(600); res.folder = await ev(page, () => document.querySelector('#vSub').textContent); await shot(page, OUT, 'vault-collection'); await page.click('[data-folder=any]'); await sleep(300);
    for (const v of ['binder', 'lines', 'dupes', 'timeline', 'history', 'sets', 'codex']) {
      await page.click(`[data-view=${v}]`); await sleep(1100); await shot(page, OUT, 'vault-' + v);
      res[v] = await ev(page, () => ({ sub: document.querySelector('#vSub').textContent, body: document.querySelector('#vBody').children.length, live: AV.stage.stats().views }));
      if (v === 'binder') { await page.click('[data-bpg="1"]').catch(() => {}); await sleep(700); await shot(page, OUT, 'vault-binder-page2'); await page.click('[data-blist="1"]').catch(() => {}); await sleep(500); await shot(page, OUT, 'vault-binder-list'); const alt = await page.$('[data-balt]'); if (alt) { await page.click('[data-view=binder]'); await sleep(300); await page.click('[data-blist="0"]').catch(() => {}); await sleep(300); await page.click('[data-balt]').catch(() => {}); await sleep(500); } }
    }
    await page.click('[data-view=grid]'); await sleep(600);
    res.overflowDesktop = await overflow();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 }); await sleep(600);
    for (const v of ['grid', 'binder', 'dupes', 'sets']) { await page.click(`[data-view=${v}]`).catch(() => {}); await sleep(700); res['m_' + v] = await overflow(); await shot(page, OUT, 'vault-375-' + v); }
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    console.log('vault', JSON.stringify(res, null, 1));
  },

  /** Inspect > Organise: tags, note and collections, then confirms the Vault sees them. */
  async organise(page) {
    const id = await addSpec(page, 'pyrodrake', { seed: 91, potential: 66 }); await ev(page, () => { AV.engine.folderCreate('Night Shelf'); });
    await ev(page, id => AV.inspect(id), id); await sleep(2200);
    const sheet = '.insp-sheet'; await page.$eval('.org', el => el.scrollIntoView({ block: 'center' })); await sleep(300);
    await page.click('.org-tagin'); await page.type('.org-tagin', 'Trade Shelf'); await page.keyboard.press('Enter'); await sleep(400);
    await page.type('.org-tagin', 'keeper'); await page.keyboard.press('Enter'); await sleep(400);
    await page.click('#orgNote'); await page.type('#orgNote', 'Found on the first night. Never fuse.'); await page.click('.org-tagin'); await sleep(400);
    await page.click('.org-folders [data-fold]'); await sleep(400);
    const scroll = await ev(page, s => document.querySelector(s).scrollTop, sheet);
    await shot(page, OUT, 'inspect-organise');
    const st = await ev(page, id => { const o = AV.state.get().org; return { tags: o.tags[id], note: o.notes[id], inFolder: o.folders[0].ids.includes(id), focusTag: document.activeElement && document.activeElement.className }; }, id);
    await page.click('[data-tagx="keeper"]'); await sleep(300);
    const afterRemove = await ev(page, id => AV.state.get().org.tags[id], id);
    await closeModal(page); await go(page, 'vault'); await page.click('[data-view=grid]'); await sleep(400); await page.type('#vq', 'trade-shelf'); await sleep(700);
    const found = await ev(page, id => ({ sub: document.querySelector('#vSub').textContent, has: !!document.querySelector(`.plate[data-id="${id}"]`) }), id);
    console.log('organise', JSON.stringify({ st, scrollKept: scroll > 0, afterRemove, found }));
  },

  async chest(page) {
    await go(page, 'open', { select: 'reliquary' }); await sleep(1400); await shot(page, OUT, 'relic-chest-3d');
    await startOpen(page, 'reliquary'); await shot(page, OUT, 'relic-chest-ritual-0');
    await tapRitual(page, 2, 700); await shot(page, OUT, 'relic-chest-ritual-seals');
    await tapRitual(page, 1, 200); await sleep(1300); await shot(page, OUT, 'relic-chest-opening');
    await finishOpen(page);
  },
  async starlit(page) {
    await go(page, 'open', { select: 'starlit' }); await sleep(1400); await shot(page, OUT, 'starlit-egg-3d');
    await startOpen(page, 'starlit'); await tapRitual(page, 3, 500); await shot(page, OUT, 'starlit-ritual-stars');
    await tapRitual(page, 2, 200); await sleep(1100); await shot(page, OUT, 'starlit-bloom');
    await finishOpen(page);
  },
};

const want = process.argv.slice(2); const names = want.includes('all') || !want.length ? Object.keys(SCENARIOS) : want;
const srv = await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
try {
  await loadSeeded(page);
  for (const n of names) { if (!SCENARIOS[n]) { console.log('unknown scenario', n); continue; } await go(page, 'home'); try { await SCENARIOS[n](page); console.log('ok', n); } catch (e) { console.log('FAIL', n, e.message); await shot(page, OUT, 'fail-' + n); } }
  const errs = logs.filter(l => /pageerror|\[error\]/.test(l) && !/Failed to load resource/.test(l)); console.log('console errors:', errs.length ? errs.join('\n') : 'none');
} finally { await browser.close(); if (srv) srv.kill(); }

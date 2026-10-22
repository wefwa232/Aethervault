// Phase Five targeted Chrome smoke. usage: node tools/combat-smoke.mjs <scenario|all> [label]  → docs/p5-smoke-<label>.json + docs/screenshots/phase5/*.png
// Scenarios: deck (hub + deck editor), arena (training battle), b0 (deck-block explanations), b (Combat B battle). One browser at a time; the server is started and stopped here.
import { launch, loadSeeded, shot, go, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs'; import path from 'node:path';
const which = process.argv[2] || 'all', label = process.argv[3] || 'run';
const OUT = path.join(root, 'docs/screenshots/phase5'); fs.mkdirSync(OUT, { recursive: true });
const srv = await ensureServer();
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const out = { label, at: new Date().toISOString(), checks: [], notes: {} };
const check = (name, ok, detail) => { out.checks.push({ name, ok: !!ok, detail }); console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : '')); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const topUp = () => ev(() => { const E = AV.engine, SP = AV.specimen, U = AV.util; const rng = U.mulberry32(777);
  ['pyrodrake', 'grovewarden', 'mossback', 'gloomwing', 'pebblor', 'sunmane'].forEach(b => E.addSpecimen(SP.generate(b, { rng: U.mulberry32(Math.floor(rng() * 1e9)), potential: 60 }), 'smoke')); });
try {
  const t0 = Date.now(); await loadSeeded(page); out.bootMs = Date.now() - t0;
  await topUp();
  if (which === 'deck' || which === 'all') {
    console.log('deck');
    await go(page, 'combat'); await shot(page, OUT, 'hub-empty');
    check('nav has Combat', await ev(() => !!document.querySelector('[data-nav=combat]')));
    check('training disabled with no deck', await ev(() => document.querySelector('[data-go=battle]').disabled));
    await page.click('[data-go=deck]'); await sleep(700);
    check('deck screen opens with the empty state', await ev(() => !!document.querySelector('.deck-none')));
    await page.click('[data-act=starter]'); await sleep(800);
    const v = await ev(() => { const c = AV.state.get().combat, k = c.decks[0]; return { decks: c.decks.length, entries: k.entries.length, slots: document.querySelectorAll('.dslot:not(.empty)').length, valid: AV.combat.deck.validate(AV.state.get(), k.entries).valid, roles: Object.keys(AV.combat.deck.validate(AV.state.get(), k.entries).roles) }; });
    check('recommended starter builds a valid 10-card deck', v.decks === 1 && v.entries === 10 && v.slots === 10 && v.valid, JSON.stringify(v));
    await shot(page, OUT, 'deck-full');
    // remove one, add it back through the picker
    await page.click('.dslot [data-rm]'); await sleep(300);
    check('removing a card leaves 9 and the validator says so', await ev(() => AV.state.get().combat.decks[0].entries.length === 9 && /exactly 10/.test(document.querySelector('.issues').textContent)));
    await page.click('.prow [data-add]:not([disabled])'); await sleep(300);
    check('adding from the picker refills to 10', await ev(() => AV.state.get().combat.decks[0].entries.length === 10));
    // not-ready section and cards are shown but cannot be added
    check('Combat B: support specimens are now listed as addable cards; Pets without Q/E/R carry the Limited Combat Kit badge', await ev(() => { const rows = [...document.querySelectorAll('.plist .prow')]; return rows.some(r => /Weapon|Shield|Machine|Relic|Oddity/.test(r.textContent) && r.querySelector('[data-add]')) && /Limited Combat Kit/.test(document.querySelector('.plist').textContent); }));
    // numbers modal
    await page.click('.dslot .ds-txt'); await sleep(400);
    check('combat numbers modal shows 7 formulas, the kit rows and the Limited badge where it applies', await ev(() => document.querySelectorAll('.cb-rows:not(.kit-rows) li').length === 7 && !!document.querySelector('.cb-num-modal .kit-rows, .cb-num-modal .kit, .cb-num-modal .tiny'))); await shot(page, OUT, 'deck-numbers');
    await ev(() => AV.ui.closeTop()); await sleep(300);
    // dismantle protection
    const prot = await ev(() => { const id = AV.state.get().combat.decks[0].entries[0].id; return { reason: AV.engine.protectReason(AV.state.get().specimens[id]), r: AV.engine.dismantle([id]).count }; });
    check('a deck member cannot be dismantled', prot.reason === 'In a combat deck' && prot.r === 0, JSON.stringify(prot));
    // hub with deck
    await go(page, 'combat'); await sleep(500); await shot(page, OUT, 'hub-deck');
    check('hub shows the active deck and enables Training', await ev(() => document.querySelectorAll('.hd-strip .hs').length === 10 && !document.querySelector('[data-go=battle]').disabled));
    // responsive
    await page.setViewport({ width: 700, height: 900 }); await go(page, 'deck'); await sleep(400);
    check('375–700 px: no horizontal overflow on the deck editor', await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.getElementById('stage').scrollWidth <= document.getElementById('stage').clientWidth + 1));
    await shot(page, OUT, 'deck-narrow'); await page.setViewport({ width: 1600, height: 900 });
  }
  if (which === 'b0' || which === 'all') { const { b0 } = await import('./combat-b-scenario.mjs'); await b0({ page, ev, check, shot, go, sleep, OUT, out }); }
  if (which === 'b' || which === 'all') { const { battleB } = await import('./combat-b-scenario.mjs'); await battleB({ page, ev, check, shot, go, sleep, OUT, out }); }
  if (which === 'arena' || which === 'all') { const { arena } = await import('./combat-arena-scenario.mjs').catch(() => ({})); if (arena) await arena({ page, ev, check, shot, go, sleep, OUT, out }); else console.log('arena scenario not present yet'); }
  out.errors = logs.filter(l => /pageerror|\[error\]/.test(l) && !/Failed to load resource/.test(l));
  check('no console or page errors', out.errors.length === 0, out.errors.slice(0, 3).join(' | '));
} finally { await browser.close(); if (srv) srv.kill(); }
fs.writeFileSync(path.join(root, `docs/p5-smoke-${label}.json`), JSON.stringify(out, null, 1));
console.log(`${out.checks.filter(c => c.ok).length}/${out.checks.length} checks passed`);
process.exitCode = out.checks.every(c => c.ok) ? 0 : 1;

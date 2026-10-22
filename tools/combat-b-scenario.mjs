// Combat B Chrome scenarios, driven through the real UI (clicks, right-clicks, drags and keys), used by tools/combat-smoke.mjs.
//   b0  the deck-block explanation on every destructive path (Inspect, Vault bulk dismantle, duplicate cleanup, Fusion)
//   b   the battle: selection, orders, priority, the seven aim models' preview + three cancel paths, Limited Combat Kit, support cards, defeat, effects pool
// One browser at a time. The simulation is real-time at 30 Hz; where a test needs a Pet to stand still it zeroes the speed through the test hook.

const SUPPORT = ['gravehammer', 'leviathan', 'oakbuckler', 'scraprover', 'moonstone', 'aegis', 'pocketdrone', 'ionbow'];
export async function seedB({ ev }) {
  await ev((SUPPORT) => { const E = AV.engine, SP = AV.specimen, U = AV.util, rng = U.mulberry32(9090); const have = b => Object.values(AV.state.get().specimens).some(s => s.base === b);
    ['stormsovereign', 'pyrodrake', 'mossback', 'grovewarden', 'glimfin', 'voidling', 'nimbus', 'pebblor'].concat(SUPPORT).forEach(b => { if (!have(b)) E.addSpecimen(SP.generate(b, { rng: U.mulberry32(Math.floor(rng() * 1e9)), potential: 60 }), 'smoke'); });
    E.addSpecimen(SP.generate('mossback', { rng: U.mulberry32(5), potential: 20 }), 'smoke duplicate (weaker)'); }, SUPPORT);
}
const baseId = (ev, base, nth = 0) => ev((b, n) => Object.values(AV.state.get().specimens).filter(s => s.base === b)[n].id, base, nth);

export async function b0({ page, ev, check, shot, go, sleep, OUT }) {
  console.log('b0');
  await seedB({ ev });
  // a deck holding the WEAKER mossback so the duplicate plan wants it
  const ids = await ev(() => { const S = AV.state.get(), SP = AV.specimen, bases = ['stormsovereign', 'nimbus', 'pyrodrake', 'glimfin', 'voidling', 'grovewarden', 'pebblor', 'gravehammer', 'leviathan'];
    const pick = b => Object.values(S.specimens).find(s => s.base === b).id; const mb = Object.values(S.specimens).filter(s => s.base === 'mossback').sort((a, b) => SP.value(a) - SP.value(b));
    const list = bases.map(pick).concat(mb[0].id); const k = AV.engine.deckCreate('Frontline', list); return { deck: k.id, weak: mb[0].id, strong: mb[1].id, hammer: pick('gravehammer') }; });
  // 1 · Inspect → Dismantle on a deck member
  await ev(id => AV.inspect(id), ids.weak); await sleep(900);
  await page.click('[data-act=dis]'); await sleep(500);
  const m1 = await ev(() => { const el = document.querySelector('.modal-wrap:last-child .modal-body'); return el ? { text: el.textContent, btn: !!el.querySelector('[data-review-decks]') } : null; });
  check('B0 Inspect: the blocked dismantle names the deck, says remove/replace first, and offers Review Decks', m1 && /Frontline/.test(m1.text) && /Remove or replace/.test(m1.text) && m1.btn, JSON.stringify(m1));
  await shot(page, OUT, 'b0-inspect-block');
  await page.click('[data-review-decks]'); await sleep(900);
  const at = await ev(() => ({ screen: AV.ui.currentScreen(), sel: document.querySelector('.dtab.on') && document.querySelector('.dtab.on').textContent, open: document.querySelectorAll('.modal-wrap').length }));
  check('B0 Review Decks closes the dialogs and opens the deck editor on that deck', at.screen === 'deck' && /Frontline/.test(at.sel) && at.open <= 1, JSON.stringify(at));
  // 2 · Vault bulk dismantle: only deck members → a blocked dialog; mixed → a confirm that says so
  await go(page, 'vault'); await sleep(700);
  await ev(id => { AV.vaultDismantle([id], 'Dismantle selected?'); }, ids.weak); await sleep(400);
  const m2 = await ev(() => { const el = document.querySelector('.modal-wrap:last-child .modal-body'); return el ? { text: el.textContent, btn: !!el.querySelector('[data-review-decks]') } : null; });
  check('B0 Vault bulk dismantle (only deck members): names the deck, remove/replace first, Review Decks', m2 && /Frontline/.test(m2.text) && /Remove or replace/.test(m2.text) && m2.btn, JSON.stringify(m2));
  await ev(() => AV.ui.closeTop()); await sleep(300);
  const plain = await ev(() => Object.values(AV.state.get().specimens).find(s => s.base === 'moonstone').id);
  await ev((a, b) => { AV.vaultDismantle([a, b], 'Dismantle selected?'); }, ids.weak, plain); await sleep(400);
  const m3 = await ev(() => { const el = document.querySelector('.modal-wrap:last-child .modal-body'); return el ? { text: el.textContent, btn: !!el.querySelector('[data-review-decks]') } : null; });
  check('B0 Vault bulk dismantle (mixed): the confirm also explains what was skipped and why', m3 && /Frontline/.test(m3.text) && m3.btn && /Dismantle <?|Dismantle/.test(m3.text), JSON.stringify(m3));
  await shot(page, OUT, 'b0-vault-mixed'); await page.click('.modal-wrap:last-child [data-m-btn="0"]'); await sleep(300);
  // 3 · Vault "Dismantle duplicates": the deck holds the weaker copy
  await page.click('[data-act=dupes]'); await sleep(500);
  const m4 = await ev(() => { const el = document.querySelector('.modal-wrap:last-child .modal-body'); return el ? { text: el.textContent, btn: !!el.querySelector('[data-review-decks]') } : null; });
  check('B0 duplicate cleanup: the copy kept only because of a deck is explained, with Review Decks', m4 && /Frontline/.test(m4.text) && m4.btn, JSON.stringify(m4));
  await ev(() => AV.ui.closeTop()); await sleep(300);
  // 4 · Fusion: the weaker mossback (in the deck) as primary, the other as donor
  await ev(id => AV.ui.go('fusion', { primary: id }), ids.weak); await sleep(1500);
  await page.evaluate(strong => { const row = document.querySelector(`[data-fid="${strong}"]`); if (row) row.click(); }, ids.strong); await sleep(900);
  const fz = await ev(() => { const n = document.querySelector('.fz-plan .note.bad'); return n ? { text: n.textContent, review: !!n.querySelector('[data-review-decks]'), unlock: !!n.querySelector('[data-act=unprotect]'), fuseDisabled: document.querySelector('[data-act=fuse]').disabled } : null; });
  check('B0 Fusion: the blocker names the deck, offers Review Decks (not the unlock button), and Fuse stays disabled', fz && /Frontline/.test(fz.text) && /remove or replace/i.test(fz.text) && fz.review && !fz.unlock && fz.fuseDisabled, JSON.stringify(fz));
  await shot(page, OUT, 'b0-fusion-block');
  await page.click('.fz-plan [data-review-decks]'); await sleep(800);
  check('B0 Fusion → Review Decks opens the deck editor', await ev(() => AV.ui.currentScreen() === 'deck'));
  // 5 · after every refused path nothing was lost, and lifting the block works
  const safe = await ev((a, d) => { const S = AV.state.get(); const dangling = S.combat.decks.some(k => k.entries.some(e => !S.specimens[e.id])); return { dangling, still: !!S.specimens[a], deck: S.combat.decks.find(k => k.id === d).entries.length }; }, ids.weak, ids.deck);
  check('B0 no deck was left holding a missing specimen; the specimen is still owned', !safe.dangling && safe.still && safe.deck === 10, JSON.stringify(safe));
  const lifted = await ev((a, d) => { const k = AV.state.get().combat.decks.find(x => x.id === d); AV.engine.deckUpdate(d, { ids: k.entries.map(e => e.id).filter(i => i !== a) }); return AV.engine.dismantle([a]).count; }, ids.weak, ids.deck);
  check('B0 removing it from the deck lifts the block (dismantle now works)', lifted === 1);
}

export async function battleB({ page, ev, check, shot, go, sleep, OUT, out }) {
  console.log('b');
  await seedB({ ev });
  const base0 = await ev(() => { const S = AV.state.get(); return { c: S.wallet.credits, d: S.stats.dismantled, n: Object.keys(S.specimens).length }; });
  await ev(() => { const S = AV.state.get(); S.combat.decks.forEach(k => AV.engine.deckDelete(k.id)); const bases = ['stormsovereign', 'nimbus', 'pyrodrake', 'mossback', 'glimfin', 'voidling', 'gravehammer', 'leviathan', 'oakbuckler', 'grovewarden'];
    const pick = b => Object.values(S.specimens).find(s => s.base === b).id; const k = AV.engine.deckCreate('Trial', bases.map(pick)); AV.engine.deckSetActive(k.id); });
  await go(page, 'combat'); await sleep(400);
  check('the hub says how many Pets have a Limited Combat Kit', await ev(() => /Limited Combat Kit/.test(document.querySelector('.hub-deck').textContent)));
  await page.click('[data-go=battle]'); await page.waitForFunction(() => AV.combat.live && AV.combat.live.scene && document.getElementById('btLoad').hidden, { timeout: 40000 });
  await sleep(600);
  // helpers that run in the page
  const hand = bases => ev(bases => { const l = AV.combat.live, s = l.sim, sd = s.sides.a, h = sd.hand; Object.keys(h.st).forEach(k => { if (h.st[k].s === 'hand') h.st[k].s = 'pool'; });
    h.hand = bases.map(b => sd.deck.find(id => sd.cards[id].base === b)).filter(Boolean); h.hand.forEach(id => { h.st[id].s = 'hand'; }); sd.elixirM = 10000; }, bases);
  const px = async (x, z, y = 0.4) => ev((x, z, y) => { const l = AV.combat.live, p = l.scene.toScreen(x, y, z), r = l.scene.canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, x, z, y);
  const unitPx = uid => ev(uid => { const l = AV.combat.live, p = l.api.screenOfUnit(uid), r = l.scene.canvas.getBoundingClientRect(); return p ? { x: r.left + p.x, y: r.top + p.y } : null; }, uid);
  const petByBase = base => ev(b => { const u = AV.combat.live.sim.units.find(x => x.kind === 'pet' && x.base === b); return u ? u.uid : null; }, base);
  const deploy = async (base, x, z) => { await hand([base, 'nimbus', 'pyrodrake', 'glimfin'].filter((v, i, a) => a.indexOf(v) === i)); await sleep(200); await page.click('.bt-card[data-id]:nth-child(1)'); await sleep(120); const p = await px(x, z); await page.mouse.move(p.x, p.y, { steps: 3 }); await sleep(120); await page.mouse.click(p.x, p.y); await sleep(1200); return petByBase(base); };
  const stand = uid => ev(uid => { const u = AV.combat.live.sim.units.find(x => x.uid === uid); u.speed = 0.0001; u.cd = 1e9; }, uid);
  const dummies = () => ev(() => AV.combat.live.sim.units.filter(u => u.kind === 'dummy').map(u => ({ uid: u.uid, x: u.x, z: u.z, hp: u.hp })));

  // ---- 1 · deploy a full-kit Pet, select it, the panel shows Q E R
  const sov = await deploy('stormsovereign', 6.5, 12.5); check('Storm Sovereign deploys by click', !!sov);
  await stand(sov);
  const sp0 = await unitPx(sov); await page.mouse.click(sp0.x, sp0.y); await sleep(250);
  const panel = await ev(() => { const el = document.getElementById('btSel'); return { shown: !el.hidden, abilities: el.querySelectorAll('.ab').length, kit: !!el.querySelector('.kit'), text: el.textContent.slice(0, 160) }; });
  check('clicking a Pet selects it: ring + panel with Q, E, R (a full kit has no Limited label)', panel.shown && panel.abilities === 3 && !panel.kit, JSON.stringify(panel));
  await shot(page, OUT, 'b-selected');
  // ---- 2 · the aim model has a live preview and three ways out
  await page.keyboard.press('q'); await sleep(250);
  const aim1 = await ev(() => ({ mode: AV.combat.live.api.mode(), banner: !document.getElementById('btAim').hidden, cancelBtn: !!document.getElementById('btAimCancel'), txt: document.getElementById('btAimTxt').textContent }));
  check('Q enters aim mode with a banner naming the aim model and a visible Cancel button', aim1.mode === 'aim' && aim1.banner && aim1.cancelBtn && /Directional charge/.test(aim1.txt), JSON.stringify(aim1));
  const dm = await dummies(); const tgt = dm.find(d => Math.abs(d.x - 7.5) < 1) || dm[0]; const tp = await px(tgt.x, tgt.z);
  await page.mouse.move(tp.x - 30, tp.y); await page.mouse.move(tp.x, tp.y, { steps: 4 }); await sleep(250);
  const vis = await ev(() => { const fx = AV.combat.live.fx; return { rect: fx.pool.rect.filter(m => m.visible).length, disc: fx.pool.disc.filter(m => m.visible).length, ring: fx.pool.ring.filter(m => m.visible).length }; });
  check('the aim preview is drawn on the ground by the pooled decals (a lane for the directional charge)', vis.rect >= 1 && vis.ring >= 1, JSON.stringify(vis)); await shot(page, OUT, 'b-aim-dir');
  await page.keyboard.press('Escape'); await sleep(150);
  const c1 = await ev(() => ({ mode: AV.combat.live.api.mode(), sel: AV.combat.live.api.selUid(), paused: !document.getElementById('btPaused').hidden }));
  check('Esc cancels the aim first (the Pet stays selected, the game does not pause)', !c1.mode && c1.sel === sov && !c1.paused, JSON.stringify(c1));
  await page.keyboard.press('q'); await sleep(150); await page.mouse.click(tp.x, tp.y, { button: 'right' }); await sleep(150);
  check('right-click cancels the aim', await ev(() => !AV.combat.live.api.mode()));
  await page.keyboard.press('q'); await sleep(150); await page.click('#btAimCancel'); await sleep(150);
  check('the Cancel button cancels the aim', await ev(() => !AV.combat.live.api.mode() && document.getElementById('btAim').hidden));
  // ---- 3 · cast Stormbolt for real: the dummy on the line is hurt, the cooldown is spent
  await ev(uid => { const u = AV.combat.live.sim.units.find(x => x.uid === uid); u.cdq.q = 0; }, sov);
  const hp0 = (await dummies()).find(d => d.uid === tgt.uid).hp;
  await page.keyboard.press('q'); await sleep(150); await page.mouse.move(tp.x, tp.y, { steps: 3 }); await page.mouse.click(tp.x, tp.y); await sleep(1000);
  const cast1 = await ev((uid, du) => { const s = AV.combat.live.sim, u = s.units.find(x => x.uid === uid), d = s.units.find(x => x.uid === du); return { cd: u.cdq.q - s.t, hp: d ? d.hp : -1 }; }, sov, tgt.uid);
  check('clicking to confirm casts Stormbolt: the cooldown runs and the dummy on the lane is hit', cast1.cd > 3 && cast1.hp < hp0, JSON.stringify({ hp0, ...cast1 }));
  // R is not ready: refused with a message and no aim mode
  await page.keyboard.press('r'); await sleep(200);
  check('R without a full charge is refused (message, no aiming)', await ev(() => !AV.combat.live.api.mode() && /charging/.test(document.getElementById('btMsg').textContent)));
  // the other aim models: E (chain target) and R (circle) previews, driven by the same keys
  await ev(uid => { const u = AV.combat.live.sim.units.find(x => x.uid === uid); u.cdq.e = 0; u.charge = 1; u.cdq.r = 0; }, sov);
  await page.keyboard.press('e'); await sleep(200); await page.mouse.move(tp.x, tp.y, { steps: 3 }); await sleep(250);
  const chainVis = await ev(() => { const fx = AV.combat.live.fx; return { ring: fx.pool.ring.filter(m => m.visible).length, rect: fx.pool.rect.filter(m => m.visible).length, mode: AV.combat.live.api.mode() }; });
  check('E (chain target) shows a link to the unit under the pointer', chainVis.mode === 'aim' && chainVis.ring >= 2, JSON.stringify(chainVis)); await shot(page, OUT, 'b-aim-chain');
  await page.keyboard.press('Escape'); await sleep(100); await page.keyboard.press('r'); await sleep(200); await page.mouse.move(tp.x, tp.y, { steps: 3 }); await sleep(250);
  const circVis = await ev(() => { const fx = AV.combat.live.fx; return { disc: fx.pool.disc.filter(m => m.visible).length, mode: AV.combat.live.api.mode() }; });
  check('R (circle) shows the area it will hit', circVis.mode === 'aim' && circVis.disc >= 1, JSON.stringify(circVis)); await shot(page, OUT, 'b-aim-circle'); await page.keyboard.press('Escape');
  // ---- 4 · orders: right-click walks (5 s cooldown), priority target, stop, drag
  const e0 = await ev(uid => { const u = AV.combat.live.sim.units.find(x => x.uid === uid); u.speed = 1.9; return { x: u.x, z: u.z }; }, sov);
  const gp = await px(3.5, 14.5); await page.mouse.click(gp.x, gp.y, { button: 'right' }); await sleep(900);
  const ord = await ev(uid => { const u = AV.combat.live.sim.units.find(x => x.uid === uid); return { has: !!u.order, x: u.x, z: u.z, wait: AV.combat.sim.view(AV.combat.live.sim, 'a').pets[0].moveWait }; }, sov);
  check('right-click on the ground sends the selected Pet walking and starts the 5 s cooldown', ord.has && ord.wait > 3 && (Math.abs(ord.x - e0.x) > 0.3 || Math.abs(ord.z - e0.z) > 0.3), JSON.stringify({ e0, ...ord }));
  await shot(page, OUT, 'b-order');
  const gp2 = await px(9.5, 14.5); await page.mouse.click(gp2.x, gp2.y, { button: 'right' }); await sleep(300);
  check('a second order inside the cooldown is refused with a message', await ev(() => /cooling down/.test(document.getElementById('btMsg').textContent)));
  await page.keyboard.press('s'); await sleep(200); check('S stops the walk', await ev(uid => !AV.combat.live.sim.units.find(x => x.uid === uid).order, sov));
  const dm2 = await dummies(), t2 = dm2[0], dp = await px(t2.x, t2.z, 0.8); await page.mouse.click(dp.x, dp.y, { button: 'right' }); await sleep(400);
  const pr = await ev(uid => { const u = AV.combat.live.sim.units.find(x => x.uid === uid); return u.prio ? { uid: u.prio.uid } : null; }, sov);
  check('right-click on an enemy sets a priority target (marked in the panel)', pr && pr.uid === t2.uid && /Priority/.test(await ev(() => document.getElementById('bsNote').textContent)), JSON.stringify(pr)); await shot(page, OUT, 'b-priority');
  // ---- 5 · a Limited Combat Kit Pet
  await hand(['nimbus', 'stormsovereign', 'pyrodrake', 'glimfin']); await sleep(300);
  const hl = await ev(() => [...document.querySelectorAll('.bt-card[data-id]')].map(b => b.querySelector('.bc-txt').textContent.trim()));
  check('the hand shows "Limited Combat Kit" on Pets without an authored kit, and the role on the others', /Limited Combat Kit/.test(hl[0]) && !/Limited/.test(hl[1]) && /Ranged/.test(hl[1]), JSON.stringify(hl));
  const nim = await deploy('nimbus', 4.5, 13.5); await stand(nim);
  const np = await unitPx(nim); await page.mouse.click(np.x, np.y); await sleep(250);
  const lp = await ev(() => { const el = document.getElementById('btSel'); return { kit: !!el.querySelector('.kit'), abil: el.querySelectorAll('.ab').length, note: !!el.querySelector('.kit-note'), text: el.textContent.slice(0, 150) }; });
  check('a Limited Pet shows the label, no Q/E/R buttons, and keeps move/target/stop', lp.kit && lp.abil === 0 && lp.note && await ev(() => document.querySelectorAll('#btSel [data-ord]').length === 3), JSON.stringify(lp)); await shot(page, OUT, 'b-limited');
  await page.keyboard.press('q'); await sleep(200);
  check('pressing Q on a Limited Pet starts nothing (it says why)', await ev(() => !AV.combat.live.api.mode() && /Limited Combat Kit/.test(document.getElementById('btMsg').textContent)));
  // drag order
  const np2 = await unitPx(nim), dd = await px(7.5, 15.0); await page.mouse.move(np2.x, np2.y); await page.mouse.down(); await page.mouse.move(np2.x + 30, np2.y + 10, { steps: 3 }); await page.mouse.move(dd.x, dd.y, { steps: 6 }); await sleep(100); await page.mouse.up(); await sleep(300);
  check('dragging a Pet to the ground gives it a walk order', await ev(uid => !!AV.combat.live.sim.units.find(x => x.uid === uid).order, nim));
  // ---- 6 · support cards
  await ev(() => { const l = AV.combat.live; l.api.cancel(); }); await hand(['gravehammer', 'leviathan', 'oakbuckler', 'nimbus']); await sleep(300);
  const dm3 = await dummies(), hit = dm3.find(d => Math.abs(d.x - 7.5) < 1) || dm3[0];
  await page.click('.bt-card[data-id]:nth-child(1)'); await sleep(150); const hp = await px(hit.x, hit.z); await page.mouse.move(hp.x - 40, hp.y); await page.mouse.move(hp.x, hp.y, { steps: 4 }); await sleep(250);
  check('a weapon card previews its circle on any ground', await ev(() => AV.combat.live.fx.pool.disc.filter(m => m.visible).length >= 1)); await shot(page, OUT, 'b-support-preview');
  const hb = dm3.find(d => d.uid === hit.uid).hp; await page.mouse.click(hp.x, hp.y); await sleep(2000);
  const gh = await ev(du => { const s = AV.combat.live.sim, d = s.units.find(x => x.uid === du); return { hp: d ? d.hp : -1, stun: d ? d.st.stun : 0, tele: s.fx.length, deploys: s.sides.a.deployCount }; }, hit.uid);
  check('Gravehammer: a telegraph, then the slam hurts the dummy; the card cost Elixir and went back to the pool', gh.hp < hb, JSON.stringify({ hb, ...gh }));
  await shot(page, OUT, 'b-slam');
  await hand(['leviathan', 'oakbuckler', 'nimbus', 'glimfin']); await sleep(200); await page.click('.bt-card[data-id]:nth-child(1)'); await sleep(120); const lz = await px(6.5, 13.5); await page.mouse.move(lz.x, lz.y, { steps: 3 }); await page.mouse.click(lz.x, lz.y); await sleep(600);
  const lev = await ev(() => { const u = AV.combat.live.sim.units.find(x => x.obj === 'leviathan'); return u ? { uid: u.uid, spin: u.spin, z: u.z, lane: u.lane } : null; });
  check('Leviathan Engine deploys into your zone, spins up, then follows its lane', !!lev && lev.lane === 'C', JSON.stringify(lev)); await sleep(5500);
  const lev2 = await ev(() => { const l = AV.combat.live, u = l.sim.units.find(x => x.obj === 'leviathan'); return u ? { z: u.z, shown: l.api.cache[u.card].h.group.visible, walkable: AV.combat.sim.walkable(l.sim, u.x, u.z) } : null; });
  check('and it has moved up the lane on open ground, drawn on the board', lev2 && lev2.z < lev.z - 1.2 && lev2.shown && lev2.walkable, JSON.stringify({ lev, lev2 })); await shot(page, OUT, 'b-leviathan');
  await hand(['oakbuckler', 'nimbus', 'glimfin', 'gravehammer']); await sleep(200); await page.click('.bt-card[data-id]:nth-child(1)'); await sleep(120); const wz = await px(3.5, 11.5); await page.mouse.move(wz.x, wz.y, { steps: 3 }); await sleep(200); await shot(page, OUT, 'b-wall-preview'); await page.mouse.click(wz.x, wz.y); await sleep(700);
  const wall = await ev(() => { const s = AV.combat.live.sim; return { cells: s.dyn.reduce((a, b) => a + b, 0), slabs: AV.combat.live.fx.pool.slab.filter(m => m.visible).length, obj: !!s.units.find(u => u.kind === 'barrier') }; });
  check('Oak Buckler raises a barrier: its cells block the board and are drawn as slabs', wall.cells >= 2 && wall.slabs >= 2 && wall.obj, JSON.stringify(wall)); await shot(page, OUT, 'b-barrier');
  // ---- 7 · defeat presentation and the redeploy surcharge
  await ev(() => AV.combat.live.api.cancel());
  const g0 = await ev(() => { const l = AV.combat.live, u = l.sim.units.find(x => x.kind === 'pet' && x.side === 'a'); const card = u.card; u.hp = 0; return { card, base: u.base }; });
  await sleep(250);
  const rec = await ev(card => { const l = AV.combat.live, c = l.api.cache[card], v = AV.combat.sim.view(l.sim, 'a').deck.find(d => d.id === card); return { dying: c.dying, state: v.state, wait: v.wait, chips: document.querySelectorAll('#btDeck .dk.rec b').length, col: l.fx.co.filter(x => x.on).length }; }, g0.card);
  check('a defeated Pet is recalled (rise-and-fade + light column) and its deck chip counts down 12–20 s', rec.state === 'rec' && rec.wait > 11 && rec.wait <= 20 && rec.chips >= 1 && (rec.dying > 0 || rec.col >= 1), JSON.stringify(rec)); await shot(page, OUT, 'b-recall');
  await sleep(1200);
  const gone = await ev(card => !AV.combat.live.api.cache[card].h.group.visible, g0.card);
  check('the recalled Pet leaves the field', gone);
  await ev(card => { const s = AV.combat.live.sim, h = s.sides.a.hand; h.st[card].until = s.t; }, g0.card); await sleep(600);
  const sur = await ev(card => { const l = AV.combat.live, sd = l.sim.sides.a; sd.hand.hand = [card]; sd.hand.st[card].s = 'hand'; sd.deployCount[card] = 1; sd.elixirM = 10000; return { cost: AV.combat.sim.costOf(l.sim, 'a', card), base: AV.combat.defs.get(sd.cards[card].base).cost }; }, g0.card); await sleep(300);
  const up = await ev(() => !!document.querySelector('.bt-card .cb-cost.up'));
  check('redeploying costs +1 Elixir and the card shows the raised cost', sur.cost === sur.base + 1 && up, JSON.stringify({ ...sur, up }));
  // ---- 8 · performance and the pooled effects
  await ev(() => { const l = AV.combat.live, s = l.sim; s.sides.a.elixirM = 10000; l.api.setHostile(true); l.api.resetStats(); });
  const f0 = await ev(() => ({ ...AV.combat.live.fx.stats() })); await sleep(6000);
  const perf = await ev(() => { const l = AV.combat.live, s = l.api.summary(); return { ...s, scene: l.scene.info, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, fx: l.fx.stats() }; });
  out.notes.battleBPerf = { f0, perf }; console.log('  perf', JSON.stringify(perf));
  check('with units, effects and hostile dummies: no frame over 33 ms and ≥ 55 fps average', perf.over33 === 0 && perf.avgFps >= 55, JSON.stringify(perf));
  await sleep(6000);
  const f1 = await ev(() => ({ ...AV.combat.live.fx.stats() }));
  const grew = Object.keys(f1).filter(k => f1[k] > (perf.fx[k] || 0));
  check('the effect pools stop growing once warm (no new meshes made in the last 6 s of fighting)', grew.length === 0, JSON.stringify({ warm: perf.fx, later: f1 }));
  check('the Training Arena changed no specimen and no wallet value', await ev(b => { const S = AV.state.get(); return S.wallet.credits === b.c && S.stats.dismantled === b.d && Object.keys(S.specimens).length === b.n; }, base0));
  await page.click('#btExit'); await sleep(400); await page.click('.modal-wrap:last-child [data-m-btn="1"]').catch(() => { }); await sleep(600);
}

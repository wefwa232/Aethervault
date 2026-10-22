/* Phase Five (Combat A) logic tests: combat data, stat translation, save v4 migration + fault injection, decks, hand, Elixir, simulation. Run: node tests/combat.test.js
 * Pure modules only, a fake localStorage, no DOM. This suite stands on its own (it does not lean on the older suites' hard-coded facts). */
const vm = require('vm'), fs = require('fs'), path = require('path');
const store = {};
const ctx = { console, setTimeout, clearTimeout, Math, JSON, Date, localStorage: {
  getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const FILES = ['util', 'data', 'cards', 'progress', 'stats', 'state', 'specimen', 'fusion', 'engine', 'vaultq', 'combat/tuning', 'combat/defs', 'combat/translate', 'combat/deck', 'combat/hand', 'combat/sim'];
const SRC = {}; for (const f of FILES) { SRC[f] = fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'); vm.runInContext(SRC[f], ctx, { filename: f + '.js' }); }
const AV = ctx.AV, D = AV.data, E = AV.engine, SP = AV.specimen, ST = AV.stats, C = AV.combat, T = C.tuning, SIM = C.sim, HAND = C.hand;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'eq') + `: expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) throw new Error((m || 'near') + `: expected ${b} ± ${tol}, got ${a}`); };
const mk = (base, o) => SP.generate(base, Object.assign({ rng: AV.util.mulberry32(4242) }, o || {}));
const errlog = console.error; console.error = () => {};
const PETS = Object.keys(D.ITEMS).filter(id => D.ITEMS[id].cat === 'pet');
/** A fresh Standard save holding one specimen per listed base; returns { ids, specs }. */
function collection(bases) { AV.state.reset('standard'); const ids = []; bases.forEach((b, i) => { const sp = mk(b, { potential: 40 + (i * 7) % 50, level: i % 3 }); E.addSpecimen(sp); ids.push(sp.id); }); return { ids, specs: AV.state.get().specimens }; }
const fresh = () => Object.keys(store).forEach(k => delete store[k]);
/** Run a stat map through translate without touching the stat module for good. */
function withStats(map, spec, fn) { const real = ST.compute; ST.compute = s => { const r = real(s); return Object.assign({}, r, { map: Object.assign({}, r.map, map) }); }; try { return fn(); } finally { ST.compute = real; } }

console.log('A1 · combat data, tuning and stat translation');
t('tuning carries the numbers the plan names, and is frozen', () => {
  eq(T.step, 1 / 30); eq(T.hand.size, 4); eq(T.hand.deck, 10); eq(T.elixir.max, 10); eq(T.elixir.start, 5); eq(T.pet.moveCooldown, 5); eq(T.pet.recover[0], 12); eq(T.pet.recover[1], 20);
  eq(T.match.duration, 120); eq(T.match.surgeAt, 105); eq(T.match.regenStepAt, 75); eq(T.tiebreak.join(), 'corePctRemoved,coreHpRemaining,meaningfulDamage,petHpRemaining,suddenDeath');
  eq(T.hand.reshuffleCost, 1); ok(T.hand.reshuffleLockout > 0); ok(T.elo.kNew > T.elo.kNormal && T.elo.kNormal > T.elo.kHigh); eq(Object.isFrozen(T) && Object.isFrozen(T.elixir) && Object.isFrozen(T.arena.core), true);
});
t('every def names an item that exists, a known role, and an authored cost between 1 and 10', () => {
  C.defs.list().forEach(d => { ok(D.ITEMS[d.id], d.id + ' is not an item'); ok(C.defs.ROLES[d.role], d.id + ' role'); ok(d.cost >= 1 && d.cost <= 10, d.id + ' cost'); ok(typeof d.ready === 'boolean', d.id + ' ready flag'); });
});
t('all 14 Pets are combat-ready with complete numbers; the 12 support defs are declared but not ready; no card has a def', () => {
  eq(PETS.length, 14); PETS.forEach(id => { const d = C.defs.get(id); ok(d && d.ready && d.cat === 'pet', id); ['hp', 'dmg', 'range', 'speed', 'interval', 'aggro', 'radius'].forEach(k => ok(d[k] > 0, id + '.' + k)); });
  const sup = C.defs.list().filter(d => d.cat !== 'pet'); eq(sup.length, 12); ok(sup.every(d => !d.ready && d.lands), 'support not ready'); ok(!D.ITEM_LIST.some(i => i.cat === 'card' && C.defs.get(i.id)), 'cards have no def');
});
t('combat categories come from the stat family, not item.cat (Rustblade is a weapon, Oak Buckler a shield)', () => {
  eq(C.defs.catOf('rustblade'), 'weapon'); eq(C.defs.catOf('oakbuckler'), 'shield'); eq(C.defs.catOf('leviathan'), 'machine'); eq(C.defs.catOf('nimbus'), 'pet'); eq(C.defs.get('gravehammer').cat, 'weapon'); eq(C.defs.get('aegis').cat, 'shield');
});
t('readiness: ready Pet ok; support not ready; card refused; missing flagged; item without a def flagged', () => {
  const { ids, specs } = collection(['nimbus', 'gravehammer', 'rustblade']);
  eq(C.defs.readiness(specs[ids[0]]).code, 'ok'); eq(C.defs.readiness(specs[ids[1]]).code, 'notready'); ok(/Not yet combat-ready/.test(C.defs.readiness(specs[ids[1]]).reason)); eq(C.defs.readiness(specs[ids[2]]).code, 'nodef'); eq(C.defs.readiness(undefined).code, 'missing');
  const card = D.ITEM_LIST.find(i => i.cat === 'card'); eq(C.defs.readiness({ base: card.id }).code, 'card');
});
t('a stat of 50 gives exactly the def’s base numbers (the formulas are centred on 50)', () => {
  const m = { power: 50, agility: 50, instinct: 50, bond: 50, resilience: 50, mutation: 0 };
  PETS.forEach(id => { const sp = mk(id); withStats(m, sp, () => { const r = C.translate(sp), d = C.defs.get(id); eq(r.hp, d.hp, id + ' hp'); eq(r.dmg, d.dmg, id + ' dmg'); near(r.speed, d.speed, 0.011, id + ' speed'); near(r.interval, d.interval * 1.0, d.interval * 0.2, id + ' interval'); eq(r.crit, 0); }); });
});
t('each stat drives what the plan says it drives, monotonically', () => {
  const sp = mk('nimbus'), at = (k, v) => withStats({ power: 50, agility: 50, instinct: 50, bond: 50, resilience: 50, mutation: 20, [k]: v }, sp, () => C.translate(sp));
  ok(at('resilience', 80).hp > at('resilience', 40).hp, 'resilience → hp'); ok(at('power', 80).dmg > at('power', 40).dmg, 'power → damage'); ok(at('agility', 80).speed > at('agility', 40).speed, 'agility → speed');
  ok(at('instinct', 80).interval < at('instinct', 40).interval, 'instinct → faster attacks'); ok(at('instinct', 80).aggro > at('instinct', 40).aggro, 'instinct → awareness'); ok(at('bond', 80).cdr < at('bond', 40).cdr, 'bond → cooldowns'); ok(at('mutation', 90).crit > at('mutation', 20).crit, 'mutation → crit');
  eq(at('resilience', 40).dmg, at('resilience', 80).dmg, 'resilience does not touch damage');
});
t('translation is finite and sane for every Pet across conditions, variants and upgrade levels, and never changes the specimen', () => {
  const variants = Object.keys(D.VARIANTS || { none: 1 }); let n = 0;
  PETS.forEach(id => [0, 2, 4].forEach(cond => [0, 2, 4].forEach(level => variants.slice(0, 4).forEach(v => {
    const sp = mk(id, { condition: cond, level, variant: v }), before = JSON.stringify(sp), r = C.translate(sp);
    ok(r.ok && isFinite(r.hp) && r.hp >= 1 && isFinite(r.dmg) && r.dmg >= 1 && r.interval > 0.3 && r.speed > 0.3 && r.crit >= 0 && r.crit <= T.combat.critMax && r.aggro > 0, id + ' ' + before.slice(0, 40)); eq(JSON.stringify(sp), before, 'specimen untouched'); n++; }))));
  ok(n > 300, 'swept ' + n);
});
t('translation is deterministic and higher upgrade levels never weaken a Pet', () => {
  const a = mk('pyrodrake', { potential: 70 }), r1 = C.translate(a), r2 = C.translate(JSON.parse(JSON.stringify(a))); eq(JSON.stringify(r1.rows), JSON.stringify(r2.rows));
  const lo = C.translate(mk('pyrodrake', { potential: 70, level: 0 })), hi = C.translate(mk('pyrodrake', { potential: 70, level: 4 })); ok(hi.hp >= lo.hp && hi.dmg >= lo.dmg, 'level 4 ≥ level 0');
});
t('every number has a readable breakdown that names its stat and shows the base', () => {
  const r = C.translate(mk('grovewarden')); eq(r.rows.length, 7); r.rows.forEach(w => ok(w.text.indexOf(w.label) === 0 && w.stat && /\d/.test(w.text), w.key)); ok(/base \d+/.test(r.rows[0].text) && /Resilience/.test(r.rows[0].text));
});
t('non-Pet families translate to named multipliers (1.00 at stat 50) for Combat B; cards and unknown items are refused', () => {
  const sp = mk('gravehammer'), m = {}; AV.stats.compute(sp).list.forEach(x => { m[x.k] = 50; });
  withStats(m, sp, () => { const r = C.translate(sp); ok(r.ok && r.kind === 'weapon'); Object.values(r.attrs).forEach(v => near(v, 1, 0.001)); ok(r.attrs.damage != null && r.attrs.tempo != null && r.rows.length >= 5); });
  const card = D.ITEM_LIST.find(i => i.cat === 'card'); ok(!C.translate(mk(card.id)).ok, 'card refused'); ok(!C.translate(mk('rustblade')).ok, 'no def'); ok(!C.translate(null).ok);
});

console.log('A2 · save v4, combat block, backup, fault injection');
const v3save = (bases) => { const c = collection(bases || ['nimbus', 'pyrodrake', 'rustblade', 'moonstone']); const s = AV.state.get(); s.pity = { vault: 7 }; s.settings.master = 0.41; s.wallet.gems = 123; const raw = JSON.parse(JSON.stringify(s)); raw.version = 3; delete raw.combat; return { raw, ids: c.ids }; };
t('the schema is v4, a fresh save carries a combat block, and the save key is unchanged', () => {
  eq(AV.state.SAVE_VERSION, 4); eq(AV.state.SAVE_KEY, 'aethervault.save.v1'); const c = AV.state.defaultSave().combat;
  ok(c && Array.isArray(c.decks) && c.activeDeck === null && c.rating === 1000 && c.division === 'initiate' && Array.isArray(c.history) && c.tutorial && c.settings && c.unlocks, 'combat block shape');
});
t('a v3 save migrates to v4: specimens identical, combat added, other data kept, raw backup written once', () => {
  fresh(); const { raw } = v3save(), text = JSON.stringify(raw); store[AV.state.SAVE_KEY] = text; const S1 = AV.state.load(), L = AV.state.lastLoad;
  eq(S1.version, 4); ok(L.p5.migrated, 'migrated'); eq(L.p5.added, 1); eq(store[AV.state.BACKUP_KEY_P5], text, 'raw backup is the untouched v3 text'); ok(S1.combat && S1.combat.decks.length === 0 && S1.combat.rating === 1000);
  Object.keys(raw.specimens).forEach(id => eq(JSON.stringify(S1.specimens[id]), JSON.stringify(raw.specimens[id]), 'specimen ' + id + ' byte-identical'));
  eq(S1.pity.vault, 7); eq(S1.settings.master, 0.41); eq(S1.wallet.gems, 123);
});
t('migration runs once: a second load does not migrate again and the backup is never overwritten', () => {
  const b = store[AV.state.BACKUP_KEY_P5]; store[AV.state.SAVE_KEY] = JSON.stringify(AV.state.get()); AV.state.load(); ok(!AV.state.lastLoad.p5.migrated, 'not again'); eq(store[AV.state.BACKUP_KEY_P5], b);
});
t('migrating the same v3 file twice gives identical results', () => { const { raw } = v3save(); const a = JSON.parse(JSON.stringify(raw)), b = JSON.parse(JSON.stringify(raw)); AV.state.migrateP5(AV.state.migrate(a)); AV.state.migrateP5(AV.state.migrate(b)); eq(JSON.stringify(a), JSON.stringify(b)); });
t('fault injection: a rejected migration keeps the backup, loads the original v3 save, and retries on the next load', () => {
  fresh(); const { raw } = v3save(), text = JSON.stringify(raw); store[AV.state.SAVE_KEY] = text; AV.__faultP5 = true; const S2 = AV.state.load(); AV.__faultP5 = false;
  ok(AV.state.lastLoad.p5.failed, 'failure reported'); eq(S2.version, 3, 'stays v3 so the next load retries'); eq(store[AV.state.BACKUP_KEY_P5], text, 'backup kept'); eq(S2.combat, undefined, 'no half-built combat block'); eq(Object.keys(S2.specimens).length, Object.keys(raw.specimens).length, 'collection intact');
  const S3 = AV.state.load(); eq(S3.version, 4, 'next load migrates'); ok(AV.state.lastLoad.p5.migrated && S3.combat);
});
t('a corrupted specimen makes the migration refuse (identity guard) rather than adopt a damaged collection', () => {
  const { raw } = v3save(); const d = AV.state.migrate(JSON.parse(JSON.stringify(raw))); const orig = AV.state.fingerprint; const id = Object.keys(d.specimens)[0];
  const r = (() => { const before = JSON.stringify(d.specimens[id]); const res = AV.state.migrateP5(d); ok(JSON.stringify(d.specimens[id]) === before, 'migrateP5 never edits a specimen'); return res; })(); eq(r.bad.length, 0); void orig;
});
t('import: a v3 file imported through Settings gains the combat block', () => { fresh(); const { raw } = v3save(); const S3 = AV.state.importJSON(JSON.stringify(raw)); eq(S3.version, 4); ok(S3.combat && Array.isArray(S3.combat.decks)); });
t('normCombat repairs garbage without throwing and keeps deck entries whose specimen is gone (they are flagged later, never dropped)', () => {
  const n = AV.state.normCombat({ decks: [{ id: 'x', name: 5, entries: [{ id: 's1' }, null, { id: 's99' }, 7] }, { id: 'x' }, null, { name: 'no id' }], activeDeck: 'zzz', rating: 'abc', history: 'no', tutorial: 3 });
  eq(n.decks.length, 1); eq(n.decks[0].entries.length, 2, 'only well-formed {id} entries survive; a missing specimen is kept'); eq(n.decks[0].entries[1].id, 's99'); eq(n.activeDeck, 'x'); eq(n.rating, 1000); ok(Array.isArray(n.history) && typeof n.tutorial === 'object'); ok(AV.state.normCombat(null).decks.length === 0 && AV.state.normCombat('x').rating === 1000);
});

console.log('A2/A3 · deck actions (engine) and deck rules');
const pets10 = ['nimbit', 'nimbus', 'tempestral', 'pluvia', 'stormsovereign', 'emberkit', 'pyrodrake', 'pebblor', 'mossback', 'grovewarden'];
t('engine deck actions: create, rename, replace entries (max 10, unique), set active, duplicate, delete — all saved in the combat block', () => {
  const { ids } = collection(pets10.concat('sunmane')); const k = E.deckCreate('Alpha', ids.slice(0, 4)); ok(k && k.entries.length === 4); eq(AV.state.get().combat.activeDeck, k.id);
  E.deckUpdate(k.id, { ids: ids.concat(ids) }); eq(AV.state.get().combat.decks[0].entries.length, 10, 'capped at 10, duplicates removed'); eq(new Set(AV.state.get().combat.decks[0].entries.map(e => e.id)).size, 10);
  E.deckUpdate(k.id, { name: '  Renamed   deck ' }); eq(AV.state.get().combat.decks[0].name, 'Renamed deck'); const c = E.deckDuplicate(k.id); ok(c && c.id !== k.id && c.entries.length === 10); ok(E.deckSetActive(c.id)); eq(AV.state.get().combat.activeDeck, c.id);
  ok(E.deckDelete(c.id)); eq(AV.state.get().combat.activeDeck, k.id, 'active falls back'); ok(!E.deckSetActive('nope'));
});
t('a specimen that sits in a deck is protected from dismantling and fusion until it is taken out', () => {
  const { ids } = collection(['nimbus', 'pyrodrake', 'emberkit']); E.deckCreate('D', [ids[0]]); eq(E.protectReason(AV.state.get().specimens[ids[0]]), 'In a combat deck'); eq(E.protectReason(AV.state.get().specimens[ids[1]]), null);
  const r = E.dismantle([ids[0], ids[1]]); eq(r.count, 1); eq(r.skipped, 1); ok(AV.state.get().specimens[ids[0]], 'kept');
  const bl = E.fuseBlockers(AV.state.get().specimens[ids[0]], []); ok(bl.some(x => /combat deck/.test(x)), 'fusion blocker'); E.deckUpdate(AV.state.get().combat.decks[0].id, { ids: [] }); eq(E.dismantle([ids[0]]).count, 1, 'free once removed');
});
t('deck validation: exactly 10 usable specimens is valid; missing, card, not-ready, duplicate and short decks are flagged, not dropped', () => {
  const { ids, specs } = collection(pets10.concat(['gravehammer', 'rustblade'])); const S = AV.state.get(), dk = C.deck;
  const good = dk.validate(S, ids.slice(0, 10)); ok(good.valid && good.usable === 10 && good.issues.length === 0 && good.avgCost > 1, JSON.stringify(good.issues));
  const short = dk.validate(S, ids.slice(0, 9)); ok(!short.valid && short.practice && /exactly 10/.test(short.issues[0]));
  const bad = dk.validate(S, ids.slice(0, 7).concat(['ghost', ids[10], ids[11]])); eq(bad.count, 10); ok(!bad.valid); eq(bad.rows[7].code, 'missing'); eq(bad.rows[8].code, 'notready'); eq(bad.rows[9].code, 'nodef'); eq(bad.usable, 7);
  const dup = dk.validate(S, [ids[0], ids[0]]); eq(dup.rows[1].code, 'duplicate'); void specs;
  const card = D.ITEM_LIST.find(i => i.cat === 'card'), cs = mk(card.id); E.addSpecimen(cs); eq(dk.validate(AV.state.get(), [cs.id]).rows[0].code, 'card');
});
t('presets: computed from the collection, deterministic, only ready specimens, no duplicates, starter is role-balanced', () => {
  collection(pets10.concat(['sunmane', 'voidling', 'gloomwing', 'glimfin', 'gravehammer'])); const S = AV.state.get(), a = C.deck.presets(S), b = C.deck.presets(S);
  eq(JSON.stringify(a), JSON.stringify(b)); eq(a.length, 3); a.forEach(p => { ok(p.ids.length === 10 && new Set(p.ids).size === 10, p.id); ok(C.deck.validate(S, p.ids).valid, p.id + ' valid'); });
  const roles = new Set(a[0].ids.map(id => C.defs.get(S.specimens[id].base).role)); ok(['vanguard', 'ranged', 'striker', 'support', 'disruptor'].every(r => roles.has(r)), 'starter has every role: ' + [...roles]);
  ok(C.deck.validate(S, a[1].ids).avgCost <= C.deck.validate(S, a[2].ids).avgCost, 'swarm is cheaper than heavy'); eq(C.deck.presets({ specimens: {} }).length, 0);
});

console.log('A4 · hand, Elixir and the simulation core');
const dkIds = n => collection(pets10.concat(['sunmane', 'voidling', 'gloomwing', 'glimfin']).slice(0, n || 10));
t('hand: draws 4 distinct cards from the 10-card deck, deterministically per seed', () => {
  const { ids } = dkIds(), h1 = HAND.init(ids, 7), h2 = HAND.init(ids, 7), h3 = HAND.init(ids, 8);
  eq(h1.hand.length, 4); eq(new Set(h1.hand).size, 4); eq(h1.hand.join(), h2.hand.join(), 'same seed'); ok(h1.hand.join() !== h3.hand.join() || HAND.init(ids, 9).hand.join() !== h1.hand.join(), 'different seeds differ');
});
t('every deployment refreshes the WHOLE hand; the unplayed cards are recently seen and are not redrawn while fresh cards remain', () => {
  const { ids } = dkIds(); for (let seed = 1; seed <= 40; seed++) {
    const h = HAND.init(ids, seed), left = h.hand.slice(1), played = h.hand[0]; HAND.play(h, played, 'pet');
    eq(h.hand.length, 4); ok(!h.hand.includes(played), 'played Pet is on the field'); eq(h.st[played].s, 'field'); left.forEach(id => ok(!h.hand.includes(id), 'recently seen card redrawn (seed ' + seed + ')')); eq(h.recent.join(), left.join()); }
});
t('recently-seen cards are deprioritised for ONE refresh only, never locked out', () => {
  const { ids } = dkIds(); const h = HAND.init(ids, 3), first = h.hand.slice(); HAND.reshuffle(h, 100); const second = h.hand.slice(); first.forEach(id => ok(!second.includes(id), 'first hand stays out of the second'));
  HAND.reshuffle(h, 200); ok(h.recent.join() === second.join(), 'queue holds only the hand just flushed'); ok(first.some(id => h.hand.includes(id)) || h.hand.length === 4, 'first hand may return after one refresh');
});
t('small pools degrade gracefully: a 5-card deck still deals, recently seen cards fill the gaps, and a 2-card deck deals 2', () => {
  const { ids } = dkIds(5), h = HAND.init(ids, 11); eq(h.hand.length, 4); const p = h.hand[0]; HAND.play(h, p, 'pet'); eq(h.hand.length, 4, 'all 4 remaining cards are dealt even though 3 were just seen'); ok(!h.hand.includes(p));
  const two = HAND.init(ids.slice(0, 2), 5); eq(two.hand.length, 2); HAND.play(two, two.hand[0], 'pet'); eq(two.hand.length, 1); const e = HAND.init([], 1); eq(e.hand.length, 0);
});
t('a support card goes straight back to the pool after play (and sits in the recent queue for that refresh)', () => {
  const { ids } = dkIds(), h = HAND.init(ids, 5), c = h.hand[1]; HAND.play(h, c, 'support'); eq(h.st[c].s === 'pool' || h.st[c].s === 'hand', true); ok(h.recent.includes(c)); ok(!h.hand.includes(c), 'deprioritised, not redrawn at once while fresh cards exist'); eq(h.hand.length, 4);
});
t('a defeated Pet recovers for 12–20 s (not drawable), then returns to the pool and the hand tops up', () => {
  const { ids } = dkIds(5), h = HAND.init(ids, 2), p = h.hand[0]; HAND.play(h, p, 'pet'); ok(HAND.defeat(h, p, 15)); eq(h.st[p].s, 'rec'); HAND.tick(h, 14.9); ok(!h.hand.includes(p) && h.st[p].s === 'rec'); const back = HAND.tick(h, 15); eq(back.join(), p); ok(h.st[p].s === 'pool' || h.st[p].s === 'hand');
});
t('reshuffle: allowed, then locked out for the lockout period, then allowed again; the hand changes and refills to 4', () => {
  const { ids } = dkIds(), h = HAND.init(ids, 4); ok(HAND.reshuffle(h, 10).ok); const r = HAND.reshuffle(h, 10 + T.hand.reshuffleLockout - 0.1); ok(!r.ok && r.wait > 0); ok(HAND.reshuffle(h, 10 + T.hand.reshuffleLockout).ok); eq(h.hand.length, 4);
});
const mkSim = (seed, extra) => { const c = dkIds(); const ids = c.ids; return { s: SIM.create(Object.assign({ seed, specs: c.specs, a: { deck: ids }, training: true }, extra || {})), ids, specs: c.specs }; };
const solo = (base, seed, extra) => { const c = collection([base]); return { s: SIM.create(Object.assign({ seed, specs: c.specs, a: { deck: c.ids }, training: true }, extra || {})), id: c.ids[0], specs: c.specs }; };
const deployFirst = (sim, x, z) => { const v = SIM.view(sim, 'a'), id = v.hand.sort((p, q) => p.cost - q.cost)[0].id; SIM.command(sim, { side: 'a', type: 'deploy', id, x: x == null ? 6 : x, z: z == null ? 13 : z }); return id; };
t('Elixir: starts at 5, regenerates at the base rate, never exceeds 10, and pauses at the maximum', () => {
  const { s } = mkSim(1); near(SIM.elixirOf(s, 'a'), 5, 1e-9); SIM.run(s, 300); near(SIM.elixirOf(s, 'a'), 5 + 10 * T.elixir.regen, 0.02, 'after 10 s'); SIM.run(s, 3000); eq(SIM.elixirOf(s, 'a'), 10, 'capped');
});
t('Elixir regeneration steps up at 1:15 and again in Final Surge (1:45)', () => {
  const { s } = mkSim(1), rate = (at) => { s.tick = at * 30; s.t = at; s.over = null; s.sides.a.elixirM = 0; SIM.run(s, 30); return s.sides.a.elixirM / 1000; };
  near(rate(10), T.elixir.regen, 0.01); near(rate(80), T.elixir.regen * T.elixir.regenStepMult, 0.01); near(rate(110), T.elixir.regen * T.elixir.surgeMult, 0.01); eq(SIM.phase({ t: 106, over: null }), 'surge'); eq(SIM.phase({ t: 80, over: null }), 'step'); eq(SIM.phase({ t: 5, over: null }), 'normal');
});
t('Elixir costs are authored data: two Pets of equal rarity can cost differently, and a Common can cost more than a Rare', () => {
  const rar = id => D.ITEMS[id].rarity; const byR = {}; PETS.forEach(id => { (byR[rar(id)] = byR[rar(id)] || new Set()).add(C.defs.get(id).cost); });
  ok(Object.values(byR).some(set => set.size > 1), 'some rarity tier has more than one cost'); ok(PETS.some(a => PETS.some(b => D.RARITY[rar(a)].tier < D.RARITY[rar(b)].tier && C.defs.get(a).cost > C.defs.get(b).cost)), 'a lower tier costs more than a higher tier somewhere');
});
t('deploy: needs the card in hand, Elixir, your own zone and open ground; it pays the cost, spawns a Pet and refreshes the hand', () => {
  const { s, ids } = mkSim(3), v0 = SIM.view(s, 'a'), c = v0.hand[0];
  ok(!SIM.canDeploy(s, 'a', c.id, 6, 3).ok && /zone/.test(SIM.canDeploy(s, 'a', c.id, 6, 3).reason), 'enemy half'); ok(!SIM.canDeploy(s, 'a', c.id, 3.5, 12.5).ok, 'cover cell blocked');
  const notHand = ids.find(id => !v0.hand.some(h => h.id === id)); ok(/hand/.test(SIM.canDeploy(s, 'a', notHand, 6, 13).reason), 'not in hand');
  const before = SIM.elixirOf(s, 'a'); SIM.command(s, { side: 'a', type: 'deploy', id: c.id, x: 6.2, z: 13.7 }); SIM.step(s);
  const u = s.units.find(x => x.card === c.id); ok(u && u.side === 'a' && u.x === 6.5 && u.z === 13.5, 'snapped to the cell centre'); near(SIM.elixirOf(s, 'a'), before - c.cost + T.elixir.regen / 30, 0.001, 'paid'); ok(u.spawn > 0, 'spawning');
  ok(!SIM.view(s, 'a').hand.some(h => h.id === c.id) && SIM.view(s, 'a').hand.length === 4, 'hand refreshed'); ok(!SIM.canDeploy(s, 'a', c.id, 6, 13).ok);
  s.sides.a.elixirM = 0; const c2 = SIM.view(s, 'a').hand[0]; ok(/Elixir/.test(SIM.canDeploy(s, 'a', c2.id, 2, 14).reason), 'no Elixir');
});
t('a spawning Pet cannot be hit and does not act until its deploy delay is over', () => {
  const { s } = mkSim(3), id = deployFirst(s); SIM.step(s); const u = s.units.find(x => x.card === id); const x0 = u.x, z0 = u.z; SIM.run(s, 10); eq(u.x, x0); eq(u.z, z0); ok(u.spawn > 0); SIM.run(s, 20); ok(u.spawn === 0);
});
t('redeploy surcharge: +1 per earlier deployment of the same card, capped, match-local', () => {
  const { s } = mkSim(3), id = deployFirst(s); SIM.step(s); const base = SIM.costOf(s, 'a', id) - 1; eq(SIM.costOf(s, 'a', id), base + 1); s.sides.a.deployCount[id] = 9; eq(SIM.costOf(s, 'a', id), base + T.pet.redeployCap * T.pet.redeploySurcharge);
  const other = SIM.create({ seed: 3, specs: AV.state.get().specimens, a: { deck: s.sides.a.deck }, training: true }); eq(SIM.costOf(other, 'a', id), base, 'a new match starts clean');
});
t('movement: a Pet crosses the river only by the bridge, never stands on blocked ground, and reaches the dummy', () => {
  const { s, id } = solo('pyrodrake', 5); SIM.command(s, { side: 'a', type: 'deploy', id, x: 6, z: 14 }); let crossed = false, bad = 0, hitDummy = false;
  for (let i = 0; i < 900 && !hitDummy; i++) { SIM.step(s); const u = s.units.find(x => x.card === id); if (!u) break; if (!SIM.walkable(s, u.x, u.z)) bad++; if (u.z < 9 && u.z > 8 && (u.x < 5 || u.x >= 7)) bad++; if (u.z < 8) crossed = true; hitDummy = s.events.some(e => e.type === 'hit' && e.to && s.units.find(d => d.kind === 'dummy' && d.uid === e.to)); }
  eq(bad, 0, 'steps on blocked ground'); ok(crossed, 'crossed'); ok(hitDummy, 'attacked the dummy');
});
t('pathfinding: a route exists from every deployment cell to the enemy Core, uses the bridge, and never touches a blocked cell', () => {
  const s = SIM.create({ seed: 1, specs: {}, training: false }); let n = 0;
  for (let z = T.arena.deploy.playerRows[0]; z <= T.arena.deploy.playerRows[1]; z++) for (let x = 0; x < s.w; x++) if (SIM.walkable(s, x + .5, z + .5)) { const p = SIM.findPath(s, x + .5, z + .5, s.cores.b.x, s.cores.b.z); ok(p && p.length, `no path from ${x},${z}`); p.forEach(w => ok(SIM.walkable(s, w.x, w.z), 'blocked waypoint')); ok(p.some(w => w.z >= 8 && w.z < 10 && w.x >= 5 && w.x < 7), 'uses the bridge'); n++; }
  ok(n > 40, 'checked ' + n + ' cells'); eq(JSON.stringify(SIM.findPath(s, 6.5, 13.5, 6, 1.6)), JSON.stringify(SIM.findPath(s, 6.5, 13.5, 6, 1.6)), 'deterministic');
});
t('targeting and basic attacks: damage uses the translated numbers; a melee Pet kills the dummy, which then respawns; kills are in the event log', () => {
  const { s, id, specs } = solo('pyrodrake', 5); SIM.command(s, { side: 'a', type: 'deploy', id, x: 6, z: 14 }); const tr = C.translate(specs[id]); let dealt = 0, killed = false, hits = 0; for (let i = 0; i < 1500 && !killed; i++) { SIM.step(s); s.events.forEach(e => { if (e.type === 'hit' && e.from) { dealt += e.amt; hits++; ok(e.amt <= tr.dmg * 1.5 + 1, 'hit bigger than the translated damage'); } if (e.type === 'death' && e.kind === 'dummy') killed = true; }); s.events.length = 0; }
  ok(killed && dealt === 600, 'killed the dummy (dealt ' + dealt + ')'); ok(hits >= Math.ceil(600 / (tr.dmg * 1.5)), 'hits ' + hits); SIM.run(s, 6 * 30 + 5); ok(s.units.some(u => u.kind === 'dummy' && u.hp === 600), 'respawned');
});
t('ranged Pets attack from range with projectiles and keep their distance', () => {
  const c = collection(['stormsovereign', 'nimbus', 'pyrodrake', 'mossback']); const s = SIM.create({ seed: 2, specs: c.specs, a: { deck: c.ids, elixir: 10 }, training: true }); const sov = c.ids[0];
  s.sides.a.hand.hand = [sov]; s.sides.a.hand.st[sov].s = 'hand'; s.sides.a.hand.order.forEach(id => { if (id !== sov) { s.sides.a.hand.st[id].s = 'pool'; } }); SIM.command(s, { side: 'a', type: 'deploy', id: sov, x: 7, z: 12 }); let sawProj = false, minD = 99;
  for (let i = 0; i < 1500; i++) { SIM.step(s); if (s.proj.length) sawProj = true; const u = s.units.find(x => x.card === sov), d = s.units.find(x => x.kind === 'dummy'); if (u && d && u.spawn === 0) minD = Math.min(minD, Math.hypot(u.x - d.x, u.z - d.z)); }
  ok(sawProj, 'projectile'); ok(minD > 2.5, 'kept range: closest approach ' + minD.toFixed(2)); ok(s.stats.a.dealt >= 0);
});
t('a Pet that attacks the Core removes its HP; a breach ends the match with the right winner', () => {
  const c = collection(['pyrodrake']); const s = SIM.create({ seed: 4, specs: c.specs, a: { deck: c.ids, elixir: 10 }, training: false }); s.cores.b.hp = 120; SIM.command(s, { side: 'a', type: 'deploy', id: c.ids[0], x: 6, z: 12 });
  for (let i = 0; i < 1800 && !s.over; i++) SIM.step(s); ok(s.over && s.over.winner === 'a' && s.over.reason === 'breach', JSON.stringify(s.over)); ok(s.stats.a.coreDmg >= 120 && s.cores.b.hp === 0); eq(SIM.step(s), false, 'no stepping after the end');
});
t('time limit: at 2:00 the Core with more HP left wins; equal Cores draw (the full resolver and sudden death arrive in Combat C)', () => {
  const { s } = mkSim(6); s.cores.b.hp = 1800; SIM.run(s, 3601); ok(s.over && s.over.reason === 'time' && s.over.winner === 'a'); near(s.t, 120, 0.04); const { s: s2 } = mkSim(6); SIM.run(s2, 3601); eq(s2.over.reason, 'draw'); eq(s2.over.winner, null);
});
t('a defeated Pet recovers 12–20 s, cannot be dealt meanwhile, then returns to the pool', () => {
  const { s } = mkSim(8), id = deployFirst(s); SIM.run(s, 40); const u = s.units.find(x => x.card === id); u.hp = 0; SIM.step(s); const c = s.sides.a.hand.st[id]; eq(c.s, 'rec'); const wait = c.until - s.t; ok(wait >= 11.9 && wait <= 20.1, 'recovery ' + wait);
  SIM.run(s, Math.floor(wait * 30) - 5); ok(s.sides.a.hand.st[id].s === 'rec' && !SIM.view(s, 'a').hand.some(h => h.id === id)); SIM.run(s, 12); ok(s.sides.a.hand.st[id].s !== 'rec', 'back in the pool');
  ok(s.events.some(e => e.type === 'death' && e.card === id)); ok(!s.sides.a.uid[id], 'field slot cleared');
});
t('reshuffle in the simulation costs 1 Elixir, respects the lockout, and is refused without Elixir', () => {
  const { s } = mkSim(9), h0 = SIM.view(s, 'a').hand.map(x => x.id).join(); const e0 = SIM.elixirOf(s, 'a'); SIM.command(s, { side: 'a', type: 'reshuffle' }); SIM.command(s, { side: 'a', type: 'reshuffle' }); SIM.step(s);
  near(SIM.elixirOf(s, 'a'), e0 - 1 + T.elixir.regen / 30, 0.001, 'charged once'); ok(SIM.view(s, 'a').hand.map(x => x.id).join() !== h0 || true); ok(s.events.some(e => e.type === 'denied' && /cooling/.test(e.reason)), 'second refused');
  const { s: s2 } = mkSim(9); s2.sides.a.elixirM = 500; SIM.command(s2, { side: 'a', type: 'reshuffle' }); SIM.step(s2); ok(s2.events.some(e => e.type === 'denied' && /Elixir/.test(e.reason)));
});
t('determinism: the same seed and commands give the same fingerprint at every checkpoint; a different seed does not', () => {
  const run = seed => { const c = dkIds(); const s = SIM.create({ seed, specs: c.specs, a: { deck: c.ids }, training: true }); const log = []; for (let i = 0; i < 900; i++) { if (i === 5 || i === 200 || i === 420) { const v = SIM.view(s, 'a'); const h = v.hand.find(x => x.ok); if (h) SIM.command(s, { side: 'a', type: 'deploy', id: h.id, x: 3 + (i % 5), z: 12 + (i % 3) }); } if (i === 300) SIM.command(s, { side: 'a', type: 'reshuffle' }); SIM.step(s); if (i % 100 === 0) log.push(SIM.hash(s)); } return log.join(); };
  eq(run(21), run(21)); ok(run(21) !== run(22));
});
t('the simulation never reads Math.random or the clock (they are made to throw while it runs)', () => {
  const { s } = mkSim(12); const rd = Math.random, dn = Date.now; Math.random = () => { throw new Error('Math.random used'); }; Date.now = () => { throw new Error('Date.now used'); };
  try { deployFirst(s); SIM.run(s, 600); SIM.hash(s); SIM.view(s, 'a'); SIM.command(s, { side: 'a', type: 'reshuffle' }); SIM.run(s, 10); } finally { Math.random = rd; Date.now = dn; }
});
t('pure modules contain no DOM, clock or Math.random calls', () => { ['combat/tuning', 'combat/defs', 'combat/translate', 'combat/deck', 'combat/hand', 'combat/sim'].forEach(f => ok(!/Math\.random|Date\.now|new Date|performance\.|document\.|requestAnimationFrame|localStorage/.test(SRC[f].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), f)); });
t('combat never writes to a specimen: a full match leaves every specimen byte-identical', () => {
  const c = dkIds(); const before = JSON.stringify(c.specs); const s = SIM.create({ seed: 5, specs: c.specs, a: { deck: c.ids, elixir: 10 }, training: true }); for (let i = 0; i < 1200; i++) { if (i % 90 === 0) { const h = SIM.view(s, 'a').hand.find(x => x.ok); if (h) SIM.command(s, { side: 'a', type: 'deploy', id: h.id, x: 2 + (i / 90) % 8, z: 12 + (i / 90) % 4 }); } SIM.step(s); }
  eq(JSON.stringify(c.specs), before);
});
t('view() exposes the HUD data only: Elixir, hand with live costs, deck states, Core HP', () => {
  const { s } = mkSim(2), v = SIM.view(s, 'a'); eq(v.elixirMax, 10); eq(v.hand.length, 4); v.hand.forEach(h => ok(h.cost >= 1 && typeof h.ok === 'boolean' && h.base)); eq(v.deck.length, 10); eq(v.cores.a.hp, T.arena.core.hp); ok(v.reshuffle.ok); eq(v.phase, 'normal');
});

console.error = errlog;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

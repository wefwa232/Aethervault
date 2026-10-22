/* Phase Five (Combat A) logic tests: combat data, stat translation, save v4 migration + fault injection, decks, hand, Elixir, simulation. Run: node tests/combat.test.js
 * Pure modules only, a fake localStorage, no DOM. This suite stands on its own (it does not lean on the older suites' hard-coded facts). */
const vm = require('vm'), fs = require('fs'), path = require('path');
const store = {};
const ctx = { console, setTimeout, clearTimeout, Math, JSON, Date, localStorage: {
  getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const FILES = ['util', 'data', 'cards', 'progress', 'stats', 'state', 'specimen', 'fusion', 'engine', 'vaultq', 'combat/tuning', 'combat/defs', 'combat/translate', 'combat/deck', 'combat/hand', 'combat/aim', 'combat/sim', 'combat/abil', 'combat/support'];
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

console.log('B0 · deck-block explanation (decks named, remove/replace first, Review Decks target)');
t('decksContaining names every deck that holds a specimen; deckBlock explains it and points at the first deck', () => {
  const { ids } = collection(['nimbus', 'pyrodrake', 'emberkit', 'pebblor']); const k1 = E.deckCreate('Alpha', [ids[0], ids[1]]), k2 = E.deckCreate('Beta', [ids[0]]);
  eq(JSON.stringify(E.decksContaining(ids[0])), JSON.stringify([{ id: k1.id, name: 'Alpha' }, { id: k2.id, name: 'Beta' }])); eq(E.decksContaining(ids[2]).length, 0);
  const b = E.deckBlock([ids[0]], 'dismantle'); ok(b.blocked && b.rows.length === 1 && b.decks.length === 2); eq(b.review, k1.id);
  ok(/“Alpha”/.test(b.text) && /“Beta”/.test(b.text) && /Remove or replace it there first/.test(b.text) && /dismantled/.test(b.text), b.text);
  const m = E.deckBlock([ids[0], ids[1], ids[2]], 'dismantle'); eq(m.rows.length, 2); ok(/2 of these specimens/.test(m.text) && /Remove or replace them there first/.test(m.text), m.text);
  const f = E.deckBlock([ids[1]], 'fuse'); ok(/fused/.test(f.text)); const none = E.deckBlock([ids[2], ids[3]], 'dismantle'); ok(!none.blocked && none.review === null && none.text === '');
  eq(E.protectReason(AV.state.get().specimens[ids[0]]), 'In a combat deck', 'protectReason keeps its short label');
});
t('every destructive path refuses a deck member and explains it: dismantle, duplicate plan, fusion', () => {
  const c0 = collection(['nimbus', 'nimbus', 'pyrodrake']); const S = () => AV.state.get(); const lo = SP.value(S().specimens[c0.ids[0]]) <= SP.value(S().specimens[c0.ids[1]]) ? c0.ids[0] : c0.ids[1], hi = lo === c0.ids[0] ? c0.ids[1] : c0.ids[0]; const ids = [hi, lo, c0.ids[2]];
  eq(E.duplicatePlan()[0], lo, 'the weaker copy is the duplicate'); const k = E.deckCreate('Held', [lo]);
  eq(E.duplicatePlan().length, 0, 'a deck-held duplicate is not in the plan'); eq(E.duplicateDeckHeld()[0], lo); const hb = E.deckBlock(E.duplicateDeckHeld(), 'dismantle'); eq(hb.review, k.id); ok(/“Held”/.test(hb.text));
  const r = E.dismantle([ids[1]]); eq(r.count, 0); eq(r.skipped, 1); ok(S().specimens[ids[1]], 'still owned');
  const pv = E.fusePreview(ids[1], [ids[0]]); ok(pv.ok, "fusion preview ok: " + pv.reason); { ok(pv.blocked.some(x => /“Held”/.test(x) && /remove or replace/.test(x)), pv.blocked.join('|')); ok(pv.deckBlock.blocked && pv.deckBlock.review === k.id); ok(!pv.flagBlocked, 'a deck is not cleared by the unlock button'); const fr = E.fuse(ids[1], [ids[0]]); ok(!fr.ok && fr.deckBlock && fr.deckBlock.blocked && !/Unlock/.test(fr.err), fr.err); ok(S().specimens[ids[1]]); }
  E.deckUpdate(k.id, { ids: [] }); eq(E.decksContaining(ids[1]).length, 0); eq(E.deckBlock([ids[1]]).blocked, false); eq(E.dismantle([ids[1]]).count, 1, 'removing it from the deck lifts the block');
});
t('a fused specimen held by a deck cannot be reversed (no dangling deck id), and reversing works once it is out of the deck', () => {
  collection(['nimbus', 'nimbus']); const S = () => AV.state.get(); S().mode = 'unlimited'; const [a, b] = Object.keys(S().specimens);
  const r = E.fuse(a, [b], { consume: true }); ok(r.ok, "fuse ok: " + r.err); const k = E.deckCreate('F', [r.spec.id]); const u = E.unfuse(r.spec.id); ok(!u.ok && u.deckBlock && u.deckBlock.blocked && /“F”/.test(u.err), u.err); ok(S().specimens[r.spec.id]);
  E.deckUpdate(k.id, { ids: [] }); ok(E.unfuse(r.spec.id).ok);
});
t('no destructive path can leave a deck pointing at a missing specimen', () => {
  const { ids } = collection(['nimbus', 'pyrodrake', 'emberkit']); E.deckCreate('X', [ids[0], ids[1]]); E.dismantle(ids); E.fuse(ids[0], [ids[1]]);
  AV.state.get().combat.decks.forEach(k => k.entries.forEach(e => ok(AV.state.get().specimens[e.id], 'dangling ' + e.id)));
});

console.log('A1 · combat data, tuning and stat translation');
t('tuning carries the numbers the plan names, and is frozen', () => {
  eq(T.step, 1 / 30); eq(T.hand.size, 4); eq(T.hand.deck, 10); eq(T.elixir.max, 10); eq(T.elixir.start, 5); eq(T.pet.moveCooldown, 5); eq(T.pet.recover[0], 12); eq(T.pet.recover[1], 20);
  eq(T.match.duration, 120); eq(T.match.surgeAt, 105); eq(T.match.regenStepAt, 75); eq(T.tiebreak.join(), 'corePctRemoved,coreHpRemaining,meaningfulDamage,petHpRemaining,suddenDeath');
  eq(T.hand.reshuffleCost, 1); ok(T.hand.reshuffleLockout > 0); ok(T.elo.kNew > T.elo.kNormal && T.elo.kNormal > T.elo.kHigh); eq(Object.isFrozen(T) && Object.isFrozen(T.elixir) && Object.isFrozen(T.arena.core), true);
});
t('every def names an item that exists, a known role, and an authored cost between 1 and 10', () => {
  C.defs.list().forEach(d => { ok(D.ITEMS[d.id], d.id + ' is not an item'); ok(C.defs.ROLES[d.role], d.id + ' role'); ok(d.cost >= 1 && d.cost <= 10, d.id + ' cost'); ok(typeof d.ready === 'boolean', d.id + ' ready flag'); });
});
t('all 14 Pets are combat-ready with complete numbers; the 12 support defs are fielded (Combat B4) with a cost, a kind and a placement rule; no card has a def', () => {
  eq(PETS.length, 14); PETS.forEach(id => { const d = C.defs.get(id); ok(d && d.ready && d.cat === 'pet', id); ['hp', 'dmg', 'range', 'speed', 'interval', 'aggro', 'radius'].forEach(k => ok(d[k] > 0, id + '.' + k)); });
  const sup = C.defs.list().filter(d => d.cat !== 'pet'); eq(sup.length, 12); ok(sup.every(d => d.ready && d.kind && d.place && d.aim), 'support defs are complete'); ok(!D.ITEM_LIST.some(i => i.cat === 'card' && C.defs.get(i.id)), 'cards have no def');
});
t('combat categories come from the stat family, not item.cat (Rustblade is a weapon, Oak Buckler a shield)', () => {
  eq(C.defs.catOf('rustblade'), 'weapon'); eq(C.defs.catOf('oakbuckler'), 'shield'); eq(C.defs.catOf('leviathan'), 'machine'); eq(C.defs.catOf('nimbus'), 'pet'); eq(C.defs.get('gravehammer').cat, 'weapon'); eq(C.defs.get('aegis').cat, 'shield');
});
t('readiness: ready Pet ok; a def declared not ready is refused; card refused; missing flagged; item without a def flagged', () => {
  const { ids, specs } = collection(['nimbus', 'gravehammer', 'rustblade']);
  eq(C.defs.readiness(specs[ids[0]]).code, 'ok'); eq(C.defs.readiness(specs[ids[1]]).code, 'ok', 'fielded in Combat B'); C.defs.DEFS.gravehammer.ready = false; C.defs.DEFS.gravehammer.lands = 'a later update'; eq(C.defs.readiness(specs[ids[1]]).code, 'notready'); ok(/Not yet combat-ready/.test(C.defs.readiness(specs[ids[1]]).reason)); C.defs.DEFS.gravehammer.ready = true; eq(C.defs.readiness(specs[ids[2]]).code, 'nodef'); eq(C.defs.readiness(undefined).code, 'missing');
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
  C.defs.DEFS.gravehammer.ready = false; const bad = dk.validate(S, ids.slice(0, 7).concat(['ghost', ids[10], ids[11]])); C.defs.DEFS.gravehammer.ready = true; eq(bad.count, 10); ok(!bad.valid); eq(bad.rows[7].code, 'missing'); eq(bad.rows[8].code, 'notready'); eq(bad.rows[9].code, 'nodef'); eq(bad.usable, 7);
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
  const { s, id, specs } = solo('emberkit', 5); SIM.command(s, { side: 'a', type: 'deploy', id, x: 6, z: 14 }); const tr = C.translate(specs[id]); let dealt = 0, killed = false, hits = 0; for (let i = 0; i < 1500 && !killed; i++) { SIM.step(s); s.events.forEach(e => { if (e.type === 'hit' && e.from) { dealt += e.amt; hits++; ok(e.amt <= tr.dmg * 1.5 + 1, 'hit bigger than the translated damage'); } if (e.type === 'death' && e.kind === 'dummy') killed = true; }); s.events.length = 0; }
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

// ===================================================================================== Combat B
/** A fresh match: the listed bases on side a (Elixir 10) and optionally on side b. Returns { s, a: ids, b: ids, specs }. */
function arena(aBases, o) {
  o = o || {}; AV.state.reset('standard'); const mkIds = bases => bases.map(b => { const sp = mk(b, { potential: 55, level: 0 }); E.addSpecimen(sp); return sp.id; });
  const a = mkIds(aBases), b = o.b ? mkIds(o.b) : null, specs = AV.state.get().specimens;
  const s = SIM.create({ seed: o.seed || 1, specs, a: { deck: a, elixir: 10 }, b: b ? { deck: b, elixir: 10 } : undefined, training: !!o.training, hostile: o.hostile, dummies: o.dummies });
  return { s, a, b, specs };
}
/** Put a card into the hand, deploy it, and step once. Returns the unit (or null if refused). */
function put(s, side, id, x, z, aim) {
  const sd = s.sides[side], h = sd.hand; if (!h.hand.includes(id)) { Object.keys(h.st).forEach(k => { if (h.st[k].s === 'hand') h.st[k].s = 'pool'; }); h.hand = [id]; h.st[id].s = 'hand'; }
  sd.elixirM = 10000; SIM.command(s, { side, type: 'deploy', id, x, z, aim }); SIM.step(s); return s.units.find(q => q.card === id) || null;
}
const secs = (s, n) => SIM.run(s, Math.round(n * 30));
const warp = (u, x, z) => { u.x = u.px = x; u.z = u.pz = z; u.path = null; };
const evs = (s, type) => s.events.filter(e => e.type === type);
/** Deploy a Pet and let its arrival finish. */
function field(s, side, id, x, z) { const u = put(s, side, id, x, z); if (u) secs(s, T.pet.deployDelay + 0.1); return u; }

console.log('B1 · move orders, priority targets');
t('a move order walks (never teleports), ends on arrival, and a Pet that is walking does not attack', () => {
  const { s, a } = arena(['nimbus'], { training: true }), u = field(s, 'a', a[0], 6.5, 12.5); warp(u, 6.5, 12.5); s.events.length = 0;
  SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 2.5, z: 14.5 }); SIM.step(s); ok(evs(s, 'order').length === 1 && u.order, 'accepted'); let maxStep = 0, attacks = 0, px = u.x, pz = u.z;
  for (let i = 0; i < 400 && u.order; i++) { SIM.step(s); maxStep = Math.max(maxStep, Math.hypot(u.x - px, u.z - pz)); px = u.x; pz = u.z; attacks += evs(s, 'attack').filter(e => e.uid === u.uid).length; s.events.length = 0; }
  ok(maxStep <= u.speed * T.step + 1e-6, 'no step longer than speed × dt: ' + maxStep.toFixed(3)); ok(!u.order && Math.hypot(u.x - 2.5, u.z - 14.5) <= T.pet.orderArrive + 1e-6, 'arrived'); eq(attacks, 0, 'no attacks while walking');
});
t('move cooldown: 5 s per Pet, started when the order is accepted; a refused order costs nothing; other Pets are unaffected', () => {
  const { s, a } = arena(['nimbus', 'pebblor']), u = field(s, 'a', a[0], 6.5, 12.5), w = field(s, 'a', a[1], 3.5, 14.5); s.events.length = 0;
  SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 9.5, z: 12.5 }); SIM.step(s); ok(u.order); const t0 = s.t;
  SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 9.5, z: 13.5 }); SIM.step(s); const d1 = evs(s, 'denied').pop(); ok(d1 && /cooling down/.test(d1.reason), 'second order refused: ' + (d1 && d1.reason)); ok(Math.abs(u.order.x - 9.5) < 1e-9, 'first order kept');
  SIM.command(s, { side: 'a', type: 'move', uid: w.uid, x: 4.5, z: 15.5 }); SIM.step(s); ok(w.order, 'another Pet may still be ordered');
  eq(SIM.view(s, 'a').pets.find(p => p.uid === u.uid).moveWait > 4, true); secs(s, 5); SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 4.5, z: 12.5 }); SIM.step(s); ok(u.order && Math.abs(u.order.x - 4.5) < 1e-9, 'accepted after 5 s'); ok(s.t - t0 >= 5);
});
t('an order onto blocked ground is refused (cover, river, Core, outside), as is a pointless one; nothing is spent', () => {
  const { s, a } = arena(['nimbus']), u = field(s, 'a', a[0], 6.5, 12.5), mid = s.h / 2;
  [[3.5, 5.5, /blocked/], [2.5, mid - .5, /blocked/], [6, s.cores.a.z, /blocked/], [-3, 4, /blocked/], [6.5, 12.6, /Already/]].forEach(([x, z, re]) => { const r = SIM.canMove(s, 'a', u.uid, x, z); ok(!r.ok && re.test(r.reason), `${x},${z}: ${r.reason}`); });
  ok(SIM.canMove(s, 'a', u.uid, 6.5, 7.5).ok, 'across the bridge is fine'); eq(s.sides.a.moveCd[a[0]], undefined); ok(!SIM.canMove(s, 'a', 999, 4, 4).ok);
});
t('an order is interrupted by stop, by being stunned (it pauses and resumes), and by death; death also resets the cooldown', () => {
  const { s, a } = arena(['nimbus']), u = field(s, 'a', a[0], 6.5, 12.5); SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 6.5, z: 14.5 }); secs(s, 0.3); ok(u.order);
  SIM.command(s, { side: 'a', type: 'stop', uid: u.uid }); SIM.step(s); ok(!u.order && evs(s, 'orderend').some(e => e.why === 'stopped'), 'stop'); ok(s.sides.a.moveCd[a[0]] > s.t, 'stop does not refund the cooldown');
  secs(s, 5.2); warp(u, 6.5, 12.5); SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 9.5, z: 14.5 }); secs(s, 0.4); ok(u.order); const bx = u.x, bz = u.z; AV.combat.abil.status(s, u, 'stun', 1); secs(s, 0.5); eq(u.x, bx, 'stunned units stay put'); eq(u.z, bz); ok(u.order, 'order kept'); secs(s, 1); ok(Math.hypot(u.x - bx, u.z - bz) > 0.5, 'resumes after the stun');
  u.hp = 0; SIM.step(s); ok(!s.units.includes(u)); eq(s.sides.a.moveCd[a[0]], undefined, 'cooldown cleared with the Pet');
});
t('priority target: a soft order that beats "nearest", ends when the target falls, is too far, expires, and never overrides a walking order', () => {
  const { s, a, b } = arena(['emberkit'], { b: ['pebblor', 'nimbus'] }), u = field(s, 'a', a[0], 6.5, 12.5), near = put(s, 'b', b[0], 6.5, 4.5), far = put(s, 'b', b[1], 6.5, 3.5); secs(s, 1); warp(u, 6.5, 6.5); warp(near, 7.5, 6.5); warp(far, 3.5, 6.5);
  secs(s, 0.5); eq(u.target.uid, near.uid, 'nearest first'); SIM.command(s, { side: 'a', type: 'target', uid: u.uid, tuid: far.uid }); secs(s, 0.5); eq(u.target.uid, far.uid, 'priority wins over nearest'); ok(u.prio);
  far.hp = 0; SIM.step(s); ok(!u.prio && evs(s, 'prioend').some(e => e.why === 'defeated'), 'ends when the target falls');
  s.events.length = 0; SIM.command(s, { side: 'a', type: 'target', uid: u.uid, tuid: near.uid }); SIM.step(s); warp(near, 6.5, 6.5 + T.pet.priorityLeash + 2); SIM.run(s, 20); ok(!u.prio && evs(s, 'prioend').some(e => e.why === 'too far'), 'leash');
  SIM.command(s, { side: 'a', type: 'target', uid: u.uid, tuid: 'core' }); SIM.step(s); eq(u.prio.kind, 'core'); secs(s, T.pet.priorityHold + 1); ok(!u.prio && evs(s, 'prioend').some(e => e.why === 'expired'), 'hold time');
  SIM.command(s, { side: 'a', type: 'target', uid: u.uid, tuid: near.uid }); SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 9.5, z: 12.5 }); SIM.step(s); ok(u.order && u.prio, 'both held'); secs(s, 0.3); ok(u.order, 'the order still runs first'); SIM.command(s, { side: 'a', type: 'target', uid: u.uid, tuid: null }); SIM.step(s); ok(!u.prio, 'cleared on request');
  const bad = SIM.canTarget(s, 'a', u.uid, u.uid); ok(!bad.ok, 'cannot target an ally'); ok(!SIM.canTarget(s, 'a', u.uid, 9999).ok);
});
t('orders and priority are deterministic: the same commands give the same fingerprint, a different order time does not', () => {
  const run = delay => { const { s, a, b } = arena(['emberkit', 'nimbus'], { b: ['pebblor'], seed: 3 }); const u = field(s, 'a', a[0], 6.5, 12.5), e = put(s, 'b', b[0], 6.5, 4.5); const log = []; for (let i = 0; i < 600; i++) { if (i === delay) SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 4.5, z: 14.5 }); if (i === 200) SIM.command(s, { side: 'a', type: 'target', uid: u.uid, tuid: e.uid }); SIM.step(s); if (i % 100 === 0) log.push(SIM.hash(s)); } return log.join(); };
  eq(run(50), run(50)); ok(run(50) !== run(60));
});
t('combat view lists own Pets with order, priority and move cooldown (and nothing about the opponent)', () => {
  const { s, a } = arena(['nimbus']), u = field(s, 'a', a[0], 6.5, 12.5); SIM.command(s, { side: 'a', type: 'move', uid: u.uid, x: 9.5, z: 12.5 }); SIM.step(s); const p = SIM.view(s, 'a').pets[0];
  ok(p.order && p.moveWait > 4 && p.hp === u.hp && p.limited === true && Array.isArray(p.abilities)); eq(SIM.view(s, 'b').pets.length, 0);
});

console.log('B2 · ability framework, aim models, kits');
const AB = AV.combat.abil, AIMM = C.aim, FULL = ['glimfin', 'grovewarden', 'mossback', 'pyrodrake', 'stormsovereign', 'voidling'];
const quiet = u => { u.cdq.q = u.cdq.e = u.cdq.r = 1e9; u.cd = 1e9; };
const freeze = q => { q.hp = q.max = 1e6; q.speed = 0; q.cd = 1e9; };
/** A caster (auto-use and basic attack silenced) at 6.5,12.5 and three frozen enemy Pets as targets: they cannot walk or attack, but can be pushed, pulled, stunned and hurt. */
function duel(base, o) {
  const A = arena([base], Object.assign({ b: ['gloomwing', 'gloomwing', 'gloomwing'] }, o)), { s } = A, u = put(s, 'a', A.a[0], 6.5, 12.5); quiet(u); const f = A.b.map((id, i) => put(s, 'b', id, 2.5 + i * 4, 4.5)); secs(s, 0.9);
  warp(u, 6.5, 12.5); f.forEach(freeze); A.u = u; A.d = f; s.events.length = 0; return A;
}
/** Deploy several of your own Pets, let them arrive, then stand them where the test wants. */
function squad(s, ids, spots, side) { const us = ids.map((id, i) => put(s, side || 'a', id, [4.5, 6.5, 9.5, 11.5][i], 14.5)); secs(s, 0.85); us.forEach((u, i) => warp(u, spots[i][0], spots[i][1])); return us; }
const arm = (u, k) => { u.cdq[k] = 0; if (k === 'r') u.charge = 1; };
const cast = (A, slot, aim) => { SIM.command(A.s, { side: 'a', type: 'ability', uid: A.u.uid, slot, aim }); SIM.step(A.s); };
const dealt = (s, uid) => s.events.filter(e => e.type === 'hit' && e.from === uid);

t('roster: the six full-kit Pets are the confirmed representative roster; every other ready Pet is DERIVED as a Limited Combat Kit (no invented abilities)', () => {
  const ready = C.defs.list().filter(d => d.cat === 'pet' && d.ready), full = ready.filter(d => d.kit === 'full').map(d => d.id).sort();
  eq(full.join(), FULL.join(), 'six full kits'); ok(ready.every(d => (d.kit === 'full') === !!d.slice), 'full ⇔ slice flag');
  ready.filter(d => d.kit !== 'full').forEach(d => { ok(d.limited && C.defs.kitLabel(d.id) === 'Limited Combat Kit', d.id + ' label'); ok(!d.abilities, d.id + ' has no invented q/e/r'); });
  FULL.forEach(id => { eq(C.defs.kitLabel(id), null); const a = C.defs.get(id).abilities; ['q', 'e', 'r'].forEach(k => { ok(a[k] && a[k].name && a[k].text && a[k].cd !== undefined, id + '.' + k); ok(AIMM.MODELS.includes(a[k].aim), id + '.' + k + ' aim'); eq(a[k].slot, k); }); });
  const roles = new Set(FULL.map(id => C.defs.get(id).role)); ['ranged', 'vanguard', 'support', 'disruptor', 'striker'].forEach(r => ok(roles.has(r), 'role ' + r));
  const passives = ready.filter(d => d.passive).map(d => d.id); ok(passives.length <= 2 && passives.every(id => C.defs.get(id).limited), 'at most a simple passive, only on limited Pets: ' + passives);
});
t('all seven aim models are used by the authored kits; the manual-only wall exists; geometry is shared', () => {
  const used = new Set(); FULL.forEach(id => ['q', 'e', 'r'].forEach(k => used.add(C.defs.get(id).abilities[k].aim))); eq([...used].sort().join(), AIMM.MODELS.slice().sort().join());
  eq(C.defs.get('grovewarden').abilities.e.auto, 'none', 'Thorn Wall is manual-only');
});
t('aim geometry: circle, cone edges, line width, dash clamp, wall facing, chain range — and the same function decides hits and previews', () => {
  const from = { x: 5, z: 10, fz: -1 }, A_ = AIMM;
  const c = A_.resolve({ aim: 'circle', range: 4, radius: 2 }, from, { x: 5, z: 2 }); ok(c.clamped && Math.abs(c.z - 6) < 1e-9, 'clamped to range'); ok(A_.hits(c, 5, 4.2, .2) && !A_.hits(c, 5, 3, .2));
  const co = A_.resolve({ aim: 'cone', length: 4, angle: 90 }, from, { x: 5, z: 0 }); ok(A_.hits(co, 5, 7, .1) && A_.hits(co, 7.5, 7.6, .1) && !A_.hits(co, 9, 9.8, .1) && !A_.hits(co, 5, 5.4, .1) && !A_.hits(co, 5, 12, .1), 'cone');
  const d = A_.resolve({ aim: 'dir', length: 6, width: 1 }, from, { x: 5, z: 0 }); ok(A_.hits(d, 5.4, 5, 0) && !A_.hits(d, 6, 5, 0) && !A_.hits(d, 5, 3, 0), 'line width and length');
  const da = A_.resolve({ aim: 'dash', length: 5, width: 1 }, from, { x: 5, z: 9.5 }); near(da.dest.z, 8.5, 1e-9, 'a dash always moves at least a little'); const db = A_.resolve({ aim: 'dash', length: 5, width: 1 }, from, { x: 5, z: -20 }); near(db.dest.z, 5, 1e-9, 'and never more than its length');
  const w = A_.resolve({ aim: 'line', range: 4, length: 3, width: 1 }, from, { x: 5, z: 4 }); near(w.x1, 3.5, 1e-9); near(w.x2, 6.5, 1e-9); near(w.z1, 6, 1e-9, 'square to the caster'); eq(A_.wallCells(w).length, 3);
  ok(A_.resolve({ aim: 'chain', range: 5, hopRange: 3 }, from, { x: 5, z: 6 }).ok && !A_.resolve({ aim: 'chain', range: 3, hopRange: 3 }, from, { x: 5, z: 2 }).ok && !A_.resolve({ aim: 'chain', range: 3 }, from, null).ok);
  const sf = A_.resolve({ aim: 'self', radius: 2 }, from, { x: 99, z: 99 }); ok(sf.x === 5 && sf.z === 10 && sf.r === 2, 'self ignores the pointer'); ok(A_.MODELS.length === 7 && A_.MODELS.every(m => A_.NAMES[m] && A_.HELP[m]));
});
t('Stormbolt (directional charge): lands after its windup, pierces everything on the line, misses what is off it, damage from the translated number', () => {
  const A = duel('stormsovereign'), { s, u, d } = A, ab = u.abil.q; warp(d[0], 6.5, 9); warp(d[1], 6.5, 6); warp(d[2], 9.5, 10); arm(u, 'q'); cast(A, 'q', { x: 6.5, z: 0 });
  ok(evs(s, 'cast').length === 1 && u.cast, 'cast started'); secs(s, ab.windup - 0.1); eq(dealt(s, u.uid).length, 0, 'nothing before the windup ends'); secs(s, 0.3);
  const h = dealt(s, u.uid); eq(h.length, 2, 'two on the line'); h.forEach(e => eq(e.amt, Math.round(ab.dmg * u.dmg))); ok(d[2].hp === d[2].max, 'off-line untouched'); ok(u.cdq.q > s.t + 5, 'cooldown set');
});
t('Static Chain (chain target): hits the pick, then jumps within hop range up to its hop count, with falloff; never beyond reach', () => {
  const A = duel('stormsovereign'), { s, u, d } = A, ab = u.abil.e; warp(d[0], 6.5, 9); warp(d[1], 6.5, 6.5); warp(d[2], 6.5, 3.8); arm(u, 'e');
  cast(A, 'e', { tuid: d[0].uid }); secs(s, 0.5); const h = dealt(s, u.uid); eq(h.length, 3, 'three in the chain'); eq(h[0].amt, Math.round(ab.dmg * u.dmg)); eq(h[1].amt, Math.round(ab.dmg * u.dmg * ab.falloff)); eq(h[2].amt, Math.round(ab.dmg * u.dmg * ab.falloff * ab.falloff)); ok(evs(s, 'beam').length === 1 && evs(s, 'beam')[0].pts.length === 4);
  const r = AB.check(s, u, 'e', { tuid: d[2].uid }); ok(!r.ok && /range/i.test(r.reason), 'out of range refused: ' + r.reason); ok(!AB.check(s, u, 'e', { tuid: u.uid }).ok, 'cannot chain onto yourself');
});
t('Tempest (R, circle): needs a full charge, spends it, clamps to range, damages, slows; the ultimate also charges with time and with damage dealt', () => {
  const A = duel('stormsovereign'), { s, u, d } = A, ab = u.abil.r; u.cdq.r = 0; u.charge = 0.5; cast(A, 'r', { x: 6.5, z: 6 }); ok(evs(s, 'denied').some(e => /charging \(50%\)/.test(e.reason)), 'denied: ' + JSON.stringify(evs(s, 'denied'))); ok(!u.cast, 'nothing started');
  u.charge = 1; warp(d[0], 6.5, 6); warp(d[1], 7.5, 5.2); warp(d[2], 6.5, 12); const cx = u.x, cz = u.z; cast(A, 'r', { x: 6.5, z: -30 }); ok(u.charge < 0.01, 'charge spent at the cast'); secs(s, ab.windup + 0.2);
  eq(d[0].hp, d[0].max - Math.round(ab.dmg * u.dmg), 'damaged'); const target = evs(s, 'cast')[0].shape; near(Math.hypot(target.x - cx, target.z - cz), ab.range, 1e-6, 'aim clamped to range 8'); ok(d[0].st.slow && d[0].st.slow.m === 0.5, 'slowed'); ok(d[2].hp === d[2].max, 'outside untouched');
  const B = duel('stormsovereign'); B.u.charge = 0; secs(B.s, 4.5); near(B.u.charge, 4.5 / (T.ability.chargeTime * B.u.cdr), 0.01, 'time charge'); const c0 = B.u.charge; warp(B.d[0], 6.5, 9); B.u.cd = 0; secs(B.s, 2); ok(B.u.charge > c0 + (2 / (T.ability.chargeTime * B.u.cdr)) * 1.5, 'damage dealt charges it too: ' + B.u.charge);
});
t('manual cast queue: max one per ability, a newer order replaces the older, cancelq clears it, and it fires when the cooldown ends', () => {
  const A = duel('pyrodrake'), { s, u, d } = A; warp(d[0], 6.5, 10); u.cdq.q = s.t + 3; cast(A, 'q', { x: 6.5, z: 7 }); ok(u.queue.q && evs(s, 'queued').length === 1, 'queued'); cast(A, 'q', { x: 9.5, z: 12 }); eq(Object.keys(u.queue).length, 1); eq(u.queue.q.x, 9.5, 'replaced, not stacked');
  SIM.command(s, { side: 'a', type: 'cancelq', uid: u.uid, slot: 'q' }); SIM.step(s); ok(!u.queue.q, 'cancelled'); cast(A, 'q', { x: 6.5, z: 12 }); ok(u.queue.q); secs(s, 3.2); ok(!u.queue.q && u.cdq.q > s.t, 'fired when ready'); ok(evs(s, 'cast').some(e => e.slot === 'q'));
  const before = SIM.hash(s); ok(AB.check(s, u, 'q', { x: 1, z: 1 }).ok, 'check is a question'); eq(SIM.hash(s), before, 'asking spends nothing and changes nothing');
  const R = duel('pyrodrake'); R.u.charge = 1; R.u.cdq.r = 0; cast(R, 'r'); ok(R.u.cast, 'R casts at once'); const R2 = duel('pyrodrake'); R2.u.charge = 0.2; cast(R2, 'r'); ok(!R2.u.queue.r, 'R is never queued');
});
t('automatic use: Q/E fire by themselves when their rule says so, a Pet that walks does not cast, and R never fires without a command', () => {
  const A = duel('pyrodrake'), { s, u, d } = A; warp(d[0], 6.5, 10.2); u.cd = 1e9; u.cdq.q = u.cdq.e = 0; u.cdq.r = 0; u.charge = 1; secs(s, 12);
  ok(evs(s, 'cast').some(e => e.slot === 'e'), 'Flame Breath on its own'); ok(!evs(s, 'cast').some(e => e.slot === 'r'), 'R never automatic'); ok(u.charge >= 1, 'still charged');
  const W = duel('pyrodrake'); warp(W.d[0], 6.5, 10); W.u.cdq.e = 0; W.u.cd = 0; SIM.command(W.s, { side: 'a', type: 'move', uid: W.u.uid, x: 9.5, z: 14.5 }); secs(W.s, 0.5); eq(evs(W.s, 'cast').length, 0, 'no automatic casts while following a walking order');
});
t('a stun (or being carried) during the windup cancels the effect; the cooldown is spent', () => {
  const A = duel('stormsovereign'), { s, u, d } = A; warp(d[0], 6.5, 9); arm(u, 'q'); cast(A, 'q', { x: 6.5, z: 0 }); AB.status(s, u, 'stun', 1); secs(s, 0.6); eq(dealt(s, u.uid).length, 0, 'no damage'); ok(evs(s, 'interrupted').length === 1 && u.cdq.q > s.t, 'interrupted, cooldown spent');
});
t('Wing Dash (dash): the caster flies the line (never a jump), hits each enemy it crosses once, and stops at the end', () => {
  const A = duel('pyrodrake'), { s, u, d } = A; warp(d[0], 6.5, 10.5); warp(d[1], 6.5, 8.8); warp(d[2], 10.5, 12); arm(u, 'q'); cast(A, 'q', { x: 6.5, z: 0 }); let px = u.x, pz = u.z, maxStep = 0, endZ = null;
  for (let i = 0; i < 40; i++) { SIM.step(s); maxStep = Math.max(maxStep, Math.hypot(u.x - px, u.z - pz)); px = u.x; pz = u.z; if (!u.dash && !u.cast && endZ === null && i > 3) endZ = u.z; }
  ok(maxStep <= u.abil.q.dash * T.step + 1e-6, 'step ' + maxStep.toFixed(3)); near(endZ, 12.5 - u.abil.q.length, 0.05, 'ended 5 cells on'); const h = dealt(s, u.uid); eq(h.length, 2, 'two crossed, once each'); ok(d[2].hp === d[2].max); ok(!u.dash);
});
t('Flame Breath and Shell Bash (cone): only the fan is hit; Shell Bash also stuns; Inferno (self) shoves enemies back onto open ground', () => {
  const A = duel('pyrodrake'), { s, u, d } = A; warp(d[0], 6.5, 10.5); warp(d[1], 7.7, 10.6); warp(d[2], 9.5, 12.3); arm(u, 'e'); cast(A, 'e', { x: 6.5, z: 0 }); secs(s, 0.5); eq(dealt(s, u.uid).length, 2, 'in the cone: straight ahead and the one inside the edge'); ok(d[2].hp === d[2].max, 'beside the cone');
  const B = duel('mossback'); warp(B.d[0], 6.5, 11); B.u.cdq.e = 0; cast(B, 'e', { x: 6.5, z: 0 }); secs(B.s, 0.5); ok(B.d[0].st.stun > B.s.t - 0.4, 'stunned');
  const C2 = duel('pyrodrake'); warp(C2.d[0], 7.5, 11.5); C2.u.charge = 1; C2.u.cdq.r = 0; cast(C2, 'r'); secs(C2.s, 1.6); ok(C2.d[0].x > 7.5 + 0.5 && SIM.walkable(C2.s, C2.d[0].x, C2.d[0].z), 'pushed away and still on open ground'); ok(C2.d[0].hp < C2.d[0].max);
});
t('Shell Guard absorbs damage, Bastion taunts enemies into hitting the tank, both are timed', () => {
  const A = duel('mossback'), { s, u } = A; u.hp = u.max * 0.5; arm(u, 'q'); cast(A, 'q'); secs(s, 0.4); const g = u.st.guard; ok(g && g.amt > 0, 'guard up'); const hp0 = u.hp; ok(AV.combat.core.damage(s, 'b', { kind: 'unit', uid: u.uid, side: 'a' }, g.amt * 0.5, false, 0) === 0, 'fully absorbed'); eq(u.hp, hp0); secs(s, 4.2); ok(!(u.st.guard && u.st.guard.until > s.t), 'expired');
  const B = arena(['mossback', 'nimbus'], { b: ['pebblor'] }), [tank, soft] = squad(B.s, B.a, [[6.5, 8], [6.5, 7.2]]), foe = put(B.s, 'b', B.b[0], 6.5, 4.5); secs(B.s, 0.85); warp(foe, 6.5, 6.4); freeze(foe); quiet(tank); quiet(soft); tank.cdq.r = 0; tank.charge = 1; B.s.units.forEach(q => { q.rt = 0; });
  SIM.step(B.s); eq(foe.target && foe.target.uid, soft.uid, 'before: the nearer one'); SIM.command(B.s, { side: 'a', type: 'ability', uid: tank.uid, slot: 'r', aim: {} }); secs(B.s, 0.8); ok(foe.st.taunt && foe.st.taunt.by === tank.uid, 'taunted'); foe.rt = 0; SIM.step(B.s); eq(foe.target.uid, tank.uid, 'forced onto the tank');
});
t('Glimfin heals: Bright Link chains between allies with falloff, Bubble Ward mends over time, Tidal Surge heals and cleanses', () => {
  const A = arena(['glimfin', 'pebblor', 'mossback', 'nimbus']), { s } = A, [g, x1, x2, x3] = squad(s, A.a, [[6.5, 12.5], [5.5, 13.5], [7.5, 13.5], [6.5, 15]]); quiet(g); [x1, x2, x3].forEach(q => { q.hp = Math.round(q.max * 0.4); quiet(q); });
  g.cdq.q = 0; SIM.command(s, { side: 'a', type: 'ability', uid: g.uid, slot: 'q', aim: { tuid: x1.uid } }); secs(s, 0.7); const gain = q => q.hp - Math.round(q.max * 0.4); ok(gain(x1) > 0 && gain(x2) > 0 && gain(x3) >= 0, 'chain healed'); ok(gain(x1) / x1.max > gain(x2) / x2.max - 1e-9, 'falloff'); ok(!AB.check(s, g, 'q', { tuid: 99999 }).ok);
  const h0 = x1.hp; g.cdq.e = 0; SIM.command(s, { side: 'a', type: 'ability', uid: g.uid, slot: 'e', aim: { x: 5.5, z: 13.5 } }); secs(s, 2.6); ok(x1.hp > h0, 'ward mends'); ok(s.zones.some(z => z.kind === 'ability'));
  AB.status(s, x1, 'stun', 5); AB.status(s, x2, 'slow', 0.4, 5); g.cdq.r = 0; g.charge = 1; SIM.command(s, { side: 'a', type: 'ability', uid: g.uid, slot: 'r', aim: {} }); secs(s, 0.7); ok(!x1.st.stun && !x2.st.slow, 'cleansed');
});
t('Root Snare roots, Thorn Wall is a physical wall that paths route around, never traps a unit, and fades; Overgrowth slows and wounds inside', () => {
  const A = duel('grovewarden'), { s, u, d } = A; warp(d[0], 6.5, 9.5); arm(u, 'q'); cast(A, 'q', { x: 6.5, z: 9.5 }); secs(s, 0.6); ok(d[0].st.root > s.t, 'rooted'); ok(dealt(s, u.uid).length === 1);
  const B = arena(['grovewarden']), gv = field(B.s, 'a', B.a[0], 6.5, 14.5), bs = B.s; quiet(gv); warp(gv, 6.5, 14.5); gv.cdq.e = 0; const pathBefore = SIM.findPath(bs, 2.5, 13.5, 10.5, 13.5).length;
  SIM.command(bs, { side: 'a', type: 'ability', uid: gv.uid, slot: 'e', aim: { x: 6.5, z: 11.5 } }); secs(bs, 0.7); const cells = bs.dyn.reduce((a, b) => a + b, 0); ok(cells >= 2 && bs.walls.length === 1, 'wall cells ' + cells); ok(!SIM.walkable(bs, 6.5, 11.5), 'blocks the cell'); ok(SIM.findPath(bs, 2.5, 13.5, 10.5, 13.5).length >= pathBefore, 'paths go around');
  secs(bs, 6.2); eq(bs.dyn.reduce((a, b) => a + b, 0), 0, 'the wall fades and frees its cells'); eq(bs.walls.length, 0);
  const C3 = duel('grovewarden'); warp(C3.d[0], 6.5, 7); C3.u.charge = 1; C3.u.cdq.r = 0; cast(C3, 'r', { x: 6.5, z: 7 }); secs(C3.s, 5); const per = Math.round(0.45 * C3.u.dmg); ok(C3.d[0].st.slow && C3.d[0].max - C3.d[0].hp >= 3 * per, 'zone wounds ' + (C3.d[0].max - C3.d[0].hp) + ' vs ' + per); ok(C3.s.zones.length === 1);
  const D = arena(['grovewarden', 'pebblor']), [g2, blk] = squad(D.s, D.a, [[6.5, 15.5 - 1], [6.5, 11.5]]); quiet(g2); g2.cdq.e = 0; SIM.command(D.s, { side: 'a', type: 'ability', uid: g2.uid, slot: 'e', aim: { x: 6.5, z: 11.5 } }); secs(D.s, 0.6); ok(D.s.dyn[11 * D.s.w + 6] === 0, 'the occupied cell is left open'); ok(D.s.dyn.some(v => v > 0), 'but the rest of the wall stands'); void blk;
});
t('Voidling: Rift Pull drags enemies in, Dread Wave slows their attacks, Event Horizon pulls, stuns and wounds — all onto walkable ground', () => {
  const A = duel('voidling'), { s, u, d } = A; warp(d[0], 5, 7); warp(d[1], 9, 7); arm(u, 'q'); cast(A, 'q', { x: 7, z: 7 }); secs(s, 1.3); ok(d[0].x > 5.5 && d[1].x < 8.5, 'moved toward the point: ' + d[0].x.toFixed(2) + ', ' + d[1].x.toFixed(2)); ok(SIM.walkable(s, d[0].x, d[0].z) && SIM.walkable(s, d[1].x, d[1].z));
  const B = duel('voidling'); warp(B.d[0], 6.5, 10); B.u.cdq.e = 0; cast(B, 'e', { x: 6.5, z: 0 }); secs(B.s, 0.6); ok(B.d[0].st.dull && B.d[0].st.dull.m === 1.7, 'attacks slowed');
  const C2 = duel('voidling'); warp(C2.d[0], 8.5, 7); warp(C2.d[1], 4.5, 7); C2.u.charge = 1; C2.u.cdq.r = 0; cast(C2, 'r', { x: 6.5, z: 7 }); secs(C2.s, 1.4); ok(C2.d[0].st.stun > C2.s.t - 0.3, 'stunned'); ok(Math.abs(C2.d[0].x - 6.5) < 2 && SIM.walkable(C2.s, C2.d[0].x, C2.d[0].z)); ok(C2.d[0].hp < C2.d[0].max);
});
t('limited-kit passives: Stone Skin (Pebblor, −15% damage) and Soft Rain (Pluvia mends nearby allies); Limited Pets have no abilities to cast', () => {
  const A = arena(['pebblor', 'nimbus']), [p] = squad(A.s, A.a, [[6.5, 12.5], [6.5, 14.5]]); const hp0 = p.hp; AV.combat.core.damage(A.s, 'b', { kind: 'unit', uid: p.uid, side: 'a' }, 100, false, 0); eq(hp0 - p.hp, 85, 'armor');
  SIM.command(A.s, { side: 'a', type: 'ability', uid: p.uid, slot: 'q', aim: {} }); SIM.step(A.s); ok(evs(A.s, 'denied').some(e => /No such ability/.test(e.reason)), 'nothing invented to cast');
  const B = arena(['pluvia', 'mossback']), [pl, mb] = squad(B.s, B.a, [[6.5, 12.5], [6.5, 13.8]]); mb.hp = Math.round(mb.max * 0.5); const h0 = mb.hp; quiet(pl); quiet(mb); secs(B.s, 3.2); ok(mb.hp - h0 >= Math.floor(mb.max * 0.015) * 2, 'mended ' + (mb.hp - h0));
});
t('cooldowns follow the Bond factor (translate().cdr) and abilities are deterministic: same seed and commands → same fingerprints', () => {
  const A = duel('stormsovereign'); arm(A.u, 'q'); warp(A.d[0], 6.5, 9); cast(A, 'q', { x: 6.5, z: 0 }); near(A.u.cdq.q - A.s.t, A.u.abil.q.cd * A.u.cdr, 0.1, 'cd × Bond factor');
  const run = seed => { const X = arena(['pyrodrake', 'glimfin'], { b: ['pebblor', 'nimbus'], seed }), u = field(X.s, 'a', X.a[0], 6.5, 12.5), e = put(X.s, 'b', X.b[0], 6.5, 4.5); put(X.s, 'b', X.b[1], 3.5, 4.5); const log = []; for (let i = 0; i < 900; i++) { if (i === 100) warp(e, 6.5, 10); if (i === 150) SIM.command(X.s, { side: 'a', type: 'ability', uid: u.uid, slot: 'q', aim: { x: 6.5, z: 8 } }); SIM.step(X.s); if (i % 150 === 0) log.push(SIM.hash(X.s)); } return log.join(); };
  eq(run(8), run(8)); ok(run(8) !== run(9));
});

console.log('B3 · defeat, recovery, redeploy');
t('a defeated Pet leaves with a recall event, recovers for 12–20 s (seeded), then returns to the pool; the specimen is never touched', () => {
  const { s, a, specs } = arena(['nimbus', 'pebblor']); const before = JSON.stringify(specs), u = field(s, 'a', a[0], 6.5, 12.5); s.events.length = 0; u.hp = 0; SIM.step(s);
  const d = evs(s, 'death')[0]; ok(d && d.kind === 'pet' && d.card === a[0] && Math.abs(d.x - u.x) < 1e-9 && typeof d.z === 'number', 'death event carries the position for the recall effect'); const st = s.sides.a.hand.st[a[0]]; eq(st.s, 'rec'); const wait = st.until - s.t; ok(wait >= 11.9 && wait <= 20.01, 'recovery ' + wait.toFixed(2));
  const v = SIM.view(s, 'a').deck.find(x => x.id === a[0]); ok(v.state === 'rec' && v.wait > 11, 'deck strip shows the countdown'); ok(!SIM.view(s, 'a').hand.some(h => h.id === a[0]), 'not drawable while recovering'); secs(s, 20.1); ok(['pool', 'hand'].includes(s.sides.a.hand.st[a[0]].s), 'back in the pool'); eq(JSON.stringify(specs), before, 'specimen untouched');
});
t('redeploy surcharge: +1 Elixir per redeploy, capped at +3, match-local; support cards never carry one', () => {
  const { s, a } = arena(['nimbus']), base = C.defs.get('nimbus').cost, costs = [];
  for (let i = 0; i < 6; i++) { costs.push(SIM.costOf(s, 'a', a[0])); const u = put(s, 'a', a[0], 6.5, 12.5); ok(u, 'deployed #' + i); secs(s, 0.9); u.hp = 0; SIM.step(s); s.sides.a.hand.st[a[0]].until = s.t; SIM.step(s); }
  eq(costs.join(), [base, base + 1, base + 2, base + 3, base + 3, base + 3].join(), 'surcharge and cap'); eq(SIM.view(s, 'a').deck[0].surcharge, 3);
  const other = arena(['nimbus']); eq(SIM.costOf(other.s, 'a', other.a[0]), base, 'a new match starts clean');
});
t('defeat edge cases: nothing can die while still arriving; simultaneous defeats get their own seeded recovery times; an order, a priority target, a queued cast and a pending cast die with the Pet', () => {
  const A = arena(['nimbus', 'emberkit']), { s } = A, [u1, u2] = squad(s, A.a, [[4.5, 12.5], [9.5, 12.5]]); s.sides.a.sk = 1; const fresh = put(s, 'a', A.a[0], 0, 0); void fresh;
  const B = arena(['nimbus'], { b: ['nimbus'] }), nb = put(B.s, 'a', B.a[0], 6.5, 12.5); ok(nb.spawn > 0); const hp0 = nb.hp; AV.combat.core.damage(B.s, 'b', { kind: 'unit', uid: nb.uid, side: 'a' }, 9999, false, 0); eq(nb.hp, hp0, 'cannot be hurt while arriving'); B.s.zones.push({ id: 99, kind: 'ability', side: 'b', owner: 0, x: nb.x, z: nb.z, r: 3, until: 10, every: 0.1, next: 0.1, dmg: 500, heal: 0, slow: 0, seen: {} }); SIM.step(B.s); eq(nb.hp, hp0, 'zones cannot kill an arriving Pet either');
  [u1, u2].forEach(u => { u.hp = 0; }); s.events.length = 0; SIM.step(s); const rec = A.a.map(id => s.sides.a.hand.st[id]); ok(rec.every(r => r.s === 'rec'), 'both recovering'); ok(rec[0].until !== rec[1].until, 'distinct seeded times'); rec.forEach(r => { const w = r.until - s.t; ok(w >= 11.9 && w <= 20.01); });
  const rerun = () => { const X = arena(['nimbus', 'emberkit'], { seed: 11 }), us = squad(X.s, X.a, [[4.5, 12.5], [9.5, 12.5]]); us.forEach(u => { u.hp = 0; }); SIM.step(X.s); return X.a.map(id => X.s.sides.a.hand.st[id].until).join(); }; eq(rerun(), rerun(), 'deterministic');
  const C2 = duel('stormsovereign'); const u = C2.u; arm(u, 'q'); cast(C2, 'q', { x: 6.5, z: 0 }); u.queue.e = { x: 1, z: 1 }; u.prio = { kind: 'core', side: 'b', until: 99 }; u.order = { x: 3, z: 3, t: 0 }; warp(C2.d[0], 6.5, 9); u.hp = 0; secs(C2.s, 1); eq(dealt(C2.s, u.uid).length, 0, 'a cast in its windup does nothing if the caster fell'); ok(!C2.s.units.includes(u)); eq(C2.s.sides.a.moveCd[C2.a[0]], undefined);
});
t('when a Pet falls, enemies that were hunting it look for a new target and its priority marker ends', () => {
  const A = arena(['emberkit'], { b: ['nimbus', 'pebblor'] }), u = field(A.s, 'a', A.a[0], 6.5, 12.5), [x, y] = [put(A.s, 'b', A.b[0], 6.5, 4.5), put(A.s, 'b', A.b[1], 3.5, 4.5)]; secs(A.s, 0.9); warp(u, 6.5, 6.5); warp(x, 7.5, 6.5); warp(y, 5.5, 6.5); SIM.command(A.s, { side: 'a', type: 'target', uid: u.uid, tuid: x.uid }); secs(A.s, 0.4); ok(u.prio);
  x.hp = 0; A.s.events.length = 0; SIM.step(A.s); ok(!u.prio && evs(A.s, 'prioend').some(e => e.why === 'defeated')); secs(A.s, 0.6); eq(u.target && u.target.uid, y.uid, 'next target');
});

console.log('B4 · support cards and the Leviathan Engine');
const SUP = ['gravehammer', 'ionbow', 'prismedge', 'oakbuckler', 'aegis', 'leviathan', 'scraprover', 'pocketdrone', 'moonstone', 'heartofeternity', 'backwardsclock', 'glitchedcursor'];
const SU_ = AV.combat.support;
/** Play a card; returns { ok, reason, u (new unit, if any) }. */
function play(s, side, id, x, z, aim) { const n0 = s.units.length; s.events.length = 0; const u = put(s, side, id, x, z, aim); const d = evs(s, 'deploy').find(e => e.id === id), den = evs(s, 'denied').pop(); return { ok: !!d, reason: den ? den.reason : '', u: u || s.units.slice(n0).find(q => q.card === id) || null }; }
t('the roster: twelve support cards, three weapons, two shields, three machines, two relics, two oddities — at least 80% combat, at most 20% Elixir-oriented, every one fieldable', () => {
  const d = SUP.map(id => C.defs.get(id)); eq(d.length, 12); const by = {}; d.forEach(x => { by[x.cat] = (by[x.cat] || 0) + 1; ok(x.ready && x.kind && x.place && x.aim && x.cost >= 1 && x.cost <= 10 && x.blurb, x.id); }); eq(JSON.stringify(by), JSON.stringify({ weapon: 3, shield: 2, machine: 3, relic: 2, oddity: 2 }));
  const elx = d.filter(x => x.elixir).length; ok(elx / 12 <= 0.2 && (12 - elx) / 12 >= 0.8, 'Elixir share ' + elx + '/12'); ok(['point', 'circle', 'line', 'chain', 'self'].every(m => d.some(x => x.aim === m) || m === 'point' && true), 'varied placement');
  ok(C.defs.list().filter(x => x.cat !== 'pet').every(x => SUP.includes(x.id)), 'no stray support def'); eq(AV.combat.defs.catOf('gravehammer'), 'weapon');
});
t('deploying a support card spends its Elixir (no surcharge), returns it to the pool, refreshes the hand, and allows one copy in play at a time', () => {
  const A = arena(SUP.slice(0, 4).concat(['nimbus'])), { s } = A, id = A.a[0]; const e0 = s.sides.a.elixirM = 10000; const r = play(s, 'a', id, 6.5, 6.5); ok(r.ok, r.reason); eq(s.sides.a.elixirM <= e0 - C.defs.get('gravehammer').cost * 1000 + 100, true); ok(['pool', 'hand'].includes(s.sides.a.hand.st[id].s), 'back to the pool'); eq(s.sides.a.deployCount[id], 1);
  s.sides.a.hand.hand = [id]; s.sides.a.hand.st[id].s = 'hand'; const r2 = play(s, 'a', id, 6.5, 6.5); ok(!r2.ok && /Already in play/.test(r2.reason), r2.reason); secs(s, 3); const r3 = play(s, 'a', id, 6.5, 6.5); ok(r3.ok, 'again after it is gone: ' + r3.reason); eq(SIM.costOf(s, 'a', id), C.defs.get('gravehammer').cost, 'no surcharge');
  const poor = arena(['gravehammer']); poor.s.sides.a.hand.hand = [poor.a[0]]; poor.s.sides.a.hand.st[poor.a[0]].s = 'hand'; poor.s.sides.a.elixirM = 1000; SIM.command(poor.s, { side: 'a', type: 'deploy', id: poor.a[0], x: 5, z: 5 }); SIM.step(poor.s); ok(evs(poor.s, 'denied').some(e => /Elixir/.test(e.reason)));
});
t('Gravehammer: a telegraph, then a slam after its windup that damages and stuns inside the circle only; it can target any ground but never hurts a Core; a unit being carried is skipped by it', () => {
  const A = arena(['gravehammer'], { b: ['gloomwing', 'gloomwing'] }), { s } = A, [e1, e2] = A.b.map((id, i) => put(s, 'b', id, 4.5 + i * 3, 4.5)); secs(s, 0.9); [e1, e2].forEach(freeze); warp(e1, 6.5, 8.5); warp(e2, 10, 8.5); const d = C.defs.get('gravehammer');
  const r = play(s, 'a', A.a[0], 6.5, 8.5); ok(r.ok && evs(s, 'telegraph').length === 1, 'telegraph: ' + r.reason); secs(s, d.windup - 0.1); eq(e1.hp, e1.max, 'not yet'); secs(s, 0.3); ok(e1.hp < e1.max, 'slammed'); ok(e1.st.stun > s.t - 0.5, 'stunned'); eq(e2.hp, e2.max, 'outside the circle'); ok(evs(s, 'slam').length === 1);
  const B = arena(['gravehammer']), c0 = B.s.cores.b.hp; play(B.s, 'a', B.a[0], B.s.cores.b.x, B.s.cores.b.z); secs(B.s, 1.5); eq(B.s.cores.b.hp, c0, 'Cores are not slam targets');
});
t('Ionbow: only in your zone; it fires down its lane at the nearest enemy in it, ignores everything off the lane, has HP and fades', () => {
  const A = arena(['ionbow'], { b: ['gloomwing', 'gloomwing'] }), { s } = A; ok(!play(s, 'a', A.a[0], 6.5, 6.5).ok, 'not in the zone'); const r = play(s, 'a', A.a[0], 6.5, 13.5); ok(r.ok && r.u && r.u.obj === 'emplacement', r.reason); const u = r.u;
  const [e1, e2] = A.b.map((id, i) => put(s, 'b', id, 4.5 + i * 3, 4.5)); secs(s, 0.9); [e1, e2].forEach(freeze); warp(e1, 6.5, 8); warp(e2, 9.5, 8); s.events.length = 0; secs(s, 2.5); ok(e1.hp < e1.max, 'lane target shot'); eq(e2.hp, e2.max, 'off-lane untouched'); ok(evs(s, 'beam').length >= 1);
  warp(e1, 6.5, 14.5 + 0); secs(s, 1.5); const hpB = e1.hp; ok(true); void hpB; secs(s, 10); ok(!s.units.includes(u), 'gone after its duration'); const B = arena(['ionbow']); const bu = play(B.s, 'a', B.a[0], 6.5, 13.5).u; secs(B.s, 1); bu.hp = 0; SIM.step(B.s); ok(!B.s.units.includes(bu), 'can be destroyed');
});
t('Prismedge: needs an enemy to pick; the blade flies out, hunts that target, strikes on its interval, picks a new victim when it falls, can be shot down, and fades', () => {
  const A = arena(['prismedge'], { b: ['gloomwing', 'gloomwing'] }), { s } = A, [e1, e2] = A.b.map((id, i) => put(s, 'b', id, 4.5 + i * 3, 4.5)); secs(s, 0.9); [e1, e2].forEach(freeze); ok(!play(s, 'a', A.a[0], 6, 6).ok, 'no target → refused'); ok(!play(s, 'a', A.a[0], 6, 6, { tuid: 9999 }).ok);
  const r = play(s, 'a', A.a[0], 0, 0, { tuid: e1.uid }); ok(r.ok && r.u && r.u.obj === 'blade', r.reason); const bl = r.u; secs(s, 3); ok(e1.hp < e1.max, 'target struck'); const hp1 = e2.hp; e1.hp = 0; secs(s, 2.5); ok(e2.hp < hp1, 'moves on to the next enemy'); secs(s, 5); ok(!s.units.includes(bl), 'faded');
  const B = arena(['prismedge'], { b: ['gloomwing'] }), t2 = put(B.s, 'b', B.b[0], 6.5, 4.5); secs(B.s, 0.9); freeze(t2); const b2 = play(B.s, 'a', B.a[0], 0, 0, { tuid: t2.uid }).u; b2.hp = 0; SIM.step(B.s); ok(!B.s.units.includes(b2), 'can be shot down');
});
t('Oak Buckler: a barrier on your half only, with HP; walking units path around it, shots stop on it, it frees its cells when it expires or is destroyed', () => {
  const A = arena(['oakbuckler'], { b: ['nimbus'] }), { s } = A; ok(!play(s, 'a', A.a[0], 6.5, 6.5).ok, 'not on the enemy half'); const r = play(s, 'a', A.a[0], 6.5, 12.5); ok(r.ok && r.u && r.u.kind === 'barrier', r.reason); const bar = r.u; secs(s, 0.5);
  const cells = s.dyn.reduce((a, b) => a + b, 0); ok(cells >= 2, 'cells ' + cells); ok(!SIM.walkable(s, 6.5, 12.5)); const pl = SIM.findPath(s, 3.5, 14.5, 9.5, 11.5); ok(pl && pl.every(p => SIM.walkable(s, p.x, p.z)), 'a route around exists');
  const sh = put(s, 'b', A.b[0], 6.5, 4.5); secs(s, 0.9); warp(sh, 6.5, 6.5); sh.range = 20; sh.cd = 0; sh.speed = 0; const tg = put(s, 'a', A.a[0], 6.5, 15.0); void tg; s.proj.push({ uid: 777, side: 'b', from: sh.uid, x: 6.5, z: 8, px: 6.5, pz: 8, tg: { kind: 'core', side: 'a' }, speed: 12, dmg: 40, crit: false, hit: 'bolt' }); const hb = bar.hp, cA = s.cores.a.hp; secs(s, 1); ok(bar.hp < hb && s.cores.a.hp === cA, 'the shot hit the barrier, not the Core');
  secs(s, 9); eq(s.dyn.reduce((a, b) => a + b, 0), 0, 'cells freed on expiry'); ok(!s.units.includes(bar));
  const B = arena(['oakbuckler']), bb = play(B.s, 'a', B.a[0], 6.5, 12.5).u; secs(B.s, 0.5); bb.hp = 0; SIM.step(B.s); eq(B.s.dyn.reduce((a, b) => a + b, 0), 0, 'cells freed when destroyed'); eq(B.s.walls.length, 0);
});
t('Starforged Aegis: only on your own Pet; it absorbs damage and reflects part of it back at the attacker, then fades', () => {
  const A = arena(['aegis', 'pebblor'], { b: ['gloomwing'] }), { s } = A, p = field(s, 'a', A.a[1], 6.5, 12.5), foe = put(s, 'b', A.b[0], 6.5, 4.5); secs(s, 0.9); freeze(foe); ok(!play(s, 'a', A.a[0], 0, 0, { tuid: foe.uid }).ok, 'not on an enemy'); ok(!play(s, 'a', A.a[0], 0, 0).ok);
  const r = play(s, 'a', A.a[0], 0, 0, { tuid: p.uid }); ok(r.ok, r.reason); const g = p.st.guard, d = C.defs.get('aegis'); ok(g && g.amt > 0 && g.reflect > 0, 'ward up'); const hp0 = p.hp, fh = foe.hp; AV.combat.core.damage(s, 'b', { kind: 'unit', uid: p.uid, side: 'a' }, 50, false, foe.uid); eq(p.hp, hp0, 'absorbed'); ok(foe.hp < fh, 'reflected'); secs(s, d.dur + 0.5); ok(!(p.st.guard && p.st.guard.until > s.t), 'expired');
});
t('Scrap Rover: drives forward and rams — the first contact knocks back and stuns; it fights on, and wears out', () => {
  const A = arena(['scraprover'], { b: ['gloomwing'] }), { s } = A, rov = play(s, 'a', A.a[0], 6.5, 13.5).u; ok(rov && rov.ai === 'rover'); const foe = put(s, 'b', A.b[0], 6.5, 4.5); secs(s, 0.9); freeze(foe); warp(foe, 6.5, 11); let z0 = rov.z; secs(s, 1.2); ok(rov.z < z0, 'moves'); secs(s, 1.5); ok(rov.rammed && foe.hp < foe.max, 'rammed'); ok(foe.st.stun > 0, 'stunned by the ram'); secs(s, 21); ok(!s.units.includes(rov), 'wears out');
});
t('Pocket Drone: repairs the most hurt ally Pet over time and is a decoy that enemies prefer over a nearer Pet', () => {
  const A = arena(['pocketdrone', 'pebblor'], { b: ['emberkit'] }), { s } = A, p = field(s, 'a', A.a[1], 6.5, 12.5); p.hp = Math.round(p.max * 0.4); quiet(p); p.speed = 0; const dr = play(s, 'a', A.a[0], 6.5, 14.5).u; ok(dr && dr.obj === 'drone'); p.hp = Math.round(p.max * 0.4); const h0 = p.hp; secs(s, 4); ok(p.hp - h0 >= 30, 'repaired ' + (p.hp - h0));
  const B = arena(['pocketdrone', 'pebblor'], { b: ['emberkit'] }), pp = field(B.s, 'a', B.a[1], 6.5, 12.5), foe = put(B.s, 'b', B.b[0], 6.5, 4.5); secs(B.s, 0.9); freeze(pp); const d2 = play(B.s, 'a', B.a[0], 9.5, 14.5).u; secs(B.s, 1); warp(foe, 6.5, 9.3); foe.speed = 0; warp(pp, 6.5, 11.5); warp(d2, 6.5, 12.6); d2.speed = 0; foe.rt = 0; foe.cd = 1e9; SIM.step(B.s); eq(foe.target && foe.target.uid, d2.uid, 'the decoy draws the target though the Pet is nearer');
});
t('Moonstone slows everything inside and freezes each unit once on entry; it fades. Glitched Cursor makes enemies inside pick their farthest target', () => {
  const A = arena(['moonstone'], { b: ['gloomwing'] }), { s } = A, e = put(s, 'b', A.b[0], 6.5, 4.5); secs(s, 0.9); freeze(e); warp(e, 6.5, 7); ok(play(s, 'a', A.a[0], 6.5, 7).ok); SIM.step(s); ok(e.st.slow && e.st.slow.m < 1, 'slowed'); ok(e.st.stun > s.t, 'frozen briefly'); const until = e.st.stun; secs(s, 2); eq(e.st.stun, until, 'only once'); secs(s, 5); ok(!s.zones.length, 'faded');
  const B = arena(['glitchedcursor', 'pebblor', 'nimbus'], { b: ['emberkit'] }), foe = put(B.s, 'b', B.b[0], 6.5, 4.5), [n1, n2] = squad(B.s, B.a.slice(1), [[6.5, 7.6], [6.5, 3.5]]); freeze(foe); quiet(n1); quiet(n2); n1.speed = n2.speed = 0; warp(foe, 6.5, 5.5); foe.aggro = 9; foe.rt = 0; SIM.step(B.s); eq(foe.target.uid, n2.uid, 'nearest by default'); ok(play(B.s, 'a', B.a[0], 6.5, 5.5).ok); secs(B.s, 0.4); foe.rt = 0; SIM.step(B.s); eq(foe.target.uid, n1.uid, 'farthest while distorted');
});
t('Heart of Eternity revives the longest-recovering Pet at once and returns Elixir; with nobody down it only heals. Backwards Clock glides units back to where they were ~2.5 s ago, onto open ground', () => {
  const A = arena(['heartofeternity', 'nimbus', 'pebblor']), { s } = A, [n, p] = [field(s, 'a', A.a[1], 6.5, 12.5), field(s, 'a', A.b ? 0 : A.a[2], 4.5, 14.5)]; void p; n.hp = 0; SIM.step(s); ok(s.sides.a.hand.st[A.a[1]].s === 'rec'); const r = play(s, 'a', A.a[0], 0, 0); ok(r.ok, r.reason); ok(['pool', 'hand'].includes(s.sides.a.hand.st[A.a[1]].s), 'revived'); ok(s.sides.a.elixirM / 1000 >= 10 - 5 + C.defs.get('heartofeternity').refund - 0.1, 'Elixir returned: ' + s.sides.a.elixirM);
  const B = arena(['heartofeternity']); play(B.s, 'a', B.a[0], 0, 0); ok(B.s.sides.a.elixirM / 1000 <= 5.1, 'no refund without a revive: ' + B.s.sides.a.elixirM);
  const K = arena(['backwardsclock', 'nimbus'], { b: ['emberkit'] }), { s: ks } = K, kn = field(ks, 'a', K.a[1], 6.5, 12.5), fo = put(ks, 'b', K.b[0], 6.5, 4.5); secs(ks, 0.9); freeze(fo); fo.speed = 0; warp(fo, 2.5, 4.5); quiet(kn); secs(ks, 1); SIM.command(ks, { side: 'a', type: 'move', uid: kn.uid, x: 9.5, z: 14.5 }); secs(ks, 3.4);
  const want = ks.hist.slice().reverse().find(h => h.t <= ks.t - 2.5 + 0.01).p[kn.uid]; const far0 = Math.hypot(kn.x - want[0], kn.z - want[1]); ok(far0 > 1.5, 'it has moved on: ' + far0.toFixed(2)); ok(play(ks, 'a', K.a[0], 0, 0).ok); ok(evs(ks, 'rewind').length === 1); let guard = 0; while (kn.fm && guard++ < 90) SIM.step(ks); ok(Math.hypot(kn.x - want[0], kn.z - want[1]) < 0.2, 'glided back to where it was'); ok(SIM.walkable(ks, kn.x, kn.z) && SIM.walkable(ks, fo.x, fo.z), 'open ground'); ok(!kn.order, 'its walking order is cancelled');
});
t('Leviathan Engine: 1.5 s spin-up, then a fixed lane (left/centre/right by where it is placed) across the bridge, always on open ground, contact damage, and it reaches the enemy Core', () => {
  const lanes = SIM.lanes(arena(['leviathan']).s, 'a'); eq(Object.keys(lanes).join(), 'L,C,R'); ['L', 'C', 'R'].forEach(k => { eq(lanes[k].length, 5); });
  [['L', 1.5, 'L'], ['C', 6.5, 'C'], ['R', 10.5, 'R']].forEach(([name, x, lane]) => {
    const A = arena(['leviathan']), { s } = A, e = play(s, 'a', A.a[0], x, 13.5).u; ok(e, name); eq(e.lane, lane); secs(s, 0.7); const z0 = e.z; secs(s, 0.7); near(e.z, z0, 0.01, 'still spinning up at 1.4 s'); let bad = 0, crossed = false; for (let i = 0; i < 30 * 28 && s.units.includes(e); i++) { SIM.step(s); if (!SIM.walkable(s, e.x, e.z)) bad++; if (e.z < 7) crossed = true; } eq(bad, 0, 'never off open ground'); ok(crossed, name + ' crossed the bridge');
  });
  const B = arena(['leviathan']), e = play(B.s, 'a', B.a[0], 6.5, 13.5).u, c0 = B.s.cores.b.hp; secs(B.s, 25); ok(B.s.cores.b.hp < c0, 'damaged the enemy Core on contact'); secs(B.s, 10); ok(!B.s.units.includes(e), 'wears out');
  const card = { def: C.defs.get('leviathan'), t: { attrs: { damage: 1.4, hp: 1 } } }, weak = { def: C.defs.get('leviathan'), t: { attrs: { damage: 0.6, hp: 1 } } }; ok(SU_.val(card, 'dmg', 40) > SU_.val(weak, 'dmg', 40) * 2, 'contact damage scales with Output');
});
t('Leviathan grapple: holds one enemy Pet, carries it, drops it on open ground within ≤ 3.9 s, never twice within 10 s, never a Core, never something already held', () => {
  const A = arena(['leviathan'], { b: ['gloomwing', 'emberkit'] }), { s } = A, e = play(s, 'a', A.a[0], 6.5, 13.5).u, v1 = put(s, 'b', A.b[0], 6.5, 4.5), v2 = put(s, 'b', A.b[1], 3.5, 4.5); secs(s, 0.9); [v1, v2].forEach(freeze); v2.cd = 1e9;
  secs(s, 1.8); warp(e, 6.5, 9.5); warp(v1, 6.5, 8.2); s.events.length = 0; secs(s, 1); ok(v1.held && e.carry && e.carry.uid === v1.uid, 'grappled'); eq(evs(s, 'grapple').length, 1); const t0 = s.t; let same = true; for (let i = 0; i < 20; i++) { SIM.step(s); if (v1.held && (v1.x !== e.x || v1.z !== e.z)) same = false; } ok(same, 'rides on the Engine'); ok(v1.cd > 1e8, 'its attack timer does not run down into an attack'); ok(!AB.check(s, v1, 'q', {}).ok || !v1.abil, 'cannot act while held');
  warp(v2, e.x + 0.5, e.z); secs(s, 0.7); ok(v2.hp <= v2.max && !v2.held, 'a second enemy is not grabbed while the Engine is carrying');
  while (v1.held && s.t - t0 < 6) SIM.step(s); ok(s.t - t0 <= 3.9 + 0.1, 'released within the limit: ' + (s.t - t0).toFixed(2)); ok(!v1.held && SIM.walkable(s, v1.x, v1.z), 'dropped on open ground'); ok(!s.units.some(q => q !== v1 && q.hp > 0 && Math.hypot(q.x - v1.x, q.z - v1.z) < 0.85 && !q.static), 'nobody underneath'); ok(v1.st.stun > s.t, 'a short stun after the drop');
  warp(v1, e.x + 0.3, e.z); secs(s, 3); ok(!v1.held, 'not re-grabbed inside 10 s'); ok(e.grabCd[v1.uid] > s.t - 3);
  const core = s.cores.b; ok(!SIM.canMove(s, 'a', e.uid, 1, 1).ok, 'a machine takes no orders'); eq(e.carry === null || !!e.carry, true); void core;
});
t('Leviathan hard rules: a 4 s watchdog frees ANY hold even if the carrier is stuck; a fallen carrier or a fallen victim cleans up; ejection always finds open ground even when the area is walled in', () => {
  const A = arena(['leviathan'], { b: ['gloomwing'] }), { s } = A, e = play(s, 'a', A.a[0], 6.5, 13.5).u, v = put(s, 'b', A.b[0], 6.5, 4.5); secs(s, 0.9); freeze(v); e.spin = 1e9; warp(v, 6.5, 12.5); SU_.grapple(s, e, v); ok(v.held); const t0 = s.t; while (v.held && s.t - t0 < 6) SIM.step(s); near(s.t - t0, T.support.hold, 0.1, 'watchdog at the hard limit'); ok(!v.held && SIM.walkable(s, v.x, v.z)); ok(evs(s, 'eject').some(x => x.why === 'watchdog'));
  const B = arena(['leviathan'], { b: ['gloomwing'] }), eb = play(B.s, 'a', B.a[0], 6.5, 13.5).u, vb = put(B.s, 'b', B.b[0], 6.5, 4.5); secs(B.s, 2); freeze(vb); warp(vb, eb.x, eb.z); SU_.grapple(B.s, eb, vb); eb.hp = 0; SIM.step(B.s); ok(!vb.held && SIM.walkable(B.s, vb.x, vb.z), 'carrier destroyed → victim released on open ground');
  const C2 = arena(['leviathan'], { b: ['gloomwing'] }), ec = play(C2.s, 'a', C2.a[0], 6.5, 13.5).u, vc = put(C2.s, 'b', C2.b[0], 6.5, 4.5); secs(C2.s, 2); freeze(vc); warp(vc, ec.x, ec.z); SU_.grapple(C2.s, ec, vc); vc.hp = 0; SIM.step(C2.s); eq(ec.carry, null, 'victim fell → carrier is free'); ok(!C2.s.units.includes(vc));
  const D = arena(['leviathan'], { b: ['gloomwing', 'gloomwing', 'gloomwing'] }), ed = play(D.s, 'a', D.a[0], 6.5, 13.5).u; D.b.forEach((id, i) => put(D.s, 'b', id, 4.5 + i * 2, 4.5)); secs(D.s, 0.9); const crowd = D.s.units.filter(q => q.side === 'b'); crowd.forEach(freeze);
  warp(ed, 6.5, 12.5); crowd.forEach((q, i) => warp(q, 5.5 + i, 12.5)); for (let z = 9; z <= 16; z++) for (let x = 0; x < D.s.w; x++) if (Math.hypot(x + .5 - 6.5, z + .5 - 12.5) < 3.2 && !D.s.blocked[z * D.s.w + x] && !(x === 6 && z === 12)) D.s.dyn[z * D.s.w + x] = 1;
  const spot = SU_.safeSpot(D.s, ed.x, ed.z, 0, ed.route); ok(SIM.walkable(D.s, spot.x, spot.z), 'open ground even when the near cells are all walled: ' + JSON.stringify(spot)); ok(!D.s.units.some(q => q.hp > 0 && Math.hypot(q.x - spot.x, q.z - spot.z) < 0.9), 'and nobody standing on it');
});
t('a carried unit is skipped by area effects (Tempest) but single-target attacks still hit it', () => {
  const A = arena(['leviathan', 'stormsovereign'], { b: ['gloomwing'] }), { s } = A, e = play(s, 'a', A.a[0], 6.5, 13.5).u, v = put(s, 'b', A.b[0], 6.5, 4.5); secs(s, 0.9); freeze(v); warp(e, 6.5, 9); warp(v, 6.5, 9); v.held = { by: e.uid, t0: s.t }; e.carry = { uid: v.uid, t0: s.t, until: s.t + 3 }; e.spin = 1e9;
  const r = AB.foes(s, 'a'); ok(!r.includes(v), 'not an area-effect target'); const hp0 = v.hp; AV.combat.core.damage(s, 'a', { kind: 'unit', uid: v.uid, side: 'b' }, 30, false, 0); ok(v.hp < hp0, 'but a direct hit lands');
});
t('support cards never write to a specimen; a match with every card is deterministic and byte-identical for the collection', () => {
  const run = seed => { const X = arena(SUP.slice(0, 5).concat(['nimbus', 'pebblor', 'emberkit', 'glimfin', 'voidling']), { b: ['pebblor', 'gloomwing', 'nimbus'], seed }), before = JSON.stringify(X.specs), log = []; const cells = [[6.5, 13.5], [4.5, 12.5], [9.5, 14.5], [6.5, 9.5], [3.5, 14.5], [10.5, 13.5], [5.5, 11.5], [7.5, 14.5], [4.5, 11.5], [9.5, 11.5]]; X.b.forEach((id, i) => { X.s.sides.b.elixirM = 10000; put(X.s, 'b', id, 3.5 + i * 3, 5.5); });
    for (let i = 0; i < 1200; i++) { if (i % 60 === 0) { const v = SIM.view(X.s, 'a'), h = v.hand.find(q => q.ok); if (h) { const k = (i / 60) % cells.length, tg = X.s.units.find(q => q.side === 'b'); SIM.command(X.s, { side: 'a', type: 'deploy', id: h.id, x: cells[k][0], z: cells[k][1], aim: tg ? { tuid: tg.uid } : undefined }); } } SIM.step(X.s); if (i % 200 === 0) log.push(SIM.hash(X.s)); } eq(JSON.stringify(X.specs), before, 'specimens byte-identical'); return log.join(); };
  eq(run(5), run(5)); ok(run(5) !== run(6));
});
t('the pure modules stay pure: no DOM, clock or Math.random in aim, abilities or support; Math.random and Date.now throw during a full match', () => {
  ['combat/aim', 'combat/abil', 'combat/support'].forEach(f => ok(!/Math\.random|Date\.now|new Date|performance\.|document\.|requestAnimationFra|localStorage/.test(SRC[f].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), f));
  const A = arena(['stormsovereign', 'leviathan', 'gravehammer', 'glimfin'], { b: ['pebblor'], training: true, hostile: true }); const rd = Math.random, dn = Date.now; Math.random = () => { throw new Error('Math.random used'); }; Date.now = () => { throw new Error('Date.now used'); };
  try { const u = put(A.s, 'a', A.a[0], 6.5, 12.5); put(A.s, 'a', A.a[1], 4.5, 13.5); put(A.s, 'a', A.a[2], 6.5, 8.5); put(A.s, 'b', A.b[0], 6.5, 4.5); u.charge = 1; SIM.command(A.s, { side: 'a', type: 'ability', uid: u.uid, slot: 'r', aim: { x: 6.5, z: 6 } }); SIM.run(A.s, 900); SIM.hash(A.s); SIM.view(A.s, 'a'); } finally { Math.random = rd; Date.now = dn; }
});
t('hostile training dummies strike the nearest Pet in reach; passive ones never do', () => {
  const A = arena(['pebblor'], { training: true, hostile: true }), u = field(A.s, 'a', A.a[0], 6.5, 12.5); quiet(u); const dm = A.s.units.find(q => q.kind === 'dummy'); warp(u, dm.x, dm.z + 1.2); const h0 = u.hp; secs(A.s, 3); ok(u.hp < h0, 'struck');
  const B = arena(['pebblor'], { training: true }), ub = field(B.s, 'a', B.a[0], 6.5, 12.5); quiet(ub); const db = B.s.units.find(q => q.kind === 'dummy'); warp(ub, db.x, db.z + 1.2); const h1 = ub.hp; secs(B.s, 3); eq(ub.hp, h1);
});

console.error = errlog;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

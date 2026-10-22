/* Phase Four logic tests: container pools, cards, opening integrity, save v3 migration (and Fusion once it lands). Run: node tests/phase4.test.js
 * Same sandbox approach as the other suites: pure modules only, a fake localStorage. */
const vm = require('vm'), fs = require('fs'), path = require('path');
const store = {};
const ctx = { console, setTimeout, clearTimeout, Math, JSON, Date, localStorage: {
  getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const FILES = ['util', 'data', 'cards', 'progress', 'stats', 'state', 'specimen', 'fusion', 'engine', 'vaultq'];
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const AV = ctx.AV, D = AV.data, E = AV.engine, SP = AV.specimen, ST = AV.stats, PR = AV.progress, CD = AV.cards;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'eq') + `: expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const mk = (base, o) => SP.generate(base, Object.assign({ rng: AV.util.mulberry32(4242) }, o || {}));
const errlog = console.error; console.error = () => {};
const catsOf = id => { AV.state.reset('unlimited'); const out = new Set(); for (let i = 0; i < 400; i++) E.open(id, 1).results.forEach(r => out.add(SP.itemOf(r.spec).cat)); return out; };

console.log('Container pools');
t('Wanderer Pack awards Cards only (5 per pack, 5th Uncommon+), across 400 packs', () => {
  AV.state.reset('unlimited'); let n = 0;
  for (let i = 0; i < 400; i++) { const r = E.open('wanderer', 1).results; eq(r.length, 5); r.forEach(x => { ok(SP.itemOf(x.spec).cat === 'card', x.spec.base); n++; }); ok(r.some(x => SP.rarityTier(x.spec) >= 1), 'an Uncommon+ in every pack'); }
  eq(n, 2000);
});
t('pack cards are presented lowest → highest rarity', () => { AV.state.reset('unlimited'); for (let i = 0; i < 60; i++) { const r = E.open('wanderer', 1).results; for (let k = 1; k < r.length; k++) ok(SP.rarityTier(r[k].spec) >= SP.rarityTier(r[k - 1].spec), 'ascending'); } });
t('Hatchling awards ordinary juvenile pets only; Starlit only prestigious pets, Rare+ and potential ≥ 55', () => {
  const H = new Set(D.CONTAINER.hatchling.items), S = new Set(D.CONTAINER.starlit.items);
  AV.state.reset('unlimited');
  for (let i = 0; i < 300; i++) { const h = E.open('hatchling', 1).results[0].spec; ok(H.has(h.base) && SP.itemOf(h).cat === 'pet', h.base); const s = E.open('starlit', 1).results[0].spec; ok(S.has(s.base), s.base); ok(SP.rarityTier(s) >= 2 && s.potential >= 55, 'starlit quality'); }
  [...H].forEach(id => ok(!S.has(id), 'pools are distinct: ' + id));
});
t('Capsule → oddities, Forge → gear + machines, Relic Chest → relics only, Mythic Vault → mixed non-card', () => {
  eq([...catsOf('capsule')].join(), 'oddity'); ok([...catsOf('forge')].every(c => c === 'gear' || c === 'machine'));
  eq([...catsOf('reliquary')].join(), 'relic'); const v = catsOf('vault'); ok(!v.has('card') && v.size >= 4, [...v].join());
});
t('no item definition was deleted and every former Wanderer category still has a container', () => {
  ['rustblade', 'ionbow', 'bonecharm', 'moonstone', 'pocketdrone', 'leviathan', 'infinitesock', 'missingtexture'].forEach(id => ok(D.ITEMS[id], id));
  ['gear', 'relic', 'machine', 'oddity'].forEach(cat => ok(D.CONTAINERS.some(c => c.id !== 'wanderer' && E.poolItems(c).some(i => i.cat === cat)), cat));
});

console.log('Cards');
t('card catalogue: 3 sets, 64 cards, unique ids and numbers, every rarity represented', () => {
  eq(CD.SETS.length, 3); eq(CD.LIST.length, 64); eq(new Set(CD.LIST.map(i => i.id)).size, 64); eq(new Set(CD.LIST.map(i => CD.number(i))).size, 64);
  D.RARITIES.forEach(r => ok(CD.LIST.some(i => i.rarity === r.id), r.id));
  CD.LIST.forEach(i => { ok(CD.CLASSES[i.card.cls], i.id + ' class'); ok(i.lore.length > 30, i.id + ' text'); ok(PR.ARCH[i.id] && PR.ARCH[i.id].fam === 'card', i.id + ' arch'); eq(PR.formsFor(i.id).length, 2, i.id + ' premium forms'); });
});
t('a card depicting a specimen never grants that specimen', () => {
  AV.state.reset('unlimited'); for (let i = 0; i < 200; i++) E.open('wanderer', 1);
  ok(E.all().every(s => SP.itemOf(s).cat === 'card'), 'only cards in the vault'); ok(!AV.state.get().discovered.nimbit, 'Nimbit not discovered by its card');
});
t('card copies carry print traits; materials follow rarity; stats come from the Card family and include print traits', () => {
  const a = mk('cfla001', { card: { finish: 'matte', foil: 'none', edition: 'unlimited', alt: 0 } }), b = mk('cfla001', { card: { finish: 'etched', foil: 'spot', edition: 'proof', alt: 1 } });
  ok(a.card && a.card.finish === 'matte'); eq(a.size, 1, 'cards share one format'); eq(CD.material(SP.itemOf(a)).id, 'matte'); eq(CD.material(D.ITEMS.cdvl013).id, 'lumen'); eq(CD.material(D.ITEMS.clsx020).id, 'null');
  eq(ST.compute(a).fam, 'card'); ok(ST.compute(b).map.prestige > ST.compute(a).map.prestige, 'proof + alt art raise Prestige'); ok(ST.compute(b).map.depth > ST.compute(a).map.depth, 'etched + alt raise Depth');
  CD.LIST.forEach(i => { for (const cond of [0, 4]) ST.compute(mk(i.id, { condition: cond, level: 4, potential: 100 })).list.forEach(x => ok(x.value >= 1 && x.value <= 140 && Number.isInteger(x.value), i.id + ' ' + x.k)); });
});
t('card stats and print traits are deterministic and survive a JSON round trip', () => {
  const r1 = mk('clsx013'), r2 = SP.generate('clsx013', { rng: AV.util.mulberry32(4242) }); eq(JSON.stringify(r1.card), JSON.stringify(r2.card)); eq(JSON.stringify(ST.compute(r1).map), JSON.stringify(ST.compute(JSON.parse(JSON.stringify(r1))).map));
});
t('foil treatments respect the material hierarchy (Common never gets holographic foil)', () => {
  const r = AV.util.mulberry32(9); for (let i = 0; i < 2000; i++) { const c = CD.roll(D.ITEMS.cfla001, r); ok(['none', 'spot'].includes(c.foil), c.foil); }
  for (let i = 0; i < 500; i++) { const c = CD.roll(D.ITEMS.clsx020, r); eq(c.foil, 'nullfoil'); }
});
t('cards upgrade through card stages and take a premium form; the Living Print branch differs from the Archive Proof', () => {
  AV.state.reset('unlimited'); const sp = mk('cfla024', { potential: 80 }); E.addSpecimen(sp);
  for (let i = 0; i < 3; i++) ok(E.upgrade(sp.id).ok); eq(SP.stageName(sp), 'Encapsulated');
  const fs_ = PR.formsFor('cfla024'); ok(fs_[0].motifs[0] !== fs_[1].motifs[0] && fs_[0].tint !== fs_[1].tint && fs_[0].blurb !== fs_[1].blurb);
  ok(E.transform(sp.id, 'cfla024_living').ok); eq(sp.form, 'cfla024_living');
});

console.log('Opening integrity');
t('rewards are created and saved before any animation; the opening is recorded for reload recovery', () => {
  Object.keys(store).forEach(k => delete store[k]); AV.state.reset('standard'); AV.state.get().wallet.credits = 5000;
  const r = E.open('wanderer', 2); ok(r.ok); const saved = JSON.parse(store[AV.state.SAVE_KEY]);
  r.results.forEach(x => ok(saved.specimens[x.spec.id], 'saved ' + x.spec.id)); eq(saved.lastOpening.ids.length, 10); eq(saved.lastOpening.seen, false);
  const again = AV.state.load(); eq(Object.keys(again.specimens).length, 10, 'reload neither loses nor duplicates');
});

console.log('Save migration (v2 → v3)');
const v2save = () => { AV.state.reset('standard'); const s = AV.state.get(); ['nimbit', 'rustblade', 'moonstone', 'whisperjar', 'leviathan'].forEach((b, i) => { const sp = mk(b, { level: i % 3, potential: 40 + i * 10 }); E.addSpecimen(sp); }); s.pity = { wanderer: 17, hatchling: 22 }; s.settings.master = .33; s.wallet.gems = 321; const raw = JSON.parse(JSON.stringify(s)); raw.version = 2; ['org', 'fusions', 'fusionSeq', 'lastOpening', 'binder'].forEach(k => delete raw[k]); ['rouletteSpeed', 'clickVolume', 'cardHolo', 'holoReturn', 'multiOpen', 'fusionAnim', 'binderAnim'].forEach(k => delete raw.settings[k]); return raw; };
t('v2 save migrates to v3: identity, stats, pity, wallet and settings preserved; new structures and defaults added; backup written once', () => {
  Object.keys(store).forEach(k => delete store[k]); const raw = v2save(), text = JSON.stringify(raw); store[AV.state.SAVE_KEY] = text;
  const S1 = AV.state.load(), L = AV.state.lastLoad;
  eq(S1.version, 3); ok(L.p4.migrated, 'migrated'); eq(store[AV.state.BACKUP_KEY_P4], text, 'raw backup');
  Object.keys(raw.specimens).forEach(id => eq(AV.state.fingerprint(S1.specimens[id]), AV.state.fingerprint(raw.specimens[id]), id));
  Object.keys(raw.specimens).forEach(id => eq(JSON.stringify(S1.specimens[id].stats), JSON.stringify(raw.specimens[id].stats), id + ' stats'));
  eq(S1.pity.wanderer, 17); eq(S1.pity.hatchling, 22); eq(S1.wallet.gems, 321); eq(S1.settings.master, .33); eq(S1.settings.multiOpen, 'condensed'); eq(S1.settings.cardHolo, true);
  ok(Array.isArray(S1.org.searches) && Array.isArray(S1.org.folders) && Array.isArray(S1.fusions) && S1.fusionSeq === 0, 'new structures');
});
t('migration runs once: a second load does not migrate again and the backup is never overwritten', () => {
  const b = store[AV.state.BACKUP_KEY_P4]; AV.state.load(); ok(!AV.state.lastLoad.p4.migrated, 'not again'); eq(store[AV.state.BACKUP_KEY_P4], b);
});
t('migrating the same v2 file twice gives identical results (deterministic)', () => {
  const raw = v2save(); const a = JSON.parse(JSON.stringify(raw)), b = JSON.parse(JSON.stringify(raw)); AV.state.migrateP4(a); AV.state.migrateP4(b); eq(JSON.stringify(a), JSON.stringify(b));
});
t('migration failure keeps the backup and loads the original save (v2) instead of resetting', () => {
  Object.keys(store).forEach(k => delete store[k]); const raw = v2save(), text = JSON.stringify(raw); store[AV.state.SAVE_KEY] = text;
  AV.__faultP4 = true; const S2 = AV.state.load(); AV.__faultP4 = false;
  ok(AV.state.lastLoad.p4.failed, 'failure reported'); eq(S2.version, 2, 'stays v2 so the next load retries'); eq(store[AV.state.BACKUP_KEY_P4], text, 'backup kept');
  Object.keys(raw.specimens).forEach(id => eq(AV.state.fingerprint(S2.specimens[id]), AV.state.fingerprint(raw.specimens[id]), id)); eq(S2.wallet.gems, 321);
  const S3 = AV.state.load(); eq(S3.version, 3, 'next load migrates'); ok(AV.state.lastLoad.p4.migrated);
});
t('imported v2 files get the same v3 fields', () => {
  const raw = v2save(); const S3 = AV.state.importJSON(JSON.stringify(raw)); eq(S3.version, 3); ok(Array.isArray(S3.fusions) && S3.org && Array.isArray(S3.org.folders)); eq(Object.keys(S3.specimens).length, Object.keys(raw.specimens).length);
});

console.log('Fusion');
const FU = AV.fusion;
const add = (base, o) => { const sp = mk(base, Object.assign({ seed: (o && o.seed) || 77 }, o || {})); E.addSpecimen(sp); return sp; };
t('compatibility: duplicate, recipe, hybrid, infusion, oddity, composite cards; unrelated pairs and card/non-card are refused', () => {
  AV.state.reset('standard');
  eq(FU.compat(add('nimbit'), add('nimbit')).kind, 'duplicate'); eq(FU.compat(add('emberkit'), add('nimbit')).kind, 'recipe');
  eq(FU.compat(add('nimbus'), add('tempestral')).kind, 'hybrid'); eq(FU.compat(add('ionbow'), add('nimbus')).kind, 'infusion');
  eq(FU.compat(add('rustblade'), add('whisperjar')).kind, 'oddity'); eq(FU.compat(add('cfla001'), add('cfla005')).kind, 'composite');
  ok(!FU.compat(add('cfla001'), add('clsx001')).ok, 'cards of different sets'); ok(!FU.compat(add('cfla001'), add('nimbit')).ok, 'card + specimen');
  ok(!FU.compat(add('rustblade'), add('moonstone')).ok, 'unrelated (steel blade + night relic)');
});
t('preview matches the committed result exactly (traits, stats, mutation, name)', () => {
  AV.state.reset('standard'); const S = AV.state.get(); S.wallet.essence = 1e6; S.wallet.credits = 1e7;
  const a = add('nimbus', { seed: 11, potential: 60, condition: 2, variant: 'none' }), b = add('tempestral', { seed: 22, potential: 90, condition: 0, variant: 'golden' });
  const pv = E.fusePreview(a.id, [b.id]); ok(pv.ok, pv.reason); const r = E.fuse(a.id, [b.id]); ok(r.ok, r.err);
  const strip = x => { const o = JSON.parse(JSON.stringify(x)); delete o.id; delete o.history; delete o.prog; delete o.origin; if (o.fusion) { delete o.fusion.id; delete o.fusion.at; delete o.fusion.sim; } return JSON.stringify(o); };
  eq(strip(r.spec), strip(pv.result), 'same specimen'); eq(JSON.stringify(ST.compute(r.spec).map), JSON.stringify(pv.after), 'same stats');
});
t('duplicate fusion: rank rises, best condition kept, potential grows within limits, base identity unchanged; a mutation slot opens at Rank II', () => {
  AV.state.reset('standard'); const S = AV.state.get(); S.wallet.essence = 1e6; S.wallet.credits = 1e7;
  const a = add('rustblade', { seed: 1, potential: 50, condition: 3 }), b = add('rustblade', { seed: 2, potential: 70, condition: 1 }), c = add('rustblade', { seed: 3, potential: 40, condition: 2 });
  const r = E.fuse(a.id, [b.id, c.id]); ok(r.ok, r.err); const f = r.spec;
  eq(f.base, 'rustblade'); eq(f.serial, a.serial, 'primary serial kept'); eq(f.seed, a.seed); eq(f.fusion.rank, 2); eq(f.condition, 1); eq(f.potential, 78);
  ok(f.fusion.mutation, 'Rank II opens a mutation'); ok(FU.motifs(f).length >= 2, 'mutation adds geometry'); ok(ST.compute(f).map.power > ST.compute(a).map.power, 'stats rise');
  ok(!E.get(a.id) && !E.get(b.id) && !E.get(c.id), 'Standard consumes every input'); eq(E.all().length, 1);
});
t('locked, favorited and companion inputs are never consumed without being unlocked first', () => {
  AV.state.reset('standard'); const S = AV.state.get(); S.wallet.essence = 1e6; S.wallet.credits = 1e7;
  const a = add('pebblor'), b = add('pebblor'); b.locked = true; let r = E.fuse(a.id, [b.id]); ok(!r.ok && /locked/.test(r.err)); ok(E.get(a.id) && E.get(b.id));
  b.locked = false; a.favorite = true; r = E.fuse(a.id, [b.id]); ok(!r.ok && /favorited/.test(r.err)); a.favorite = false;
  S.companion = b.id; r = E.fuse(a.id, [b.id]); ok(!r.ok && /companion/.test(r.err)); S.companion = a.id;
  r = E.fuse(a.id, [b.id]); ok(r.ok, r.err); eq(S.companion, r.spec.id, 'a companion primary hands its role to the result');
});
t('parent history, fusion ledger and a fresh identifier are recorded; a safety backup is written first', () => {
  AV.state.reset('standard'); const S = AV.state.get(); S.wallet.essence = 1e6; S.wallet.credits = 1e7; delete store[AV.state.BACKUP_KEY_FUSION];
  const a = add('pyrodrake'), b = add('sunmane'); AV.specimen.addHistory(a, 'rename', 'Renamed to "Ash".'); const r = E.fuse(a.id, [b.id]); ok(r.ok, r.err);
  ok(/^FX-\d{4}$/.test(r.spec.fusion.id)); ok(r.spec.id !== a.id && r.spec.id !== b.id, 'new persistent id'); eq(r.spec.fusion.name, 'Solar Wyrmcub');
  ok(r.spec.history.some(h => /Ash/.test(h.text)) && r.spec.history.some(h => h.type === 'fuse'), 'ownership history carried + fusion entry');
  eq(r.spec.fusion.parents.length, 2); eq(S.fusions.length, 1); eq(S.fusions[0].parents[1].base, 'sunmane'); ok(store[AV.state.BACKUP_KEY_FUSION], 'backup written');
});
t('a failed commit rolls everything back (specimens, wallet, ledger)', () => {
  AV.state.reset('standard'); const S = AV.state.get(); S.wallet.essence = 99999; S.wallet.credits = 999999;
  const a = add('glimfin'), b = add('pluvia'); const before = JSON.stringify(AV.state.get());
  AV.__faultFusion = true; const r = E.fuse(a.id, [b.id]); AV.__faultFusion = false;
  ok(!r.ok && r.restored, 'reported'); eq(JSON.stringify(AV.state.get()), before, 'state identical to before');
});
t('mutations are deterministic and persist through save/reload; cached render keys round-trip', () => {
  AV.state.reset('standard'); const S = AV.state.get(); S.wallet.essence = 1e6; S.wallet.credits = 1e7;
  const a = add('gloomwing', { seed: 5 }), b = add('voidling', { seed: 6 }); const p1 = E.fusePreview(a.id, [b.id]), p2 = E.fusePreview(a.id, [b.id]);
  eq(JSON.stringify(p1.result), JSON.stringify(p2.result)); const r = E.fuse(a.id, [b.id]); ok(r.ok); AV.state.save(true);
  const L = AV.state.load(), back = L.specimens[r.spec.id]; ok(back && back.fusion.mutation.id === r.spec.fusion.mutation.id); eq(JSON.stringify(ST.compute(back).map), JSON.stringify(ST.compute(r.spec).map));
  const k = FU.renderKey(back), o = {}; FU.applyRenderKey(o, k); eq(o.fusion.mutation.id, back.fusion.mutation.id); eq(o.fusion.rank, back.fusion.rank);
});
t('Unlimited: fusion is free and non-destructive by default, can consume on request, and can be reversed', () => {
  AV.state.reset('unlimited'); const S = AV.state.get(); const a = add('oakbuckler'), b = add('rustblade'); const w = JSON.stringify(S.wallet);
  let r = E.fuse(a.id, [b.id]); ok(r.ok && r.sim); ok(E.get(a.id) && E.get(b.id), 'inputs kept'); eq(JSON.stringify(S.wallet), w, 'free'); eq(r.spec.fusion.name, 'Bulwark Blade');
  ok(E.unfuse(r.spec.id).ok); ok(!E.get(r.spec.id), 'reversed');
  r = E.fuse(a.id, [b.id], { consume: true }); ok(r.ok && !E.get(a.id), 'consumed on request'); const u = E.unfuse(r.spec.id); ok(u.ok && u.restored === 2 && E.get(a.id) && E.get(b.id), 'restored from the ledger');
  AV.state.get().mode = 'standard'; ok(!E.unfuse(a.id).ok, 'no reversal in Standard');
});
t('composite card fusion stays a card of the same set and can upgrade its foil', () => {
  AV.state.reset('unlimited'); const a = add('cfla001', { card: { finish: 'matte', foil: 'none', edition: 'unlimited', alt: 0 } }), b = add('cfla011', { card: { finish: 'satin', foil: 'spot', edition: 'first', alt: 1 } });
  const pv = E.fusePreview(a.id, [b.id]); ok(pv.ok, pv.reason); eq(pv.result.base, 'cfla001'); ok(pv.result.card, 'still a card'); eq(pv.kind, 'composite');
});

console.log('Vault');
const VQ = AV.vaultQ;
const ctxOf = () => { const S = AV.state.get(); return { now: Date.now(), companion: S.companion }; };
t('filters combine: AND across facets, OR within a facet; search reaches set, number, tags, notes, mutation and parents', () => {
  AV.state.reset('unlimited'); const S = AV.state.get();
  ['nimbit', 'nimbit', 'rustblade', 'moonstone'].forEach((b, i) => add(b, { seed: 100 + i, variant: i ? 'none' : 'foil', condition: i % 3 }));
  ['cfla001', 'cfla011', 'clsx004', 'cdvl013'].forEach((b, i) => add(b, { seed: 200 + i, card: { finish: 'satin', foil: i === 3 ? 'starfield' : 'none', edition: i === 1 ? 'first' : 'unlimited', alt: i === 2 ? 1 : 0 } }));
  const all = E.all(); E.setTags(all[2].id, ['heirloom', 'Desk Shelf']); E.setNote(all[3].id, 'Bought the night the lamps went out');
  let f = VQ.blank(), idx = VQ.index(S); const run = (q = '') => VQ.run(idx, f, q, 'newest', ctxOf());
  f.cat.add('pet'); eq(run().length, 2); f.cat.add('card'); eq(run().length, 6, 'OR within a facet'); f.rar.add('common'); ok(run().every(x => x.rar === 'common'), 'AND across facets');
  f = VQ.blank(); f.set.add('fla'); eq(run().length, 2); f.edition.add('first'); eq(run().length, 1); f = VQ.blank(); f.alt = 'alt'; eq(run().length, 1); f = VQ.blank(); f.dupes = true; eq(run().length, 2);
  f = VQ.blank(); f.number = [1, 5]; eq(run().length, 2, 'card number range');
  f = VQ.blank(); eq(run('heirloom').length, 1, 'tag search'); eq(run('desk-shelf').length, 1); eq(run('lamps went out').length, 1, 'note search'); eq(run('FLA 011').length, 1, 'card number search'); eq(run('lower stacks').length, 1, 'set name search');
  const r = E.fuse(all[0].id, [all[1].id]); ok(r.ok, r.err); idx = VQ.index(S); f = VQ.blank(); f.fusion = 'fused'; eq(run().length, 1); eq(run(r.spec.fusion.id.toLowerCase()).length, 1, 'fusion id search'); eq(run('nimbit ' + U4(all[1].serial)).length >= 1, true, 'parent serial search');
});
function U4(n) { return String(n).padStart(4, '0'); }
t('chips describe every active filter and remove individually; presets serialise and restore exactly', () => {
  const f = VQ.blank(); f.rar.add('rare'); f.rar.add('epic'); f.fav = true; f.potential = [50, null]; f.fusion = 'fused';
  const c = VQ.chips(f); eq(c.length, 5); VQ.removeChip(f, 'rar', 'rare'); eq(VQ.chips(f).length, 4);
  const back = VQ.deserialize(JSON.parse(JSON.stringify(VQ.serialize(f)))); eq(JSON.stringify(VQ.serialize(back)), JSON.stringify(VQ.serialize(f)));
});
t('saved searches, folders (multiple membership), tags and notes persist through save/reload and never touch identity', () => {
  AV.state.reset('standard'); const a = add('glimfin'), b = add('voidling'); const fp = AV.state.fingerprint(a);
  const f1 = E.folderCreate('Shelf of Night'), f2 = E.folderCreate('Water things'); E.folderAdd(f1.id, [a.id, b.id]); E.folderAdd(f2.id, [a.id]); E.setTags(a.id, ['#Lantern', 'lantern', 'deep sea']); E.setNote(b.id, 'eyes');
  const qs = E.searchSave({ name: 'Night pets', f: VQ.serialize(Object.assign(VQ.blank(), { cat: new Set(['pet']) })), q: 'void', sort: 'rarity' }); E.searchUpdate(qs.id, { fav: true });
  AV.state.save(true); const L = AV.state.load();
  eq(L.org.folders.length, 2); eq(L.org.folders[0].ids.length, 2); ok(L.org.folders[1].ids.includes(a.id), 'in two folders'); eq(JSON.stringify(L.org.tags[a.id]), JSON.stringify(['lantern', 'deep-sea'])); eq(L.org.notes[b.id], 'eyes');
  eq(L.org.searches[0].name, 'Night pets'); eq(L.org.searches[0].fav, true); eq(AV.state.fingerprint(L.specimens[a.id]), fp, 'identity untouched');
  E.dismantle([b.id]); ok(!AV.state.get().org.notes[b.id] && !AV.state.get().org.folders[0].ids.includes(b.id), 'pruned on dismantle');
});
t('large collections stay responsive: index 3000 specimens and run combined filters quickly', () => {
  AV.state.reset('unlimited'); const S = AV.state.get(), r = AV.util.mulberry32(9), bases = D.ITEM_LIST.map(i => i.id);
  for (let i = 0; i < 3000; i++) { const sp = SP.generate(bases[Math.floor(r() * bases.length)], { rng: AV.util.mulberry32(i + 1) }); sp.id = 's' + (S.nextId++); S.specimens[sp.id] = sp; }
  const t0 = Date.now(); const idx = VQ.index(S); const t1 = Date.now(); const f = VQ.blank(); f.cat.add('card'); f.rar.add('rare'); f.potential = [40, null];
  let n = 0; for (let k = 0; k < 20; k++) n = VQ.run(idx, f, k % 2 ? 'archive' : '', 'value', ctxOf()).length; const t2 = Date.now();
  ok(t1 - t0 < 2500, 'index ' + (t1 - t0) + ' ms'); ok((t2 - t1) / 20 < 60, 'filter+sort ' + ((t2 - t1) / 20).toFixed(1) + ' ms per run'); ok(n > 0);
  console.log(`       (3000 specimens: index ${t1 - t0} ms, filter+search+sort ${((t2 - t1) / 20).toFixed(1)} ms per run in Node)`);
});

console.error = errlog;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

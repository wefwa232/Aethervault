/* Phase Three logic tests: stats, progression, transformations, migration. Run: node tests/phase3.test.js
 * (Kept separate from logic.test.js so the Phase Two contracts stay readable. Same sandbox approach: pure modules only.) */
const vm = require('vm'), fs = require('fs'), path = require('path');
const store = {};
const ctx = { console, setTimeout, clearTimeout, Math, JSON, Date, localStorage: {
  getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util', 'data', 'cards', 'progress', 'stats', 'state', 'specimen', 'engine'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const AV = ctx.AV, D = AV.data, E = AV.engine, SP = AV.specimen, ST = AV.stats, PR = AV.progress;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'eq') + `: expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const mk = (base, o) => SP.generate(base, Object.assign({ rng: AV.util.mulberry32(1234) }, o || {}));
const errlog = console.error; console.error = () => {}; // expected failure paths log; keep the report readable

console.log('Stat framework');
t('every item has an archetype whose focus/weak stats exist in its family', () => {
  D.ITEM_LIST.forEach(i => { const a = PR.ARCH[i.id]; ok(a, i.id + ' arch'); const f = ST.FAMILIES[a.fam]; ok(f, i.id + ' family'); [...a.focus, a.weak].forEach(k => ok(f.byKey[k], i.id + ' stat ' + k)); eq(a.focus.length, 2); });
});
t('stat sets are category-appropriate: weapons, shields, pets, machines, relics, oddities each get their own', () => {
  eq(ST.familyOf('rustblade').stats.map(x => x.k).join(), 'power,speed,precision,stability,crit,energy,growth');
  ok(!ST.familyOf('oakbuckler').byKey.power && ST.familyOf('oakbuckler').byKey.guard, 'shields use Guard, not Power');
  ok(ST.familyOf('nimbit').byKey.bond && ST.familyOf('leviathan').byKey.overdrive && ST.familyOf('moonstone').byKey.resonance && ST.familyOf('whisperjar').byKey.containment);
  eq(new Set(D.ITEM_LIST.filter(i => i.cat !== 'card').map(i => PR.ARCH[i.id].fam)).size, 6, 'six non-card families');
  ok(ST.familyOf('cfla001').byKey.print && ST.familyOf('cfla001').byKey.projection, 'Phase Four: cards use their own Card family');
  ok(ST.FAMILIES.cosmetic && ST.FAMILIES.cosmetic.stats.length === 6, 'cosmetic family defined for later');
});
t('stats are deterministic: same specimen → same numbers, repeatedly and after a JSON round trip', () => {
  const a = mk('leviathan', { level: 2, potential: 77, condition: 1 }), b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 5; i++) eq(JSON.stringify(ST.compute(a).map), JSON.stringify(ST.compute(b).map));
  eq(JSON.stringify(a.stats), JSON.stringify(ST.snapshot(a)), 'stored snapshot equals recomputation');
});
t('stat values stay in 1..140 and are whole numbers for every item, level, potential and condition', () => {
  D.ITEM_LIST.forEach(i => { for (let lv = 0; lv <= 4; lv++) for (const pot of [1, 50, 100]) for (const cond of [0, 4]) ST.compute(mk(i.id, { level: lv, potential: pot, condition: cond })).list.forEach(x => ok(x.value >= 1 && x.value <= 140 && Number.isInteger(x.value), `${i.id} ${x.k} ${x.value}`)); });
});
t('each upgrade stage raises every non-potential stat (upgrades always show a benefit)', () => {
  D.ITEM_LIST.forEach(i => { const sp = mk(i.id, { potential: 60 }); for (let lv = 0; lv < 4; lv++) { const a = ST.compute(sp, { level: lv }), b = ST.compute(sp, { level: lv + 1 }); a.list.forEach((x, n) => { if (x.k === 'growth') return; ok(b.list[n].value > x.value, `${i.id} ${x.k} stage ${lv}→${lv + 1}: ${x.value}→${b.list[n].value}`); }); } });
});
t('potential sets the growth ceiling, yet low potential is not worthless', () => {
  const lo = mk('ionbow', { potential: 10, level: 3 }), hi = mk('ionbow', { potential: 100, level: 3 });
  ok(ST.compute(hi).map.growth > ST.compute(lo).map.growth + 30); ok(ST.compute(hi).map.precision > ST.compute(lo).map.precision);
  ok(ST.compute(lo).map.precision > ST.compute(mk('ionbow', { potential: 10, level: 0 })).map.precision + 6, 'low potential still gains per stage');
  const c = ST.ceiling(mk('ionbow', { potential: 90, level: 0 })); ok(c.precision > ST.compute(mk('ionbow', { potential: 90, level: 0 })).map.precision, 'ceiling above current');
});
t('rarity matters but does not decide: a Common out-scores an Epic in its focus stat sometimes, not always', () => {
  let wins = 0; for (let n = 0; n < 200; n++) { const c = mk('rustblade', { seed: n * 7919 + 3, condition: n % 5 }), e = mk('gravehammer', { seed: n * 104729 + 11, condition: (n + 2) % 5 }); if (ST.compute(c).map.stability > ST.compute(e).map.stability) wins++; }
  ok(wins > 20, 'common wins ' + wins + '/200'); ok(wins < 190, 'but rarity still counts ' + wins);
});
t('conditions create character, not just a penalty: worse condition lowers stable stats and raises volatile ones', () => {
  const good = ST.compute(mk('rustblade', { condition: 0 })).map, bad = ST.compute(mk('rustblade', { condition: 4 })).map;
  ok(good.stability > bad.stability && bad.crit > good.crit, JSON.stringify([good, bad]));
});
t('the same base identity gives specimens different numbers (duplicates stay worth comparing)', () => {
  const sigs = new Set(); for (let n = 0; n < 40; n++) sigs.add(JSON.stringify(ST.compute(mk('nimbus', { seed: (n * 2654435761) >>> 0, condition: n % 5, potential: 20 + (n * 7) % 80 })).map)); ok(sigs.size >= 35, 'distinct ' + sigs.size);
});
t('identity is the biggest share (≈60–70 %) and traits a clear minority (≈15–25 % incl. growth)', () => {
  let id = 0, tr = 0, gr = 0; D.ITEM_LIST.forEach(i => { const sp = mk(i.id, { level: 2, potential: 60 }); ST.compute(sp).list.forEach(x => { if (x.k === 'growth') return; id += x.parts.identity; tr += Math.abs(x.parts.trait); gr += x.parts.growth; }); });
  const tot = id + tr + gr; ok(id / tot > 0.6 && id / tot < 0.85, 'identity ' + (id / tot).toFixed(2)); ok(tr / tot > 0.05 && tr / tot < 0.25, 'trait ' + (tr / tot).toFixed(2));
});

console.log('Progression and transformations');
t('every collectible has a major transformation (evolution or form); ≥ 50 % offer a real choice; branches differ in more than colour', () => {
  let branching = 0;
  D.ITEM_LIST.forEach(i => { const k = PR.kindOf(i.id); ok(k === 'evolution' || k === 'form', i.id + ' has no transformation'); if (PR.isBranching(i.id)) branching++; });
  ok(branching / D.ITEM_LIST.length >= 0.5, 'branching ' + branching + '/' + D.ITEM_LIST.length);
  D.ITEM_LIST.filter(i => PR.formsFor(i.id).length > 1).forEach(i => { const [a, b] = PR.formsFor(i.id); ok(JSON.stringify(a.motifs) !== JSON.stringify(b.motifs) && a.tint !== b.tint && JSON.stringify(a.lean) !== JSON.stringify(b.lean) && a.blurb !== b.blurb && a.behave !== b.behave, i.id + ' branches too similar'); });
  Object.values(PR.FORMS).forEach(f => { ok(D.ITEMS[f.item], f.id); const fam = ST.familyOf(f.item); Object.keys(f.lean).concat(Object.keys(f.trade || {})).forEach(k => ok(fam.byKey[k], f.id + ' stat ' + k)); ok(f.motifs.length >= 1 && f.blurb.length > 20, f.id); });
});
t('category stage names cover five stages and the specimen reports them', () => {
  Object.values(PR.STAGE_NAMES).forEach(n => eq(n.length, 5)); eq(SP.stageName(mk('nimbit', { level: 4 })), 'Apex Form'); eq(SP.stageName(mk('leviathan', { level: 1 })), 'Tuned'); eq(SP.stageName(mk('whisperjar', { level: 4 })), 'Breached');
});
t('upgrade preview matches the result; it records stat changes in history and the ledger', () => {
  AV.state.reset('unlimited'); const sp = mk('prismedge', { potential: 90 }); E.addSpecimen(sp, 'test'); const before = JSON.stringify(sp.stats);
  const pv = E.upgradePreview(sp.id); ok(pv.next && Object.keys(pv.delta).length >= 5 && pv.nextStage === 'Tempered', 'preview');
  const r = E.upgrade(sp.id); ok(r.ok && sp.level === 1); ok(JSON.stringify(sp.stats) !== before); eq(sp.prog.length, 1); eq(sp.prog[0].type, 'upgrade');
  eq(JSON.stringify(r.delta), JSON.stringify(pv.delta), 'delta equals preview'); ok(/Forged → Tempered/.test(sp.history[sp.history.length - 1].text), sp.history[sp.history.length - 1].text);
  eq(JSON.stringify(sp.stats), JSON.stringify(ST.snapshot(sp)));
});
t('upgrade charges the stated cost in Standard Mode and refuses without funds', () => {
  AV.state.reset('standard'); const S0 = AV.state.get(); S0.wallet = { credits: 10000, gems: 0, essence: 500, keys: 0 }; const sp = mk('rustblade'); E.addSpecimen(sp, 't');
  const cost = SP.upgradeCost(sp); const r = E.upgrade(sp.id); ok(r.ok); eq(S0.wallet.essence, 500 - cost.essence); eq(S0.wallet.credits, 10000 - cost.credits);
  S0.wallet = { credits: 0, gems: 0, essence: 0, keys: 0 }; const lv = sp.level; eq(E.upgrade(sp.id).ok, false); eq(sp.level, lv);
});
t('major transformation: needs the stage, charges once, sets the form, adds a controlled jump', () => {
  AV.state.reset('standard'); const S0 = AV.state.get(); S0.wallet = { credits: 1e6, gems: 0, essence: 1e5, keys: 0 };
  const sp = mk('ionbow', { potential: 80, level: 2 }); E.addSpecimen(sp, 'test');
  eq(E.transform(sp.id, 'stormstring').ok, false, 'too early'); sp.level = 3; sp.stats = ST.snapshot(sp);
  ok(E.transformOptions(sp).forms.length === 2 && E.transformOptions(sp).branching);
  const pre = ST.compute(sp).map, cost = PR.transformCost('ionbow'), w0 = S0.wallet.essence;
  const r = E.transform(sp.id, 'stormstring'); ok(r.ok, r.err); eq(sp.form, 'stormstring'); eq(S0.wallet.essence, w0 - cost.essence);
  const post = ST.compute(sp).map; ok(post.speed - pre.speed >= 10 && post.speed - pre.speed <= 14, 'lean jump ' + (post.speed - pre.speed)); eq(post.precision, pre.precision, 'unrelated stat unchanged');
  eq(E.transform(sp.id, 'railbow').ok, false, 'one transformation at a time'); eq(sp.prog[sp.prog.length - 1].type, 'form');
});
t('a form must belong to the specimen’s own item', () => {
  AV.state.reset('unlimited'); const sp = mk('rustblade', { level: 3 }); E.addSpecimen(sp, 't'); eq(E.transform(sp.id, 'stormstring').ok, false); eq(sp.form, null);
});
t('branches change stats differently; re-binding keeps the old look; fee in Standard, free in Unlimited', () => {
  AV.state.reset('standard'); const S0 = AV.state.get(); S0.wallet = { credits: 1e6, gems: 0, essence: 1e5, keys: 0 };
  const sp = mk('rustblade', { level: 3, potential: 70 }); E.addSpecimen(sp, 'test'); E.transform(sp.id, 'quickened');
  const a = ST.compute(sp).map; const w = S0.wallet.essence; ok(E.reform(sp.id, 'cleaver').ok); ok(S0.wallet.essence < w, 'fee in standard'); const b = ST.compute(sp).map;
  ok(a.speed > b.speed && b.power > a.power, 'speed branch vs power branch'); ok(sp.looks.includes('form:quickened'));
  ok(PR.looksOf(sp).some(l => l.id === 'form:quickened'), 'previous branch selectable'); ok(E.setLook(sp.id, 'form:quickened')); eq(PR.displaySpec(sp).form, 'quickened'); eq(sp.form, 'cleaver', 'progress untouched by the look');
  ok(E.setLook(sp.id, 'lv:1') && PR.displaySpec(sp).level === 1); eq(E.setLook(sp.id, 'form:nonexistent'), false);
  AV.state.reset('unlimited'); const sp2 = mk('rustblade', { level: 3 }); E.addSpecimen(sp2, 'test'); E.transform(sp2.id, 'quickened'); const w2 = AV.state.get().wallet.essence; ok(E.reform(sp2.id, 'cleaver').ok); eq(AV.state.get().wallet.essence, w2, 'free in Unlimited');
});
t('evolution keeps earlier appearances, does not lose earned growth, records history and a carry', () => {
  AV.state.reset('unlimited'); const sp = mk('nimbit', { level: 1, potential: 70 }); E.addSpecimen(sp, 'test'); const pre = ST.compute(sp).map;
  const r = E.evolve(sp.id, 'nimbus'); ok(r.ok); ok(sp.looks.includes('base:nimbit')); const post = ST.compute(sp).map; ok(sp.carry);
  Object.keys(pre).forEach(k => { if (k !== 'growth') ok(post[k] >= pre[k] * 0.85, `${k} ${pre[k]}→${post[k]}`); });
  ok(PR.looksOf(sp).some(l => l.id === 'base:nimbit')); eq(PR.displaySpec(sp, 'base:nimbit').base, 'nimbit'); eq(sp.prog[sp.prog.length - 1].type, 'evolve');
});
t('protected specimens keep their protection through other specimens’ transformations', () => {
  AV.state.reset('unlimited'); const a = mk('rustblade', { level: 3 }), b = mk('rustblade', { level: 3 }); E.addSpecimen(a, 't'); E.addSpecimen(b, 't'); E.toggleLock(a.id);
  E.transform(b.id, 'cleaver'); eq(E.dismantle([a.id]).count, 0); ok(E.get(a.id));
});

console.log('Save migration (v1 → v2)');
t('v1 save → v2 keeps every identity field, adds deterministic stats, writes the backup once, and is repeatable', () => {
  Object.keys(store).forEach(k => delete store[k]);
  const v1 = AV.state.defaultSave('standard', 'Old'); v1.version = 1; v1.specimens = {}; let n = 1;
  ['nimbus', 'rustblade', 'leviathan', 'heartofeternity', 'whisperjar', 'oakbuckler'].forEach((b, i) => { const sp = mk(b, { seed: 100 + i, level: i % 4, potential: 30 + i * 11 }); ['stats', 'sv', 'form', 'look', 'looks', 'carry', 'prog'].forEach(k => delete sp[k]); sp.id = 's' + n; sp.history = [{ t: 1, type: 'created', text: 'Drawn.' }]; v1.specimens[sp.id] = sp; n++; });
  v1.specimens.s1.history.push({ t: 2, type: 'evolve', text: 'Evolved from Nimbit into Nimbus.' }); v1.nextId = n;
  const raw = JSON.stringify(v1); store[AV.state.SAVE_KEY] = raw;
  const keep = ['id', 'base', 'serial', 'seed', 'pattern', 'condition', 'variant', 'potential', 'level', 'palette', 'size', 'favorite', 'locked', 'nickname', 'invested', 'origin'];
  const before = JSON.parse(raw);
  const S1 = AV.state.load(); const L = AV.state.lastLoad;
  eq(Object.keys(S1.specimens).length, 6, 'collection count'); eq(S1.version, AV.state.SAVE_VERSION, 'v1 migrates through v2 to the current schema'); eq(L.p3.migrated, 6); eq(L.p3.backup, AV.state.BACKUP_KEY);
  eq(store[AV.state.BACKUP_KEY], raw, 'backup is the untouched raw v1 text');
  Object.keys(before.specimens).forEach(id => { const x = before.specimens[id], y = S1.specimens[id]; keep.forEach(k => eq(JSON.stringify(y[k]), JSON.stringify(x[k]), id + '.' + k)); eq(y.history.length, x.history.length); ok(y.stats && y.sv === 1 && y.form === null && y.look === 'auto'); eq(JSON.stringify(y.stats), JSON.stringify(ST.snapshot(y))); });
  ok(S1.specimens.s1.looks.includes('base:nimbit'), 'earlier species recovered from history');
  store[AV.state.SAVE_KEY] = JSON.stringify(S1); store[AV.state.BACKUP_KEY] = 'SENTINEL'; AV.state.load(); ok(!AV.state.lastLoad.p3.migrated, 'runs once'); eq(store[AV.state.BACKUP_KEY], 'SENTINEL', 'backup never overwritten');
  store[AV.state.SAVE_KEY] = raw; delete store[AV.state.BACKUP_KEY]; const S2 = AV.state.load();
  Object.keys(S1.specimens).forEach(id => eq(JSON.stringify(S2.specimens[id].stats), JSON.stringify(S1.specimens[id].stats), 'repeatable ' + id));
});
t('migration of an imported v1 file adds the same fields', () => {
  const v1 = AV.state.defaultSave(); v1.version = 1; const sp = mk('pocketdrone'); ['stats', 'sv'].forEach(k => delete sp[k]); sp.id = 's1'; v1.specimens = { s1: sp }; v1.nextId = 2;
  const S1 = AV.state.importJSON(JSON.stringify(v1)); ok(S1.specimens.s1.stats && S1.specimens.s1.sv === 1);
});
t('migration failure keeps the backup and loads the original save instead of resetting', () => {
  Object.keys(store).forEach(k => delete store[k]);
  const v1 = AV.state.defaultSave(); v1.version = 1; const sp = mk('rustblade'); ['stats', 'sv'].forEach(k => delete sp[k]); sp.id = 's1'; v1.specimens = { s1: sp }; v1.nextId = 2;
  const orig = ST.snapshot; ST.snapshot = () => ({ power: NaN }); // force a validation failure
  store[AV.state.SAVE_KEY] = JSON.stringify(v1); const S1 = AV.state.load(); ST.snapshot = orig;
  ok(AV.state.lastLoad.p3.failed, 'failure reported'); ok(S1.specimens.s1 && S1.specimens.s1.serial === sp.serial, 'collection intact'); ok(store[AV.state.BACKUP_KEY], 'backup kept');
});

console.error = errlog;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

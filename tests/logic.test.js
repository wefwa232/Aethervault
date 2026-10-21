/* Node logic harness: loads the pure game modules into a sandbox and asserts the rules. Run: node tests/logic.test.js */
const vm = require('vm'), fs = require('fs'), path = require('path');
const store = {};
const ctx = { console, setTimeout, clearTimeout, Math, JSON, Date, localStorage: {
  getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util', 'data', 'progress', 'stats', 'state', 'specimen', 'engine'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const AV = ctx.AV, D = AV.data, E = AV.engine, SP = AV.specimen;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'eq') + `: expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

console.log('Content');
t('at least 25 obtainable collectibles across 5 categories', () => {
  const ob = D.ITEM_LIST.filter(i => i.obtainable);
  ok(ob.length >= 25, 'obtainable ' + ob.length);
  eq(new Set(ob.map(i => i.cat)).size, 5);
});
t('every item has valid rarity, palette, lore and evolutions point to real items', () => {
  D.ITEM_LIST.forEach(i => { ok(D.RARITY[i.rarity], i.id + ' rarity'); eq(i.pal.length, 4, i.id + ' pal'); ok(i.lore.length > 10, i.id + ' lore'); i.evolves.forEach(e => ok(D.ITEMS[e.to], i.id + '->' + e.to)); });
});
t('every container pool has items and a reachable rarity table summing to 1', () => {
  D.CONTAINERS.forEach(c => { AV.state.reset('standard'); const rows = E.rarityTable(c); ok(rows.length > 0, c.id); ok(Math.abs(rows.reduce((a, r) => a + r.p, 0) - 1) < 1e-9, c.id + ' sum'); });
});
t('every slot minimum is satisfiable by its pool', () => {
  D.CONTAINERS.forEach(c => c.slots.forEach(sl => { if (sl.min) ok(E.poolItems(c).some(i => D.RARITY[i.rarity].tier >= D.RARITY[sl.min].tier), c.id + ' ' + sl.min); }));
});

console.log('Specimens');
t('generation yields in-range traits and unique-ish seeds', () => {
  const seeds = new Set();
  for (let i = 0; i < 500; i++) {
    const s = SP.generate('emberkit');
    ok(s.potential >= 1 && s.potential <= 100); ok(s.serial >= 1 && s.serial <= 9999); ok(s.condition >= 0 && s.condition <= 4);
    ok(D.VARIANT[s.variant]); ok(D.PATTERNS.some(p => p.id === s.pattern)); ok(s.personality); seeds.add(s.seed);
  }
  ok(seeds.size > 490, 'seeds should be mostly unique');
});
t('non-pets get no personality; forced traits are honored', () => {
  const s = SP.generate('rustblade', { variant: 'golden', condition: 0, potential: 99, serial: 7 });
  eq(s.personality, undefined); eq(s.variant, 'golden'); eq(s.condition, 0); eq(s.serial, 7);
});
t('value rises with level, variant and condition', () => {
  const a = SP.generate('moonstone', { variant: 'none', condition: 2, potential: 50, serial: 5000 });
  const b = Object.assign({}, a, { variant: 'prismatic' }), c = Object.assign({}, a, { level: 3 }), d = Object.assign({}, a, { condition: 0 });
  ok(SP.value(b) > SP.value(a) && SP.value(c) > SP.value(a) && SP.value(d) > SP.value(a));
});
t('low potential caps upgrade stage', () => { eq(SP.maxLevel({ potential: 10 }), 3); eq(SP.maxLevel({ potential: 80 }), 4); });

console.log('Opening & economy');
t('opening spends currency, creates specimens, grants xp', () => {
  AV.state.reset('standard'); const w0 = E.balance('credits');
  const r = E.open('wanderer', 1); ok(r.ok); eq(r.results.length, 3); eq(E.balance('credits'), w0 - 120 + 200 * r.levelUps.length, 'cost minus level-up gifts'); eq(E.all().length, 3);
});
t('cannot open when unaffordable (standard) and nothing is created', () => {
  AV.state.reset('standard'); AV.state.get().wallet.credits = 50;
  const r = E.open('wanderer', 1); ok(!r.ok); eq(E.all().length, 0); eq(E.balance('credits'), 50);
});
t('unlimited mode opens for free', () => {
  AV.state.reset('unlimited'); const r = E.open('vault', 5); ok(r.ok); eq(E.all().length, 15); eq(E.balance('gems'), Infinity);
});
t('slot guarantees hold over many Mythic Vault openings', () => {
  AV.state.reset('unlimited');
  for (let i = 0; i < 300; i++) { const r = E.open('vault', 1); ok(D.RARITY[r.results[0].spec && SP.itemOf(r.results[0].spec).rarity].tier >= 2); ok(D.RARITY[SP.itemOf(r.results[1].spec).rarity].tier >= 3); ok(D.RARITY[SP.itemOf(r.results[2].spec).rarity].tier >= 4); }
});
t('starlit egg only yields pets of rare+', () => {
  AV.state.reset('unlimited');
  for (let i = 0; i < 300; i++) { const sp = E.open('starlit', 1).results[0].spec; eq(SP.itemOf(sp).cat, 'pet'); ok(SP.rarityOf(sp).tier >= 2); }
});
t('pity guarantees a legendary within the threshold', () => {
  AV.state.reset('unlimited'); const c = D.CONTAINER.hatchling; let since = 0, worst = 0;
  for (let i = 0; i < 2000; i++) { const sp = E.open('hatchling', 1).results[0].spec; if (SP.rarityOf(sp).tier >= 5) since = 0; else since++; worst = Math.max(worst, since); }
  ok(worst < c.pity.after, 'worst drought ' + worst);
});
t('serial numbers can be low and are never unique-colliding in identity (ids unique)', () => {
  AV.state.reset('unlimited'); E.open('wanderer', 20); const ids = E.all().map(s => s.id); eq(new Set(ids).size, ids.length);
});

console.log('Protection & dismantle');
t('favorited / locked / companion specimens cannot be dismantled', () => {
  AV.state.reset('unlimited'); E.open('wanderer', 4); const [a, b, c] = E.all();
  E.toggleFavorite(a.id); E.toggleLock(b.id);
  const before = E.all().length; const r = E.dismantle([a.id, b.id]);
  eq(r.count, 0); eq(r.skipped, 2); eq(E.all().length, before);
  AV.state.reset('standard'); const st = E.giveStarter(); const r2 = E.dismantle([st.spec.id]); eq(r2.count, 0, 'companion');
});
t('dismantle grants Essence and removes specimens', () => {
  AV.state.reset('standard'); E.open('wanderer', 1); const ids = E.all().map(s => s.id); const e0 = E.balance('essence');
  const preview = E.essencePreview(ids); const r = E.dismantle(ids); eq(r.count, 3); eq(E.balance('essence'), e0 + preview); eq(E.all().length, 0);
});
t('duplicate plan keeps the best copy and skips protected ones', () => {
  AV.state.reset('unlimited');
  const mk = (p) => { const s = SP.generate('rustblade', { potential: p, variant: 'none', condition: 2, serial: 5000 }); E.addSpecimen(s); return s; };
  const a = mk(10), b = mk(90), c = mk(50); E.toggleFavorite(c.id);
  const plan = E.duplicatePlan(); ok(!plan.includes(b.id), 'best kept'); ok(!plan.includes(c.id), 'favorite not planned'); ok(plan.includes(a.id));
});

console.log('Upgrade & evolution');
t('upgrade costs resources and bumps level up to cap', () => {
  AV.state.reset('standard'); const s = SP.generate('nimbit', { potential: 90 }); E.addSpecimen(s);
  AV.state.get().wallet.essence = 100000; AV.state.get().wallet.credits = 1e6;
  for (let i = 0; i < 4; i++) ok(E.upgrade(s.id).ok); eq(s.level, 4); ok(!E.upgrade(s.id).ok, 'capped');
});
t('upgrade fails without resources and changes nothing', () => {
  AV.state.reset('standard'); const s = SP.generate('nimbit', { potential: 90 }); E.addSpecimen(s); AV.state.get().wallet.essence = 0;
  const r = E.upgrade(s.id); ok(!r.ok); eq(s.level, 0);
});
t('full Nimbus line evolves, keeping identity, resetting level', () => {
  AV.state.reset('unlimited'); const s = SP.generate('nimbit', { potential: 80, serial: 1234 }); E.addSpecimen(s);
  ok(!E.evolve(s.id, 'nimbus').ok, 'needs level'); E.upgrade(s.id);
  ok(E.evolve(s.id, 'nimbus').ok); eq(s.base, 'nimbus'); eq(s.level, 0); eq(s.serial, 1234);
  E.upgrade(s.id); E.upgrade(s.id); ok(E.evolve(s.id, 'tempestral').ok);
  for (let i = 0; i < 3; i++) E.upgrade(s.id); ok(E.evolve(s.id, 'stormsovereign').ok); eq(SP.rarityOf(s).id, 'legendary');
  ok(!E.evolve(s.id, 'pluvia').ok, 'no such branch from final');
});
t('branching: Nimbus can take the rain path', () => {
  AV.state.reset('unlimited'); const s = SP.generate('nimbus', { potential: 80 }); E.addSpecimen(s); E.upgrade(s.id); E.upgrade(s.id);
  ok(E.evolve(s.id, 'pluvia').ok); eq(s.base, 'pluvia');
});
t('evolved species become discovered', () => { ok(AV.state.get().discovered.pluvia); });

console.log('Store, daily, mode');
t('mock checkout subtracts play cash and adds gems; refuses when short', () => {
  AV.state.reset('standard'); const g0 = E.balance('gems'); ok(E.buyCash('g2').ok); eq(AV.state.get().playCash, 45.01); eq(E.balance('gems'), g0 + 500);
  AV.state.get().playCash = 1; ok(!E.buyCash('g3').ok);
});
t('exchanges convert resources', () => {
  AV.state.reset('standard'); const g = E.balance('gems'), k = E.balance('keys'); ok(E.exchange('x3').ok); eq(E.balance('gems'), g - 15); eq(E.balance('keys'), k + 1);
  AV.state.get().wallet.gems = 0; ok(!E.exchange('x3').ok);
});
t('daily reward claims once per day and tracks streak', () => {
  AV.state.reset('standard'); ok(E.claimDaily('2026-01-01').ok); ok(!E.claimDaily('2026-01-01').ok);
  eq(E.claimDaily('2026-01-02').streak, 2); eq(E.claimDaily('2026-01-05').streak, 1, 'streak resets');
});
t('xp levels up and rewards gems', () => { AV.state.reset('standard'); const g = E.balance('gems'); const ups = E.addXp(500); ok(ups.length >= 2); ok(E.balance('gems') > g); });
t('unlimited duplication only works in unlimited mode', () => {
  AV.state.reset('standard'); const s = SP.generate('rustblade'); E.addSpecimen(s); ok(!E.duplicateSpecimen(s.id).ok);
  E.setMode('unlimited'); ok(E.duplicateSpecimen(s.id).ok); eq(E.all().length, 2);
});

console.log('Persistence');
t('save → load round-trips specimens, wallet and settings', () => {
  AV.state.reset('standard'); E.open('wanderer', 2); E.setSetting('animSpeed', 2); AV.state.get().wallet.gems = 1234; AV.state.save(true);
  const n = E.all().length; const snap = JSON.stringify(AV.state.get());
  AV.state.load(); eq(E.all().length, n); eq(AV.state.get().wallet.gems, 1234); eq(AV.state.get().settings.animSpeed, 2); eq(JSON.stringify(AV.state.get()), snap);
});
t('migration fills missing fields and drops unknown items', () => {
  const old = { wallet: { credits: 5 }, specimens: { s1: { id: 's1', base: 'ghost' }, s2: SP.generate('rustblade') }, profile: { name: 'Old' } };
  const m = AV.state.migrate(old); eq(m.wallet.credits, 5); eq(m.wallet.gems, 40); ok(!m.specimens.s1); ok(m.specimens.s2); ok(m.settings.master > 0);
});
t('corrupt save does not crash load and is preserved', () => {
  store[AV.state.SAVE_KEY] = '{not json'; AV.state.load(); ok(Object.keys(store).some(k => k.includes('corrupt')));
});
t('import rejects junk', () => { let threw = false; try { AV.state.importJSON('{"a":1}'); } catch (e) { threw = true; } ok(threw); });

console.log('Presentation contracts (data the 3D layer depends on; no rendering)');
t('settings carry a 3D quality level and old saves inherit it', () => {
  eq(AV.state.defaultSave().settings.quality3d, 'medium');
  const m = AV.state.migrate({ wallet: {}, specimens: {}, settings: { master: 0.5 } }); eq(m.settings.quality3d, 'medium'); eq(m.settings.master, 0.5);
});
t('every vertical-slice model id exists in the registry with the fields the 3D layer reads', () => {
  const slice = ['nimbit', 'nimbus', 'tempestral', 'pluvia', 'stormsovereign', 'rustblade', 'prismedge', 'heartofeternity', 'leviathan', 'whisperjar'];
  slice.forEach(id => { const i = D.ITEMS[id]; ok(i, id); ok(i.pal.length === 4 && i.cat && D.RARITY[i.rarity], id + ' fields'); });
  eq(new Set(slice.map(id => D.ITEMS[id].cat)).size, 5, 'all five categories');
});
t('specimens expose every trait the 3D shader consumes', () => {
  const s = SP.generate('whisperjar');
  ['variant', 'pattern', 'seed', 'palette', 'condition', 'potential', 'serial', 'level', 'size'].forEach(k => ok(s[k] !== undefined, k));
  ok(D.VARIANT[s.variant] && D.PATTERNS.some(p => p.id === s.pattern) && D.PALETTES[s.palette]);
});
t('upgrade stages and condition tiers cover the ranges the models switch on', () => { eq(D.UPGRADE_STAGES.length, 5); eq(D.CONDITION_MULT.length, 5); Object.values(D.CONDITION_LABELS).forEach(l => eq(l.length, 5)); });
t('containers used by 3D rituals define a ritual kind and a two-colour theme', () => {
  ['hatchling', 'forge', 'vault', 'starlit'].forEach(id => { const c = D.CONTAINER[id]; ok(['egg', 'crate', 'vault'].includes(c.ritual), id); eq(c.theme.length, 2, id); });
});

console.log('Phase Two contracts');
const readJs = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
// the model manifest is plain data inside manifest.js; parse it rather than loading three.js
const manifestSrc = readJs('stage3d/manifest.js'), FILES = {};
manifestSrc.replace(/'(models-[a-z0-9]+\.js)':\s*\[([^\]]*)\]/g, (_, f, list) => { FILES[f] = list.split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean); });
const MODELLED = [].concat(...Object.values(FILES));
t('manifest lists every lazily-loaded model file exactly once, and every file exists', () => {
  const onDisk = fs.readdirSync(path.join(__dirname, '..', 'js', 'stage3d')).filter(f => /^models-.*\.js$/.test(f) && !/^models-(containers|crate-vault|containers2)\.js$/.test(f));
  onDisk.forEach(f => ok(FILES[f], f + ' is missing from manifest.js'));
  Object.keys(FILES).forEach(f => ok(onDisk.includes(f), f + ' in manifest but not on disk'));
  eq(new Set(MODELLED).size, MODELLED.length, 'a model key is listed twice');
});
t('Phase Two adds at least 13 collectible models across all five categories (plus the pack and capsule containers)', () => {
  const phase1 = ['nimbit', 'nimbus', 'tempestral', 'pluvia', 'stormsovereign', 'rustblade', 'prismedge', 'heartofeternity', 'leviathan', 'whisperjar'];
  const added = MODELLED.filter(k => !phase1.includes(k)); ok(added.length >= 13, 'added ' + added.length);
  eq(new Set(added.map(k => D.ITEMS[k].cat)).size, 5, 'all categories gain a model');
  ['container:pack', 'container:capsule'].forEach(k => ok(readJs('stage3d/models-containers2.js').includes("registerModel('" + k + "'"), k));
});
t('every modelled collectible exists in the registry and keeps an SVG fallback drawing', () => {
  const art = readJs('art.js'); MODELLED.forEach(id => { ok(D.ITEMS[id], id + ' not in ITEMS'); ok(art.includes('ART.' + id + ' = '), id + ' has no SVG fallback'); });
});
t('new pet families have evolutions that exist and a line entry for the Atlas', () => {
  ['emberkit', 'mossback'].forEach(id => { const i = D.ITEMS[id]; ok(i.evolves.length >= 1, id + ' evolves'); i.evolves.forEach(e => ok(D.ITEMS[e.to], e.to)); ok(D.EVO_LINES.some(l => l.root === id), id + ' line'); });
  D.ITEM_LIST.filter(i => i.line).forEach(i => ok(D.EVO_LINES.some(l => l.id === i.line), i.id + ' line id'));
  ok(!D.ITEMS.grovewarden.obtainable && D.ITEMS.mossback.obtainable, 'evolution forms are not drawn from eggs');
});
t('new settings (fpsLimit, fastStartup) default sensibly and old saves inherit them without touching player data', () => {
  const d = AV.state.defaultSave().settings; eq(d.fpsLimit, 'auto'); eq(d.fastStartup, false);
  const old = { version: 1, profile: { name: 'Old', level: 9, xp: 5 }, wallet: { credits: 77, gems: 3, essence: 1, keys: 0 }, specimens: { 1: { id: 1, base: 'nimbit', variant: 'none', pattern: 'plain', seed: 1, palette: 0, condition: 2, potential: 50, serial: 12, level: 0, size: 1, aura: 'none' }, 2: { id: 2, base: 'removedthing' } }, nextId: 3, settings: { master: .3, quality3d: 'high' } };
  const m = AV.state.migrate(old); eq(m.settings.quality3d, 'high'); eq(m.settings.master, .3); eq(m.settings.fpsLimit, 'auto'); eq(m.wallet.credits, 77); eq(m.profile.level, 9); eq(m.version, 2);
  ok(m.specimens[1] && !m.specimens[2], 'unknown records are set aside, known ones kept');
});
t('loader reports what it found (used by the startup sequence): fresh, migrated, dropped, corrupt', () => {
  const L = AV.state.lastLoad, KEY = AV.state.SAVE_KEY;
  delete store[KEY]; AV.state.load(); ok(L.fresh && !L.corrupt, 'fresh');
  store[KEY] = JSON.stringify({ version: 1, wallet: {}, specimens: { 1: { id: 1, base: 'nimbit' }, 2: { id: 2, base: 'gone' } }, profile: {} }); AV.state.load(); ok(!L.fresh && L.specimens === 1 && L.dropped === 1 && L.fromVersion === 1, JSON.stringify(L));
  store[KEY] = '{not json'; AV.state.load(); ok(L.corrupt && /corrupt/.test(L.backupKey), 'corrupt detected'); ok(store[L.backupKey] === '{not json', 'raw text preserved under the backup key');
  delete store[KEY]; Object.keys(store).forEach(k => { if (/corrupt/.test(k)) delete store[k]; });
});
t('version info is available for the startup screen', () => { ok(/^\d+\.\d+\.\d+$/.test(AV.VERSION.number) && AV.VERSION.build, JSON.stringify(AV.VERSION)); });
t('save key is unchanged and the schema is v2 (Phase Three); v1 saves migrate in place', () => { eq(AV.state.SAVE_VERSION, 2); eq(AV.state.SAVE_KEY, 'aethervault.save.v1'); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

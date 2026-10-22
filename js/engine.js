/* AETHERVAULT — game actions. The only place state is mutated. UI calls these; they save + emit. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util, SP = AV.specimen;
  const S = () => AV.state.get();
  const bus = AV.bus;

  const isUnlimited = () => S().mode === 'unlimited';
  const balance = cur => (isUnlimited() ? Infinity : S().wallet[cur] || 0);
  const canAfford = cost => Object.keys(cost).every(c => !cost[c] || balance(c) >= cost[c]);
  function spend(cost) {
    if (!canAfford(cost)) return false;
    if (!isUnlimited()) for (const c of Object.keys(cost)) S().wallet[c] -= cost[c];
    bus.emit('wallet'); return true;
  }
  function grant(reward, opts = {}) {
    const mult = opts.noMult ? 1 : S().economy.rewardMult || 1;
    for (const c of Object.keys(reward)) S().wallet[c] = (S().wallet[c] || 0) + Math.round(reward[c] * mult);
    bus.emit('wallet');
  }
  const tick = () => { AV.state.save(); };

  // ---------- Pricing & odds ----------
  function price(container) {
    const m = S().economy.priceMult || 1;
    return { cur: container.price.cur, amt: Math.max(0, Math.ceil(container.price.amt * m)) };
  }
  /** The items a container can award: an explicit list (Phase Four: Hatchling/Starlit) or every obtainable item of its categories. */
  function poolItems(container) {
    if (container.items) return container.items.map(id => D.ITEMS[id]).filter(Boolean);
    return D.ITEM_LIST.filter(i => i.obtainable && container.cats.includes(i.cat));
  }
  /** Effective rarity table after dropping rarities with no items in the pool; optionally restricted by a minimum tier. */
  function rarityTable(container, minTier = 0) {
    const pool = poolItems(container);
    const has = {}; pool.forEach(i => (has[i.rarity] = (has[i.rarity] || 0) + 1));
    let rows = D.RARITIES.filter(r => (container.odds[r.id] || 0) > 0 && has[r.id] && r.tier >= minTier).map(r => ({ id: r.id, w: container.odds[r.id] }));
    if (!rows.length) { // widen: any available rarity >= minTier, else anything
      rows = D.RARITIES.filter(r => has[r.id] && r.tier >= minTier).map(r => ({ id: r.id, w: 1 }));
      if (!rows.length) rows = D.RARITIES.filter(r => has[r.id]).slice(-1).map(r => ({ id: r.id, w: 1 }));
    }
    const total = rows.reduce((a, r) => a + r.w, 0);
    rows.forEach(r => { r.p = r.w / total; r.count = has[r.id]; });
    return rows;
  }
  function oddsReport(containerId) {
    const c = D.CONTAINER[containerId];
    const rows = rarityTable(c);
    const pool = poolItems(c);
    return {
      container: c, rarities: rows,
      items: rows.map(r => ({ rarity: r.id, p: r.p, list: pool.filter(i => i.rarity === r.id).map(i => ({ id: i.id, p: r.p / r.count })) })),
      pity: c.pity ? { rarity: c.pity.rarity, after: c.pity.after, current: S().pity[c.id] || 0 } : null,
    };
  }

  // ---------- Specimen bookkeeping ----------
  function addSpecimen(spec, source) {
    const s = S();
    spec.id = 's' + (s.nextId++);
    SP.addHistory(spec, 'created', source || 'Drawn from the Archive.');
    s.specimens[spec.id] = spec;
    const isNew = !s.discovered[spec.base];
    const d = s.discovered[spec.base] || (s.discovered[spec.base] = { count: 0, first: Date.now(), bestPotential: 0 });
    d.count++; d.bestPotential = Math.max(d.bestPotential, spec.potential);
    const newVariant = spec.variant !== 'none' && !s.variantsSeen[spec.variant];
    if (spec.variant !== 'none') s.variantsSeen[spec.variant] = true;
    s.recent.unshift(spec.id); if (s.recent.length > 24) s.recent.length = 24;
    const r = SP.rarityOf(spec).id;
    s.stats.byRarity[r] = (s.stats.byRarity[r] || 0) + 1;
    s.stats.pulls++;
    return { isNew, newVariant };
  }

  // ---------- XP / level ----------
  const xpNeeded = level => 100 + (level - 1) * 60;
  function addXp(n) {
    const p = S().profile, ups = [];
    p.xp += n;
    while (p.xp >= xpNeeded(p.level)) {
      p.xp -= xpNeeded(p.level); p.level++;
      p.title = D.TITLES[Math.min(D.TITLES.length - 1, Math.floor((p.level - 1) / 4))];
      grant({ gems: 10, credits: 200 }, { noMult: true });
      ups.push(p.level);
    }
    bus.emit('profile');
    return ups;
  }

  // ---------- Opening ----------
  function rollSlot(container, slotMin, pityActive) {
    let minTier = slotMin ? D.RARITY[slotMin].tier : 0;
    if (pityActive) minTier = Math.max(minTier, D.RARITY[container.pity.rarity].tier);
    const rows = rarityTable(container, minTier);
    const rid = U.pickWeighted(rows.map(r => [r.id, r.w]));
    const pool = poolItems(container).filter(i => i.rarity === rid);
    return U.pick(pool);
  }

  function open(containerId, count = 1, opts = {}) {
    const c = D.CONTAINER[containerId];
    if (!c) return { ok: false, err: 'Unknown container' };
    count = Math.max(1, Math.min(25, count | 0));
    const p = price(c);
    const cost = {}; cost[p.cur] = p.amt * count;
    if (!canAfford(cost)) return { ok: false, err: `Not enough ${D.CURRENCY[p.cur].name}` };
    spend(cost);
    const s = S(), results = [];
    let xp = 10 * count;
    for (let n = 0; n < count; n++) {
      const pack = [];
      for (let i = 0; i < c.count; i++) {
        const slot = c.slots[i] || {};
        const pityCount = (s.pity[c.id] || 0);
        const pityActive = !!(c.pity && pityCount + 1 >= c.pity.after);
        const item = rollSlot(c, slot.min, pityActive);
        const spec = SP.generate(item.id, { container: c.id, variantBoost: c.variantBoost, minPotential: c.minPotential });
        const meta = addSpecimen(spec, `Drawn from a ${c.name}.`);
        if (c.pity) {
          if (D.RARITY[item.rarity].tier >= D.RARITY[c.pity.rarity].tier) s.pity[c.id] = 0;
          else s.pity[c.id] = pityCount + 1;
        }
        xp += (D.RARITY[item.rarity].tier + 1) * 5 + (meta.isNew ? 40 : 0);
        pack.push({ spec, isNew: meta.isNew, newVariant: meta.newVariant, pityTriggered: pityActive && D.RARITY[item.rarity].tier >= D.RARITY[c.pity.rarity].tier, pack: n });
      }
      // Card packs present their cards from lowest to highest rarity (presentation order only: every card was already rolled)
      if (c.ascending) pack.sort((a, b) => SP.rarityTier(a.spec) - SP.rarityTier(b.spec));
      results.push(...pack);
    }
    s.stats.opened += count;
    // Reload protection: the rewards are saved now, before any animation, and the opening is remembered until its summary is seen.
    s.lastOpening = { container: c.id, count, ids: results.map(r => r.spec.id), at: Date.now(), seen: false };
    const levelUps = addXp(xp);
    bus.emit('specimens'); bus.emit('opened', { container: c, results });
    AV.state.save(true);
    return { ok: true, results, cost, levelUps, xp };
  }

  /** The free onboarding egg: always a Nimbit (the start of the Nimbus Line). */
  function giveStarter() {
    const spec = SP.generate('nimbit', { container: 'starter', variant: 'foil', condition: 1, minPotential: 72, level: 0 });
    const meta = addSpecimen(spec, 'Your very first egg, hatched in the Archive.');
    S().companion = spec.id;
    const levelUps = addXp(20);
    bus.emit('specimens'); bus.emit('companion'); tick();
    return { spec, isNew: meta.isNew, newVariant: meta.newVariant, levelUps };
  }

  // ---------- Specimen management ----------
  const get = id => S().specimens[id];
  const all = () => Object.values(S().specimens);
  function protectReason(spec) {
    if (spec.locked) return 'Locked';
    if (spec.favorite) return 'Favorited';
    if (S().companion === spec.id) return 'Active companion';
    if (inDeck(spec.id)) return 'In a combat deck';
    return null;
  }
  /** Phase Five: is this specimen referenced by any saved combat deck? (decks hold ids only; removing it from the deck frees it) */
  function inDeck(id) { const c = S().combat; return !!(c && c.decks.some(k => k.entries.some(e => e.id === id))); }
  function toggleFavorite(id) { const sp = get(id); if (!sp) return; sp.favorite = !sp.favorite; bus.emit('specimens'); tick(); return sp.favorite; }
  function toggleLock(id) { const sp = get(id); if (!sp) return; sp.locked = !sp.locked; bus.emit('specimens'); tick(); return sp.locked; }
  function setFlags(ids, flag, value) {
    ids.forEach(id => { const sp = get(id); if (sp) sp[flag] = value; });
    bus.emit('specimens'); tick();
  }
  function rename(id, name) {
    const sp = get(id); if (!sp) return;
    name = String(name || '').trim().slice(0, 24);
    if (name === sp.nickname) return;
    SP.addHistory(sp, 'rename', name ? `Renamed to "${name}".` : 'Nickname cleared.');
    sp.nickname = name; bus.emit('specimens'); tick();
  }
  function setCompanion(id) {
    const sp = get(id); if (!sp || SP.itemOf(sp).cat !== 'pet') return false;
    S().companion = id; bus.emit('companion'); tick(); return true;
  }

  /** Dismantle specimens into Essence. Protected specimens are ALWAYS skipped, even if ids include them. */
  function dismantle(ids) {
    const s = S(); let essence = 0, count = 0, skipped = 0; const removed = [];
    for (const id of ids) {
      const sp = s.specimens[id]; if (!sp) continue;
      if (protectReason(sp)) { skipped++; continue; }
      essence += SP.essenceYield(sp);
      delete s.specimens[id]; removed.push(id); count++;
    }
    s.recent = s.recent.filter(i => !removed.includes(i));
    pruneOrg(removed);
    s.stats.dismantled += count;
    if (essence) grant({ essence }, { noMult: false });
    bus.emit('specimens'); tick();
    return { ok: true, count, skipped, essence: Math.round(essence * (s.economy.rewardMult || 1)), removed };
  }

  /** Plan: keep the single most valuable copy of each base item; everything else unprotected is a candidate. */
  function duplicatePlan() {
    const groups = {};
    all().forEach(sp => (groups[sp.base] = groups[sp.base] || []).push(sp));
    const ids = [];
    for (const base of Object.keys(groups)) {
      const g = groups[base].slice().sort((a, b) => SP.value(b) - SP.value(a));
      // The best copy is always kept, even if it is the only unprotected one.
      g.slice(1).forEach(sp => { if (!protectReason(sp)) ids.push(sp.id); });
    }
    return ids;
  }
  function essencePreview(ids) { return ids.reduce((a, id) => a + (get(id) ? SP.essenceYield(get(id)) : 0), 0); }

  function duplicateSpecimen(id) {
    if (!isUnlimited()) return { ok: false, err: 'Duplication is an Unlimited Mode power.' };
    const src = get(id); if (!src) return { ok: false, err: 'Missing' };
    const copy = U.deepClone(src);
    copy.favorite = false; copy.locked = false; copy.history = []; copy.serial = Math.floor(Math.random() * 9999) + 1;
    addSpecimen(copy, `Duplicated from ${SP.displayName(src)} (#${U.pad(src.serial, 4)}) using Unlimited Mode.`);
    bus.emit('specimens'); tick();
    return { ok: true, spec: copy };
  }

  // ---------- Upgrade, evolve, transform ----------
  const PR = () => AV.progress, ST = () => AV.stats;
  /** Record a progression event: stat snapshot + delta, in both the compact `prog` ledger and the readable history. */
  function recordProg(sp, type, from, to, cost, prevStats, text) {
    const now = ST().snapshot(sp), d = ST().delta(prevStats, now);
    sp.stats = now; sp.sv = ST().VERSION;
    sp.prog = sp.prog || [];
    sp.prog.push({ t: Date.now(), type, from, to, cost: cost || null, delta: d });
    if (sp.prog.length > 60) sp.prog.splice(0, sp.prog.length - 60);
    SP.addHistory(sp, type === 'form' ? 'evolve' : type, text + (Object.keys(d).length ? ' (' + ST().describeDelta(sp, d) + ')' : ''));
    return d;
  }

  /** What the next upgrade would do (read-only): costs, stat deltas, newly unlocked detail, transformation gate. */
  function upgradePreview(id) {
    const sp = get(id); if (!sp) return null;
    const cost = SP.upgradeCost(sp), cur = ST().compute(sp);
    if (!cost) return { spec: sp, cost: null, current: cur, next: null, delta: {}, stage: PR().stageName(sp.base, sp.level), nextStage: null, unlock: '' };
    const next = ST().compute(sp, { level: sp.level + 1 });
    return { spec: sp, cost, current: cur, next, delta: ST().delta(cur.map, next.map), stage: PR().stageName(sp.base, sp.level), nextStage: PR().stageName(sp.base, sp.level + 1),
      unlock: PR().stageUnlock(sp.base, sp.level + 1), affordable: canAfford(cost), gate: sp.level + 1 === PR().FORM_LEVEL ? PR().kindOf(sp.base) : 'none' };
  }

  function upgrade(id) {
    const sp = get(id); if (!sp) return { ok: false, err: 'Missing specimen' };
    const cost = SP.upgradeCost(sp);
    if (!cost) return { ok: false, err: 'Already at its limit' };
    if (!canAfford(cost)) return { ok: false, err: 'Not enough resources' };
    const prevStats = ST().snapshot(sp), fromName = PR().stageName(sp.base, sp.level);
    spend(cost);
    const prev = sp.level; sp.level++;
    sp.invested.essence += cost.essence; sp.invested.credits += cost.credits;
    const d = recordProg(sp, 'upgrade', fromName, PR().stageName(sp.base, sp.level), cost, prevStats, `${fromName} → ${SP.stageName(sp)} (stage ${sp.level + 1}). ${PR().stageUnlock(sp.base, sp.level)}.`);
    S().stats.upgrades++;
    const levelUps = addXp(25);
    bus.emit('specimens'); bus.emit('upgraded', { spec: sp }); tick();
    return { ok: true, spec: sp, prev, cost, levelUps, delta: d };
  }

  function evolveOptions(sp) {
    return SP.evolutions(sp).map(ev => ({ ev, ready: sp.level >= ev.level, affordable: canAfford({ essence: ev.essence }) }));
  }
  function evolve(id, toBase) {
    const sp = get(id); if (!sp) return { ok: false, err: 'Missing specimen' };
    const ev = SP.evolutions(sp).find(e => e.to === toBase);
    if (!ev) return { ok: false, err: 'No such evolution' };
    if (sp.level < ev.level) return { ok: false, err: `Needs ${PR().stageName(sp.base, ev.level)} stage` };
    if (!canAfford({ essence: ev.essence })) return { ok: false, err: 'Not enough Essence' };
    spend({ essence: ev.essence });
    const from = SP.itemOf(sp), prevStats = ST().snapshot(sp), carry = ST().carryFor(sp, toBase), fromLook = 'base:' + from.id;
    sp.invested.essence += ev.essence;
    sp.looks = sp.looks || []; if (!sp.looks.includes(fromLook)) sp.looks.push(fromLook);
    sp.base = toBase; sp.level = 0; sp.form = null; sp.look = 'auto'; sp.carry = carry;
    const to = D.ITEMS[toBase];
    recordProg(sp, 'evolve', from.name, to.name, { essence: ev.essence }, prevStats, `Evolved from ${from.name} into ${to.name}.`);
    const s = S();
    const d = s.discovered[toBase] || (s.discovered[toBase] = { count: 0, first: Date.now(), bestPotential: 0 });
    const isNew = d.count === 0; d.count++; d.bestPotential = Math.max(d.bestPotential, sp.potential);
    s.stats.evolutions++;
    const levelUps = addXp(100);
    bus.emit('specimens'); bus.emit('evolved', { spec: sp, from, to }); tick();
    return { ok: true, spec: sp, from, to, isNew, levelUps };
  }

  /** Major-transformation options for a specimen's base item (forms/branches), with readiness. */
  function transformOptions(sp) {
    const forms = PR().formsFor(sp.base), cost = PR().transformCost(sp.base), has = !!sp.form;
    const reformCost = isUnlimited() ? {} : { essence: Math.ceil(cost.essence * 0.6) };
    return { kind: PR().kindOf(sp.base), branching: forms.length > 1, current: sp.form, cost, reformCost, levelNeeded: PR().FORM_LEVEL,
      stageReady: sp.level >= PR().FORM_LEVEL,
      forms: forms.map(f => ({ form: f, current: sp.form === f.id, unlocked: has && ((sp.looks || []).includes('form:' + f.id) || sp.form === f.id),
        ready: sp.level >= PR().FORM_LEVEL && !has, affordable: canAfford(cost), preview: ST().compute(sp, { form: f.id }) })) };
  }
  function transform(id, formId) {
    const sp = get(id); if (!sp) return { ok: false, err: 'Missing specimen' };
    const f = PR().form(formId);
    if (!f || f.item !== sp.base) return { ok: false, err: 'No such transformation' };
    if (sp.form) return { ok: false, err: 'Already transformed' };
    if (sp.level < PR().FORM_LEVEL) return { ok: false, err: `Needs the ${PR().stageName(sp.base, PR().FORM_LEVEL)} stage` };
    const cost = PR().transformCost(sp.base);
    if (!canAfford(cost)) return { ok: false, err: 'Not enough resources' };
    const prevStats = ST().snapshot(sp);
    spend(cost);
    sp.invested.essence += cost.essence; sp.invested.credits += cost.credits;
    sp.form = f.id; sp.look = 'auto';
    const d = recordProg(sp, 'form', PR().stageName(sp.base, sp.level), f.name, cost, prevStats, `${f.kind}: became ${f.name}.`);
    S().stats.transformations = (S().stats.transformations || 0) + 1;
    const levelUps = addXp(80);
    bus.emit('specimens'); bus.emit('transformed', { spec: sp, form: f }); tick();
    return { ok: true, spec: sp, form: f, cost, levelUps, delta: d };
  }
  /** Switch an already-transformed specimen to its other branch. Free in Unlimited Mode; an Essence fee in Standard. The old branch stays selectable as an appearance. */
  function reform(id, formId) {
    const sp = get(id); if (!sp) return { ok: false, err: 'Missing specimen' };
    const f = PR().form(formId);
    if (!f || f.item !== sp.base || !sp.form || sp.form === f.id) return { ok: false, err: 'Nothing to change' };
    const fee = transformOptions(sp).reformCost;
    if (!canAfford(fee)) return { ok: false, err: 'Not enough Essence' };
    const old = PR().form(sp.form), prevStats = ST().snapshot(sp);
    spend(fee); if (fee.essence) sp.invested.essence += fee.essence;
    sp.looks = sp.looks || []; if (!sp.looks.includes('form:' + old.id)) sp.looks.push('form:' + old.id);
    sp.looks = sp.looks.filter(l => l !== 'form:' + f.id);
    sp.form = f.id; sp.look = 'auto';
    const d = recordProg(sp, 'form', old.name, f.name, fee, prevStats, `Rebound from ${old.name} to ${f.name}.`);
    bus.emit('specimens'); bus.emit('transformed', { spec: sp, form: f }); tick();
    return { ok: true, spec: sp, form: f, cost: fee, delta: d };
  }
  /** Choose which unlocked appearance the specimen shows. Progress is untouched. */
  function setLook(id, lookId) {
    const sp = get(id); if (!sp) return false;
    if (!PR().looksOf(sp).some(l => l.id === lookId)) return false;
    sp.look = lookId; bus.emit('specimens'); tick(); return true;
  }

  // ---------- Fusion (Phase Four) ----------
  const FU = () => AV.fusion;
  /** Why the given inputs cannot be consumed (Standard rules; Unlimited when consuming). Locked/favorited never; a companion only as the primary. */
  function fuseBlockers(p, ds) {
    const out = [];
    [p, ...ds].forEach((x, i) => { if (!x) return; if (x.locked) out.push(`${SP.displayName(x)} (#${U.pad(x.serial, 4)}) is locked`); else if (x.favorite) out.push(`${SP.displayName(x)} (#${U.pad(x.serial, 4)}) is favorited`); else if (i > 0 && S().companion === x.id) out.push(`${SP.displayName(x)} is your companion`); else if (inDeck(x.id)) out.push(`${SP.displayName(x)} (#${U.pad(x.serial, 4)}) is in a combat deck`); });
    return out;
  }
  /** Read-only: the exact result, cost, protection blockers and consequences of a fusion. */
  function fusePreview(pid, dids, opts = {}) {
    const p = get(pid), ds = (dids || []).map(get).filter(Boolean), pl = FU().plan(p, ds);
    if (!pl.ok) return pl;
    const sim = isUnlimited() && !opts.consume;
    pl.sim = sim; pl.cost = isUnlimited() ? {} : pl.cost; pl.affordable = canAfford(pl.cost); pl.blocked = sim ? [] : fuseBlockers(p, ds);
    pl.consequences = sim ? ['Simulated (Unlimited Mode): every input stays in your Vault.', 'A new fused specimen is added with its own identifier.', 'It can be reversed later; nothing is lost.']
      : ['The primary and every donor are consumed (removed from the Vault).', 'A new fused specimen is created with a new identifier and the primary\'s ownership history.', 'The fusion ledger keeps a full record of every parent.', 'A safety backup of your save is written first. This cannot be undone in Standard Mode.'];
    return pl;
  }
  /** Commit a fusion atomically. On any failure the whole state is rolled back to the moment before. */
  function fuse(pid, dids, opts = {}) {
    const p = get(pid), ds = (dids || []).map(get).filter(Boolean), pl = FU().plan(p, ds);
    if (!pl.ok) return { ok: false, err: pl.reason };
    const sim = isUnlimited() && !opts.consume, blocked = sim ? [] : fuseBlockers(p, ds);
    if (blocked.length) return { ok: false, err: blocked.join('; ') + '. Unlock or un-favorite first.', blocked };
    const cost = isUnlimited() ? {} : pl.cost; if (!canAfford(cost)) return { ok: false, err: 'Not enough resources' };
    const s = S(), snapshot = JSON.stringify(s);
    if (!sim) { try { localStorage.setItem(AV.state.BACKUP_KEY_FUSION, snapshot); } catch (e) { return { ok: false, err: 'The safety backup could not be written, so nothing was fused.' }; } }
    let r;
    try {
      spend(cost);
      r = pl.result; const fxId = 'FX-' + U.pad(++s.fusionSeq, 4), now = Date.now(), parents = [p, ...ds];
      r.id = 's' + (s.nextId++); Object.assign(r.fusion, { id: fxId, at: now, sim });
      r.origin = Object.assign({}, p.origin, { fusion: fxId });
      const label = { duplicate: 'duplicate fusion', recipe: 'recipe fusion', hybrid: 'hybrid fusion', infusion: 'element infusion', oddity: 'Oddity fusion', composite: 'composite print' }[pl.kind] || 'fusion';
      r.history = (p.history || []).slice(-40).concat([{ t: now, type: 'fuse', text: `${sim ? 'Simulated ' : ''}${label} ${fxId} of ${parents.map(x => `${SP.displayName(x)} #${U.pad(x.serial, 4)}`).join(' + ')}${r.fusion.mutation ? ' — ' + r.fusion.mutation.name : ''}${pl.kind === 'duplicate' ? ' — Fusion Rank ' + FU().ROMAN[r.fusion.rank] : ''}.` }]);
      r.prog = (p.prog || []).slice(-59).concat([{ t: now, type: 'fuse', from: SP.displayName(p), to: r.fusion.name || SP.itemOf(p).name, cost, delta: AV.stats.delta(pl.before, pl.after) }]);
      s.specimens[r.id] = r;
      const consumed = sim ? [] : parents.map(x => x.id);
      if (AV.__faultFusion) throw new Error('fault injected (test hook)');
      carryOrg(p.id, r.id);
      consumed.forEach(id => delete s.specimens[id]); pruneOrg(consumed);
      if (consumed.includes(s.companion)) s.companion = r.id;
      s.recent = [r.id].concat((s.recent || []).filter(i => !consumed.includes(i))).slice(0, 24);
      s.fusions.push({ id: fxId, at: now, kind: pl.kind, recipe: r.fusion.recipe, sim, consumed, result: r.id, mutation: r.fusion.mutation, cost, parents: parents.map(x => JSON.parse(JSON.stringify(x))) });
      s.stats.fusions = (s.stats.fusions || 0) + 1;
      if (!s.specimens[r.id] || Object.values(r.stats || {}).some(v => !isFinite(v)) || consumed.some(id => s.specimens[id])) throw new Error('validation failed');
    } catch (e) {
      AV.state.replace(JSON.parse(snapshot)); bus.emit('specimens'); bus.emit('wallet');
      return { ok: false, err: 'The fusion failed and was rolled back; nothing changed (' + e.message + ').', restored: true };
    }
    const levelUps = addXp(40);
    bus.emit('specimens'); bus.emit('fused', { spec: r }); AV.state.save(true);
    return { ok: true, spec: r, fx: r.fusion.id, sim, plan: pl, levelUps };
  }
  /** Unlimited Mode: undo a fusion. Restores any parent that was consumed (from the ledger) and removes the fused specimen. */
  function unfuse(rid) {
    if (!isUnlimited()) return { ok: false, err: 'Reversing a fusion is an Unlimited Mode power.' };
    const s = S(), r = get(rid); if (!r || !r.fusion) return { ok: false, err: 'Not a fused specimen' };
    const rec = (s.fusions || []).find(f => f.result === rid); if (!rec) return { ok: false, err: 'No fusion record' };
    let restored = 0; rec.parents.forEach(ps => { if (!s.specimens[ps.id] && rec.consumed.includes(ps.id)) { s.specimens[ps.id] = ps; restored++; } });
    delete s.specimens[rid]; rec.reversed = Date.now(); if (s.companion === rid) s.companion = rec.parents[0].id;
    s.recent = (s.recent || []).filter(i => i !== rid);
    bus.emit('specimens'); AV.state.save(true);
    return { ok: true, restored };
  }

  // ---------- Vault organisation (Phase Four) ----------
  // Folders/albums (a specimen may sit in several), tags, notes and saved searches live in S().org. None of it touches identity.
  const ORG = () => S().org;
  const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  const touch = ids => { const t = Date.now(); ids.forEach(id => (ORG().touched[id] = t)); };
  const orgChanged = () => { bus.emit('org'); tick(); };
  function folderCreate(name) { const f = { id: 'f' + Date.now().toString(36) + (ORG().folders.length + 1), name: cleanName(name) || 'New collection', ids: [], at: Date.now() }; ORG().folders.push(f); orgChanged(); return f; }
  function folderRename(fid, name) { const f = ORG().folders.find(x => x.id === fid); if (!f || !cleanName(name)) return false; f.name = cleanName(name); orgChanged(); return true; }
  function folderDelete(fid) { const o = ORG(), n = o.folders.length; o.folders = o.folders.filter(x => x.id !== fid); orgChanged(); return o.folders.length < n; }
  function folderAdd(fid, ids) { const f = ORG().folders.find(x => x.id === fid); if (!f) return 0; let n = 0; ids.forEach(id => { if (get(id) && !f.ids.includes(id)) { f.ids.push(id); n++; } }); touch(ids); orgChanged(); return n; }
  function folderRemove(fid, ids) { const f = ORG().folders.find(x => x.id === fid); if (!f) return 0; const n = f.ids.length; f.ids = f.ids.filter(id => !ids.includes(id)); orgChanged(); return n - f.ids.length; }
  const normTag = t => String(t || '').toLowerCase().replace(/^#/, '').replace(/[^a-z0-9 _-]/g, '').trim().replace(/\s+/g, '-').slice(0, 24);
  function setTags(id, tags) { if (!get(id)) return []; const t = [...new Set((tags || []).map(normTag).filter(Boolean))].slice(0, 12); if (t.length) ORG().tags[id] = t; else delete ORG().tags[id]; touch([id]); orgChanged(); return t; }
  function addTag(ids, tag) { const t = normTag(tag); if (!t) return 0; let n = 0; ids.forEach(id => { if (!get(id)) return; const cur = ORG().tags[id] || []; if (!cur.includes(t) && cur.length < 12) { ORG().tags[id] = cur.concat(t); n++; } }); touch(ids); orgChanged(); return n; }
  function removeTag(ids, tag) { const t = normTag(tag); ids.forEach(id => { const cur = ORG().tags[id]; if (cur) { const nx = cur.filter(x => x !== t); if (nx.length) ORG().tags[id] = nx; else delete ORG().tags[id]; } }); orgChanged(); }
  function setNote(id, text) { if (!get(id)) return; const t = String(text || '').slice(0, 600); if (t.trim()) ORG().notes[id] = t; else delete ORG().notes[id]; touch([id]); orgChanged(); }
  function searchSave(p) { const s = { id: 'q' + Date.now().toString(36) + (ORG().searches.length + 1), name: cleanName(p.name) || 'Saved search', fav: false, f: p.f || {}, q: p.q || '', sort: p.sort || 'newest', view: p.view || 'grid', at: Date.now() }; ORG().searches.push(s); orgChanged(); return s; }
  function searchUpdate(qid, patch) { const s = ORG().searches.find(x => x.id === qid); if (!s) return null; if (patch.name != null) s.name = cleanName(patch.name) || s.name; ['f', 'q', 'sort', 'view', 'fav'].forEach(k => { if (patch[k] !== undefined) s[k] = patch[k]; }); orgChanged(); return s; }
  function searchDelete(qid) { const o = ORG(), n = o.searches.length; o.searches = o.searches.filter(x => x.id !== qid); orgChanged(); return o.searches.length < n; }
  /** Drop organisation references to specimens that no longer exist (dismantled, or consumed by a fusion). */
  function pruneOrg(ids) { const o = ORG(); if (!o) return; o.folders.forEach(f => { f.ids = f.ids.filter(id => !ids.includes(id)); }); ids.forEach(id => { delete o.tags[id]; delete o.notes[id]; delete o.touched[id]; }); }
  /** A fused result inherits its primary's tags, note and collections. */
  function carryOrg(fromId, toId) { const o = ORG(); if (!o) return; if (o.tags[fromId]) o.tags[toId] = o.tags[fromId].slice(); if (o.notes[fromId]) o.notes[toId] = o.notes[fromId]; o.folders.forEach(f => { if (f.ids.includes(fromId) && !f.ids.includes(toId)) f.ids.push(toId); }); o.touched[toId] = Date.now(); }

  // ---------- Daily reward ----------
  function dailyStatus(today = U.dateKey()) {
    const d = S().daily;
    return { canClaim: d.last !== today, streak: d.streak, nextIndex: d.last === today ? d.streak % 7 : (isConsecutive(d.last, today) ? d.streak % 7 : 0) };
  }
  function isConsecutive(last, today) {
    if (!last) return false;
    const a = new Date(last + 'T00:00:00'), b = new Date(today + 'T00:00:00');
    return Math.round((b - a) / 86400000) === 1;
  }
  function claimDaily(today = U.dateKey()) {
    const d = S().daily;
    if (d.last === today) return { ok: false, err: 'Already claimed today' };
    const streak = isConsecutive(d.last, today) ? d.streak + 1 : 1;
    const reward = D.DAILY_REWARDS[(streak - 1) % 7];
    d.last = today; d.streak = streak;
    grant(reward);
    const levelUps = addXp(15);
    bus.emit('profile'); tick();
    return { ok: true, reward, streak, levelUps };
  }

  // ---------- Store (all fictional) ----------
  function buyCash(id) {
    const b = D.STORE.cash.find(x => x.id === id); if (!b) return { ok: false, err: 'Unknown bundle' };
    const s = S();
    if (s.playCash + 1e-9 < b.price) return { ok: false, err: 'Not enough Play Cash' };
    s.playCash = Math.round((s.playCash - b.price) * 100) / 100;
    grant({ gems: b.gems + b.bonus }, { noMult: true });
    bus.emit('wallet'); tick();
    return { ok: true, gems: b.gems + b.bonus };
  }
  function topUpPlayCash() { S().playCash = Math.round((S().playCash + 50) * 100) / 100; bus.emit('wallet'); tick(); }
  function trade(pay, get_) {
    if (!canAfford(pay)) return { ok: false, err: 'Not enough resources' };
    spend(pay); grant(get_, { noMult: true }); tick();
    return { ok: true };
  }
  const exchange = id => { const x = D.STORE.exchange.find(e => e.id === id); return x ? trade(x.pay, x.get) : { ok: false, err: 'Unknown' }; };
  function buyBundle(id, dailyDiscount) {
    const b = D.STORE.bundles.find(e => e.id === id) || D.STORE.dailyOffers.find(e => e.id === id);
    if (!b) return { ok: false, err: 'Unknown' };
    const pay = {}; Object.keys(b.pay).forEach(k => (pay[k] = dailyDiscount ? Math.ceil(b.pay[k] * 0.7) : b.pay[k]));
    return trade(pay, b.get);
  }
  function dailyOfferId(today = U.dateKey()) {
    const n = today.split('-').reduce((a, v) => a * 31 + (+v), 7);
    return D.STORE.dailyOffers[n % D.STORE.dailyOffers.length].id;
  }

  // ---------- Mode / settings ----------
  function setMode(mode) { S().mode = mode === 'unlimited' ? 'unlimited' : 'standard'; bus.emit('mode'); bus.emit('wallet'); tick(); }
  function setSetting(key, value) { S().settings[key] = value; bus.emit('settings', { key }); tick(); }

  // ---------- Derived summaries ----------
  function totals() {
    const sp = all();
    return {
      count: sp.length,
      value: sp.reduce((a, x) => a + SP.value(x), 0),
      discovered: Object.keys(S().discovered).length,
      codexTotal: D.ITEM_LIST.length,
      favorites: sp.filter(x => x.favorite).length,
      best: sp.slice().sort((a, b) => SP.value(b) - SP.value(a))[0] || null,
    };
  }

  // ------------------------------------------------------------------ Phase Five: combat decks (the only writers of save.combat)
  // Combat reads collection data and never changes a specimen. Deck entries are specimen ids; validation lives in combat/deck.js.
  const CB = () => S().combat;
  const deckName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  const cleanEntries = ids => { const seen = new Set(); return (ids || []).map(x => String(x && x.id != null ? x.id : x)).filter(id => id && !seen.has(id) && seen.add(id)).slice(0, AV.combat.tuning.hand.deck).map(id => ({ id })); };
  function combatChanged() { bus.emit('combat'); tick(); }
  function deckCreate(name, ids, preset) {
    const c = CB(); if (!c) return null; if (c.decks.length >= 20) return null;
    const now = Date.now(), k = { id: 'd' + now.toString(36) + (c.decks.length + 1), name: deckName(name) || 'Deck ' + (c.decks.length + 1), entries: cleanEntries(ids), preset: preset || null, created: now, updated: now };
    c.decks.push(k); if (!c.activeDeck) c.activeDeck = k.id; combatChanged(); return k;
  }
  /** patch: { name?, ids? } — ids replaces the whole entry list (max 10, unique). Unknown ids are kept: the editor flags them, nothing is silently dropped. */
  function deckUpdate(id, patch) {
    const c = CB(), k = c && c.decks.find(x => x.id === id); if (!k) return null;
    if (patch.name != null && deckName(patch.name)) k.name = deckName(patch.name);
    if (patch.ids) { k.entries = cleanEntries(patch.ids); k.preset = patch.preset !== undefined ? patch.preset : null; }
    k.updated = Date.now(); combatChanged(); return k;
  }
  function deckDelete(id) { const c = CB(); if (!c) return false; const n = c.decks.length; c.decks = c.decks.filter(x => x.id !== id); if (c.activeDeck === id) c.activeDeck = c.decks.length ? c.decks[0].id : null; if (c.decks.length !== n) combatChanged(); return c.decks.length < n; }
  function deckSetActive(id) { const c = CB(); if (!c || !c.decks.some(x => x.id === id)) return false; c.activeDeck = id; combatChanged(); return true; }
  function deckDuplicate(id) { const c = CB(), k = c && c.decks.find(x => x.id === id); return k ? deckCreate(k.name + ' copy', k.entries.map(e => e.id), null) : null; }
  function combatSetting(key, val) { const c = CB(); if (!c || !(key in c.settings)) return false; c.settings[key] = val; combatChanged(); return true; }

  AV.engine = { inDeck, deckCreate, deckUpdate, deckDelete, deckSetActive, deckDuplicate, combatSetting, isUnlimited, balance, canAfford, spend, grant, price, poolItems, rarityTable, oddsReport, addSpecimen, xpNeeded, addXp,
    fusePreview, fuse, unfuse, fuseBlockers,
    folderCreate, folderRename, folderDelete, folderAdd, folderRemove, setTags, addTag, removeTag, setNote, searchSave, searchUpdate, searchDelete, pruneOrg,
    open, giveStarter, get, all, protectReason, toggleFavorite, toggleLock, setFlags, rename, setCompanion,
    dismantle, duplicatePlan, essencePreview, duplicateSpecimen, upgrade, upgradePreview, evolveOptions, evolve, transformOptions, transform, reform, setLook,
    dailyStatus, claimDaily, buyCash, topUpPlayCash, exchange, buyBundle, dailyOfferId, setMode, setSetting, totals };
})();

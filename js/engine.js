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
  function poolItems(container) {
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
      for (let i = 0; i < c.count; i++) {
        const slot = c.slots[i] || {};
        const pityCount = (s.pity[c.id] || 0);
        const pityActive = !!(c.pity && pityCount + 1 >= c.pity.after);
        const item = rollSlot(c, slot.min, pityActive);
        const spec = SP.generate(item.id, { container: c.id, variantBoost: c.variantBoost });
        const meta = addSpecimen(spec, `Drawn from a ${c.name}.`);
        if (c.pity) {
          if (D.RARITY[item.rarity].tier >= D.RARITY[c.pity.rarity].tier) s.pity[c.id] = 0;
          else s.pity[c.id] = pityCount + 1;
        }
        xp += (D.RARITY[item.rarity].tier + 1) * 5 + (meta.isNew ? 40 : 0);
        results.push({ spec, isNew: meta.isNew, newVariant: meta.newVariant, pityTriggered: pityActive && D.RARITY[item.rarity].tier >= D.RARITY[c.pity.rarity].tier });
      }
    }
    s.stats.opened += count;
    const levelUps = addXp(xp);
    bus.emit('specimens'); bus.emit('opened', { container: c, results });
    tick();
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
    return null;
  }
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

  AV.engine = { isUnlimited, balance, canAfford, spend, grant, price, poolItems, rarityTable, oddsReport, addSpecimen, xpNeeded, addXp,
    open, giveStarter, get, all, protectReason, toggleFavorite, toggleLock, setFlags, rename, setCompanion,
    dismantle, duplicatePlan, essencePreview, duplicateSpecimen, upgrade, upgradePreview, evolveOptions, evolve, transformOptions, transform, reform, setLook,
    dailyStatus, claimDaily, buyCash, topUpPlayCash, exchange, buyBundle, dailyOfferId, setMode, setSetting, totals };
})();

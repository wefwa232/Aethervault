/* AETHERVAULT — Combat deck rules. Pure: takes the save object and a deck, returns verdicts. No DOM, no mutation, no Math.random.
 * A deck is exactly 10 specimens (any mixture). Entries are specimen ids; they are checked against the LIVE save every time, and anything wrong is
 * flagged — never silently removed. Presets are computed from the collection on demand and copied into a deck when chosen. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning, DF = () => AV.combat.defs;

  /** Verdict for one deck. entries: [{id}] (or plain ids). */
  function validate(save, entries) {
    const want = T().hand.deck, seen = new Set(), rows = [], issues = [];
    (entries || []).forEach(e => {
      const id = String(e && e.id != null ? e.id : e), spec = (save.specimens || {})[id] || null;
      let v = DF().readiness(spec);
      if (v.ok && seen.has(id)) v = { ok: false, code: 'duplicate', reason: 'Listed twice.' };
      seen.add(id);
      const t = v.ok ? AV.combat.translate(spec) : null;
      rows.push({ id, spec, ok: v.ok, code: v.code, reason: v.reason, def: spec ? DF().get(spec.base) : null, cost: spec && DF().get(spec.base) ? DF().get(spec.base).cost : 0, facts: t && t.ok ? AV.combat.translate.facts(spec) : null });
    });
    const good = rows.filter(r => r.ok), bad = rows.filter(r => !r.ok);
    if (rows.length !== want) issues.push(`Needs exactly ${want} specimens (has ${rows.length}).`);
    if (bad.length) issues.push(`${bad.length} specimen${bad.length === 1 ? ' is' : 's are'} not usable: ${bad.slice(0, 3).map(r => r.reason.replace(/\.$/, '')).join('; ')}.`);
    const cost = good.reduce((a, r) => a + r.cost, 0), roles = {}; good.forEach(r => { roles[r.def.role] = (roles[r.def.role] || 0) + 1; });
    return { rows, count: rows.length, usable: good.length, valid: rows.length === want && !bad.length, practice: good.length >= 1, issues, avgCost: good.length ? Math.round(cost / good.length * 10) / 10 : 0, roles, want };
  }

  /** Every specimen that can enter a deck right now, with its combat summary, strongest first (ties by id, so the order is stable). */
  function eligible(save) {
    const out = [];
    Object.keys(save.specimens || {}).forEach(id => {
      const sp = save.specimens[id], v = DF().readiness(sp); if (!v.ok) return;
      const t = AV.combat.translate(sp), def = DF().get(sp.base);
      out.push({ id, spec: sp, def, t, rating: t.kind === 'pet' ? t.hp * t.dps / 100 : 8 + def.cost }); // support cards rank after Pets in the presets
    });
    return out.sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1));
  }

  /** Presets, from the collection as it is now. Each: { id, name, blurb, ids[] } (fewer than 10 ids when the collection is small). */
  function presets(save) {
    const pool = eligible(save), want = T().hand.deck; if (!pool.length) return [];
    const pick = (order, must) => {
      const chosen = [], has = id => chosen.some(c => c.id === id);
      (must || []).forEach(role => { const c = order.find(x => x.def.role === role && !has(x.id)); if (c) chosen.push(c); });
      order.forEach(c => { if (chosen.length < want && !has(c.id)) chosen.push(c); });
      return chosen.slice(0, want).map(c => c.id);
    };
    const byRating = pool, cheap = pool.slice().sort((a, b) => a.def.cost - b.def.cost || b.rating - a.rating || (a.id < b.id ? -1 : 1)), heavy = pool.slice().sort((a, b) => b.def.cost - a.def.cost || b.rating - a.rating || (a.id < b.id ? -1 : 1));
    return [
      { id: 'starter', name: 'Recommended Starter', blurb: 'A balanced mix: front line, ranged damage, support and a disruptor, then your strongest.', ids: pick(byRating, ['vanguard', 'ranged', 'striker', 'support', 'disruptor']) },
      { id: 'swarm', name: 'Quick Swarm', blurb: 'Cheap units that arrive often and keep the Elixir flowing.', ids: pick(cheap, ['striker', 'ranged']) },
      { id: 'heavy', name: 'Heavy Guard', blurb: 'Expensive, durable units; fewer deployments, bigger effect.', ids: pick(heavy, ['vanguard', 'ranged']) },
    ];
  }

  AV.combat.deck = { validate, eligible, presets };
})();

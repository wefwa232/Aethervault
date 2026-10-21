/* AETHERVAULT — Phase Three universal stat framework. Pure functions of stored specimen data: no DOM, no state, no Math.random.
 *   value_k = soft( identity_k + trait_k + growth_k + form_k + carry_k )
 *   identity   the item's own profile (rarity bonus + archetype focus/weak + stable per-item noise)   ≈ 60–70 %
 *   trait      condition character, variant, pattern, size, seed noise                                 ≈ 15–25 %
 *   growth     upgrade stages, scaled by potential and by how central the stat is to the item
 *   form       a major transformation's lean (+) and trade-off (−)
 *   carry      what an evolution keeps of earlier growth
 * The same specimen always yields the same numbers. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util;
  const P = () => AV.progress;

  // tag: power · finesse · stable · volatile · magic · growth
  const S = (k, label, tag, hint) => ({ k, label, tag, hint });
  const FAMILIES = {
    weapon: { name: 'Weapon', stats: [
      S('power', 'Power', 'power', 'Raw striking force.'), S('speed', 'Speed', 'finesse', 'How quickly it acts.'), S('precision', 'Precision', 'finesse', 'How exactly it lands.'),
      S('stability', 'Stability', 'stable', 'Resistance to wear and misfire.'), S('crit', 'Critical Power', 'volatile', 'Chance for an outsized effect.'),
      S('energy', 'Energy Capacity', 'magic', 'Charge it can hold.'), S('growth', 'Upgrade Potential', 'growth', 'How far this specimen can be developed.')] },
    shield: { name: 'Shield', stats: [
      S('guard', 'Guard', 'stable', 'Protection it provides.'), S('resilience', 'Resilience', 'stable', 'Damage it can take before failing.'), S('reflect', 'Deflection', 'finesse', 'Force it turns aside.'),
      S('stability', 'Stability', 'stable', 'Steadiness under load.'), S('energy', 'Energy Capacity', 'magic', 'Charge it can hold.'), S('growth', 'Upgrade Potential', 'growth', 'How far this specimen can be developed.')] },
    pet: { name: 'Being', stats: [
      S('power', 'Power', 'power', 'Physical strength.'), S('agility', 'Agility', 'finesse', 'Speed and balance.'), S('instinct', 'Instinct', 'finesse', 'Awareness and reaction.'),
      S('bond', 'Bond', 'stable', 'Closeness to its collector.'), S('resilience', 'Resilience', 'stable', 'Toughness and recovery.'),
      S('mutation', 'Mutation Affinity', 'volatile', 'Openness to change.'), S('growth', 'Evolution Potential', 'growth', 'How far this specimen can grow.')] },
    machine: { name: 'Machine', stats: [
      S('output', 'Output', 'power', 'Work it produces.'), S('efficiency', 'Efficiency', 'finesse', 'Output per unit of fuel.'), S('durability', 'Durability', 'stable', 'Wear it endures.'),
      S('precision', 'Precision', 'finesse', 'Tolerance of its parts.'), S('stability', 'Stability', 'stable', 'Steadiness under strain.'),
      S('overdrive', 'Overdrive', 'volatile', 'Headroom beyond its limits.'), S('growth', 'Upgrade Potential', 'growth', 'How far this specimen can be developed.')] },
    relic: { name: 'Relic', stats: [
      S('resonance', 'Resonance', 'magic', 'Strength of its hum.'), S('potency', 'Potency', 'power', 'Effect it carries.'), S('stability', 'Stability', 'stable', 'Resistance to unravelling.'),
      S('preservation', 'Preservation', 'stable', 'How well it keeps its form.'), S('mystery', 'Mystery', 'volatile', 'What it has not yet revealed.'),
      S('growth', 'Awakening Potential', 'growth', 'How far it can be awakened.')] },
    oddity: { name: 'Oddity', stats: [
      S('coherence', 'Coherence', 'stable', 'How much it agrees with itself.'), S('containment', 'Containment', 'stable', 'How well it stays put.'), S('activity', 'Activity', 'volatile', 'How much it is doing.'),
      S('distortion', 'Distortion', 'volatile', 'Reality bent around it.'), S('stability', 'Stability', 'stable', 'Resistance to collapse.'),
      S('growth', 'Unknown Potential', 'growth', 'What it might still become.')] },
    // Defined for a later phase: the game has no cosmetic items yet.
    cosmetic: { name: 'Cosmetic', stats: [
      S('finish', 'Finish', 'stable', 'Surface quality.'), S('animation', 'Animation', 'finesse', 'Motion it carries.'), S('reactivity', 'Reactivity', 'finesse', 'How it answers touch.'),
      S('prestige', 'Prestige', 'power', 'Standing among collectors.'), S('integrity', 'Rarity Integrity', 'stable', 'Faithfulness to its tier.'), S('growth', 'Enhancement Potential', 'growth', 'How far it can be enhanced.')] },
  };
  Object.values(FAMILIES).forEach(f => { f.byKey = {}; f.stats.forEach(s => (f.byKey[s.k] = s)); });

  // variant → the stat tags it nudges
  const VARIANT_TAGS = { foil: ['stable', 'power'], holographic: ['finesse', 'magic'], golden: ['power', 'stable'], inverted: ['volatile', 'finesse'], shadow: ['volatile', 'power'],
    corrupted: ['volatile', 'magic'], celestial: ['magic', 'finesse'], glitched: ['volatile', 'finesse'], prismatic: ['magic', 'finesse', 'power'] };

  function hash01(str) { // FNV-1a → [0,1)
    let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296;
  }
  const familyOf = itemId => { const a = P().ARCH[itemId]; return FAMILIES[a ? a.fam : 'weapon']; };
  const famName = itemId => { const a = P().ARCH[itemId]; return a ? a.fam : 'weapon'; };
  const soft = v => Math.min(140, v > 100 ? 100 + (v - 100) * 0.5 : v);
  const maxLevelOf = s => (s.potential >= 25 ? 4 : 3);

  /** Everything that goes into one stat, so the UI can explain it. */
  function parts(spec, stat, level) {
    const item = D.ITEMS[spec.base], arch = P().ARCH[spec.base], fam = FAMILIES[arch.fam], k = stat.k, tier = D.RARITY[item.rarity].tier, tag = stat.tag;
    if (k === 'growth') { const v = 10 + spec.potential * 0.9; return { identity: v, trait: 0, growth: 0, form: 0, carry: 0, raw: v, cond: 0, variant: 0, pattern: 0, size: 0, noise: 0, focus: 0 }; }
    const focus = k === arch.focus[0] ? 16 : k === arch.focus[1] ? 9 : k === arch.weak ? -10 : 0;
    const identity = U.clamp(34 + 2.4 * tier + focus + (hash01(spec.base + ':' + k) - 0.5) * 12, 18, 90);
    const q = 2 - (spec.condition || 0);
    const cond = tag === 'stable' ? q * 3 : tag === 'volatile' ? -q * 1.5 : 0;
    const variant = (VARIANT_TAGS[spec.variant] || []).includes(tag) ? 5 : 0;
    const pattern = (hash01((spec.pattern || 'plain') + ':' + k) - 0.5) * 4;
    const size = tag === 'power' ? ((spec.size || 1) - 1) * 20 : 0;
    const noise = (hash01(((spec.seed >>> 0) || 0) + ':' + k) - 0.5) * 8;
    const trait = cond + variant + pattern + size + noise;
    const w = k === arch.weak ? 0.6 : (k === arch.focus[0] || k === arch.focus[1]) ? 1.4 : 1;
    const growth = Math.min(level, 4) * (2.2 + spec.potential / 30) * w;
    const f = spec.form ? P().form(spec.form) : null;
    const form = f ? (f.lean[k] || 0) - ((f.trade && f.trade[k]) || 0) : 0;
    const carry = (spec.carry && spec.carry[k]) || 0;
    return { identity, trait, growth, form, carry, raw: identity + trait + growth + form + carry, cond, variant, pattern, size, noise, focus };
  }

  /** Stats for a specimen. over: { level, form, carry } to preview a hypothetical state. */
  function compute(spec, over) {
    const s = Object.assign({ condition: 2, potential: 50, level: 0, size: 1, seed: 0, pattern: 'plain', variant: 'none' }, spec, over || {}), fam = familyOf(s.base), level = s.level || 0;
    const list = fam.stats.map(st => { const p = parts(s, st, level); return { k: st.k, label: st.label, tag: st.tag, hint: st.hint, value: Math.max(1, Math.round(soft(p.raw))), parts: p }; });
    const map = {}; list.forEach(x => (map[x.k] = x.value));
    return { fam: famName(s.base), family: fam, list, map };
  }
  /** The value each stat reaches at this specimen's highest reachable stage (with the current form). */
  function ceiling(spec) { const c = compute(spec, { level: maxLevelOf(spec) }); return c.map; }
  /** Plain { key: value } snapshot stored on the specimen. */
  const snapshot = spec => compute(spec).map;
  /** Differences b − a for the keys of b (only non-zero). */
  function delta(a, b) { const d = {}; Object.keys(b).forEach(k => { const x = b[k] - (a && a[k] != null ? a[k] : 0); if (x) d[k] = x; }); return d; }
  /** Most important stats first: the item's focus stats, then the highest values. */
  function top(spec, n = 4) { const c = compute(spec), ar = P().ARCH[spec.base]; return c.list.filter(x => x.k !== 'growth').sort((a, b) => ((ar.focus.includes(b.k) ? 100 : 0) + b.value) - ((ar.focus.includes(a.k) ? 100 : 0) + a.value)).slice(0, n); }
  const total = spec => compute(spec).list.filter(x => x.k !== 'growth').reduce((a, x) => a + x.value, 0);
  /** Stats carried through an evolution: keeps 75 % of what was earned above the new species' own baseline, plus a flat jump. */
  function carryFor(prev, nextBase) {
    const before = compute(prev), probe = Object.assign({}, prev, { base: nextBase, level: 0, form: null, carry: null }), after = compute(probe), out = {};
    after.list.forEach(x => { if (x.k === 'growth') return; const old = before.map[x.k]; out[x.k] = Math.round(Math.max(0, old - x.value) * 0.75 + 4); });
    return out;
  }
  function describeDelta(spec, d) { const fam = familyOf(spec.base); return Object.keys(d).map(k => `${fam.byKey[k] ? fam.byKey[k].label : k} ${d[k] > 0 ? '+' : ''}${d[k]}`).join(', '); }

  AV.stats = { FAMILIES, familyOf, famName, parts, compute, ceiling, snapshot, delta, top, total, carryFor, describeDelta, hash01, maxLevelOf, VERSION: 1 };
})();

/* AETHERVAULT — Combat stat translation. Pure: a stored specimen in, combat attributes out, with a readable breakdown for every number.
 * Reads AV.stats.compute(spec) (which already folds in upgrade level, form/branch, variant, condition, fusion and card prints); it never writes to the specimen.
 * Rule of thumb: a stat of 50 gives exactly the def's base value; each formula is  base × (lo + (hi − lo) × stat/100)  so tuning stays legible.
 *   Pet:  resilience → HP · power → damage · agility → move speed · instinct → attack tempo and awareness · bond → ability cooldown · mutation → critical chance
 * Non-pet families map their stats to named attribute multipliers (1.00 at stat 50) that Combat B applies to each card's authored effect. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning;

  /** Linear multiplier: 1.0 at stat 50, lo at 0, hi at 100 (stats may exceed 100 up to 140). */
  const mult = (v, lo, hi) => lo + (hi - lo) * (v / 100);
  const r1 = n => Math.round(n * 10) / 10, r2 = n => Math.round(n * 100) / 100;
  const row = (key, label, value, unit, stat, statVal, formula) => ({ key, label, value, unit, stat, statVal, text: `${label} ${value}${unit ? ' ' + unit : ''} = ${formula}` });

  // [attribute, label, lo, hi] per family stat; "growth" never enters combat
  const FAMILY = {
    weapon:  { power: ['damage', 'Damage', 0.6, 1.4], speed: ['tempo', 'Tempo', 0.85, 1.15], precision: ['accuracy', 'Accuracy', 0.7, 1.3], stability: ['reliability', 'Reliability', 0.8, 1.2], crit: ['crit', 'Critical chance', 0.5, 1.5], energy: ['charges', 'Charges', 0.8, 1.2] },
    shield:  { guard: ['absorb', 'Absorb', 0.6, 1.4], resilience: ['hp', 'Barrier HP', 0.6, 1.4], reflect: ['reflect', 'Reflection', 0.5, 1.5], stability: ['duration', 'Duration', 0.8, 1.2], energy: ['charges', 'Charges', 0.8, 1.2] },
    machine: { output: ['damage', 'Output', 0.6, 1.4], efficiency: ['upkeep', 'Efficiency', 0.85, 1.15], durability: ['hp', 'Body HP', 0.6, 1.4], precision: ['accuracy', 'Accuracy', 0.7, 1.3], stability: ['reliability', 'Reliability', 0.8, 1.2], overdrive: ['burst', 'Overdrive burst', 0.5, 1.5] },
    relic:   { resonance: ['radius', 'Radius', 0.8, 1.2], potency: ['strength', 'Strength', 0.6, 1.4], stability: ['duration', 'Duration', 0.8, 1.2], preservation: ['hp', 'Hold', 0.8, 1.2], mystery: ['variance', 'Variance', 0.5, 1.5] },
    oddity:  { coherence: ['control', 'Control', 0.7, 1.3], containment: ['radius', 'Containment', 0.8, 1.2], activity: ['rate', 'Activity', 0.7, 1.3], distortion: ['strength', 'Distortion', 0.6, 1.4], stability: ['duration', 'Duration', 0.8, 1.2] },
  };

  /**
   * translate(spec) → { ok, kind, def, stats, hp, dmg, range, speed, interval, aggro, crit, cdr, dps, rows[], summary }  for pets;
   *                   { ok, kind, def, stats, attrs:{name: multiplier}, rows[] }  for other combat families;  { ok:false, reason } otherwise.
   * Integer-rounded where the simulation needs integers, so every consumer sees the same numbers.
   */
  function translate(spec) {
    const defs = AV.combat.defs, def = spec && defs.get(spec.base), cat = spec && defs.catOf(spec.base);
    if (!spec) return { ok: false, reason: 'No specimen.' };
    if (!def || cat === 'card') return { ok: false, reason: cat === 'card' ? 'Cards stay outside combat.' : 'No combat role.' };
    const st = AV.stats.compute(spec), m = st.map, rows = [];
    if (def.cat === 'pet') {
      const res = m.resilience || 50, pow = m.power || 50, agi = m.agility || 50, ins = m.instinct || 50, bond = m.bond || 50, mut = m.mutation || 0;
      const fHp = mult(res, 0.6, 1.4), fDmg = mult(pow, 0.6, 1.4), fSpd = mult(agi, 0.85, 1.15), fTempo = 1.15 - 0.3 * (ins / 100), fAware = mult(ins, 0.85, 1.15), fCd = 1.15 - 0.3 * (bond / 100);
      const hp = Math.max(1, Math.round(def.hp * fHp)), dmg = Math.max(1, Math.round(def.dmg * fDmg)), speed = r2(def.speed * fSpd), interval = r2(def.interval * fTempo), aggro = r1(def.aggro * fAware);
      const crit = Math.min(T().combat.critMax, r2((mut / 100) * 0.2)), cdr = r2(fCd);
      rows.push(
        row('hp', 'Max HP', hp, '', 'Resilience', res, `base ${def.hp} × ${r2(fHp)}  (Resilience ${res})`),
        row('dmg', 'Damage per hit', dmg, '', 'Power', pow, `base ${def.dmg} × ${r2(fDmg)}  (Power ${pow})`),
        row('speed', 'Move speed', speed, 'cells/s', 'Agility', agi, `base ${def.speed} × ${r2(fSpd)}  (Agility ${agi})`),
        row('interval', 'Attack interval', interval, 's', 'Instinct', ins, `base ${def.interval} × ${r2(fTempo)}  (Instinct ${ins})`),
        row('aggro', 'Awareness', aggro, 'cells', 'Instinct', ins, `base ${def.aggro} × ${r2(fAware)}  (Instinct ${ins})`),
        row('crit', 'Critical chance', Math.round(crit * 100), '%', 'Mutation', mut, `Mutation ${mut} × 0.2%, capped at ${Math.round(T().combat.critMax * 100)}%`),
        row('cdr', 'Ability cooldown', cdr, '×', 'Bond', bond, `1.15 − 0.3 × Bond ${bond}/100`));
      const dps = r1(dmg / interval);
      return { ok: true, kind: 'pet', def, stats: m, hp, dmg, range: def.range, speed, interval, aggro, crit, cdr, dps, radius: def.radius, rows, summary: `${hp} HP · ${dps} DPS · range ${def.range}` };
    }
    const map = FAMILY[def.cat] || {}, attrs = {}, fam = st.family;
    Object.keys(map).forEach(k => {
      const v = m[k]; if (v == null) return; const [name, label, lo, hi] = map[k], f = r2(mult(v, lo, hi));
      attrs[name] = f; rows.push(row(name, label, f, '×', (fam.byKey[k] || {}).label || k, v, `${lo} to ${hi} scaled by ${(fam.byKey[k] || {}).label || k} ${v}`));
    });
    return { ok: true, kind: def.cat, def, stats: m, attrs, rows, summary: def.blurb };
  }
  /** Compact facts for a deck row or card face. */
  function facts(spec) {
    const t = translate(spec); if (!t.ok) return null;
    return t.kind === 'pet' ? { hp: t.hp, dps: t.dps, range: t.range, speed: t.speed } : { attrs: t.attrs };
  }
  AV.combat.translate = Object.assign(translate, { facts, FAMILY, mult });
})();

/* AETHERVAULT — specimen generation and pure formulas. No DOM, no state access. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util;
  const MAX_LEVEL = 4;

  function serialInfo(n) {
    const s = String(n);
    if (n < 10) return { label: 'Single-Digit Serial', mult: 6 };
    if (n < 100) return { label: 'Low Serial', mult: 3 };
    if (n < 1000) return { label: 'Three-Digit Serial', mult: 1.3 };
    if (n > 999 && /^(\d)\1+$/.test(s)) return { label: 'Repdigit Serial', mult: 1.6 };
    if (s === s.split('').reverse().join('')) return { label: 'Palindrome Serial', mult: 1.25 };
    return { label: '', mult: 1 };
  }

  function sizeLabel(sz) {
    if (sz < 0.9) return 'Tiny';
    if (sz < 0.97) return 'Small';
    if (sz <= 1.05) return 'Average';
    if (sz <= 1.12) return 'Large';
    return 'Colossal';
  }

  /** Build a fresh specimen (without id). opts can force any trait (Creator Mode hook). */
  function generate(baseId, opts = {}) {
    const item = D.ITEMS[baseId];
    if (!item) throw new Error('Unknown item ' + baseId);
    const r = opts.rng || Math.random;
    const tier = D.RARITY[item.rarity].tier;
    const boost = opts.variantBoost || 1;

    const variant = opts.variant || U.pickWeighted(
      D.VARIANTS.map(v => [v.id, v.id === 'none' ? v.weight : v.weight * boost * (1 + tier * 0.12)]), r);
    const pattern = opts.pattern || U.pickWeighted(D.PATTERNS.map(p => [p.id, p.weight]), r);
    const palette = opts.palette != null ? opts.palette : U.pickWeighted(D.PALETTES.map(p => [p.id, p.weight]), r);
    const condition = opts.condition != null ? opts.condition : U.pickWeighted(D.CONDITION_WEIGHTS.map((w, i) => [i, w]), r);
    let potential = opts.potential != null ? opts.potential : Math.round(U.clamp((r() + r()) * 50 + tier * 2, 1, 100));
    if (opts.minPotential) potential = Math.max(potential, opts.minPotential);
    const auraChance = 0.05 + tier * 0.05;
    const aura = opts.aura || (r() < auraChance ? U.pick(D.AURAS.filter(a => a.id !== 'none'), r).id : 'none');
    const sizeSpread = item.cat === 'pet' ? 0.22 : 0.14;
    let size = +(1 + (r() * 2 - 1) * sizeSpread).toFixed(3);
    if (item.cat === 'card') size = 1; // printed cards share one format
    const serial = opts.serial != null ? opts.serial : Math.floor(r() * 9999) + 1;

    const spec = {
      id: null, base: baseId,
      variant, pattern, seed: opts.seed != null ? opts.seed : (r() * 4294967296) >>> 0, palette,
      condition, potential, serial, level: opts.level || 0, size, aura,
      quirk: U.pick(D.QUIRKS[item.cat], r),
      favorite: false, locked: false, nickname: '',
      invested: { essence: 0, credits: 0 },
      origin: { container: opts.container || null, at: Date.now(), event: null, season: 1 },
      owner: 'player',
      history: [],
    };
    if (item.cat === 'pet') spec.personality = U.pick(D.PERSONALITIES, r).id;
    if (item.cat === 'card' && AV.cards) spec.card = AV.cards.roll(item, r, opts.card || {});
    initProgress(spec);
    return spec;
  }

  /** Phase Three fields. Idempotent: fills what is missing, never overwrites a trait. sv = stat-framework version. */
  function initProgress(spec) {
    if (spec.form === undefined) spec.form = null;
    if (!spec.look) spec.look = 'auto';
    if (!Array.isArray(spec.looks)) spec.looks = [];
    if (spec.carry === undefined) spec.carry = null;
    if (!Array.isArray(spec.prog)) spec.prog = [];
    if (AV.stats) { spec.stats = AV.stats.snapshot(spec); spec.sv = AV.stats.VERSION; }
    return spec;
  }
  /** Readable stats for a specimen (always computed from stored data, so they are stable across reloads). */
  const stats = s => AV.stats.compute(s);

  const itemOf = s => D.ITEMS[s.base];
  const rarityOf = s => D.RARITY[itemOf(s).rarity];
  const catOf = s => D.CATEGORY[itemOf(s).cat];
  const displayName = s => s.nickname || (s.fusion && s.fusion.name) || itemOf(s).name;
  const conditionLabel = s => (D.CONDITION_LABELS[itemOf(s).cat] || D.CONDITION_LABELS.default)[s.condition];
  const variantOf = s => D.VARIANT[s.variant];
  const maxLevel = s => (s.potential >= 25 ? MAX_LEVEL : MAX_LEVEL - 1);
  const isProtected = s => !!(s.favorite || s.locked);
  const stageName = s => (AV.progress ? AV.progress.stageName(s.base, s.level) : D.UPGRADE_STAGES[s.level]);

  function value(s) {
    const R = rarityOf(s);
    const aura = s.aura !== 'none' ? 1.15 : 1;
    const v = R.value * variantOf(s).mult * D.CONDITION_MULT[s.condition] * (0.75 + s.potential / 200)
      * serialInfo(s.serial).mult * (1 + s.level * 0.45) * aura * (AV.fusion ? AV.fusion.valueMult(s) : 1);
    return Math.max(1, Math.round(v));
  }

  function essenceYield(s) {
    const R = rarityOf(s);
    const base = R.essence * (0.6 + s.potential / 250) * Math.sqrt(variantOf(s).mult);
    return Math.max(1, Math.round(base + (s.invested ? s.invested.essence : 0) * 0.5));
  }

  /** Cost to go from current level to level+1. null at cap. */
  function upgradeCost(s) {
    if (s.level >= maxLevel(s)) return null;
    const R = rarityOf(s);
    const essence = Math.ceil(R.upgrade * Math.pow(s.level + 1, 1.5));
    return { essence, credits: essence * 5 };
  }

  /** Evolution options currently listed for the base item (regardless of readiness). */
  function evolutions(s) { return itemOf(s).evolves || []; }

  function addHistory(s, type, text) {
    s.history.push({ t: Date.now(), type, text });
    if (s.history.length > 60) s.history.splice(1, s.history.length - 60);
  }

  // Stable ordering key for sorting
  const rarityTier = s => rarityOf(s).tier;

  AV.specimen = { generate, itemOf, rarityOf, catOf, displayName, conditionLabel, variantOf, maxLevel, isProtected, stageName,
    value, essenceYield, upgradeCost, evolutions, addHistory, serialInfo, sizeLabel, rarityTier, MAX_LEVEL, initProgress, stats };
})();

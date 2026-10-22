/* AETHERVAULT — Phase Four Fusion. Pure rules + one atomic engine action. No DOM.
 *   Duplicate fusion   copies of the same base: Fusion Rank +1 per donor (max III), best condition, potential +4 per donor (cap 100),
 *                      a mutation slot opens at Rank II. The result stays recognisably the same collectible.
 *   Compatible fusion  two different bases that share a family/element (same category), an authored recipe, an element infusion across
 *                      categories, a deliberate Oddity fusion, or two Cards of the same set. The primary keeps its base identity; the
 *                      secondary passes one trait and its element, and the pairing settles on one controlled mutation.
 *   Every outcome is deterministic: plan() computes the exact result, and commit() builds from plan(), so the preview IS the result.
 *   Mutations change geometry (forms.js motifs), material/variant, animation, stats, archive text and the pedestal tint. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util;
  const SP = () => AV.specimen, ST = () => AV.stats;

  // ------------------------------------------------------------------ families and elements
  const TAGS = {
    nimbit: ['sky', 'storm'], nimbus: ['sky', 'storm'], tempestral: ['storm', 'sky'], pluvia: ['water', 'sky'], stormsovereign: ['storm', 'sky', 'royal'],
    emberkit: ['ember'], pyrodrake: ['ember', 'sky'], pebblor: ['stone', 'grove'], mossback: ['grove', 'stone'], grovewarden: ['grove'], glimfin: ['water', 'light'],
    gloomwing: ['night', 'light'], voidling: ['void', 'night'], sunmane: ['light', 'ember', 'royal'],
    rustblade: ['steel', 'blade'], oakbuckler: ['grove', 'guard'], ionbow: ['storm', 'steel'], gravehammer: ['night', 'steel'], prismedge: ['light', 'blade'], aegis: ['light', 'guard', 'star'],
    bonecharm: ['bone', 'luck'], amberfossil: ['grove', 'time'], moonstone: ['night', 'light'], oracletablet: ['time', 'stone'], eclipsescepter: ['night', 'light', 'royal'], sunkencrown: ['water', 'royal'], heartofeternity: ['time', 'light', 'star'],
    pocketdrone: ['sky', 'gear'], scraprover: ['steel', 'gear'], skyskiff: ['sky', 'gear'], chronoracer: ['time', 'gear'], leviathan: ['water', 'steel', 'gear'], starhopper: ['star', 'sky', 'gear'],
    infinitesock: ['loop'], vendingfragment: ['gear', 'loop'], glitchedcursor: ['void', 'loop'], whisperjar: ['void', 'time'], impossiblecube: ['loop', 'void'], backwardsclock: ['time', 'loop'], missingtexture: ['void'],
  };
  const ELEMENT = { ember: 'flame', storm: 'bolt', water: 'water', light: 'light', star: 'light', sky: 'dust', grove: 'dust', stone: 'dust', time: 'dust', night: 'dust', void: 'dust', royal: 'light', bone: 'dust', luck: 'light' };
  const ADJ = { sky: 'Skyborne', storm: 'Stormbound', water: 'Tidebound', ember: 'Ember-touched', light: 'Dawnlit', night: 'Duskwoven', void: 'Hollow', grove: 'Mossgrown', stone: 'Stoneset', steel: 'Ironclad', blade: 'Edged', guard: 'Warded', star: 'Starforged', time: 'Timeworn', gear: 'Geared', loop: 'Recursive', bone: 'Bone-carved', luck: 'Lucky', royal: 'Regal' };
  const TINT = { sky: '#bfe0ff', storm: '#ffe066', water: '#4fd1c5', ember: '#ff8a3d', light: '#ffe6a0', night: '#9a7bff', void: '#b06bff', grove: '#7fe38a', stone: '#b8c0a8', steel: '#c9d3e6', blade: '#e8eef8', guard: '#d9b878', star: '#fff2a8', time: '#7affd7', gear: '#ffb15a', loop: '#ff7ad1', bone: '#efe2c4', luck: '#a8ff8a', royal: '#ffd36b' };
  const tagsOf = base => { const it = D.ITEMS[base]; if (!it) return []; if (it.cat === 'card') return ['print', 'set:' + it.card.set, it.card.cls]; return TAGS[base] || []; };

  // ------------------------------------------------------------------ mutations (all change geometry + material/animation + stats + text + pedestal)
  // lean: stat TAG → bonus (applied through the stat family's tags, so it fits any category)
  const MUT = {
    material:    { name: 'Material Mutation', motifs: ['plates'], lean: { stable: 6, power: 2 }, blurb: 'Its substance changed in the chamber: the surface took on the other specimen\'s material.' },
    pattern:     { name: 'Pattern Mutation', motifs: ['orbit'], lean: { finesse: 5, magic: 3 }, blurb: 'A second pattern crept across it during fusion and settled into the first.' },
    elemental:   { name: 'Elemental Mutation', motifs: [], lean: { magic: 6, power: 3 }, blurb: 'It now carries an element it was not born with.' },
    structural:  { name: 'Structural Mutation', motifs: ['spines', 'crystals'], lean: { power: 6, stable: 2 }, blurb: 'New structure grew along its frame: ridges and crystal where there were none.' },
    behavioral:  { name: 'Behavioural Mutation', motifs: ['echo'], lean: { finesse: 7 }, blurb: 'It moves differently now, trailing an echo of the specimen it absorbed.' },
    holographic: { name: 'Holographic Mutation', motifs: ['halo'], lean: { magic: 5, finesse: 4 }, blurb: 'Light passes through it in layers, like a print under a second film.' },
    containment: { name: 'Containment Mutation', motifs: ['cage', 'rift'], lean: { stable: 8, volatile: -2 }, blurb: 'The Oddity\'s influence had to be contained inside it. The cage holds; mostly.' },
  };
  // authored recipes (unordered pairs) — name, mutation, archive text
  const R_ = (a, b, name, mut, text) => ({ a, b, name, mut, text });
  const RECIPES = [
    R_('emberkit', 'nimbit', 'Steamkit', 'elemental', 'A kit wrapped in its own small weather. It hisses when it is happy, which is often.'),
    R_('pebblor', 'mossback', 'Cairnshell', 'structural', 'River stones settled into a mossy shell. Slow, sure, and very hard to tip over.'),
    R_('glimfin', 'pluvia', 'Rainlantern', 'elemental', 'Its lantern now drips a soft rain that never reaches the floor.'),
    R_('gloomwing', 'voidling', 'Umbral Moth', 'behavioral', 'A moth that drinks the dark instead of the light, and leaves a second shadow where it flies.'),
    R_('pyrodrake', 'sunmane', 'Solar Wyrmcub', 'elemental', 'Small wings, a small dawn, and a great deal of warmth for its size.'),
    R_('oakbuckler', 'rustblade', 'Bulwark Blade', 'structural', 'Ringwood grew along the old steel. It parries as readily as it cuts.'),
    R_('ionbow', 'prismedge', 'Lightning Prism', 'elemental', 'Every arrow leaves split into seven bolts of light. Only one of them is real.'),
    R_('eclipsescepter', 'moonstone', 'Lunar Totality', 'holographic', 'The moonstone sits in the scepter\'s cradle; the eclipse now keeps a calendar.'),
    R_('amberfossil', 'bonecharm', 'Amberbone Talisman', 'material', 'A knucklebone sealed in amber. The luck inside it is very, very patient.'),
    R_('pocketdrone', 'skyskiff', 'Drone Tender', 'behavioral', 'The skiff carries a flight of drones that go fetch things nobody asked for.'),
    R_('backwardsclock', 'infinitesock', 'Sock of Yesterday', 'containment', 'One sock, always missing from the day before. The clock keeps it from going further back.'),
    R_('glitchedcursor', 'impossiblecube', 'Cursor Lattice', 'holographic', 'A cube built from pointers, each pointing at another corner that is not there.'),
  ];
  const recipeFor = (a, b) => RECIPES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;

  function hash01(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  const ROMAN = ['', 'I', 'II', 'III'];
  const MAX_RANK = 3;

  /** How two specimens relate. Returns { kind, ok, reason, shared, recipe }. */
  function compat(p, d) {
    if (!p || !d) return { ok: false, kind: 'none', reason: 'Choose two specimens.' };
    if (p.id && p.id === d.id) return { ok: false, kind: 'none', reason: 'A specimen cannot fuse with itself.' };
    const ip = D.ITEMS[p.base], id = D.ITEMS[d.base];
    if (p.base === d.base) return { ok: true, kind: 'duplicate', reason: 'Two copies of the same collectible.', shared: [] };
    const pc = ip.cat === 'card', dc = id.cat === 'card';
    if (pc || dc) { if (pc && dc && ip.card.set === id.card.set) return { ok: true, kind: 'composite', reason: `Both cards belong to ${AV.cards.SET[ip.card.set].name}.`, shared: ['set:' + ip.card.set] }; return { ok: false, kind: 'none', reason: pc && dc ? 'Cards fuse only with cards of the same set.' : 'Cards only fuse with other cards.' }; }
    const rec = recipeFor(p.base, d.base); if (rec) return { ok: true, kind: 'recipe', reason: `An authored Archive recipe: ${rec.name}.`, shared: tagsOf(p.base).filter(t => tagsOf(d.base).includes(t)), recipe: rec };
    const shared = tagsOf(p.base).filter(t => tagsOf(d.base).includes(t));
    if (ip.cat === 'oddity' || id.cat === 'oddity') return { ok: true, kind: 'oddity', reason: 'A deliberate Oddity fusion: the result must contain what it absorbs.', shared };
    if (shared.length && ip.cat === id.cat) return { ok: true, kind: 'hybrid', reason: `Same division, shared ${shared.map(t => ADJ[t] ? t : t).join(' + ')} family.`, shared };
    if (shared.length) return { ok: true, kind: 'infusion', reason: `Different divisions, but both carry the ${shared[0]} element.`, shared };
    return { ok: false, kind: 'none', reason: 'No shared family, element or recipe. The Archive will not fuse unrelated things (except Oddities).' };
  }

  /** Mutation candidates for a pairing, and the one this pairing settles on (deterministic from both seeds). */
  function mutationFor(p, donors, c, rank) {
    const d = donors[0], el = (c.shared && c.shared[0]) || tagsOf(d.base)[0] || 'light', elemName = ELEMENT[el] || 'light';
    let cands = [];
    if (c.kind === 'duplicate') cands = rank >= 2 && !(p.fusion && p.fusion.mutation) ? ['structural', 'material', 'pattern'] : [];
    else if (c.kind === 'recipe') cands = [c.recipe.mut];
    else if (c.kind === 'oddity') cands = ['containment', 'holographic'];
    else if (c.kind === 'composite') cands = ['holographic', 'pattern'];
    else cands = ['elemental', 'pattern', 'material', 'behavioral'];
    if (p.fusion && p.fusion.mutation && c.kind === 'duplicate') return { cands: [], chosen: p.fusion.mutation, kept: true };
    if (!cands.length) return { cands, chosen: null };
    const h = hash01([(p.seed >>> 0), donors.map(x => x.seed >>> 0).join(','), c.kind].join(':')), type = cands[Math.floor(h * cands.length) % cands.length];
    const tint = type === 'elemental' ? TINT[el] || '#ffe6a0' : TINT[tagsOf(d.base)[0]] || D.ITEMS[d.base].pal[1];
    return { cands, chosen: { type, id: type === 'elemental' ? 'elemental:' + elemName : type, name: MUT[type].name + (type === 'elemental' ? ' · ' + elemName : ''), tint, element: el } };
  }

  /** Cost of a fusion (free in Unlimited). */
  function costOf(p, donors) { const R = D.RARITY[D.ITEMS[p.base].rarity], essence = Math.ceil(R.upgrade * 2.5 * (1 + donors.length)); return { essence, credits: essence * 3 }; }

  /** The exact outcome of fusing primary p with donors. Pure: no state is touched. */
  function plan(p, donors, o = {}) {
    donors = (donors || []).filter(Boolean);
    if (!p || !donors.length) return { ok: false, reason: 'Choose a primary and at least one other specimen.' };
    const c = compat(p, donors[0]);
    if (!c.ok) return { ok: false, reason: c.reason, compat: c };
    if (donors.length > 1 && (c.kind !== 'duplicate' || donors.some(d => d.base !== p.base))) return { ok: false, reason: 'Only duplicate fusion takes two donors; compatible fusion takes exactly one.', compat: c };
    if (donors.length > 2) return { ok: false, reason: 'At most two donors at a time.', compat: c };
    const rank0 = (p.fusion && p.fusion.rank) || 0;
    if (c.kind === 'duplicate' && rank0 >= MAX_RANK) return { ok: false, reason: 'Already at Fusion Rank III.', compat: c };
    const all = [p, ...donors], r = JSON.parse(JSON.stringify(p));
    const rank = c.kind === 'duplicate' ? Math.min(MAX_RANK, rank0 + donors.length) : rank0;
    const guaranteed = [], possible = [], inherited = [];
    // condition: best of the inputs (lower index is better)
    const bestCond = Math.min(...all.map(s => s.condition)); if (bestCond < p.condition) guaranteed.push(`Condition improves to ${SP().conditionLabel(Object.assign({}, p, { condition: bestCond }))} (best of the inputs)`); r.condition = bestCond;
    // potential: controlled growth
    const pot = c.kind === 'duplicate' ? Math.min(100, Math.max(...all.map(s => s.potential)) + 4 * donors.length) : Math.min(100, Math.round(p.potential * .7 + donors[0].potential * .3) + 3);
    if (pot !== p.potential) guaranteed.push(`Potential ${p.potential}% → ${pot}%`); r.potential = pot;
    if (c.kind === 'duplicate') guaranteed.push(`Fusion Rank ${ROMAN[rank0] || '—'} → ${ROMAN[rank]}`);
    // one trait passes from the secondary (compatible kinds); deterministic choice shown as "inherits"
    const d = donors[0];
    if (c.kind !== 'duplicate') {
      const opts = [];
      if (d.variant !== 'none' && p.variant === 'none') opts.push(['variant', `Variant ${SP().variantOf(d).name} (from the secondary)`]);
      if (d.pattern !== p.pattern && d.pattern !== 'plain' && !(p.card)) opts.push(['pattern', `Pattern ${D.PATTERNS.find(x => x.id === d.pattern).name} (from the secondary)`]);
      if (d.aura !== 'none' && p.aura === 'none') opts.push(['aura', `Aura ${D.AURAS.find(x => x.id === d.aura).name} (from the secondary)`]);
      if (p.card && d.card) { if (d.card.alt && !p.card.alt) opts.push(['alt', 'Alternate art (from the secondary)']); const fc = AV.cards.FOILS; if ((fc[d.card.foil] || fc.none).cx > (fc[p.card.foil] || fc.none).cx) opts.push(['foil', `Foil ${fc[d.card.foil].name} (from the secondary)`]); }
      opts.forEach(x => possible.push(x[1]));
      if (opts.length) { const pick = opts[Math.floor(hash01((p.seed >>> 0) + '|' + (d.seed >>> 0) + '|trait') * opts.length) % opts.length]; inherited.push(pick[1]);
        if (pick[0] === 'variant') r.variant = d.variant; else if (pick[0] === 'pattern') r.pattern = d.pattern; else if (pick[0] === 'aura') r.aura = d.aura; else if (pick[0] === 'alt') r.card.alt = 1; else if (pick[0] === 'foil') r.card.foil = d.card.foil; }
    }
    // mutation
    const mu = mutationFor(p, donors, c, rank), m = mu.chosen;
    if (m && !mu.kept) {
      if (m.type === 'material' && r.variant === 'none') r.variant = d.variant !== 'none' ? d.variant : 'foil';
      if (m.type === 'pattern') { if (r.card) r.card.alt = 1; else if (d.pattern !== r.pattern) r.pattern = d.pattern !== 'plain' ? d.pattern : 'swirled'; }
      if (m.type === 'holographic') { if (r.card) { const fc = AV.cards.FOILS; if ((fc[r.card.foil] || fc.none).cx < fc.holo.cx) r.card.foil = 'holo'; } else if (r.variant === 'none') r.variant = 'holographic'; }
    }
    // identity
    const rec = c.recipe, primaryItem = D.ITEMS[p.base], el = (c.shared && c.shared[0]) || tagsOf(d.base)[0];
    const name = rec ? rec.name : c.kind === 'duplicate' ? null : c.kind === 'composite' ? 'Composite ' + primaryItem.name : c.kind === 'oddity' ? 'Contained ' + primaryItem.name : `${ADJ[el] || 'Fused'} ${primaryItem.name}`;
    const prevName = p.fusion && p.fusion.name;
    const classification = c.kind === 'duplicate' ? `${D.CATEGORY[primaryItem.cat].single} · Fusion Rank ${ROMAN[rank]}` : `${D.CATEGORY[primaryItem.cat].single} hybrid · ${tagsOf(p.base).slice(0, 1).concat(tagsOf(d.base).slice(0, 1)).join(' / ')}`;
    r.fusion = {
      rank, kind: c.kind, name: name || prevName || null, classification, recipe: rec ? rec.name : null,
      mutation: m ? { type: m.type, id: m.id, name: m.name, tint: m.tint, element: m.element } : null,
      tint: m ? m.tint : (p.fusion && p.fusion.tint) || D.ITEMS[d.base].pal[1], echo: c.kind !== 'duplicate' ? D.ITEMS[d.base].pal[0] : (p.fusion && p.fusion.echo) || null,
      text: rec ? rec.text : m ? MUT[m.type].blurb : (p.fusion && p.fusion.text) || 'Two copies, one specimen: stronger, steadier and unmistakably itself.',
      parents: all.map(s => ({ id: s.id, base: s.base, serial: s.serial, variant: s.variant, condition: s.condition, potential: s.potential, level: s.level, form: s.form || null, fx: s.fusion ? s.fusion.id : null })),
    };
    r.invested = { essence: all.reduce((a, s) => a + ((s.invested && s.invested.essence) || 0), 0), credits: all.reduce((a, s) => a + ((s.invested && s.invested.credits) || 0), 0) };
    r.level = Math.max(...[p.level || 0]); r.favorite = false; r.locked = false; r.id = null;
    if (AV.stats) { r.stats = ST().snapshot(r); r.sv = ST().VERSION; }
    const before = ST() ? ST().compute(p).map : {}, after = ST() ? ST().compute(r).map : {};
    return { ok: true, compat: c, kind: c.kind, rank, result: r, mutation: m, mutationCandidates: (mu.cands || []).map(t => ({ type: t, name: MUT[t].name, chosen: !!(m && m.type === t) })), mutationKept: !!mu.kept,
      guaranteed, possible, inherited, before, after, cost: costOf(p, donors), name: r.fusion.name || primaryItem.name };
  }

  // ------------------------------------------------------------------ effects used by stats, value and rendering
  /** Bonus to one stat: rank adds to every stat (more to focus stats); the mutation leans through stat tags. */
  function statBonus(spec, k, tag, isFocus) {
    const f = spec.fusion; if (!f || k === 'growth') return 0;
    let b = (f.rank || 0) * (isFocus ? 3 : 1.2) + (f.kind && f.kind !== 'duplicate' ? 2 : 0);
    const m = f.mutation && MUT[f.mutation.type]; if (m && m.lean[tag]) b += m.lean[tag];
    return b;
  }
  const valueMult = s => (s.fusion ? 1 + (s.fusion.rank || 0) * .25 + (s.fusion.mutation ? .2 : 0) + (s.fusion.kind && s.fusion.kind !== 'duplicate' ? .15 : 0) : 1);
  /** Motifs forms.js adds for a fused specimen (mutation geometry + rank details). */
  function motifs(spec) {
    const f = spec.fusion; if (!f) return [];
    const out = []; if (f.mutation) { const m = MUT[f.mutation.type]; out.push(...(m ? m.motifs : [])); if (f.mutation.type === 'elemental') out.push('elem:' + (f.mutation.id.split(':')[1] || 'light')); }
    if (f.rank >= 1 && !out.includes('orbit')) out.push('orbit'); if (f.rank >= 2 && !out.includes('crystals')) out.push('crystals'); if (f.rank >= 3 && !out.includes('halo')) out.push('halo');
    if (f.echo && !out.includes('echo')) out.push('echo');
    return out;
  }
  const renderKey = s => { const f = s.fusion; return f ? [(f.mutation && f.mutation.id) || '-', f.rank || 0, (f.tint || '').replace('#', ''), (f.echo || '').replace('#', '')].join('~') : ''; };
  function applyRenderKey(o, k) { const a = k.split('~'); const mid = a[0] === '-' ? null : a[0]; o.fusion = { rank: +a[1] || 0, mutation: mid ? { id: mid, type: mid.split(':')[0] } : null, tint: a[2] ? '#' + a[2] : null, echo: a[3] ? '#' + a[3] : null, kind: 'render' }; }

  AV.fusion = { TAGS, MUT, RECIPES, ADJ, TINT, MAX_RANK, tagsOf, compat, plan, recipeFor, costOf, statBonus, valueMult, motifs, renderKey, applyRenderKey, hash01, ROMAN };
})();

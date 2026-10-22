/* AETHERVAULT — Phase Four Vault query engine. Pure (no DOM): an index of searchable records rebuilt only when the collection changes,
 * combinable filters (AND across facets, OR within a facet), sorting, readable filter chips, and preset (saved search) serialisation.
 * The screen calls run(); nothing here renders. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util;
  const SP = () => AV.specimen;

  // Facets that hold sets of values (OR within the facet)
  const SET_KEYS = ['cat', 'sub', 'base', 'rar', 'variant', 'cond', 'stage', 'branch', 'mutation', 'source', 'set', 'edition', 'finish', 'foil', 'tag'];
  // Facets that hold a single value
  const ONE_KEYS = ['form', 'fusion', 'named', 'alt', 'folder'];
  // Toggles
  const FLAG_KEYS = ['fav', 'locked', 'dupes', 'recent', 'companion'];
  // [min,max] ranges
  const RANGE_KEYS = ['statTotal', 'potential', 'serial', 'number', 'order', 'date'];

  function blank() { const f = {}; SET_KEYS.forEach(k => (f[k] = new Set())); ONE_KEYS.forEach(k => (f[k] = 'any')); FLAG_KEYS.forEach(k => (f[k] = false)); RANGE_KEYS.forEach(k => (f[k] = [null, null])); return f; }
  const subOf = (s, it) => (it.cat === 'card' ? AV.cards.CLASSES[it.card.cls].name : ({ weapon: 'Weapon', shield: 'Shield', pet: 'Being', machine: 'Machine', relic: 'Relic', oddity: 'Oddity' })[(AV.progress.ARCH[s.base] || {}).fam] || D.CATEGORY[it.cat].single);
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };

  /** One record per specimen. Rebuilt only when the collection changes (the screen passes the revision). */
  function index(S) {
    const org = S.org || { tags: {}, notes: {}, folders: [], touched: {} }, counts = {}, specs = Object.values(S.specimens || {});
    specs.forEach(s => (counts[s.base] = (counts[s.base] || 0) + 1));
    return specs.map(s => {
      const it = D.ITEMS[s.base], R = D.RARITY[it.rarity], form = s.form && AV.progress.form(s.form), tags = (org.tags && org.tags[s.id]) || [], note = (org.notes && org.notes[s.id]) || '';
      const st = s.stats || {}, statTotal = Object.keys(st).filter(k => k !== 'growth').reduce((a, k) => a + (st[k] || 0), 0);
      const card = it.cat === 'card' ? it.card : null, d = card ? AV.cards.describe(s) : null, fz = s.fusion || null;
      const lastHist = (s.history || []).reduce((a, h) => Math.max(a, h.t || 0), 0), lastProg = (s.prog || []).reduce((a, p) => Math.max(a, p.t || 0), 0);
      const hay = [SP().displayName(s), it.name, s.nickname, U.pad(s.serial, 4), String(s.serial), D.CATEGORY[it.cat].name, subOf(s, it), SP().variantOf(s).name, SP().conditionLabel(s), D.PATTERNS.find(p => p.id === s.pattern).name, R.name,
        form ? form.name : '', fz ? [fz.name, fz.classification, fz.recipe, fz.mutation && fz.mutation.name, fz.id, ...(fz.parents || []).map(p => D.ITEMS[p.base].name + ' ' + U.pad(p.serial, 4))].join(' ') : '',
        card ? [d.set.name, d.set.code, AV.cards.number(it), d.cls.name, d.material.name, d.finish, d.foil, d.edition, d.alt ? 'alternate art alt' : '', d.imprint].join(' ') : '',
        tags.join(' '), note].join(' ').toLowerCase();
      return { s, id: s.id, it, cat: it.cat, sub: subOf(s, it), tier: R.tier, rar: it.rarity, order: +String(s.id).slice(1) || 0, at: (s.origin && s.origin.at) || 0, modified: Math.max(lastHist, lastProg, (org.touched && org.touched[s.id]) || 0),
        statTotal, value: SP().value(s), source: s.origin && s.origin.fusion ? 'fusion' : (s.origin && s.origin.container) || 'creator', dupes: counts[s.base], tags, note, card, d, fz, form, hay };
    });
  }

  const inR = (v, r) => (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1]);
  /** True when a record passes every active facet. */
  function match(x, f, ctx) {
    const s = x.s;
    if (f.cat.size && !f.cat.has(x.cat)) return false;
    if (f.sub.size && !f.sub.has(x.sub)) return false;
    if (f.base.size && !f.base.has(s.base)) return false;
    if (f.rar.size && !f.rar.has(x.rar)) return false;
    if (f.variant.size && !f.variant.has(s.variant)) return false;
    if (f.cond.size && !f.cond.has(s.condition)) return false;
    if (f.stage.size && !f.stage.has(s.level)) return false;
    if (f.form === 'transformed' && !s.form) return false; if (f.form === 'untransformed' && s.form) return false;
    if (f.branch.size && !f.branch.has(s.form)) return false;
    if (f.fusion === 'fused' && !x.fz) return false; if (f.fusion === 'unfused' && x.fz) return false; if (/^rank\d$/.test(f.fusion) && !(x.fz && x.fz.rank >= +f.fusion.slice(4))) return false; if (f.fusion === 'hybrid' && !(x.fz && x.fz.kind && x.fz.kind !== 'duplicate')) return false;
    if (f.mutation.size && !(x.fz && x.fz.mutation && f.mutation.has(x.fz.mutation.type))) return false;
    if (f.source.size && !f.source.has(x.source)) return false;
    if (f.set.size && !(x.card && f.set.has(x.card.set))) return false;
    if (f.edition.size && !(s.card && f.edition.has(s.card.edition))) return false;
    if (f.finish.size && !(s.card && f.finish.has(s.card.finish))) return false;
    if (f.foil.size && !(s.card && f.foil.has(s.card.foil))) return false;
    if (f.alt === 'alt' && !(s.card && s.card.alt)) return false; if (f.alt === 'standard' && !(s.card && !s.card.alt)) return false;
    if (f.tag.size && !x.tags.some(t => f.tag.has(t))) return false;
    if (f.folder !== 'any' && !(ctx.folderIds && ctx.folderIds.has(s.id))) return false;
    if (f.named === 'named' && !s.nickname) return false; if (f.named === 'unnamed' && s.nickname) return false;
    if (f.fav && !s.favorite) return false; if (f.locked && !s.locked) return false; if (f.dupes && x.dupes < 2) return false;
    if (f.recent && !(x.modified >= (ctx.now - 86400000))) return false;
    if (f.companion && ctx.companion !== s.id) return false;
    if (!inR(x.statTotal, f.statTotal) || !inR(s.potential, f.potential) || !inR(s.serial, f.serial) || !inR(x.order, f.order)) return false;
    if ((f.number[0] != null || f.number[1] != null) && !(x.card && inR(x.card.no, f.number))) return false;
    if ((f.date[0] != null || f.date[1] != null) && !inR(dayStart(x.at), [f.date[0], f.date[1]])) return false;
    return true;
  }
  const SORTS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['rarity', 'Rarity'], ['value', 'Value'], ['potential', 'Potential'], ['stats', 'Stat total'], ['serial', 'Lowest serial'], ['level', 'Upgrade stage'], ['cond', 'Best condition'], ['name', 'Name A–Z'], ['number', 'Card number'], ['modified', 'Recently modified']];
  const CMP = {
    newest: (a, b) => b.order - a.order, oldest: (a, b) => a.order - b.order, rarity: (a, b) => b.tier - a.tier || b.value - a.value, value: (a, b) => b.value - a.value,
    potential: (a, b) => b.s.potential - a.s.potential, stats: (a, b) => b.statTotal - a.statTotal, serial: (a, b) => a.s.serial - b.s.serial, level: (a, b) => b.s.level - a.s.level || b.value - a.value,
    cond: (a, b) => a.s.condition - b.s.condition || b.value - a.value, name: (a, b) => SP().displayName(a.s).localeCompare(SP().displayName(b.s)),
    number: (a, b) => (a.card ? a.card.set.localeCompare(b.card ? b.card.set : 'zzz') || a.card.no - (b.card ? b.card.no : 0) : 1), modified: (a, b) => b.modified - a.modified,
  };
  /** Filter + search + sort. q is matched word by word against each record's search text. Returns records. */
  function run(idx, f, q, sort, ctx) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    const out = idx.filter(x => (!words.length || words.every(w => x.hay.includes(w))) && match(x, f, ctx || {}));
    return out.sort(CMP[sort] || CMP.newest);
  }
  /** Facet value counts over the whole collection (for option lists). */
  function facets(idx) {
    const c = {}; const inc = (k, v) => { (c[k] = c[k] || {})[v] = ((c[k] || {})[v] || 0) + 1; };
    idx.forEach(x => { inc('cat', x.cat); inc('sub', x.sub); inc('base', x.s.base); inc('rar', x.rar); inc('variant', x.s.variant); inc('cond', x.s.condition); inc('stage', x.s.level); if (x.s.form) inc('branch', x.s.form); if (x.fz && x.fz.mutation) inc('mutation', x.fz.mutation.type); inc('source', x.source); if (x.card) { inc('set', x.card.set); inc('edition', x.s.card.edition); inc('finish', x.s.card.finish); inc('foil', x.s.card.foil); } x.tags.forEach(t => inc('tag', t)); });
    return c;
  }
  // ------------------------------------------------------------------ chips and labels
  const sourceName = id => id === 'fusion' ? 'Fusion' : id === 'creator' ? 'Creator' : id === 'starter' ? 'First Egg' : (D.CONTAINER[id] ? D.CONTAINER[id].name : id);
  const LABEL = {
    cat: v => D.CATEGORY[v] ? D.CATEGORY[v].name : v, sub: v => v, base: v => (D.ITEMS[v] ? D.ITEMS[v].name : v), rar: v => D.RARITY[v].name, variant: v => D.VARIANT[v].name, cond: v => D.CONDITION_LABELS.default[v] + ' tier',
    stage: v => 'Stage ' + (+v + 1), branch: v => (AV.progress.form(v) ? AV.progress.form(v).name : v), mutation: v => (AV.fusion && AV.fusion.MUT[v] ? AV.fusion.MUT[v].name : v), source: sourceName,
    set: v => AV.cards.SET[v].name, edition: v => AV.cards.EDITION[v].name, finish: v => (AV.cards.FINISHES.find(x => x.id === v) || {}).name || v, foil: v => (AV.cards.FOILS[v] || {}).name || v, tag: v => '#' + v,
  };
  const ONE_LABEL = { form: { transformed: 'Transformed', untransformed: 'Not transformed' }, fusion: { fused: 'Fused', unfused: 'Not fused', hybrid: 'Hybrid fusions', rank1: 'Fusion Rank I+', rank2: 'Fusion Rank II+', rank3: 'Fusion Rank III' }, named: { named: 'Custom name', unnamed: 'No custom name' }, alt: { alt: 'Alternate art', standard: 'Standard art' } };
  const FLAG_LABEL = { fav: 'Favorites', locked: 'Locked', dupes: 'Duplicates', recent: 'Modified in the last day', companion: 'Displayed (companion)' };
  const RANGE_LABEL = { statTotal: 'Stat total', potential: 'Potential', serial: 'Serial', number: 'Card number', order: 'Acquisition order', date: 'Acquired' };
  const fmtR = (k, v) => (k === 'date' ? new Date(v).toLocaleDateString() : k === 'potential' ? v + '%' : v);
  /** Active filters as removable chips: { k, v, label }. */
  function chips(f, ctx = {}) {
    const out = [];
    SET_KEYS.forEach(k => f[k].forEach(v => out.push({ k, v, label: (LABEL[k] || String)(v) })));
    ONE_KEYS.forEach(k => { if (f[k] !== 'any') out.push({ k, v: f[k], label: k === 'folder' ? 'Folder: ' + (ctx.folderName || f[k]) : ONE_LABEL[k][f[k]] }); });
    FLAG_KEYS.forEach(k => { if (f[k]) out.push({ k, v: true, label: FLAG_LABEL[k] }); });
    RANGE_KEYS.forEach(k => { const r = f[k]; if (r[0] != null || r[1] != null) out.push({ k, v: null, label: `${RANGE_LABEL[k]} ${r[0] != null ? fmtR(k, r[0]) : '…'}–${r[1] != null ? fmtR(k, r[1]) : '…'}` }); });
    return out;
  }
  function removeChip(f, k, v) { if (SET_KEYS.includes(k)) f[k].delete(v); else if (ONE_KEYS.includes(k)) f[k] = 'any'; else if (FLAG_KEYS.includes(k)) f[k] = false; else if (RANGE_KEYS.includes(k)) f[k] = [null, null]; return f; }
  const activeCount = f => chips(f).length;
  /** Presets are stored in the save as plain JSON. */
  function serialize(f) { const o = {}; SET_KEYS.forEach(k => { if (f[k].size) o[k] = [...f[k]]; }); ONE_KEYS.forEach(k => { if (f[k] !== 'any') o[k] = f[k]; }); FLAG_KEYS.forEach(k => { if (f[k]) o[k] = true; }); RANGE_KEYS.forEach(k => { if (f[k][0] != null || f[k][1] != null) o[k] = f[k].slice(); }); return o; }
  function deserialize(o) { const f = blank(); Object.keys(o || {}).forEach(k => { if (SET_KEYS.includes(k)) f[k] = new Set(o[k]); else if (ONE_KEYS.includes(k)) f[k] = o[k]; else if (FLAG_KEYS.includes(k)) f[k] = !!o[k]; else if (RANGE_KEYS.includes(k)) f[k] = o[k].slice(0, 2); }); return f; }

  AV.vaultQ = { SET_KEYS, ONE_KEYS, FLAG_KEYS, RANGE_KEYS, SORTS, blank, index, match, run, facets, chips, removeChip, activeCount, serialize, deserialize, LABEL, ONE_LABEL, FLAG_LABEL, RANGE_LABEL, sourceName, subOf };
})();

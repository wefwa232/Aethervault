/* AETHERVAULT — save state, persistence, migration, event bus. */
(function () {
  const AV = (window.AV = window.AV || {});
  const SAVE_KEY = 'aethervault.save.v1';
  const SAVE_VERSION = 4;
  const BACKUP_KEY = 'aethervault.save.v1.backup-p3'; // raw pre-Phase-Three save, written once, never overwritten
  const BACKUP_KEY_P4 = 'aethervault.save.v1.backup-p4'; // raw pre-Phase-Four (v2) save, written once, never overwritten
  const BACKUP_KEY_P5 = 'aethervault.save.v1.backup-p5'; // raw pre-Phase-Five (v3) save, written once, never overwritten
  const BACKUP_KEY_FUSION = 'aethervault.save.v1.backup-fusion'; // rolling copy written just before a Standard-mode fusion commits

  // ---------- Event bus ----------
  const listeners = {};
  const bus = {
    on(topic, fn) { (listeners[topic] = listeners[topic] || new Set()).add(fn); return () => listeners[topic].delete(fn); },
    emit(topic, payload) { Array.from(listeners[topic] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error('[bus]', topic, e); } }); },
  };

  function defaultSettings() {
    return { master: 0.8, music: 0.45, sfx: 0.8, opening: 0.9, animSpeed: 1, reducedMotion: false, shake: true, flashing: true, textSize: 1, skipRituals: false, quality3d: 'medium', fpsLimit: 'auto', fastStartup: false,
      // Phase Four
      rouletteSpeed: 1, clickVolume: 0.7, cardHolo: true, holoReturn: 4, multiOpen: 'condensed', fusionAnim: 'full', binderAnim: true };
  }

  function defaultSave(mode = 'standard', name = 'Collector') {
    return {
      version: SAVE_VERSION,
      profile: { name, level: 1, xp: 0, title: 'Initiate', createdAt: Date.now() },
      mode,
      economy: { priceMult: 1, rewardMult: 1 },
      wallet: { credits: 1000, gems: 40, essence: 60, keys: 3 },
      playCash: 50,
      specimens: {},
      nextId: 1,
      discovered: {},
      variantsSeen: {},
      pity: {},
      stats: { opened: 0, pulls: 0, dismantled: 0, upgrades: 0, evolutions: 0, transformations: 0, byRarity: {} },
      companion: null,
      daily: { last: null, streak: 0 },
      recent: [],
      settings: defaultSettings(),
      flags: { onboarded: false },
      ext: {},
      // Phase Four (save v3)
      org: defaultOrg(),          // Vault organisation: saved searches, folders/albums, tags, notes
      fusions: [],                // fusion ledger (parent snapshots, recipe, result id), newest last
      fusionSeq: 0,               // last fusion identifier number (FX-0001…)
      lastOpening: null,          // { container, count, ids, at, seen } until the summary of the last opening is seen
      binder: { set: 'fla', page: 0 },
      // Phase Five (save v4)
      combat: defaultCombat(),
    };
  }
  /** Combat progress. Decks hold specimen ids only ({ id }); the specimens themselves are never copied or modified by combat. */
  function defaultCombat() { return { v: 1, decks: [], activeDeck: null, rating: 1000, division: 'initiate', games: 0, wins: 0, history: [], tutorial: { done: false, step: 0 }, settings: { unlimited: false, autoPause: true }, unlocks: {} }; }
  /** Tolerant normaliser: keeps whatever is valid, repairs the rest, never throws. Deck entries are kept even if their specimen is gone (the deck editor flags them). */
  function normCombat(c) {
    const d = defaultCombat(); if (!c || typeof c !== 'object') return d;
    const out = Object.assign(defaultCombat(), c);
    out.v = 1; out.decks = (Array.isArray(c.decks) ? c.decks : []).filter(k => k && typeof k === 'object' && k.id).slice(0, 20).map(k => ({ id: String(k.id), name: String(k.name || 'Deck').slice(0, 28), entries: (Array.isArray(k.entries) ? k.entries : []).filter(e => e && e.id != null).slice(0, 10).map(e => ({ id: String(e.id) })), preset: k.preset || null, created: +k.created || 0, updated: +k.updated || 0 }));
    const seen = new Set(); out.decks = out.decks.filter(k => !seen.has(k.id) && seen.add(k.id));
    if (!out.decks.some(k => k.id === out.activeDeck)) out.activeDeck = out.decks.length ? out.decks[0].id : null;
    ['rating', 'games', 'wins'].forEach(k => { out[k] = isFinite(+c[k]) ? +c[k] : d[k]; });
    out.division = typeof c.division === 'string' ? c.division : d.division; out.history = Array.isArray(c.history) ? c.history.slice(-50) : [];
    out.tutorial = Object.assign(d.tutorial, c.tutorial); out.settings = Object.assign(defaultCombat().settings, c.settings); out.unlocks = c.unlocks && typeof c.unlocks === 'object' ? c.unlocks : {};
    return out;
  }
  function defaultOrg() { return { searches: [], folders: [], tags: {}, notes: {}, touched: {} }; }

  /** Bring any older/partial save up to the current schema. Never throws away player data. */
  function migrate(s) {
    const d = defaultSave(s.mode || 'standard');
    const out = Object.assign({}, d, s);
    out.profile = Object.assign({}, d.profile, s.profile);
    out.wallet = Object.assign({}, d.wallet, s.wallet);
    out.settings = Object.assign({}, d.settings, s.settings);
    out.flags = Object.assign({}, d.flags, s.flags);
    out.stats = Object.assign({}, d.stats, s.stats);
    out.economy = Object.assign({}, d.economy, s.economy);
    out.daily = Object.assign({}, d.daily, s.daily);
    out.org = Object.assign(defaultOrg(), s.org); out.binder = Object.assign({}, d.binder, s.binder);
    out.specimens = s.specimens || {};
    if (s.combat === undefined) delete out.combat; else out.combat = normCombat(s.combat);
    // Drop specimens whose base item no longer exists rather than crash the UI.
    migrate.dropped = 0;
    for (const id of Object.keys(out.specimens)) if (!AV.data.ITEMS[out.specimens[id].base]) { delete out.specimens[id]; migrate.dropped++; }
    if (out.companion && !out.specimens[out.companion]) out.companion = null;
    out.version = SAVE_VERSION;
    return out;
  }

  // ---------- Phase Three migration (save v1 → v2): deterministic stats + progression fields ----------
  // Only ADDS fields. Every field below must be identical before and after, or the migration is rejected.
  const KEEP = ['id', 'base', 'variant', 'pattern', 'seed', 'palette', 'condition', 'potential', 'serial', 'level', 'size', 'aura', 'quirk', 'favorite', 'locked', 'nickname', 'owner', 'personality'];
  function fingerprint(sp) { const o = {}; KEEP.forEach(k => { o[k] = sp[k]; }); o.hist = (sp.history || []).length; o.inv = JSON.stringify(sp.invested || null); o.origin = JSON.stringify(sp.origin || null); return JSON.stringify(o); }
  /** Pure on its input object; returns { added, bad[] }. Idempotent: specimens that already carry sv are skipped. */
  function migrateP3(save) {
    const before = {}, ids = Object.keys(save.specimens || {}); let added = 0; const bad = [];
    ids.forEach(id => { before[id] = fingerprint(save.specimens[id]); });
    ids.forEach(id => {
      const sp = save.specimens[id];
      if (sp.sv) return;
      AV.specimen.initProgress(sp);
      (sp.history || []).forEach(h => { const m = h && h.type === 'evolve' && /^Evolved from (.+) into (.+)\.$/.exec(h.text || ''); if (m) { const f = AV.data.ITEM_LIST.find(i => i.name === m[1]); if (f && !sp.looks.includes('base:' + f.id)) sp.looks.push('base:' + f.id); } });
      added++;
    });
    ids.forEach(id => {
      const sp = save.specimens[id], st = sp.stats;
      if (fingerprint(sp) !== before[id]) bad.push(id + ': identity changed');
      else if (!st || !Object.keys(st).length || Object.values(st).some(v => !isFinite(v) || v < 1 || v > 140)) bad.push(id + ': invalid stats');
    });
    if (ids.length !== Object.keys(save.specimens).length) bad.push('collection count changed');
    return { added, bad };
  }

  // ---------- Phase Four migration (save v2 → v3): Vault organisation, fusion ledger, opening record ----------
  /** Pure on its input object; returns { added, bad[] }. Only adds top-level structures; specimens must come out identical. Idempotent. */
  function migrateP4(save) {
    const ids = Object.keys(save.specimens || {}), before = {}; const bad = []; let added = 0;
    ids.forEach(id => { before[id] = fingerprint(save.specimens[id]) + '|' + JSON.stringify(save.specimens[id].stats || null) + '|' + (save.specimens[id].form || ''); });
    const o = save.org && typeof save.org === 'object' ? save.org : (added++, {});
    save.org = { searches: Array.isArray(o.searches) ? o.searches : [], folders: Array.isArray(o.folders) ? o.folders : [], tags: o.tags && typeof o.tags === 'object' ? o.tags : {}, notes: o.notes && typeof o.notes === 'object' ? o.notes : {}, touched: o.touched && typeof o.touched === 'object' ? o.touched : {} };
    if (!Array.isArray(save.fusions)) { save.fusions = []; added++; }
    if (typeof save.fusionSeq !== 'number') { save.fusionSeq = 0; added++; }
    if (save.lastOpening === undefined) save.lastOpening = null;
    if (!save.binder || typeof save.binder !== 'object') save.binder = { set: 'fla', page: 0 };
    save.version = SAVE_VERSION;
    ids.forEach(id => { const sp = save.specimens[id]; if (!sp || fingerprint(sp) + '|' + JSON.stringify(sp.stats || null) + '|' + (sp.form || '') !== before[id]) bad.push(id + ': identity changed'); });
    if (ids.length !== Object.keys(save.specimens || {}).length) bad.push('collection count changed');
    if (AV.__faultP4) bad.push('fault injected (test hook)');
    return { added, bad };
  }

  // ---------- Phase Five migration (save v3 → v4): the combat block ----------
  /** Pure on its input object; returns { added, bad[] }. Adds ONE top-level structure (combat); every specimen must come out identical. Idempotent. */
  function migrateP5(save) {
    const ids = Object.keys(save.specimens || {}), before = {}; const bad = []; let added = 0;
    const key = id => fingerprint(save.specimens[id]) + '|' + JSON.stringify(save.specimens[id].stats || null) + '|' + (save.specimens[id].form || '') + '|' + JSON.stringify(save.specimens[id].fusion || null);
    ids.forEach(id => { before[id] = key(id); });
    if (!save.combat || typeof save.combat !== 'object') added++;
    save.combat = normCombat(save.combat);
    save.version = SAVE_VERSION;
    ids.forEach(id => { if (!save.specimens[id] || key(id) !== before[id]) bad.push(id + ': identity changed'); });
    if (ids.length !== Object.keys(save.specimens || {}).length) bad.push('collection count changed');
    if (AV.__faultP5) bad.push('fault injected (test hook)');
    return { added, bad };
  }

  let S = null;
  let saveTimer = null;
  let storageOk = true;

  function writeNow() {
    if (!S) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); storageOk = true; }
    catch (e) { storageOk = false; console.warn('Save failed', e); }
  }
  function save(immediate) {
    if (immediate) { clearTimeout(saveTimer); saveTimer = null; return writeNow(); }
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; writeNow(); }, 120);
  }

  /** What the last load() found — read by the startup sequence so its status lines describe real work. */
  const lastLoad = { fresh: true, fromVersion: null, specimens: 0, dropped: 0, corrupt: false, backupKey: null, storage: true, bytes: 0, p3: {}, p4: {}, p5: {} };
  function load() {
    let raw = null; Object.assign(lastLoad, { fresh: true, fromVersion: null, specimens: 0, dropped: 0, corrupt: false, backupKey: null, storage: true, bytes: 0, p3: {}, p4: {}, p5: {} });
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { storageOk = false; lastLoad.storage = false; }
    if (raw) {
      try {
        const parsed = JSON.parse(raw); migrate.dropped = 0;
        const fromVersion = parsed.version == null ? 0 : parsed.version;
        if (fromVersion < 2) { // keep the raw save before touching it (once; an existing backup is never overwritten)
          try { if (localStorage.getItem(BACKUP_KEY) == null) localStorage.setItem(BACKUP_KEY, raw); lastLoad.p3.backup = BACKUP_KEY; } catch (e) { lastLoad.p3.backupFailed = true; }
        }
        if (fromVersion < 3) { // Phase Four: same rule, its own key
          try { if (localStorage.getItem(BACKUP_KEY_P4) == null) localStorage.setItem(BACKUP_KEY_P4, raw); lastLoad.p4.backup = BACKUP_KEY_P4; } catch (e) { lastLoad.p4.backupFailed = true; }
        }
        if (fromVersion < 4) { // Phase Five: same rule, its own key
          try { if (localStorage.getItem(BACKUP_KEY_P5) == null) localStorage.setItem(BACKUP_KEY_P5, raw); lastLoad.p5.backup = BACKUP_KEY_P5; } catch (e) { lastLoad.p5.backupFailed = true; }
        }
        S = migrate(parsed);
        const ids = Object.keys(S.specimens), need = ids.some(id => !S.specimens[id].sv);
        if (need) {
          const draft = JSON.parse(JSON.stringify(S)); // migrate a copy; adopt it only if every check passes
          try { const r = migrateP3(draft); if (r.bad.length) throw new Error(r.bad.slice(0, 3).join('; ')); S = draft; lastLoad.p3.migrated = r.added; if (!lastLoad.p3.backupFailed) save(true); }
          catch (e) { console.error('Phase Three migration rejected; loading the original save', e); lastLoad.p3.failed = String(e.message || e); S.version = fromVersion || 1; }
        }
        if (fromVersion < 3 && !lastLoad.p3.failed) {
          const draft = JSON.parse(JSON.stringify(S));
          try { const r = migrateP4(draft); if (r.bad.length) throw new Error(r.bad.slice(0, 3).join('; ')); S = draft; lastLoad.p4.migrated = true; lastLoad.p4.added = r.added; if (!lastLoad.p4.backupFailed) save(true); }
          catch (e) { console.error('Phase Four migration rejected; loading the original save', e); lastLoad.p4.failed = String(e.message || e); S.version = fromVersion || 2; }
        }
        if (fromVersion < 4 && !lastLoad.p3.failed && !lastLoad.p4.failed) {
          const draft = JSON.parse(JSON.stringify(S));
          try { const r = migrateP5(draft); if (r.bad.length) throw new Error(r.bad.slice(0, 3).join('; ')); S = draft; lastLoad.p5.migrated = true; lastLoad.p5.added = r.added; if (!lastLoad.p5.backupFailed) save(true); }
          catch (e) { console.error('Phase Five migration rejected; loading the original save', e); lastLoad.p5.failed = String(e.message || e); S.version = fromVersion; delete S.combat; }
        }
        Object.assign(lastLoad, { fresh: false, fromVersion, specimens: ids.length, dropped: migrate.dropped, bytes: raw.length }); return S;
      }
      catch (e) {
        console.error('Corrupt save, preserving backup', e);
        lastLoad.corrupt = true; lastLoad.backupKey = SAVE_KEY + '.corrupt.' + Date.now();
        try { localStorage.setItem(lastLoad.backupKey, raw); } catch (_) {}
      }
    }
    S = defaultSave();
    return S;
  }

  function reset(mode = 'standard', name = 'Collector') {
    S = defaultSave(mode, name);
    save(true);
    bus.emit('reset');
    return S;
  }

  /** Replace the whole in-memory state (used only to roll back a failed atomic action, e.g. a fusion commit). */
  function replace(next) { S = next; save(true); }

  function exportJSON() { return JSON.stringify(S, null, 1); }
  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.wallet || !parsed.specimens) throw new Error('Not an Aethervault save file');
    S = migrate(parsed);
    try { migrateP3(S); } catch (e) { console.error('Import: Phase Three fields not added', e); }
    try { migrateP4(S); } catch (e) { console.error('Import: Phase Four fields not added', e); }
    try { migrateP5(S); } catch (e) { console.error('Import: Phase Five fields not added', e); }
    save(true);
    bus.emit('reset');
    return S;
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('beforeunload', () => save(true));
    window.addEventListener('pagehide', () => save(true));
  }

  AV.bus = bus;
  AV.state = {
    get: () => S, load, lastLoad, save, reset, replace, exportJSON, importJSON, defaultSave, migrate, migrateP3, migrateP4, migrateP5, defaultCombat, normCombat, SAVE_KEY, SAVE_VERSION, BACKUP_KEY, BACKUP_KEY_P4, BACKUP_KEY_P5, BACKUP_KEY_FUSION, fingerprint,
    storageOk: () => storageOk,
  };
})();

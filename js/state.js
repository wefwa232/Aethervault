/* AETHERVAULT — save state, persistence, migration, event bus. */
(function () {
  const AV = (window.AV = window.AV || {});
  const SAVE_KEY = 'aethervault.save.v1';
  const SAVE_VERSION = 2;
  const BACKUP_KEY = 'aethervault.save.v1.backup-p3'; // raw pre-Phase-Three save, written once, never overwritten

  // ---------- Event bus ----------
  const listeners = {};
  const bus = {
    on(topic, fn) { (listeners[topic] = listeners[topic] || new Set()).add(fn); return () => listeners[topic].delete(fn); },
    emit(topic, payload) { Array.from(listeners[topic] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error('[bus]', topic, e); } }); },
  };

  function defaultSettings() {
    return { master: 0.8, music: 0.45, sfx: 0.8, opening: 0.9, animSpeed: 1, reducedMotion: false, shake: true, flashing: true, textSize: 1, skipRituals: false, quality3d: 'medium', fpsLimit: 'auto', fastStartup: false };
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
    };
  }

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
    out.specimens = s.specimens || {};
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
  const lastLoad = { fresh: true, fromVersion: null, specimens: 0, dropped: 0, corrupt: false, backupKey: null, storage: true, bytes: 0, p3: {} };
  function load() {
    let raw = null; Object.assign(lastLoad, { fresh: true, fromVersion: null, specimens: 0, dropped: 0, corrupt: false, backupKey: null, storage: true, bytes: 0, p3: {} });
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { storageOk = false; lastLoad.storage = false; }
    if (raw) {
      try {
        const parsed = JSON.parse(raw); migrate.dropped = 0;
        const fromVersion = parsed.version == null ? 0 : parsed.version;
        if (fromVersion < 2) { // keep the raw save before touching it (once; an existing backup is never overwritten)
          try { if (localStorage.getItem(BACKUP_KEY) == null) localStorage.setItem(BACKUP_KEY, raw); lastLoad.p3.backup = BACKUP_KEY; } catch (e) { lastLoad.p3.backupFailed = true; }
        }
        S = migrate(parsed);
        const ids = Object.keys(S.specimens), need = ids.some(id => !S.specimens[id].sv);
        if (need) {
          const draft = JSON.parse(JSON.stringify(S)); // migrate a copy; adopt it only if every check passes
          try { const r = migrateP3(draft); if (r.bad.length) throw new Error(r.bad.slice(0, 3).join('; ')); S = draft; lastLoad.p3.migrated = r.added; if (!lastLoad.p3.backupFailed) save(true); }
          catch (e) { console.error('Phase Three migration rejected; loading the original save', e); lastLoad.p3.failed = String(e.message || e); S.version = fromVersion || 1; }
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

  function exportJSON() { return JSON.stringify(S, null, 1); }
  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.wallet || !parsed.specimens) throw new Error('Not an Aethervault save file');
    S = migrate(parsed);
    try { migrateP3(S); } catch (e) { console.error('Import: Phase Three fields not added', e); }
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
    get: () => S, load, lastLoad, save, reset, exportJSON, importJSON, defaultSave, migrate, migrateP3, SAVE_KEY, SAVE_VERSION, BACKUP_KEY,
    storageOk: () => storageOk,
  };
})();

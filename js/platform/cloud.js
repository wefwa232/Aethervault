/* AETHERVAULT — local-first cloud saves (Distribution Subphase D). Exposes AV.cloud.
   The local save stays authoritative: it is written first, always. Synchronisation happens afterwards, is optional
   (the player turns it on per device and account), and can fail without touching local progress. Nothing is replaced
   silently: first linking, a newer cloud copy and every conflict need an explicit choice, and the version that loses
   is preserved (local safety copy and/or cloud backup) before anything is overwritten.
   Server contract: supabase/cloud_saves.sql (compare-and-swap on `revision`, RLS, validation, backups).
   The access token comes from AV.auth; no service key or secret is ever involved. */
(function () {
  const AV = (window.AV = window.AV || {});
  const KEY = 'av.cloud', DEVKEY = 'av.device', LOCAL_BACKUP = 'aethervault.save.v1.backup-sync.', KEEP_LOCAL_BACKUPS = 3;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const store = fn => { try { return fn(localStorage); } catch (e) { return null; } };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

  const T = { debounceMs: 30000, maxWaitMs: 180000, retryBaseMs: 15000, retryMaxMs: 900000, pollMs: 300000, startDelayMs: 4000 };
  if (isLocal) Object.assign(T, store(s => JSON.parse(s.getItem('av.cloud.timing') || 'null')) || {});   // test hook, localhost only

  // ---------- persistent per-browser link state (never part of the save, never exported) ----------
  const blank = () => ({ user: null, enabled: false, base: null, lastSyncAt: 0, lastError: '', needsPreserve: false });
  let meta = Object.assign(blank(), store(s => JSON.parse(s.getItem(KEY) || 'null')) || {});
  const persist = () => store(s => s.setItem(KEY, JSON.stringify(meta)));

  function guessName() {
    const ua = navigator.userAgent;
    const b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    return (b + (o ? ' on ' + o : '') + (matchMedia('(display-mode: standalone)').matches ? ' (app)' : '')).slice(0, 60);
  }
  function device() {
    let d = store(s => JSON.parse(s.getItem(DEVKEY) || 'null'));
    if (!d || !/^[0-9a-f-]{36}$/.test(d.id || '')) { d = { id: crypto.randomUUID(), name: guessName() }; store(s => s.setItem(DEVKEY, JSON.stringify(d))); }
    return d;
  }

  const C = (AV.cloud = {
    status: 'off', detail: '', pending: null, T,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    device,
  });
  const A = () => AV.auth;
  const setStatus = (s, detail) => { C.status = s; C.detail = detail || ''; emit(); };

  const available = () => !!(A() && A().configured && A().supported && A().signedIn() && crypto.subtle);
  const ready = () => { if (!available() || !meta.enabled) return false; const u = A().user(); return !!(u && meta.user === u.id); };
  C.available = available; C.linked = ready;

  // ---------- snapshot, checksum, validation ----------
  const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
  async function sha256(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
  const num = v => (isFinite(+v) ? +v : 0);
  function summaryOf(o) {
    const p = o.profile || {}, w = o.wallet || {}, c = o.combat || {};
    return { specimens: Object.keys(o.specimens || {}).length, level: num(p.level), name: String(p.name || '').slice(0, 20), title: String(p.title || '').slice(0, 24), mode: String(o.mode || '').slice(0, 12),
      credits: num(w.credits), gems: num(w.gems), essence: num(w.essence), games: num(c.games), wins: num(c.wins) };
  }
  const isPristine = o => !(o.flags && o.flags.onboarded) && !Object.keys(o.specimens || {}).length;
  async function snapshot() {
    const S = AV.state.get(); if (!S) throw fail('fatal', 'The local save is not loaded yet.');
    const obj = JSON.parse(JSON.stringify(S));
    return { obj, checksum: await sha256(canon(obj)), summary: summaryOf(obj), pristine: isPristine(obj) };
  }
  /** Is this payload safe to adopt? Mirrors the server checks and is stricter (it must survive the migrator). */
  function validate(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: 'not a save object' };
    if (!o.wallet || typeof o.wallet !== 'object' || !o.specimens || typeof o.specimens !== 'object' || Array.isArray(o.specimens)) return { ok: false, reason: 'missing wallet or specimens' };
    if (!Number.isInteger(o.version) || o.version < 1) return { ok: false, reason: 'no valid save version' };
    if (o.version > AV.state.SAVE_VERSION) return { ok: false, newer: true, reason: 'made by a newer version of Aethervault' };
    for (const k of Object.keys(o.wallet)) if (typeof o.wallet[k] !== 'number' || !isFinite(o.wallet[k])) return { ok: false, reason: 'invalid wallet value' };
    for (const id of Object.keys(o.specimens)) { const sp = o.specimens[id]; if (!sp || typeof sp !== 'object' || typeof sp.base !== 'string') return { ok: false, reason: 'invalid specimen ' + id }; }
    try { const m = AV.state.migrate(JSON.parse(JSON.stringify(o))); if (!m || typeof m !== 'object') throw 0; } catch (e) { return { ok: false, reason: 'does not load' }; }
    return { ok: true };
  }
  function blockedReason() {
    const L = AV.state.lastLoad;
    if (L.corrupt) return 'This device’s save could not be read, so it will not be uploaded.';
    if (L.p3.failed || L.p4.failed || L.p5.failed) return 'This device’s save needs repair before it can sync.';
    return '';
  }

  // ---------- local safety copies ----------
  /** Stores `obj` under a rolling set of safety keys. Returns the key, or null if the browser had no room. */
  function backupLocal(tag, obj) {
    const val = JSON.stringify(obj), key = LOCAL_BACKUP + String(Date.now()).padStart(13, '0') + '.' + tag;
    const keys = () => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LOCAL_BACKUP)) ks.push(k); } return ks.sort(); };
    try {
      try { localStorage.setItem(key, val); }
      catch (e) { keys().slice(0, -1).forEach(k => localStorage.removeItem(k)); localStorage.setItem(key, val); }   // make room by dropping older safety copies only
      const ks = keys(); while (ks.length > KEEP_LOCAL_BACKUPS) localStorage.removeItem(ks.shift());
      return key;
    } catch (e) { return null; }
  }
  C.localBackups = () => { const ks = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LOCAL_BACKUP)) ks.push(k); } } catch (e) {} return ks.sort(); };

  // ---------- HTTP (PostgREST + RPC with the signed-in user's token) ----------
  function fail(kind, msg) { return Object.assign(new Error(msg), { kind }); }
  async function http(method, path, body, tok) {
    const cfg = A().cfg, ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + path, { method, signal: ctl.signal,
        headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body) });
      let data = null; try { data = await r.json(); } catch (e) { /* empty body */ }
      return { status: r.status, ok: r.ok, data };
    } catch (e) { throw fail('net', 'Can’t reach the cloud right now.'); }
    finally { clearTimeout(t); }
  }
  async function call(method, path, body) {
    let tok = await A().token(); if (!tok) throw fail(navigator.onLine ? 'auth' : 'net', 'Sign in again to keep syncing.');
    let r = await http(method, path, body, tok);
    if (r.status === 401) { await A().refresh(); tok = await A().token(); if (!tok) throw fail('auth', 'Sign in again to keep syncing.'); r = await http(method, path, body, tok); if (r.status === 401) throw fail('auth', 'Sign in again to keep syncing.'); }
    if (r.status === 429 || r.status >= 500) throw fail('retry', 'The cloud is busy; will retry.');
    if (!r.ok) throw fail('fatal', (r.data && (r.data.message || r.data.error)) || 'Cloud request failed (' + r.status + ').');
    return r.data;
  }
  const HEAD_COLS = 'revision,checksum,save_version,device_id,device_name,app_build,summary,payload_bytes,updated_at';
  const getHead = async () => { const d = await call('GET', 'cloud_saves?select=' + HEAD_COLS + '&limit=1'); return Array.isArray(d) && d[0] ? d[0] : null; };
  const getFull = async () => { const d = await call('GET', 'cloud_saves?select=' + HEAD_COLS + ',payload&limit=1'); if (!Array.isArray(d) || !d[0]) throw fail('fatal', 'The cloud save is gone.'); return d[0]; };
  const args = (snap, extra) => Object.assign({ p_device_id: device().id, p_device_name: device().name, p_app_build: String((AV.VERSION && AV.VERSION.build) || ''), p_save_version: snap.obj.version, p_checksum: snap.checksum, p_summary: snap.summary, p_payload: snap.obj }, extra);
  const rpcPush = (snap, baseRev) => call('POST', 'rpc/av_cloud_push', args(snap, { p_base_revision: baseRev }));
  const rpcBackup = (reason, snap) => call('POST', 'rpc/av_cloud_backup_put', args(snap, { p_reason: reason }));
  C.listBackups = () => call('GET', 'save_backups?select=id,revision,reason,save_version,device_name,summary,payload_bytes,checksum,created_at&order=created_at.desc&limit=12');
  const getBackup = async id => { const d = await call('GET', 'save_backups?select=id,checksum,save_version,summary,payload&id=eq.' + encodeURIComponent(id) + '&limit=1'); if (!Array.isArray(d) || !d[0]) throw fail('fatal', 'That backup no longer exists.'); return d[0]; };

  /** Downloaded payload → verified save snapshot, or throws. Rejects corrupt (checksum), newer-schema and unloadable saves. */
  async function verified(row) {
    const o = row.payload, v = validate(o);
    if (!v.ok) throw fail(v.newer ? 'newer' : 'corrupt', v.newer ? 'That save was made by a newer version of Aethervault. Update the app first; nothing was changed.' : 'The cloud copy looks damaged (' + v.reason + '); nothing was changed.');
    const sum = await sha256(canon(o));
    if (sum !== row.checksum) throw fail('corrupt', 'The cloud copy failed its integrity check; nothing was changed.');
    return { obj: o, checksum: sum, summary: summaryOf(o), pristine: isPristine(o) };
  }

  // ---------- preserving the version that is about to lose ----------
  /** Local safety copy plus (best effort) a cloud backup. At least one must succeed or the caller aborts. */
  async function preserve(tag, snap, reason, cloudToo = true) {
    const key = backupLocal(tag, snap.obj); let cloud = false;
    if (cloudToo) { try { const r = await rpcBackup(reason, snap); cloud = r && r.status === 'ok'; } catch (e) { cloud = false; } }
    if (!key && !cloud) throw fail('fatal', 'Could not make a safety copy of the version that would be replaced, so nothing was changed. Export your save first.');
    return { local: !!key, cloud };
  }
  async function preserveHead(head, againstChecksum) {
    if (againstChecksum && head.checksum === againstChecksum) return;
    const full = await getFull(); let snap;
    try { snap = await verified(full); }
    catch (e) { // damaged or newer copy: still keep the bytes, under the checksum they really have
      const o = full.payload; snap = { obj: o, checksum: await sha256(canon(o)), summary: full.summary || {}, pristine: false };
      if (!snap.obj || typeof snap.obj !== 'object') return;
    }
    await preserve('cloud', snap, 'cloud-preserved');
  }

  // ---------- applying a verified cloud save locally ----------
  function applyLocal(snap) {
    if (document.body.dataset.screen === 'battle') throw fail('battle', 'Finish your battle first; nothing was changed.');
    AV.state.importJSON(JSON.stringify(snap.obj));
    meta.needsPreserve = false;
    const ui = AV.ui; if (ui) { try { ui.applySettings && ui.applySettings(); ui.renderTopbar && ui.renderTopbar(); ui.refresh && ui.refresh(); } catch (e) { console.warn(e); } }
  }

  // ---------- link state ----------
  let changeSeq = 0, dirtySince = 0, timer = null, retryN = 0, pollTimer = null, inflight = null, lastRun = 0;
  const now = () => Date.now();
  function adopt(rev, checksum) {
    meta.user = A().user().id; meta.enabled = true; meta.base = { revision: rev, checksum }; meta.lastSyncAt = now(); meta.lastError = ''; meta.needsPreserve = false;
    persist(); retryN = 0; C.pending = null; dirtySince = 0;
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => run(), ms); }
  function scheduleDebounced() {
    if (!ready() || ['conflict', 'blocked', 'cloud-newer', 'signin'].includes(C.status)) return;
    if (!dirtySince) dirtySince = now();
    schedule(Math.max(0, Math.min(T.debounceMs, dirtySince + T.maxWaitMs - now())));
  }
  function offline(e) {
    meta.lastError = e.message; persist();
    const wait = Math.min(T.retryMaxMs, T.retryBaseMs * 2 ** Math.min(retryN++, 10));
    setStatus('offline', e.message + ' Your progress is safe on this device and will sync when the connection returns.');
    schedule(wait);
    try { navigator.serviceWorker && navigator.serviceWorker.ready.then(r => r.sync && r.sync.register('av-cloud-sync')).catch(() => {}); } catch (e2) { /* Background Sync is Chromium-only */ }
  }
  function toast(msg) { try { AV.ui && AV.ui.toast && AV.ui.toast(msg, { icon: 'info', silent: true }); } catch (e) {} }

  async function core(opts) {
    if (!ready()) { setStatus('off'); return; }
    const why = blockedReason(); if (why) { setStatus('blocked', why); return; }
    lastRun = now(); clearTimeout(timer);
    const prev = C.status;
    setStatus('syncing');
    try {
      const seq = changeSeq, snap = await snapshot(), head = await getHead(), base = meta.base || { revision: 0, checksum: '' };
      if (head && head.save_version > AV.state.SAVE_VERSION) { setStatus('blocked', 'The cloud save is from a newer version of Aethervault. Update the app to keep syncing; this device’s progress is untouched.'); return; }
      if (!head) {
        if (base.revision > 0) { C.pending = { kind: 'cloud-deleted', head: null }; setStatus('conflict', 'The cloud copy was deleted from another device.'); if (prev !== 'conflict') toast('Cloud save needs a decision — Settings → Account'); return; }
        if (snap.pristine) { adopt(0, ''); setStatus('idle'); return; }
        const r = await rpcPush(snap, 0);
        if (r.status === 'ok') { adopt(r.revision, snap.checksum); return finish(seq); }
        return unexpected(r, snap, seq);
      }
      const localChanged = snap.checksum !== base.checksum, cloudChanged = head.revision !== base.revision;
      if (head.checksum === snap.checksum) { adopt(head.revision, head.checksum); setStatus('idle'); return; }
      if (!localChanged && !cloudChanged) { adopt(base.revision, base.checksum); setStatus('idle'); return; }
      if (!localChanged) { C.pending = { kind: 'cloud-newer', head }; setStatus('cloud-newer', 'A newer save from ' + (head.device_name || 'another device') + ' is in the cloud.'); if (prev !== 'cloud-newer') toast('A newer cloud save is available — Settings → Account'); return; }
      if (cloudChanged) { C.pending = { kind: 'conflict', head }; setStatus('conflict', 'This device and ' + (head.device_name || 'another device') + ' both changed.'); if (prev !== 'conflict') toast('Cloud save conflict — Settings → Account'); return; }
      // Only this device changed. Guard against silently replacing real progress with an emptied save (e.g. after "Reset all progress").
      if (snap.pristine && base.revision > 0) { C.pending = { kind: 'reset', head }; setStatus('conflict', 'This device’s save is empty but the cloud has progress.'); if (prev !== 'conflict') toast('Cloud save needs a decision — Settings → Account'); return; }
      if (meta.needsPreserve) await preserveHead(head, snap.checksum);   // after an import/reset, keep the cloud version before it is replaced
      const r = await rpcPush(snap, base.revision);
      if (r.status === 'ok') { adopt(r.revision, snap.checksum); return finish(seq); }
      return unexpected(r, snap, seq);
    } catch (e) { handleError(e); }
  }
  function finish(seq) { if (seq !== changeSeq) { setStatus('dirty'); dirtySince = now(); schedule(T.debounceMs); } else setStatus('idle'); }
  function unexpected(r, snap, seq) {
    if (r.status === 'conflict') { schedule(500); return; }   // raced with another device between head check and push: re-evaluate from scratch
    if (r.reason === 'downgrade') return setStatus('blocked', 'The cloud save uses a newer save format than this version of Aethervault. Update the app; nothing was overwritten.');
    meta.lastError = 'The cloud refused this save (' + r.reason + '). Your local progress is unchanged.'; persist();
    setStatus('error', meta.lastError);
  }
  function handleError(e) {
    if (e.kind === 'net' || e.kind === 'retry') return offline(e);
    if (e.kind === 'auth') { meta.lastError = e.message; persist(); return setStatus('signin', e.message); }
    meta.lastError = e.message || 'Sync failed.'; persist(); setStatus('error', meta.lastError);
  }

  async function exclusive(fn) {
    while (inflight) { try { await inflight; } catch (e) { /* ignore */ } }
    inflight = (async () => fn())();
    try { return await inflight; } finally { inflight = null; }
  }
  function run(opts) {
    if (inflight) return inflight;
    if (!ready()) return Promise.resolve();
    const go = () => (navigator.locks ? navigator.locks.request('av-cloud', { ifAvailable: true }, lock => (lock ? core(opts || {}) : null)) : core(opts || {}));
    inflight = go().finally(() => { inflight = null; });
    return inflight;
  }
  C.sync = () => run({ manual: true });
  C.localChecksum = async () => (await snapshot()).checksum;   // diagnostics / tests

  // ---------- decisions & flows (called from the UI, each is explicit) ----------
  /** What would turning cloud saves on (or resolving a conflict) do? Returns the facts the dialog shows. */
  C.inspect = async function () {
    if (!available()) throw fail('auth', 'Sign in first.');
    const snap = await snapshot(), head = await getHead();
    const kind = !head ? (snap.pristine ? 'empty' : 'upload') : head.checksum === snap.checksum ? 'same' : snap.pristine ? 'download' : 'compare';
    return { kind, local: { summary: snap.summary, checksum: snap.checksum, version: snap.obj.version, device: device().name }, head };
  };
  C.keepDevice = () => exclusive(async () => {
    if (!available()) throw fail('auth', 'Sign in first.');
    const why = blockedReason(); if (why) throw fail('fatal', why);
    const snap = await snapshot(), head = await getHead();
    if (head && head.save_version > AV.state.SAVE_VERSION) throw fail('newer', 'The cloud save is from a newer version of Aethervault. Update the app first; nothing was changed.');
    if (head) await preserveHead(head, snap.checksum);
    const r = await rpcPush(snap, head ? head.revision : 0);
    if (r.status === 'conflict') throw fail('raced', 'The cloud save changed again while you were deciding. Compare again.');
    if (r.status !== 'ok') throw fail('fatal', r.reason === 'downgrade' ? 'The cloud save uses a newer save format; update the app first.' : 'The cloud refused this save (' + r.reason + ').');
    adopt(r.revision, snap.checksum); setStatus('idle'); scheduleDebounced();
  });
  C.keepCloud = () => exclusive(async () => {
    if (!available()) throw fail('auth', 'Sign in first.');
    const snap = await snapshot(), head = await getHead(); if (!head) throw fail('fatal', 'There is no cloud save to keep.');
    if (head.save_version > AV.state.SAVE_VERSION) throw fail('newer', 'That save was made by a newer version of Aethervault. Update the app first; nothing was changed.');
    const cloud = await verified(await getFull());
    if (document.body.dataset.screen === 'battle') throw fail('battle', 'Finish your battle first; nothing was changed.');
    if (!snap.pristine && snap.checksum !== cloud.checksum) await preserve('local', snap, 'local-preserved'); else backupLocal('local', snap.obj);
    applyLocal(cloud); adopt(head.revision, head.checksum); setStatus('idle');
  });
  /** Link without choosing a side: only valid when both sides are already identical, or the cloud is empty and local is empty. */
  C.linkSame = () => exclusive(async () => {
    const i = await C.inspect(); if (i.kind !== 'same' && i.kind !== 'empty') throw fail('fatal', 'The two copies differ; choose which to keep.');
    adopt(i.head ? i.head.revision : 0, i.head ? i.head.checksum : ''); setStatus('idle');
  });
  C.restoreBackup = id => exclusive(async () => {
    if (!ready()) throw fail('auth', 'Turn on cloud saves first.');
    const snap = await snapshot(), head = await getHead(), row = await getBackup(id);
    const bk = await verified(row);
    if (document.body.dataset.screen === 'battle') throw fail('battle', 'Finish your battle first; nothing was changed.');
    if (!snap.pristine && snap.checksum !== bk.checksum) await preserve('local', snap, 'local-preserved'); else backupLocal('local', snap.obj);
    if (head) await preserveHead(head, bk.checksum);
    applyLocal(bk);
    meta.base = head ? { revision: head.revision, checksum: head.checksum } : { revision: 0, checksum: '' }; persist();
    changeSeq++; dirtySince = now(); setStatus('dirty'); schedule(500);   // the restored version becomes the new cloud head through the normal push
  });
  C.deleteCloud = () => exclusive(async () => {
    if (!available()) throw fail('auth', 'Sign in first.');
    await call('POST', 'rpc/av_cloud_delete_all', {});
    meta = blank(); persist(); C.pending = null; clearTimeout(timer); setStatus('off');
  });
  C.disable = () => { meta = blank(); persist(); C.pending = null; clearTimeout(timer); setStatus('off'); };
  C.info = () => ({ configured: !!(A() && A().configured), supported: !!(A() && A().supported), signedIn: !!(A() && A().signedIn()), linked: ready(), status: C.status, detail: C.detail,
    lastSyncAt: meta.lastSyncAt, revision: meta.base ? meta.base.revision : 0, device: device(), pending: C.pending, lastError: meta.lastError });

  // ---------- triggers ----------
  function reconcile() {
    clearTimeout(timer); clearTimeout(pollTimer);
    if (!ready()) { C.pending = null; setStatus('off'); return; }
    if (C.status === 'off') setStatus('idle');
    schedule(T.startDelayMs);
    const poll = () => { pollTimer = setTimeout(() => { if (ready() && document.visibilityState === 'visible' && !inflight && !['conflict', 'blocked', 'cloud-newer', 'signin'].includes(C.status)) run(); poll(); }, T.pollMs); }; poll();
  }
  if (AV.bus) {
    AV.bus.on('saved', () => { changeSeq++; if (ready()) { if (C.status === 'idle') setStatus('dirty'); scheduleDebounced(); } });
    AV.bus.on('reset', () => { if (meta.enabled) { meta.needsPreserve = true; persist(); } });   // import / reset: keep the cloud version before it is replaced
  }
  window.addEventListener('online', () => { if (ready() && !inflight) { retryN = 0; run(); } });
  document.addEventListener('visibilitychange', () => {
    if (!ready()) return;
    if (document.visibilityState === 'hidden') { if (C.status === 'dirty') run(); }              // best effort while the tab is still alive
    else if (now() - lastRun > 60000 && !inflight && !['conflict', 'blocked', 'cloud-newer', 'signin'].includes(C.status)) run();
  });
  // The service worker holds no tokens. A Background Sync wake-up only asks an open page to run its normal sync.
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'CLOUD_SYNC' && ready()) run(); });
  if (A()) A().onChange(reconcile);
  if (ready()) { C.status = 'idle'; if (document.readyState === 'complete') reconcile(); else window.addEventListener('load', reconcile); }
})();

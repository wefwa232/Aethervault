// Dev-only stand-in for Supabase (GoTrue auth + the PostgREST surface of supabase/cloud_saves.sql) so the cloud-save
// client can be tested without touching a real project. It mirrors the SQL's rules: compare-and-swap on `revision`,
// payload validation, downgrade rejection, backup rules, 12-backup cap, per-user isolation. Real RLS is proven by
// supabase/cloud_saves.test.sql; this server only proves the CLIENT's behaviour against the same contract.
// Usage: node tools/mock-supabase.mjs [port]   (default 54321)
// Test controls: /__user?n=1|2 (which user the next sign-in is), /__down?on=1 (503 for REST), /__state, /__seed (POST head),
//                /__tamper (corrupt stored payload without fixing its checksum), /__reset.
import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.argv[2] || 54321);
const USERS = { 1: '00000000-0000-4000-8000-000000000001', 2: '00000000-0000-4000-8000-000000000002' };
const codes = new Map(), refresh = new Map(), tokens = new Map();
let n = 0, nextUser = 1, down = false;
const db = { heads: new Map(), backups: new Map() };       // user -> row / [rows]
const log = [];
const userObj = id => ({ id, email: `tester${id.slice(-1)}@example.test`, user_metadata: { full_name: 'Test Pilot ' + id.slice(-1) } });
const mint = uid => { const rt = 'rt' + ++n, at = 'at' + n; refresh.set(rt, uid); tokens.set(at, uid); return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: userObj(uid) }; };
const sha = v => crypto.createHash('sha256').update(v).digest('base64url');
const bytes = o => Buffer.byteLength(JSON.stringify(o));

function check(a) {
  if (!a.p_device_id || !/^[0-9a-f-]{36}$/.test(a.p_device_id)) return 'device';
  if (!Number.isInteger(a.p_save_version) || a.p_save_version < 1 || a.p_save_version > 999) return 'schema-version';
  if (typeof a.p_checksum !== 'string' || !/^[0-9a-f]{64}$/.test(a.p_checksum)) return 'checksum';
  const s = a.p_summary; if (!s || typeof s !== 'object' || Array.isArray(s) || bytes(s) > 8192) return 'summary';
  const p = a.p_payload; if (!p || typeof p !== 'object' || Array.isArray(p)) return 'payload-shape';
  if (bytes(p) > 3000000) return 'too-large';
  if (!p.wallet || typeof p.wallet !== 'object' || Array.isArray(p.wallet) || !p.specimens || typeof p.specimens !== 'object' || Array.isArray(p.specimens)) return 'payload-shape';
  if (p.version !== a.p_save_version) return 'version-mismatch';
  return null;
}
const meta = r => ({ revision: r.revision, checksum: r.checksum, save_version: r.save_version, device_id: r.device_id, device_name: r.device_name, app_build: r.app_build, summary: r.summary, payload_bytes: r.payload_bytes, updated_at: r.updated_at });
const prune = uid => { const l = db.backups.get(uid) || []; l.sort((a, b) => b.created_at.localeCompare(a.created_at)); db.backups.set(uid, l.slice(0, 12)); };
const addBackup = (uid, reason, r) => { const l = db.backups.get(uid) || []; l.push({ id: crypto.randomUUID(), revision: r.revision ?? 0, reason, save_version: r.save_version, device_name: r.device_name, device_id: r.device_id, checksum: r.checksum, summary: r.summary, payload: r.payload, payload_bytes: r.payload_bytes, created_at: new Date(Date.now() + l.length).toISOString() }); db.backups.set(uid, l); prune(uid); };

function rpc(uid, name, a) {
  if (name === 'av_cloud_push') {
    if (!Number.isInteger(a.p_base_revision) || a.p_base_revision < 0) return { status: 'rejected', reason: 'base-revision' };
    const why = check(a); if (why) return { status: 'rejected', reason: why };
    const row = db.heads.get(uid), now = new Date().toISOString(), size = bytes(a.p_payload);
    const mk = rev => ({ revision: rev, save_version: a.p_save_version, app_build: String(a.p_app_build || '').slice(0, 64), device_id: a.p_device_id, device_name: String(a.p_device_name || '').trim().slice(0, 60), checksum: a.p_checksum, summary: a.p_summary, payload: a.p_payload, payload_bytes: size, updated_at: now });
    if (!row) { if (a.p_base_revision !== 0) return { status: 'conflict', head: null }; db.heads.set(uid, mk(1)); return { status: 'ok', revision: 1, checksum: a.p_checksum, updated_at: now }; }
    if (row.revision !== a.p_base_revision) return { status: 'conflict', head: meta(row) };
    if (a.p_save_version < row.save_version) return { status: 'rejected', reason: 'downgrade', cloud_save_version: row.save_version };
    if (row.checksum === a.p_checksum) return { status: 'ok', revision: row.revision, checksum: row.checksum, updated_at: row.updated_at, unchanged: true };
    if (row.device_id !== a.p_device_id || Date.parse(row.updated_at) < Date.now() - 6 * 3600e3 || row.save_version !== a.p_save_version) addBackup(uid, 'replaced', row);
    db.heads.set(uid, mk(row.revision + 1)); return { status: 'ok', revision: row.revision + 1, checksum: a.p_checksum, updated_at: now };
  }
  if (name === 'av_cloud_backup_put') {
    if (!['local-preserved', 'cloud-preserved', 'manual'].includes(a.p_reason)) return { status: 'rejected', reason: 'backup-reason' };
    const why = check(a); if (why) return { status: 'rejected', reason: why };
    const ex = (db.backups.get(uid) || []).find(b => b.checksum === a.p_checksum); if (ex) return { status: 'ok', id: ex.id, existing: true };
    addBackup(uid, a.p_reason, { revision: 0, save_version: a.p_save_version, device_name: String(a.p_device_name || '').slice(0, 60), device_id: a.p_device_id, checksum: a.p_checksum, summary: a.p_summary, payload: a.p_payload, payload_bytes: bytes(a.p_payload) });
    return { status: 'ok' };
  }
  if (name === 'av_cloud_delete_all') { const s = db.heads.delete(uid) ? 1 : 0, b = (db.backups.get(uid) || []).length; db.backups.delete(uid); return { status: 'ok', deleted_saves: s, deleted_backups: b }; }
  return undefined;
}
const pick = (row, cols) => cols ? Object.fromEntries(cols.split(',').filter(c => c in row).map(c => [c, row[c]])) : row;

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'apikey, content-type, authorization, accept, prefer'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const json = (c, o) => res.writeHead(c, { 'Content-Type': 'application/json' }).end(JSON.stringify(o));
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { return json(400, { message: 'bad json' }); }
    const p = u.pathname;
    if (p === '/auth/v1/authorize') {
      if (u.searchParams.get('code_challenge_method') !== 's256' || !u.searchParams.get('code_challenge')) return json(400, { error_description: 'PKCE required' });
      const code = crypto.randomUUID(); codes.set(code, { ch: u.searchParams.get('code_challenge'), uid: USERS[nextUser] });
      const to = new URL(u.searchParams.get('redirect_to')); to.searchParams.set('code', code);
      return res.writeHead(302, { Location: to.toString() }).end();
    }
    if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'pkce') {
      const c = codes.get(b.auth_code); codes.delete(b.auth_code);
      if (!c || sha(b.code_verifier || '') !== c.ch) return json(400, { error_description: 'invalid flow state / verifier mismatch' });
      return json(200, mint(c.uid));
    }
    if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') { const uid = refresh.get(b.refresh_token); refresh.delete(b.refresh_token); if (!uid) return json(400, { error_description: 'Invalid Refresh Token' }); return json(200, mint(uid)); }
    if (p === '/auth/v1/logout') return res.writeHead(204).end();
    // ---- test controls ----
    if (p === '/__user') { nextUser = Number(u.searchParams.get('n') || 1); return json(200, { nextUser }); }
    if (p === '/__down') { down = u.searchParams.get('on') === '1'; return json(200, { down }); }
    if (p === '/__state') return json(200, { heads: Object.fromEntries([...db.heads].map(([k, v]) => [k, Object.assign(meta(v), { payload: v.payload })])), backups: Object.fromEntries([...db.backups].map(([k, v]) => [k, v.map(x => Object.assign({}, x, { payload: undefined }))])), log });
    if (p === '/__reset') { db.heads.clear(); db.backups.clear(); log.length = 0; down = false; return json(200, {}); }
    if (p === '/__seed') { const uid = USERS[b.user || 1]; db.heads.set(uid, Object.assign({ app_build: 'seed', device_name: 'Seed' }, b.row)); return json(200, {}); }
    if (p === '/__delete') { const uid = USERS[u.searchParams.get('user') || 1]; return json(200, { deleted: db.heads.delete(uid) }); }   // remote deletion of the head (backups stay)
    if (p === '/__tamper') { const r = db.heads.get(USERS[u.searchParams.get('user') || 1]); if (r) { r.payload.wallet.credits = (r.payload.wallet.credits || 0) + 1; } return json(200, { tampered: !!r }); }
    // ---- REST ----
    if (p.startsWith('/rest/v1/')) {
      const tok = (req.headers.authorization || '').replace(/^Bearer /, ''), uid = tokens.get(tok);
      if (down) return json(503, { message: 'down for test' });
      if (!uid) return json(401, { message: 'JWT expired or invalid' });
      const what = p.slice('/rest/v1/'.length);
      log.push(req.method + ' ' + what);
      if (what.startsWith('rpc/')) { const r = rpc(uid, what.slice(4), b); return r === undefined ? json(404, { message: 'no such function' }) : json(200, r); }
      if (what === 'cloud_saves' && req.method === 'GET') { const r = db.heads.get(uid); return json(200, r ? [pick(r, u.searchParams.get('select'))] : []); }
      if (what === 'save_backups' && req.method === 'GET') {
        let l = [...(db.backups.get(uid) || [])].sort((a, c) => c.created_at.localeCompare(a.created_at));
        const id = (u.searchParams.get('id') || '').replace(/^eq\./, ''); if (id) l = l.filter(x => x.id === id);
        return json(200, l.slice(0, Number(u.searchParams.get('limit') || 12)).map(x => pick(x, u.searchParams.get('select'))));
      }
      return json(403, { message: 'permission denied for table ' + what });     // no direct writes, like the real grants
    }
    json(404, { error: 'not found' });
  });
}).listen(port, () => console.log('mock supabase on :' + port));

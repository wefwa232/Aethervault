// Probes the REAL Supabase project with only the public anon key (read from js/platform/config.js) and checks that a
// signed-out caller can reach nothing. No credentials beyond what ships in the web app. Usage: node supabase/test/anon-probe.mjs
import fs from 'node:fs';
const cfg = fs.readFileSync(new URL('../../js/platform/config.js', import.meta.url), 'utf8');
const url = /supabaseUrl:\s*'([^']+)'/.exec(cfg)[1], key = /supabaseAnonKey:\s*'([^']+)'/.exec(cfg)[1];
let bad = 0;
const full = { p_device_id: '11111111-1111-4111-8111-111111111111', p_device_name: 'x', p_app_build: 'x', p_save_version: 4, p_checksum: '0'.repeat(64), p_summary: {}, p_payload: { version: 4, wallet: {}, specimens: {} } };
const probe = async (name, method, path, body) => {
  const r = await fetch(url + '/rest/v1/' + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); const denied = r.status === 401 || r.status === 403 || /permission denied|42501/.test(t);
  console.log((denied ? 'ok   ' : 'FAIL ') + name + '  -> HTTP ' + r.status + ' ' + t.slice(0, 90)); if (!denied) bad++;
};
await probe('anon cannot read cloud_saves', 'GET', 'cloud_saves?select=*&limit=1');
await probe('anon cannot read save_backups', 'GET', 'save_backups?select=*&limit=1');
await probe('anon cannot insert cloud_saves', 'POST', 'cloud_saves', { user_id: '00000000-0000-4000-8000-000000000000' });
await probe('anon cannot call av_cloud_push', 'POST', 'rpc/av_cloud_push', { p_base_revision: 0, ...full });
await probe('anon cannot call av_cloud_delete_all', 'POST', 'rpc/av_cloud_delete_all', {});
await probe('anon cannot call av_cloud_backup_put', 'POST', 'rpc/av_cloud_backup_put', { p_reason: 'manual', ...full });
console.log(bad ? bad + ' probe(s) FAILED' : 'all probes denied');
process.exit(bad ? 1 : 0);

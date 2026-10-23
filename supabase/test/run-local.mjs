// Runs supabase/cloud_saves.sql and supabase/cloud_saves.test.sql against a local in-process Postgres (PGlite), with a
// stub of Supabase's roles/auth schema. Dev-only; nothing is sent anywhere.
//   Usage: PGLITE_DIR=<folder containing node_modules/@electric-sql/pglite> node supabase/test/run-local.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const dir = process.env.PGLITE_DIR;
if (!dir) { console.error('Set PGLITE_DIR to a folder where `npm i @electric-sql/pglite` was run.'); process.exit(2); }
const req = createRequire(path.join(dir, 'x.js'));
const { PGlite } = await import(pathToFileURL(req.resolve('@electric-sql/pglite')).href);

const db = new PGlite();
await db.exec(read('stub-supabase.sql'));
await db.exec(read('../cloud_saves.sql'));
await db.exec(read('../cloud_saves.sql'));          // idempotent: a second run must be harmless
console.log('schema applied twice without error');

const rls = await db.query(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('cloud_saves','save_backups') order by 1`);
console.log('RLS enabled:', JSON.stringify(rls.rows));
const grants = await db.query(`select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC') order by 2,1,3`);
console.log('table grants:', JSON.stringify(grants.rows));
const fgr = await db.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`);
console.log('functions:', JSON.stringify(fgr.rows));

try { await db.exec(read('../cloud_saves.test.sql')); console.log('test script did not abort (unexpected)'); process.exitCode = 1; }
catch (e) {
  console.log(e.message);
  process.exitCode = /AV TESTS: ALL \d+ PASSED/.test(e.message) ? 0 : 1;
}
const left = await db.query(`select (select count(*) from auth.users) u, (select count(*) from public.cloud_saves) s, (select count(*) from public.save_backups) b, to_regnamespace('av_test') t`);
console.log('residue after rollback:', JSON.stringify(left.rows[0]));

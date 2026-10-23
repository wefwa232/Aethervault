-- AETHERVAULT — cloud-save database tests (run AFTER cloud_saves.sql). Contains no secrets.
--
-- Paste into the Supabase SQL Editor and Run. It creates two FAKE users (fixed ids ...aaaa and ...bbbb), impersonates
-- them with simulated JWT claims, and checks Row Level Security, grants, conflicts, validation, backups and deletion.
--
-- It ends by RAISING AN ERROR ON PURPOSE. That is how it throws away everything it created: a failed statement rolls
-- back the whole script, so no fake users, saves, helper schema or results are left behind. The error text IS the
-- report: it starts with "AV TESTS: ALL n PASSED" or "AV TESTS: n FAILED" followed by one line per test.
-- Your real data is never touched (the fake ids are fixed and distinct from any real user).
--
-- Safety net: if a run is ever interrupted in a way that leaves the fake users behind, remove them with
--   delete from auth.users where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

create schema av_test;
create table av_test.results (n serial primary key, name text, ok boolean, detail text);
grant usage on schema av_test to public;
grant all on av_test.results to public;
grant usage, select on sequence av_test.results_n_seq to public;

-- A valid save payload of the given schema version with n specimens.
create function av_test.mk(p_ver integer default 4, p_n integer default 3) returns jsonb language sql as $$
  select jsonb_build_object('version', p_ver, 'wallet', jsonb_build_object('credits', 1000 + p_n),
    'specimens', coalesce((select jsonb_object_agg('s' || g, jsonb_build_object('base', 'x')) from generate_series(1, p_n) g), '{}'::jsonb))
$$;
create function av_test.ck(p_n integer) returns text language sql as $$ select lpad(to_hex(p_n), 64, '0') $$;
grant execute on all functions in schema av_test to public;

-- expect_json: run a query returning jsonb and require it to contain the expected fragment.
create function av_test.expect_json(p_name text, p_sql text, p_expect jsonb) returns void language plpgsql as $$
declare r jsonb;
begin
  execute p_sql into r;
  insert into av_test.results (name, ok, detail) values (p_name, r @> p_expect, left(r::text, 300));
exception when others then
  insert into av_test.results (name, ok, detail) values (p_name, false, 'raised: ' || sqlerrm);
end $$;
-- expect_error: the statement must fail with a message matching the pattern.
create function av_test.expect_error(p_name text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into av_test.results (name, ok, detail) values (p_name, false, 'no error was raised');
exception when others then
  insert into av_test.results (name, ok, detail) values (p_name, sqlerrm ~* p_pattern, sqlerrm);
end $$;
-- expect_count: the single-integer query must return the expected number.
create function av_test.expect_count(p_name text, p_sql text, p_expect bigint) returns void language plpgsql as $$
declare c bigint;
begin
  execute p_sql into c;
  insert into av_test.results (name, ok, detail) values (p_name, c = p_expect, 'got ' || c || ', expected ' || p_expect);
exception when others then
  insert into av_test.results (name, ok, detail) values (p_name, false, 'raised: ' || sqlerrm);
end $$;
grant execute on all functions in schema av_test to public;

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'av-test-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'av-test-b@example.invalid');

-- ===== anonymous (not signed in) =====
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select av_test.expect_error('anon cannot read cloud_saves',  $q$ select count(*) from public.cloud_saves $q$,  'permission denied');
select av_test.expect_error('anon cannot read save_backups', $q$ select count(*) from public.save_backups $q$, 'permission denied');
select av_test.expect_error('anon cannot push', $q$ select public.av_cloud_push(0, '11111111-1111-4111-8111-111111111111', 'x', 'b', 4, av_test.ck(1), '{}', av_test.mk()) $q$, 'permission denied');
select av_test.expect_error('anon cannot delete_all', $q$ select public.av_cloud_delete_all() $q$, 'permission denied');
select av_test.expect_error('anon cannot back up', $q$ select public.av_cloud_backup_put('manual', '11111111-1111-4111-8111-111111111111', 'x', 'b', 4, av_test.ck(1), '{}', av_test.mk()) $q$, 'permission denied');

-- ===== signed-in but with no subject claim =====
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select av_test.expect_error('no subject claim cannot push', $q$ select public.av_cloud_push(0, '11111111-1111-4111-8111-111111111111', 'x', 'b', 4, av_test.ck(1), '{}', av_test.mk()) $q$, 'not authenticated');

-- ===== user A =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select av_test.expect_json('A first push creates revision 1', $q$ select public.av_cloud_push(0, '11111111-1111-4111-8111-111111111111', 'Laptop', 'P5B', 4, av_test.ck(1), '{"specimens":3}', av_test.mk(4,3)) $q$, '{"status":"ok","revision":1}');
select av_test.expect_json('A second push (same device) is revision 2', $q$ select public.av_cloud_push(1, '11111111-1111-4111-8111-111111111111', 'Laptop', 'P5B', 4, av_test.ck(2), '{"specimens":4}', av_test.mk(4,4)) $q$, '{"status":"ok","revision":2}');
select av_test.expect_count('same-device recent push makes no backup', $q$ select count(*) from public.save_backups $q$, 0);
select av_test.expect_json('stale base revision is a conflict and reports the head', $q$ select public.av_cloud_push(1, '11111111-1111-4111-8111-111111111111', 'Laptop', 'P5B', 4, av_test.ck(3), '{}', av_test.mk(4,5)) $q$, '{"status":"conflict","head":{"revision":2}}');
select av_test.expect_json('pushing identical content is a no-op, not a new revision', $q$ select public.av_cloud_push(2, '11111111-1111-4111-8111-111111111111', 'Laptop', 'P5B', 4, av_test.ck(2), '{"specimens":4}', av_test.mk(4,4)) $q$, '{"status":"ok","revision":2,"unchanged":true}');
select av_test.expect_json('a different device replacing the head works', $q$ select public.av_cloud_push(2, '22222222-2222-4222-8222-222222222222', 'Phone', 'P5B', 4, av_test.ck(4), '{"specimens":6}', av_test.mk(4,6)) $q$, '{"status":"ok","revision":3}');
select av_test.expect_count('cross-device replace preserved the old head as a backup', $q$ select count(*) from public.save_backups where reason = 'replaced' and revision = 2 and device_name = 'Laptop' $q$, 1);
select av_test.expect_json('a push claiming base 5 on an existing row is a conflict', $q$ select public.av_cloud_push(5, '22222222-2222-4222-8222-222222222222', 'Phone', 'P5B', 4, av_test.ck(9), '{}', av_test.mk(4,2)) $q$, '{"status":"conflict"}');
select av_test.expect_json('base 0 on an existing row is a conflict (never a silent overwrite)', $q$ select public.av_cloud_push(0, '33333333-3333-4333-8333-333333333333', 'New browser', 'P5B', 4, av_test.ck(10), '{}', av_test.mk(4,1)) $q$, '{"status":"conflict","head":{"revision":3}}');

-- validation / corrupt-save rejection
select av_test.expect_json('rejects payload that is not an object', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(11), '{}', '[1,2,3]'::jsonb) $q$, '{"status":"rejected","reason":"payload-shape"}');
select av_test.expect_json('rejects payload without wallet', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(11), '{}', '{"version":4,"specimens":{}}'::jsonb) $q$, '{"status":"rejected","reason":"payload-shape"}');
select av_test.expect_json('rejects specimens that is not an object', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(11), '{}', '{"version":4,"wallet":{},"specimens":[]}'::jsonb) $q$, '{"status":"rejected","reason":"payload-shape"}');
select av_test.expect_json('rejects payload version that disagrees with save_version', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(11), '{}', av_test.mk(3,2)) $q$, '{"status":"rejected","reason":"version-mismatch"}');
select av_test.expect_json('rejects a malformed checksum', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, 'not-a-hash', '{}', av_test.mk(4,2)) $q$, '{"status":"rejected","reason":"checksum"}');
select av_test.expect_json('rejects an oversized payload', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(12), '{}', jsonb_set(av_test.mk(4,1), '{blob}', to_jsonb(repeat('x', 3100000)))) $q$, '{"status":"rejected","reason":"too-large"}');
select av_test.expect_json('rejects a non-object summary', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(13), '[]', av_test.mk(4,2)) $q$, '{"status":"rejected","reason":"summary"}');
select av_test.expect_json('rejects an out-of-range schema version', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 5000, av_test.ck(14), '{}', av_test.mk(4,2)) $q$, '{"status":"rejected","reason":"schema-version"}');
select av_test.expect_json('rejects a negative base revision', $q$ select public.av_cloud_push(-1, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 4, av_test.ck(15), '{}', av_test.mk(4,2)) $q$, '{"status":"rejected","reason":"base-revision"}');
select av_test.expect_json('rejects a downgrade of the save schema', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 3, av_test.ck(16), '{}', av_test.mk(3,2)) $q$, '{"status":"rejected","reason":"downgrade"}');
select av_test.expect_count('rejected pushes changed nothing (still revision 3)', $q$ select revision from public.cloud_saves $q$, 3);
select av_test.expect_json('a schema upgrade is accepted and the old head is backed up', $q$ select public.av_cloud_push(3, '22222222-2222-4222-8222-222222222222', 'Phone', 'b', 5, av_test.ck(17), '{}', av_test.mk(5,2)) $q$, '{"status":"ok","revision":4}');
select av_test.expect_count('schema upgrade preserved the previous head', $q$ select count(*) from public.save_backups where revision = 3 $q$, 1);

-- direct table writes are not possible, even on one's own row
select av_test.expect_error('A cannot insert directly', $q$ insert into public.cloud_saves (user_id, revision, save_version, device_id, checksum, payload, payload_bytes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 99, 4, '11111111-1111-4111-8111-111111111111', av_test.ck(1), av_test.mk(), 10) $q$, 'permission denied');
select av_test.expect_error('A cannot update directly', $q$ update public.cloud_saves set revision = 1000 $q$, 'permission denied');
select av_test.expect_error('A cannot delete directly', $q$ delete from public.cloud_saves $q$, 'permission denied');
select av_test.expect_error('A cannot edit a backup', $q$ update public.save_backups set reason = 'manual' $q$, 'permission denied');
select av_test.expect_error('A cannot delete a backup directly', $q$ delete from public.save_backups $q$, 'permission denied');

-- backups
select av_test.expect_json('A can store a local version as a backup', $q$ select public.av_cloud_backup_put('local-preserved', '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(20), '{}', av_test.mk(4,2)) $q$, '{"status":"ok"}');
select av_test.expect_json('storing identical content again is deduplicated', $q$ select public.av_cloud_backup_put('manual', '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(20), '{}', av_test.mk(4,2)) $q$, '{"status":"ok","existing":true}');
select av_test.expect_json('backup reason is restricted', $q$ select public.av_cloud_backup_put('replaced', '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(21), '{}', av_test.mk(4,2)) $q$, '{"status":"rejected","reason":"backup-reason"}');
select av_test.expect_json('backup payloads are validated too', $q$ select public.av_cloud_backup_put('manual', '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(22), '{}', '{"x":1}'::jsonb) $q$, '{"status":"rejected","reason":"payload-shape"}');
do $$ begin for i in 1..20 loop perform public.av_cloud_backup_put('manual', '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(100 + i), '{}', av_test.mk(4, 10 + i)); end loop; end $$;
select av_test.expect_count('backups are capped at 12 per user', $q$ select count(*) from public.save_backups $q$, 12);

-- ===== user B: must see nothing of A =====
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select av_test.expect_count('B sees none of A''s saves', $q$ select count(*) from public.cloud_saves $q$, 0);
select av_test.expect_count('B sees none of A''s backups', $q$ select count(*) from public.save_backups $q$, 0);
select av_test.expect_count('B cannot target A''s row by id', $q$ select count(*) from public.cloud_saves where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $q$, 0);
select av_test.expect_error('B cannot write A''s row directly', $q$ update public.cloud_saves set payload = '{}' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $q$, 'permission denied');
select av_test.expect_json('B pushing with A''s revision number does not touch A (B has no row: conflict)', $q$ select public.av_cloud_push(4, '44444444-4444-4444-8444-444444444444', 'B box', 'b', 4, av_test.ck(30), '{}', av_test.mk(4,1)) $q$, '{"status":"conflict","head":null}');
select av_test.expect_json('B creates its own revision 1', $q$ select public.av_cloud_push(0, '44444444-4444-4444-8444-444444444444', 'B box', 'b', 4, av_test.ck(30), '{}', av_test.mk(4,1)) $q$, '{"status":"ok","revision":1}');
select av_test.expect_count('B sees exactly its own row', $q$ select count(*) from public.cloud_saves $q$, 1);
select av_test.expect_json('B delete_all removes only B', $q$ select public.av_cloud_delete_all() $q$, '{"status":"ok","deleted_saves":1,"deleted_backups":0}');

-- ===== back to A: untouched by B, then deletes its own data =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select av_test.expect_count('A''s save survived B''s delete_all', $q$ select revision from public.cloud_saves $q$, 4);
select av_test.expect_count('A still has its 12 backups', $q$ select count(*) from public.save_backups $q$, 12);
select av_test.expect_json('A delete_all removes head and backups', $q$ select public.av_cloud_delete_all() $q$, '{"status":"ok","deleted_saves":1,"deleted_backups":12}');
select av_test.expect_count('nothing left for A', $q$ select (select count(*) from public.cloud_saves) + (select count(*) from public.save_backups) $q$, 0);
select av_test.expect_json('after deletion a device that remembers revision 4 is told the cloud is gone', $q$ select public.av_cloud_push(4, '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(40), '{}', av_test.mk(4,2)) $q$, '{"status":"conflict","head":null}');
select av_test.expect_json('after deletion a fresh upload starts again at revision 1', $q$ select public.av_cloud_push(0, '11111111-1111-4111-8111-111111111111', 'Laptop', 'b', 4, av_test.ck(40), '{}', av_test.mk(4,2)) $q$, '{"status":"ok","revision":1}');

-- ===== report, then abort so everything above is rolled back =====
reset role;
do $$
declare total int; bad int; report text;
begin
  select count(*), count(*) filter (where not ok) into total, bad from av_test.results;
  select string_agg((case when ok then 'PASS ' else 'FAIL ' end) || name || case when ok then '' else '  -> ' || coalesce(detail, '') end, E'\n' order by n) into report from av_test.results;
  raise exception E'AV TESTS: %\n%\n(This error is intentional: it rolls the whole test back.)',
    case when bad = 0 then 'ALL ' || total || ' PASSED' else bad || ' FAILED of ' || total end, report;
end $$;

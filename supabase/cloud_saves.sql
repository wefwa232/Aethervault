-- AETHERVAULT — Distribution Subphase D: cloud saves (schema, grants, Row Level Security, RPCs)
--
-- Run ONCE in the Supabase SQL Editor (Project -> SQL Editor -> New query -> paste -> Run).
-- Safe to re-run: every statement is idempotent (create ... if not exists / create or replace / drop policy if exists).
-- Contains no secrets. Needs no service-role key or database password.
--
-- DESIGN
--   * Clients can only READ their own rows (RLS + column-level SELECT grant). They can NEVER insert/update/delete a
--     table directly: all writes go through three SECURITY DEFINER functions that act only on auth.uid().
--   * One head row per user (cloud_saves) with a monotonically increasing `revision`. Pushes are compare-and-swap on
--     that revision, which is how two devices are detected as conflicting instead of silently overwriting each other.
--   * Every payload is validated in the database (shape, size, schema version, checksum format) before it is stored.
--   * Before the head is replaced by a different device (or after 6 h, or on a schema upgrade) the old head is copied to
--     save_backups. Backups are capped at 12 per user.
--   * anon (not signed in) gets nothing at all.

create schema if not exists av_private;
revoke all on schema av_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.cloud_saves (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  revision      bigint      not null check (revision >= 1),
  save_version  integer     not null check (save_version between 1 and 999),
  app_build     text        not null default '' check (char_length(app_build) <= 64),
  device_id     uuid        not null,
  device_name   text        not null default '' check (char_length(device_name) <= 60),
  checksum      text        not null check (checksum ~ '^[0-9a-f]{64}$'),
  summary       jsonb       not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 8192),
  payload       jsonb       not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 3500000),
  payload_bytes integer     not null check (payload_bytes between 2 and 3000000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.save_backups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  revision      bigint      not null default 0 check (revision >= 0),
  reason        text        not null check (reason in ('replaced', 'local-preserved', 'cloud-preserved', 'manual')),
  save_version  integer     not null check (save_version between 1 and 999),
  app_build     text        not null default '' check (char_length(app_build) <= 64),
  device_id     uuid        not null,
  device_name   text        not null default '' check (char_length(device_name) <= 60),
  checksum      text        not null check (checksum ~ '^[0-9a-f]{64}$'),
  summary       jsonb       not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 8192),
  payload       jsonb       not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 3500000),
  payload_bytes integer     not null check (payload_bytes between 2 and 3000000),
  created_at    timestamptz not null default now()
);
create index if not exists save_backups_user_created_idx on public.save_backups (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------------
-- Row Level Security: a signed-in user can read only rows whose user_id is their own. There are deliberately NO
-- insert/update/delete policies, so even if a table grant were added by mistake, direct writes would still be refused.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.cloud_saves  enable row level security;
alter table public.save_backups enable row level security;

drop policy if exists cloud_saves_select_own  on public.cloud_saves;
drop policy if exists save_backups_select_own on public.save_backups;
create policy cloud_saves_select_own  on public.cloud_saves  for select to authenticated using (user_id = (select auth.uid()));
create policy save_backups_select_own on public.save_backups for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------
-- Explicit grants. Supabase's default privileges hand new tables/functions to anon + authenticated, so strip first.
-- ---------------------------------------------------------------------------------------------------------------
revoke all on table public.cloud_saves, public.save_backups from public, anon, authenticated;
grant select on table public.cloud_saves, public.save_backups to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Validation (private schema, not reachable from the API). Returns NULL when valid, otherwise a short reason code.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function av_private.check_save(
  p_device_id uuid, p_save_version integer, p_checksum text, p_summary jsonb, p_payload jsonb
) returns text
language plpgsql
immutable
set search_path = ''
as $fn$
declare v_ver text;
begin
  if p_device_id is null then return 'device'; end if;
  if p_save_version is null or p_save_version not between 1 and 999 then return 'schema-version'; end if;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then return 'checksum'; end if;
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' or octet_length(p_summary::text) > 8192 then return 'summary'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return 'payload-shape'; end if;
  if octet_length(p_payload::text) > 3000000 then return 'too-large'; end if;
  if jsonb_typeof(p_payload -> 'wallet') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'specimens') is distinct from 'object' then return 'payload-shape'; end if;
  v_ver := p_payload ->> 'version';
  if v_ver is null or v_ver !~ '^[0-9]{1,3}$' or v_ver::integer <> p_save_version then return 'version-mismatch'; end if;
  return null;
end
$fn$;
revoke all on function av_private.check_save(uuid, integer, text, jsonb, jsonb) from public, anon, authenticated;

-- Trim a device label to something safe to store. (Clients must still escape it when displaying.)
create or replace function av_private.clean_name(p_name text) returns text
language sql
immutable
set search_path = ''
as $fn$ select left(btrim(coalesce(p_name, '')), 60) $fn$;
revoke all on function av_private.clean_name(text) from public, anon, authenticated;

-- Keep only the newest 12 backups for a user.
create or replace function av_private.prune_backups(p_uid uuid) returns void
language sql
set search_path = ''
as $fn$
  delete from public.save_backups b
  where b.user_id = p_uid
    and b.id not in (select id from public.save_backups where user_id = p_uid order by created_at desc, id limit 12);
$fn$;
revoke all on function av_private.prune_backups(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- av_cloud_push: compare-and-swap write of the head save.
--   p_base_revision = the revision this device last synced (0 = "I believe nothing is in the cloud yet").
--   Returns jsonb: {status:'ok'|'conflict'|'rejected', ...}. Expected conditions never raise, so clients can branch on them.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.av_cloud_push(
  p_base_revision bigint, p_device_id uuid, p_device_name text, p_app_build text,
  p_save_version integer, p_checksum text, p_summary jsonb, p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_row  public.cloud_saves%rowtype;
  v_why  text;
  v_size integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_base_revision is null or p_base_revision < 0 then return jsonb_build_object('status', 'rejected', 'reason', 'base-revision'); end if;
  v_why := av_private.check_save(p_device_id, p_save_version, p_checksum, p_summary, p_payload);
  if v_why is not null then return jsonb_build_object('status', 'rejected', 'reason', v_why); end if;
  v_size := octet_length(p_payload::text);

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));   -- serialise this user's writes (first-insert races)
  select * into v_row from public.cloud_saves where user_id = v_uid for update;

  if not found then
    if p_base_revision <> 0 then
      -- This device remembers a cloud save that no longer exists (deleted from another device).
      return jsonb_build_object('status', 'conflict', 'head', null);
    end if;
    insert into public.cloud_saves (user_id, revision, save_version, app_build, device_id, device_name, checksum, summary, payload, payload_bytes)
    values (v_uid, 1, p_save_version, left(coalesce(p_app_build, ''), 64), p_device_id, av_private.clean_name(p_device_name), p_checksum, p_summary, p_payload, v_size);
    return jsonb_build_object('status', 'ok', 'revision', 1, 'checksum', p_checksum, 'updated_at', now());
  end if;

  if v_row.revision <> p_base_revision then
    return jsonb_build_object('status', 'conflict', 'head', jsonb_build_object(
      'revision', v_row.revision, 'checksum', v_row.checksum, 'save_version', v_row.save_version, 'device_id', v_row.device_id,
      'device_name', v_row.device_name, 'app_build', v_row.app_build, 'summary', v_row.summary, 'payload_bytes', v_row.payload_bytes, 'updated_at', v_row.updated_at));
  end if;
  if p_save_version < v_row.save_version then
    return jsonb_build_object('status', 'rejected', 'reason', 'downgrade', 'cloud_save_version', v_row.save_version);
  end if;
  if v_row.checksum = p_checksum then
    return jsonb_build_object('status', 'ok', 'revision', v_row.revision, 'checksum', v_row.checksum, 'updated_at', v_row.updated_at, 'unchanged', true);
  end if;

  if v_row.device_id <> p_device_id or v_row.updated_at < now() - interval '6 hours' or v_row.save_version <> p_save_version then
    insert into public.save_backups (user_id, revision, reason, save_version, app_build, device_id, device_name, checksum, summary, payload, payload_bytes)
    values (v_uid, v_row.revision, 'replaced', v_row.save_version, v_row.app_build, v_row.device_id, v_row.device_name, v_row.checksum, v_row.summary, v_row.payload, v_row.payload_bytes);
    perform av_private.prune_backups(v_uid);
  end if;

  update public.cloud_saves
     set revision = v_row.revision + 1, save_version = p_save_version, app_build = left(coalesce(p_app_build, ''), 64),
         device_id = p_device_id, device_name = av_private.clean_name(p_device_name), checksum = p_checksum,
         summary = p_summary, payload = p_payload, payload_bytes = v_size, updated_at = now()
   where user_id = v_uid;
  return jsonb_build_object('status', 'ok', 'revision', v_row.revision + 1, 'checksum', p_checksum, 'updated_at', now());
end
$fn$;

-- ---------------------------------------------------------------------------------------------------------------
-- av_cloud_backup_put: store a version as a backup WITHOUT touching the head (used for "preserve both").
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.av_cloud_backup_put(
  p_reason text, p_device_id uuid, p_device_name text, p_app_build text,
  p_save_version integer, p_checksum text, p_summary jsonb, p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_why text;
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_reason is null or p_reason not in ('local-preserved', 'cloud-preserved', 'manual') then
    return jsonb_build_object('status', 'rejected', 'reason', 'backup-reason');
  end if;
  v_why := av_private.check_save(p_device_id, p_save_version, p_checksum, p_summary, p_payload);
  if v_why is not null then return jsonb_build_object('status', 'rejected', 'reason', v_why); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  -- identical content is already preserved; do not store it twice
  select id into v_id from public.save_backups where user_id = v_uid and checksum = p_checksum limit 1;
  if v_id is not null then return jsonb_build_object('status', 'ok', 'id', v_id, 'existing', true); end if;

  insert into public.save_backups (user_id, revision, reason, save_version, app_build, device_id, device_name, checksum, summary, payload, payload_bytes)
  values (v_uid, 0, p_reason, p_save_version, left(coalesce(p_app_build, ''), 64), p_device_id, av_private.clean_name(p_device_name), p_checksum, p_summary, p_payload, octet_length(p_payload::text))
  returning id into v_id;
  perform av_private.prune_backups(v_uid);
  return jsonb_build_object('status', 'ok', 'id', v_id);
end
$fn$;

-- ---------------------------------------------------------------------------------------------------------------
-- av_cloud_delete_all: remove everything the caller has in the cloud (head + backups). Local saves are not affected.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.av_cloud_delete_all() returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_s integer;
  v_b integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  delete from public.save_backups where user_id = v_uid;  get diagnostics v_b = row_count;
  delete from public.cloud_saves  where user_id = v_uid;  get diagnostics v_s = row_count;
  return jsonb_build_object('status', 'ok', 'deleted_saves', v_s, 'deleted_backups', v_b);
end
$fn$;

-- Functions: nobody by default, then only signed-in users.
revoke all on function public.av_cloud_push(bigint, uuid, text, text, integer, text, jsonb, jsonb)               from public, anon, authenticated;
revoke all on function public.av_cloud_backup_put(text, uuid, text, text, integer, text, jsonb, jsonb)           from public, anon, authenticated;
revoke all on function public.av_cloud_delete_all()                                                                from public, anon, authenticated;
grant execute on function public.av_cloud_push(bigint, uuid, text, text, integer, text, jsonb, jsonb)             to authenticated;
grant execute on function public.av_cloud_backup_put(text, uuid, text, text, integer, text, jsonb, jsonb)        to authenticated;
grant execute on function public.av_cloud_delete_all()                                                             to authenticated;

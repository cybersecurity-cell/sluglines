-- =============================================================================
-- 0007_retire_legacy_tables.sql
--
-- APPLIED: no
--
-- Retires the three legacy tables that are the entire contents of the production
-- database today, together with the two functions and the one auth trigger that
-- feed them. Closes the third item of issue #4 and the live half of
-- Docs/DECISIONS.md D-24.
--
-- WHY THIS IS A PREREQUISITE FOR 0001, NOT A TIDY-UP AFTER IT
-- -----------------------------------------------------------------------------
-- Production carries an `on_auth_user_created` trigger on `auth.users` running
-- the legacy `handle_new_user()`, whose whole body is:
--
--     insert into public.profiles (id, email) values (new.id, new.email);
--
-- `profiles.email` is `text unique not null`. So the first time identity works,
-- every signup copies the member's email address out of Supabase Auth into an
-- application table -- the exact pattern rev. 5.3 sec.6 forbids and that
-- 0001_rebuild_foundation.sql's own comment on `handle_new_member()` calls out by
-- name. 0001 installs a second, separate trigger (`on_auth_user_created_member`);
-- it does not remove this one. Applying 0001 to production without this file
-- leaves both triggers armed on the same event.
--
-- WHAT IS LIVE IN PRODUCTION RIGHT NOW, read from pg_policies on 2026-08-22
-- -----------------------------------------------------------------------------
--   spot_status   UPDATE  to public   using (true) with check (true)
--   commute_log   INSERT  to public   with check (true)
--   commute_log   SELECT  to public   using (true)
--   profiles      SELECT/UPDATE to public, scoped to auth.uid() = id
--
-- The first three are unauthenticated write and read paths over the whole table
-- -- rev. 5.3 sec.14 risk 4, and the reason D-24 recorded the risk as live rather
-- than mitigated. All three tables hold zero rows, so dropping them destroys no
-- data; it removes the policies by removing what they are attached to.
--
-- The `riders`, `drivers` and `alerts` tables from supabase/schema.sql are NOT
-- dropped here, because they were never applied to production -- the database
-- holds three tables, not six. `supabase/schema.sql` stays quarantined and
-- unapplied; tests/legacy-schema-risks.test.mjs continues to pin its unsafe set.
--
-- Nothing in this file creates a table, a policy, a function or a grant, so
-- R3-R11 have no subject. That is the point: it only removes.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- The auth trigger first. Dropping it before its function means the function is
-- never momentarily referenced by a trigger that no longer has a body.
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user();

-- Zeroed spot_status counters on a schedule. Its only table is dropped below.
drop function if exists public.reset_daily_counts();


-- -----------------------------------------------------------------------------
-- The tables. commute_log references profiles(id), so it goes first and no
-- cascade is needed -- an unexpected dependency should fail this migration
-- loudly rather than be silently dropped along with it.
-- -----------------------------------------------------------------------------
drop table if exists public.commute_log;
drop table if exists public.profiles;
drop table if exists public.spot_status;


-- -----------------------------------------------------------------------------
-- Post-condition, asserted in the migration itself so a partial apply cannot
-- report success. The same shape 0004's seed block uses.
-- -----------------------------------------------------------------------------
do $check$
declare
  v_remaining text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_remaining
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in ('spot_status', 'profiles', 'commute_log');

  if v_remaining is not null then
    raise exception 'legacy tables still present after 0007: %', v_remaining;
  end if;

  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
      and t.tgname = 'on_auth_user_created' and not t.tgisinternal
  ) then
    raise exception 'legacy auth trigger on_auth_user_created still present after 0007';
  end if;

  raise notice 'legacy retirement: 3 tables, 2 functions and 1 auth trigger removed';
end
$check$;

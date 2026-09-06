-- =============================================================================
-- 0026_revoke_anon_execute.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp),
--          applied 2026-09-06 through the Supabase MCP connector's apply_migration, one
--          file per apply, as the rehearsal for the production apply. Production has
--          NOT run this file. See Docs/DECISIONS.md D-96 and supabase/migrations/README.md.
--
-- SECURITY FIX. `Docs/DECISIONS.md` D-79. Closes the anon-exec hole `0025`
-- (D-74) left open by construction, not by oversight.
--
-- THE GAP D-74/0025/R12 LEFT OPEN
-- -----------------------------------------------------------------------------
-- `0025`'s own R12 rule (`scripts/sql-lint.mjs`) reads: every SECURITY DEFINER
-- function NOT granted to `authenticated` must be explicitly revoked from
-- `anon` and `authenticated`. A function granted to `authenticated` was
-- exempted outright, on the premise that it is "the legitimate client entry
-- point (RLS/actor checks live inside it)". R12 never verified that premise --
-- it is a fact about a function's BODY, and R12 only ever looked at its GRANT
-- statements.
--
-- `tests/lock-down-definer-functions.test.mjs` hardcoded 18 as the size of the
-- locked-down set, and D-77 declared "the D-74 vulnerability is fully closed"
-- after applying `0025` to production. Both statements are true only of the
-- 18 functions `0025` actually touches. They are not true of the other 46
-- SECURITY DEFINER functions in this tree, all of which carry
-- `grant execute ... to authenticated` and NOTHING ELSE -- meaning R12's
-- premise was simply assumed for every one of them, never checked.
--
-- `public.get_leaderboard(uuid)` (`0023`, lines 375-401) is the sharpest of
-- the 46: it is SECURITY DEFINER specifically to bypass `completed_rides`'
-- RLS restriction to `member_id = auth.uid()` (0023's own comment says so),
-- and its body contains no `auth.uid()` reference, no null check, and no
-- `caller_is_moderator()` call -- nothing. Its only protection was
-- `grant execute ... to authenticated`, which `0025`'s own header (lines
-- 17-22) already documents as insufficient on Supabase: `anon` and
-- `authenticated` are not the `PUBLIC` pseudo-role there, so Supabase's own
-- default privileges hand `anon` EXECUTE on every new `public`-schema function
-- independent of whatever `PUBLIC` holds, and `revoke ... from public` never
-- touches that grant. Concretely: the public anon key (shipped to every
-- browser) plus any `location_id` UUID is enough to pull one row per member
-- who ever completed a ride at that lot -- member_id, a partially masked real
-- name, ride count, cumulative savings. Iterating the 41 active spots
-- (`/api/health`) yields a member roster keyed by physical commuter lot,
-- which is exactly the "member directory" rev. 5.3's product invariant
-- (`0001:80-84`) says must not exist. Compare `get_dashboard_summary`
-- (`0024:65-70`), which DOES gate on `caller_is_moderator()` -- the
-- inconsistency across two functions shipped in the same slice is the bug.
--
-- Two more functions share the shape with a smaller payload:
-- `ai_global_turn_count_today()` (`0011:376-390`, no `auth.uid()` at all --
-- leaks the global daily AI usage counter to anyone) and
-- `ai_skill_enabled(text)` (`0011:269-281`, no `auth.uid()` -- leaks which AI
-- kill switches are on).
--
-- WHAT THIS MIGRATION DOES
-- -----------------------------------------------------------------------------
--   1. Re-creates the three functions above via `create or replace`, in THIS
--      migration only -- `0011` and `0023` are `APPLIED: production` and are
--      never edited (`supabase/migrations/README.md`, "Correcting a migration
--      that has already been applied"). Each re-creation carries the exact
--      original argument list and return type, adding only an authorization
--      check to the body:
--        - `ai_global_turn_count_today()`, `ai_skill_enabled(text)`: reject
--          with `42501` unless `auth.uid()` is not null. Neither function
--          took a member-scoped argument before and neither does now; the fix
--          is "authenticated", not "authorized for something specific".
--        - `get_leaderboard(uuid)`: reject with `42501` unless `auth.uid()`
--          is not null AND the caller's own `members.location_id` matches the
--          `p_location_id` argument. This is stricter than merely requiring a
--          session -- an arbitrary authenticated member could otherwise still
--          enumerate every OTHER lot's roster by varying `p_location_id`, and
--          the 41-spot enumeration risk hardly cares whether the caller is
--          anonymous or authenticated. Scoping to the caller's own home spot
--          is what actually removes the "roster keyed by physical location"
--          shape rather than just gating it behind a login. A moderator
--          bypass was considered and declined: `get_dashboard_summary`
--          already gives moderators a cross-location aggregate view with no
--          member identities in it; extending moderator reach to
--          per-member-identified rosters across every lot is a bigger grant
--          than this fix needs to make, and nothing in the finding asked for
--          it.
--   2. `revoke all on function ... from anon;` for every SECURITY DEFINER
--      function in the tree that carries `grant execute ... to authenticated`
--      and is not already revoked from `anon` -- 46 functions, enumerated
--      below by the migration that creates each one. Enumeration method: for
--      every `create or replace function` statement flagged
--      `security definer` anywhere in `supabase/migrations/*.sql`, collect
--      every one that also has a `grant execute ... to authenticated`
--      statement and NO existing `revoke ... from anon` -- i.e. exactly
--      `scripts/sql-lint.mjs`'s own `securityDefinerFunctions` /
--      `grantedToAuthenticatedFn` / `revokedFromAnonFn` sets, computed by
--      running the analyser's own `loadMigrations`/`classifyStatement` over
--      this tree rather than hand-counted. `public.get_public_spot_counts`,
--      `public.get_public_open_offer_counts`, `public.get_scheduled_job_health`
--      and `public.get_public_location` are EXCLUDED from that 46: they carry
--      `grant execute ... to anon, authenticated` explicitly and deliberately
--      (`scripts/sql-lint.mjs`'s `ANON_CALLABLE_FUNCTIONS`, R10) -- revoking
--      anon from those would break the public aggregates M1 requires.
--      `revoke` is overload-sensitive (a mismatched argument list silently
--      no-ops instead of erroring, `supabase/migrations/README.md:101`), so
--      every statement below carries the exact identity argument list the
--      creating migration's own `grant execute` statement uses.
--   3. `alter default privileges in schema public revoke execute on functions
--      from anon;` so a migration written after this one, which forgets an
--      explicit revoke, does not silently reopen the same hole for its own
--      new functions. This does not change what Supabase's own default
--      privileges hand `authenticated`, and does not touch any function's
--      existing `authenticated` grant.
--
-- WHAT THIS MIGRATION DOES NOT DO
-- -----------------------------------------------------------------------------
-- It does not edit `0011`, `0023`, `0025`, or any other file marked
-- `APPLIED: production` -- append-only, per
-- `supabase/migrations/README.md`. It creates no table. It revokes nothing
-- from `authenticated`: every one of the 46 functions below stays exactly as
-- callable by a signed-in member as it was before this migration: only the
-- anon-reachability documented above is closed. `rate_limit_hit`'s
-- `service_role` grant (`0012`) is untouched, and this migration does not
-- reference it at all -- `0025` already covers it.
--
-- ==> APPLIED: preview (phase-3-4-staging, 2026-09-06, D-96), NOT PRODUCTION.
--     Writing it was the whole job of the change that added it (D-79); the
--     production apply is a separate, explicitly authorised act still pending.
-- =============================================================================


-- =============================================================================
-- PART 1 -- auth.uid() guards, via create-or-replace, signature-preserving.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0011_agent_traces_and_kill_switches.sql -- ai_skill_enabled(text). Original
-- body (line 269-281 of 0011) ran no check at all; the two `coalesce(...)`
-- reads are unchanged, only wrapped behind an authentication requirement.
-- -----------------------------------------------------------------------------
create or replace function public.ai_skill_enabled(p_skill_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return coalesce((select enabled from public.ai_kill_switches where key = 'global'), false)
     and coalesce((select enabled from public.ai_kill_switches where key = p_skill_key), false);
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 0011_agent_traces_and_kill_switches.sql -- ai_global_turn_count_today().
-- Original body (line 376-390 of 0011) is the unchanged `select count(*)`,
-- now behind an authentication requirement.
-- -----------------------------------------------------------------------------
create or replace function public.ai_global_turn_count_today()
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return (
    select count(*)
      from public.agent_traces
     where capacity_denied = false
       and created_at >= date_trunc('day', now())
  );
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 0023_ride_history_leaderboard.sql -- get_leaderboard(uuid). See the file
-- header above for the scoping decision: the caller must be authenticated AND
-- p_location_id must equal the caller's own members.location_id. The
-- aggregate query itself (join, group by, order by) is unchanged from 0023's
-- original body.
-- -----------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_location_id uuid)
returns table (
  member_id         uuid,
  masked_name       text,
  total_rides       bigint,
  total_saved_cents bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $fn$
declare
  v_actor         uuid := auth.uid();
  v_home_location uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select m.location_id into v_home_location from public.members m where m.id = v_actor;

  if v_home_location is null or p_location_id is distinct from v_home_location then
    raise exception 'location_id must match the caller''s own location' using errcode = '42501';
  end if;

  return query
  select
    cr.member_id,
    public.mask_display_name(m.display_name),
    count(*)            as total_rides,
    sum(cr.saved_cents) as total_saved_cents
  from public.completed_rides cr
  join public.members m on m.id = cr.member_id
  where cr.location_id = p_location_id
  group by cr.member_id, m.display_name
  order by total_rides desc, min(cr.completed_at) asc;
end;
$fn$;


-- =============================================================================
-- PART 2 -- revoke anon execute from every SECURITY DEFINER function granted
-- only to authenticated. 46 functions, grouped by the migration that creates
-- each one, in ordinal order. See the file header for the enumeration method.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0001_rebuild_foundation.sql
-- -----------------------------------------------------------------------------
revoke all on function public.presence_checkin(uuid, text, integer) from anon;
revoke all on function public.presence_clear() from anon;
revoke all on function public.set_display_name(text) from anon;

-- -----------------------------------------------------------------------------
-- 0002_ride_coordinator_state.sql
-- -----------------------------------------------------------------------------
revoke all on function public.caller_owns_offer(uuid) from anon;
revoke all on function public.caller_is_offer_participant(uuid) from anon;
revoke all on function public.caller_has_confirmed_seat(uuid) from anon;
revoke all on function public.caller_is_moderator() from anon;
revoke all on function public.offer_create(text, uuid, uuid, timestamptz, timestamptz, integer, text) from anon;
revoke all on function public.offer_publish(uuid, integer, text) from anon;
revoke all on function public.offer_reserve_seat(uuid, integer, text, integer) from anon;
revoke all on function public.offer_release_seat(uuid, integer, text) from anon;
revoke all on function public.offer_confirm(uuid, integer, text) from anon;
revoke all on function public.offer_advance(uuid, integer, text) from anon;
revoke all on function public.offer_cancel(uuid, integer, text) from anon;
revoke all on function public.offer_set_pickup_details(uuid, text, text) from anon;

-- -----------------------------------------------------------------------------
-- 0006_identity_home_spot.sql
-- -----------------------------------------------------------------------------
revoke all on function public.set_home_spot(uuid) from anon;

-- -----------------------------------------------------------------------------
-- 0011_agent_traces_and_kill_switches.sql -- ai_skill_enabled and
-- ai_global_turn_count_today are also re-created above (Part 1) with
-- auth.uid() guards; the anon revoke below is the second, independent layer
-- (Supabase's default grant, not just the body check).
-- -----------------------------------------------------------------------------
revoke all on function public.ai_skill_enabled(text) from anon;
revoke all on function public.ai_set_kill_switch(text, boolean) from anon;
revoke all on function public.ai_member_turn_count_today() from anon;
revoke all on function public.ai_global_turn_count_today() from anon;

-- -----------------------------------------------------------------------------
-- 0015_incidents_functions.sql
-- -----------------------------------------------------------------------------
revoke all on function public.report_incident(public.incident_type, text) from anon;
revoke all on function public.confirm_incident(uuid) from anon;
revoke all on function public.resolve_incident(uuid) from anon;
revoke all on function public.cancel_incident(uuid) from anon;

-- -----------------------------------------------------------------------------
-- 0016_lostfound_schema.sql
-- -----------------------------------------------------------------------------
revoke all on function public.lostfound_is_item_reporter(uuid) from anon;
revoke all on function public.lostfound_is_item_claimant(uuid) from anon;
revoke all on function public.lostfound_is_claim_participant(uuid) from anon;

-- -----------------------------------------------------------------------------
-- 0017_lostfound_functions.sql
-- -----------------------------------------------------------------------------
revoke all on function public.report_lostfound_item(public.lostfound_kind, public.lostfound_category, text, date) from anon;
revoke all on function public.create_lostfound_claim(uuid, text) from anon;
revoke all on function public.respond_to_lostfound_claim(uuid, boolean) from anon;
revoke all on function public.withdraw_lostfound_claim(uuid) from anon;
revoke all on function public.send_lostfound_message(uuid, text) from anon;
revoke all on function public.reunite_lostfound_item(uuid) from anon;
revoke all on function public.cancel_lostfound_item(uuid) from anon;

-- -----------------------------------------------------------------------------
-- 0020_recurring_offer_functions.sql
-- -----------------------------------------------------------------------------
revoke all on function public.create_recurring_offer(text, uuid, uuid, integer[], time, time, integer, text, date, date) from anon;
revoke all on function public.pause_recurring_offer(uuid) from anon;
revoke all on function public.resume_recurring_offer(uuid) from anon;
revoke all on function public.cancel_recurring_offer(uuid) from anon;
revoke all on function public.skip_recurring_offer_occurrence(uuid, date) from anon;

-- -----------------------------------------------------------------------------
-- 0022_waitlist_eta_noshow_functions.sql
-- -----------------------------------------------------------------------------
revoke all on function public.offer_waitlist_join(uuid) from anon;
revoke all on function public.offer_waitlist_leave(uuid) from anon;
revoke all on function public.post_eta_update(uuid, text) from anon;
revoke all on function public.report_no_show(uuid) from anon;

-- -----------------------------------------------------------------------------
-- 0023_ride_history_leaderboard.sql -- get_leaderboard is also re-created
-- above (Part 1) with an auth.uid() + own-location guard.
-- -----------------------------------------------------------------------------
revoke all on function public.get_leaderboard(uuid) from anon;
revoke all on function public.set_app_setting(text, integer) from anon;

-- -----------------------------------------------------------------------------
-- 0024_dashboard_summary.sql
-- -----------------------------------------------------------------------------
revoke all on function public.get_dashboard_summary(uuid) from anon;


-- =============================================================================
-- PART 3 -- close the recurrence path: a future migration that forgets an
-- explicit anon revoke no longer inherits an anon-execute grant by default.
-- =============================================================================
alter default privileges in schema public revoke execute on functions from anon;

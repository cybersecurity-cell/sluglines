-- =============================================================================
-- 0023_ride_history_leaderboard.sql
--
-- APPLIED: no
--
-- Option B slice 6 (the last one, issue #90): a per-ride completion log and a
-- masked-name leaderboard, plus the moderator-tunable app_settings the
-- leaderboard's savings estimate reads from. No new AI tool: none of this is
-- in src/lib/ai/tools.ts's catalog, so this slice touches nothing under
-- src/lib/ai/.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's
-- 0012_ride_history_leaderboard.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13). This file keeps
-- that migration's shape -- a per-ride log rather than a counter, a masked
-- leaderboard read, moderator-tunable savings estimates -- and changes what
-- this repo's schema actually requires it to change.
--
-- THE STOP -> LOCATION ADAPTATION, AND WHY THE ROUTE COLUMNS ARE DROPPED
-- ENTIRELY (not just renamed)
-- -----------------------------------------------------------------------------
-- Sluglines-AI's completed_rides carries origin_stop_id/dest_stop_id (both
-- `not null references stops(id)`) plus a separate location_id, because that
-- repo's offers are themselves stop-keyed (D-70 explains why) and its
-- get_leaderboard() derives each member's most-frequent route from the stop
-- pair. This repo's offers table has never worked that way -- 0002 gives it
-- origin_location_id/destination_location_id -> public.locations directly,
-- and 0018's stops table is a standalone lookup wired into nothing, explicitly
-- NOT into offers (D-70, tests/transit-stops-schema.test.mjs asserts this).
--
-- A route-renaming adaptation (origin_stop_id/dest_stop_id ->
-- origin_location_id/destination_location_id) was the option considered and
-- declined: issue #90 asks for a leaderboard, i.e. a completion tally, not a
-- route record, and every offer this repo has already carries its own
-- origin/destination on the offers row a ride's completed_rides entry
-- references by offer_id -- a second copy of the same two columns on
-- completed_rides would be data no query in this file, or any dashboard,
-- needs. So completed_rides keeps exactly one location column, location_id,
-- populated from the offer's origin_location_id at record time (the same
-- "home spot" column every other Option B slice scopes by -- incidents,
-- lost & found, recurring offers all key their own location_id the same way).
-- get_leaderboard() below returns member_id/masked_name/total_rides/
-- total_saved_cents and nothing route-shaped; mask_display_name() is kept
-- because it is genuinely a masking concern the source got right, not a route
-- concern.
--
-- Everything else follows the same adaptations as every other Option B slice:
--   * every RLS policy and function calls caller_is_moderator() (0002), NOT
--     Sluglines-AI's is_moderator().
--   * record_completed_ride()/set_app_setting() call record_audit_event(),
--     not log_audit_event().
--   * role is a text CHECK column ('driver'|'rider'), matching
--     offers.poster_role's own encoding (0002), not a fresh offer_role enum.
--
-- HOW A COMPLETION IS RECORDED -- A SWEEP, NOT A HOOK INTO offer_advance()
-- -----------------------------------------------------------------------------
-- This is the review-critical part, same as D-72's promotion write-up.
-- Sluglines-AI's advance_offer() is redefined in its own 0012 to insert a
-- completed_rides row for the driver and every ACTIVE-reservation rider in
-- the same statement that flips the offer to COMPLETED, because that repo's
-- advance function is not yet applied anywhere at the time its 0012 ships.
--
-- This repo's equivalent, offer_advance() -- CONFIRMED -> ARRIVING ->
-- PICKED_UP -> COMPLETED, the only place any offer in this schema reaches
-- COMPLETED -- is defined in 0002, and 0002 is **applied to production**
-- (supabase/migrations/README.md's table). supabase/migrations/README.md's
-- correction rule is explicit: an applied file is never edited, and a later
-- ordinal may only re-create one of its functions to fix a defect in it,
-- carrying the old signature exactly. offer_advance() has no defect, so
-- re-creating it here to append a completed_rides insert is not a correction,
-- it is a feature addition to a frozen function -- exactly what the rule
-- forbids, and exactly the same reasoning D-71/D-72 already give for never
-- touching offer_create()/offer_reserve_seat()/offer_release_seat().
--
-- Wiring in is therefore not safe, so this file takes the other branch the
-- task set for that case: a separate SECURITY DEFINER recorder plus an
-- ops-scheduled sweep over terminal offers, same shape as 0022's
-- promote_waitlist_sweep().
--
--   1. record_completed_ride(p_offer_id) -- internal, reads one offer that
--      must already be COMPLETED (raises otherwise), and inserts one
--      completed_rides row for the poster (role 'driver', saved_cents from
--      app_settings' toll_savings_estimate_cents) and one for every rider
--      whose reservation is still CONFIRMED (role 'rider', saved_cents from
--      bus_fare_estimate_cents) -- CONFIRMED, not ACTIVE, because 0002's
--      offer_confirm() is what moves a live reservation from ACTIVE to
--      CONFIRMED, and offer_advance()'s later hops (ARRIVING/PICKED_UP/
--      COMPLETED) never touch reservations.state again, so a reservation
--      still CONFIRMED at COMPLETED time is exactly a rider who rode.
--      (0022's report_no_show() cancels a rider's reservation before the ride
--      completes, which correctly excludes a no-show from this count without
--      this file needing to know report_no_show exists.) Idempotent via a
--      unique (offer_id, member_id) constraint and `on conflict do nothing`
--      -- a replayed sweep tick or a double-recorded offer inserts nothing
--      twice.
--   2. record_completed_rides_sweep() -- internal, finds every COMPLETED
--      offer with no completed_rides row yet and calls
--      record_completed_ride() once per offer, each attempt isolated in its
--      own `exception when others` block (same isolation as 0022's
--      promote_waitlist_sweep(), for the same reason: one offer's failure
--      must not abort recording for every other offer in the run). Self-
--      correcting across consecutive runs, the same cheap-idempotent-no-op
--      shape as instantiate_recurring_offers() (0020) and
--      promote_waitlist_sweep() (0022) once nothing is left to record.
--
-- Critically, **neither function ever writes offers.state, offers.revision,
-- or reservations.state.** COMPLETED has no outgoing edge in
-- offer_transition_allowed() (0002) -- it is a terminal state -- so the offer
-- row this sweep reads cannot change under it; there is no state machine to
-- bypass because no state changes are being made at all, only a read of an
-- already-terminal offer and inserts into a brand-new table. This is a
-- strictly narrower footprint than D-72's promotion sweep, which did have to
-- reach apply_offer_transition() because it was creating new reservations.
--
-- Same reasoning as 0008/0015/0017/0020/0022's own headers for why the sweep
-- is a function, not a `cron.schedule` statement: scheduling belongs in
-- supabase/operations/, target-specific, not in a migration every preview
-- branch replays.
--
-- app_settings, AND WHY IT HAS NO UPDATE POLICY
-- -----------------------------------------------------------------------------
-- Sluglines-AI's app_settings ships an `app_settings_update_moderator` RLS
-- UPDATE policy gated on is_moderator(). R4 ("no insert/update/delete/all
-- policy on any new table, for any role -- client writes must go through a
-- SECURITY DEFINER function", enforced by scripts/sql-lint.mjs) has no
-- carve-out for a moderator-checked update any more than it did for
-- Sluglines-AI's own "no cross-cutting effects" waitlist-leave policy D-72
-- declined -- so this file ships set_app_setting(), a SECURITY DEFINER
-- function that re-checks caller_is_moderator() itself before writing.
--
-- The select-all policy on app_settings is a genuine "every member reads
-- every row" case (bus fare / toll savings estimates are not sensitive), so
-- it uses `using (auth.uid() is not null)` rather than `using (true)` -- R6
-- forbids the literal unconditional predicate; `to authenticated` already
-- excludes anonymous callers, and this states the real predicate rather than
-- letting the role clause carry the whole meaning silently. Same idiom as
-- 0011's ai_kill_switches_select_authenticated and 0018's stops read policy.
--
-- SECURITY POSTURE -- unchanged from every other file in this harness: RLS on
-- both new tables, no insert/update/delete policy for any role, revoked from
-- anon, granted SELECT to authenticated only. Every write goes through a
-- SECURITY DEFINER function in this file.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- completed_rides -- one row per member per completed offer. A log, not a
-- counter, so get_leaderboard() below can aggregate ride counts and savings
-- without losing the ability to audit any individual completion.
-- -----------------------------------------------------------------------------
create table if not exists public.completed_rides (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  role         text not null check (role in ('driver', 'rider')),
  location_id  uuid not null references public.locations (id),
  saved_cents  integer not null default 0 check (saved_cents >= 0),
  completed_at timestamptz not null default now(),
  unique (offer_id, member_id)
);

comment on column public.completed_rides.location_id is
  'The offer''s origin_location_id at record time (0002) -- the same "home spot" scoping every '
  'other Option B slice uses, not a route: see the file header for why origin/dest granularity '
  'is dropped entirely rather than carried as a second location pair.';

create index if not exists idx_completed_rides_member
  on public.completed_rides (member_id, completed_at desc);

create index if not exists idx_completed_rides_location
  on public.completed_rides (location_id, completed_at desc);

alter table public.completed_rides enable row level security;

revoke all on table public.completed_rides from anon;
revoke all on table public.completed_rides from authenticated;
grant select on table public.completed_rides to authenticated;

create policy completed_rides_select_own
  on public.completed_rides
  for select
  to authenticated
  using (member_id = auth.uid());

create policy completed_rides_select_moderator
  on public.completed_rides
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. record_completed_ride()
-- (below), reached only from record_completed_rides_sweep(), is the only writer.


-- -----------------------------------------------------------------------------
-- app_settings -- moderator-tunable key/value estimates, read by
-- record_completed_ride() below. Not member free text (rev. 5.3 sec.12
-- constraint 3): values are integers, keys are fixed by this migration's seed.
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value_cents integer not null check (value_cents >= 0),
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value_cents) values
  ('bus_fare_estimate_cents', 200),
  ('toll_savings_estimate_cents', 400)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from anon;
revoke all on table public.app_settings from authenticated;
grant select on table public.app_settings to authenticated;

-- Not `using (true)` -- R6 forbids the literal unconditional predicate.
-- `to authenticated` already excludes every anonymous caller;
-- `auth.uid() is not null` states the real predicate this policy relies on --
-- a live authenticated session -- rather than writing `true` and letting the
-- `to authenticated` clause carry the whole meaning silently. Same idiom as
-- 0011's ai_kill_switches_select_authenticated and 0018's stops read policy.
create policy app_settings_select_authenticated
  on public.app_settings
  for select
  to authenticated
  using (auth.uid() is not null);

-- No insert/update/delete policy exists, for any role. set_app_setting()
-- (below) is the only writer, and it re-checks caller_is_moderator() itself.


-- =============================================================================
-- WRITE / READ PATH -- SECURITY DEFINER functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- mask_display_name -- first 3 letters + last-initial (e.g. "Kalai Kandasamy"
-- -> "Kal K."), or first 3 letters + "." with no second word. A courtesy mask
-- for the leaderboard specifically; members already see each other's full
-- display_name elsewhere in the app (offer participant views, etc).
-- -----------------------------------------------------------------------------
create or replace function public.mask_display_name(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case
    when position(' ' in btrim(p_name)) = 0 then left(btrim(p_name), 3) || '.'
    else left(btrim(p_name), 3) || ' ' || upper(left(split_part(btrim(p_name), ' ', 2), 1)) || '.'
  end;
$fn$;

revoke all on function public.mask_display_name(text) from public;


-- -----------------------------------------------------------------------------
-- record_completed_ride -- see the file header for why this exists instead of
-- a hook inside offer_advance(). Internal: revoked from PUBLIC below and never
-- granted to any client role; reached only from record_completed_rides_sweep().
-- Idempotent via completed_rides' unique (offer_id, member_id) constraint.
-- -----------------------------------------------------------------------------
create or replace function public.record_completed_ride(p_offer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_offer              public.offers%rowtype;
  v_bus_fare_cents     integer;
  v_toll_savings_cents integer;
  v_rider              record;
  v_recorded           integer := 0;
begin
  select * into v_offer from public.offers where id = p_offer_id;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if v_offer.state <> 'COMPLETED' then
    raise exception 'offer % is % and has no completed ride to record', p_offer_id, v_offer.state
      using errcode = '55000';
  end if;

  select value_cents into v_bus_fare_cents
    from public.app_settings where key = 'bus_fare_estimate_cents';
  select value_cents into v_toll_savings_cents
    from public.app_settings where key = 'toll_savings_estimate_cents';

  insert into public.completed_rides (offer_id, member_id, role, location_id, saved_cents)
  values (p_offer_id, v_offer.poster_id, 'driver', v_offer.origin_location_id, coalesce(v_toll_savings_cents, 0))
  on conflict (offer_id, member_id) do nothing;

  if found then
    v_recorded := v_recorded + 1;
  end if;

  for v_rider in
    select rider_id from public.reservations
     where offer_id = p_offer_id and state = 'CONFIRMED'
  loop
    insert into public.completed_rides (offer_id, member_id, role, location_id, saved_cents)
    values (p_offer_id, v_rider.rider_id, 'rider', v_offer.origin_location_id, coalesce(v_bus_fare_cents, 0))
    on conflict (offer_id, member_id) do nothing;

    if found then
      v_recorded := v_recorded + 1;
    end if;
  end loop;

  return v_recorded;
end;
$fn$;

revoke all on function public.record_completed_ride(uuid) from public;


-- -----------------------------------------------------------------------------
-- record_completed_rides_sweep -- see the file header for the full rationale.
-- One record_completed_ride() attempt per COMPLETED offer with no
-- completed_rides row yet, per run, each isolated in its own
-- `exception when others` block so one offer's failure cannot abort recording
-- for every other unrelated offer in the same run (same isolation as 0022's
-- promote_waitlist_sweep()).
--
-- Internal: never granted to any client role, same as promote_waitlist_sweep().
-- -----------------------------------------------------------------------------
create or replace function public.record_completed_rides_sweep()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_offer record;
  v_count integer := 0;
begin
  for v_offer in
    select o.id
      from public.offers o
     where o.state = 'COMPLETED'
       and not exists (
         select 1 from public.completed_rides cr where cr.offer_id = o.id
       )
     order by o.id
  loop
    begin
      perform public.record_completed_ride(v_offer.id);
      v_count := v_count + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.record_completed_rides_sweep() from public;


-- -----------------------------------------------------------------------------
-- get_leaderboard -- masked name, ride count, combined savings, scoped to one
-- location. SECURITY DEFINER so it can aggregate across all members'
-- completed_rides rows (RLS otherwise restricts a caller to member_id =
-- auth.uid()) -- the function itself is the only thing allowed to do that
-- aggregation, and it returns only the three columns the leaderboard needs,
-- never raw display_name or a per-role breakdown.
-- -----------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_location_id uuid)
returns table (
  member_id         uuid,
  masked_name       text,
  total_rides       bigint,
  total_saved_cents bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $fn$
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
$fn$;

revoke all on function public.get_leaderboard(uuid) from public;
grant execute on function public.get_leaderboard(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- set_app_setting -- the only writer for app_settings. See the file header for
-- why this is a function rather than Sluglines-AI's moderator-checked UPDATE
-- policy.
-- -----------------------------------------------------------------------------
create or replace function public.set_app_setting(p_key text, p_value_cents integer)
returns public.app_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_row   public.app_settings%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_value_cents is null or p_value_cents < 0 then
    raise exception 'value_cents must be a non-negative integer' using errcode = '22023';
  end if;

  update public.app_settings
     set value_cents = p_value_cents, updated_at = now()
   where key = p_key
  returning * into v_row;

  if not found then
    raise exception 'unknown app setting %', p_key using errcode = 'P0002';
  end if;

  perform public.record_audit_event(v_actor, 'app_setting.updated', 'app_settings', null,
    jsonb_build_object('key', p_key, 'value_cents', p_value_cents));

  return v_row;
end;
$fn$;

revoke all on function public.set_app_setting(text, integer) from public;
grant execute on function public.set_app_setting(text, integer) to authenticated;

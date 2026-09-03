-- =============================================================================
-- 0024_dashboard_summary.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp), applied 2026-09-02
--
-- Option B slice 6, part two, and the last migration issue #90 asks for: a
-- single moderator-only aggregate-summary function, so a moderator dashboard
-- needs one round trip instead of six separate client queries -- same
-- reasoning as get_presence_counts / 0023's get_leaderboard. No new AI tool:
-- this is not in src/lib/ai/tools.ts's catalog, so src/lib/ai/ is untouched.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0023_dashboard_summary.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13). The adaptations:
--
--   * is_moderator() -> caller_is_moderator() (0002).
--   * moderation_reports does not exist anywhere in this repo's migrations --
--     no moderation-report queue has been transplanted (Option B never
--     brought one in; it is out of scope for issue #90's four-feature list).
--     Sluglines-AI's open_moderation_reports column is dropped and replaced
--     with active_waitlist_entries, sourced from 0021's offer_waitlist --
--     a table that DOES exist here and is exactly the kind of operational
--     signal ("how much unmet demand is queued right now") a moderator
--     dashboard exists to surface. Every other source column maps onto a
--     table this repo actually has: offers (0002), completed_rides (0023,
--     this Option B slice), incidents (0014), lostfound_items (0016),
--     presence_checkins (0001).
--   * presence_checkins here has no party_size column (0001's schema is
--     one row per member, not per party) -- current_presence_total is
--     therefore `count(*)`, not `sum(party_size)`.
--   * incidents/lostfound_items "still open" state lists use THIS repo's own
--     enums (public.incident_state, public.lostfound_item_state, both 0014/
--     0016), not Sluglines-AI's.
--
-- Counts are computed at read time, never stored, matching this repo's
-- existing "compute, don't store" choice for offers_board.active_reservation_
-- count and 0014/0016's own confirmation/claim counts.
--
-- SECURITY POSTURE -- this migration creates no table, so R3/R4/R5/R6/R7/R11
-- (all table-shaped) are vacuous for it. The one function is SECURITY
-- DEFINER (it must read across every member's rows the way 0023's
-- get_leaderboard does), pins search_path (R8), is revoked from PUBLIC (R9)
-- and granted execute to authenticated (never anon/public, R10) -- it
-- self-checks caller_is_moderator() and raises for anyone else, the same
-- gate shape as 0023's set_app_setting().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- get_dashboard_summary -- moderator-only. Raises for any other caller rather
-- than returning an empty or partial result, matching the source's own
-- "if not is_moderator() then raise" shape.
-- -----------------------------------------------------------------------------
create or replace function public.get_dashboard_summary(p_location_id uuid)
returns table (
  active_offers            bigint,
  completed_rides_today    bigint,
  open_incidents           bigint,
  active_lostfound_items   bigint,
  current_presence_total   bigint,
  active_waitlist_entries  bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $fn$
begin
  if not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*) from public.offers
       where origin_location_id = p_location_id
         and state in ('OPEN', 'PARTIALLY_RESERVED', 'RESERVED', 'CONFIRMED', 'ARRIVING', 'PICKED_UP')
    ),
    (
      select count(*) from public.completed_rides
       where location_id = p_location_id
         and completed_at >= date_trunc('day', now())
    ),
    (
      select count(*) from public.incidents
       where location_id = p_location_id
         and state in ('UNCONFIRMED', 'CONFIRMED')
    ),
    (
      select count(*) from public.lostfound_items
       where location_id = p_location_id
         and state in ('REPORTED', 'MATCHED', 'CLAIMED')
    ),
    (
      select count(*) from public.presence_checkins
       where location_id = p_location_id and expires_at > now()
    ),
    (
      select count(*) from public.offer_waitlist w
        join public.offers o on o.id = w.offer_id
       where o.origin_location_id = p_location_id
         and w.state = 'ACTIVE'
    );
end;
$fn$;

revoke all on function public.get_dashboard_summary(uuid) from public;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;

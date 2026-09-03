-- =============================================================================
-- 0025_lock_down_definer_functions.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp), applied 2026-09-02
--
-- SECURITY FIX. Closes the anon/authenticated-execute hole verified live on
-- preview (`xqonrogwwytkmqfinszp`) by applying 0011-0024 and running the live
-- suite: `tests/live-rate-limit.test.mjs` failed with "anon must be refused;
-- the call unexpectedly succeeded". Full writeup of the finding as reported:
-- SECURITY-FINDING-definer-anon-grants.md (session-local, not committed).
--
-- ROOT CAUSE
-- -----------------------------------------------------------------------------
-- Every migration through 0024 secures its SECURITY DEFINER functions with
-- `revoke all on function ... from public;` alone (scripts/sql-lint.mjs R9).
-- On a Supabase project, `anon` and `authenticated` are NOT the `PUBLIC`
-- pseudo-role -- Supabase's own default privileges grant them EXECUTE
-- directly on every new function created in the `public` schema, independent
-- of whatever PUBLIC holds. `revoke ... from public` never touches that
-- grant, so a function intended for "nobody" (run only by the pg_cron
-- scheduler, as the owner) or "service_role only" stayed reachable by anon
-- and authenticated the whole time. Because these functions are SECURITY
-- DEFINER, an anonymous PostgREST RPC call (`/rest/v1/rpc/<fn>`) runs with
-- the owner's privileges and can bypass RLS entirely --
-- `offer_create_for_member`/`offer_reserve_seat_for_member` take an explicit
-- actor id, so an anon caller could forge rides as any member;
-- `rate_limit_hit` takes caller-supplied `p_max`/`p_window_ms`, so an anon
-- caller could defeat or weaponise its own rate limit.
--
-- `sql:check` R9 passed the whole time because it only proves the shape
-- "a `revoke ... from public` statement exists for this function" -- it has
-- no database connection and cannot model Supabase's default role grants
-- (supabase/migrations/README.md, "Known limits").
--
-- SCOPE -- wider than the 10 functions the live suite first caught
-- -----------------------------------------------------------------------------
-- The live run named 10 functions from 0011-0024. This migration also adds a
-- new static rule, sql-lint R12, that generalises the check: every SECURITY
-- DEFINER function NOT granted to `authenticated` must be explicitly revoked
-- from both `anon` and `authenticated` somewhere in the migration sequence.
-- Running R12 over the *entire* tree -- not just 0011-0024 -- surfaces 8 more
-- functions with the identical gap, going all the way back to 0001/0002:
--
--   record_audit_event, handle_new_member, sweep_expired_presence   (0001)
--   claim_offer_operation, complete_offer_operation,
--     apply_offer_transition, offer_expire_sweep                    (0002/0003)
--   promote_from_waitlist                                           (0022)
--
-- `0001` and `0002` are **already applied to production**
-- (`bwpguotjzczmieeepczf`, supabase/migrations/README.md) -- so the first
-- seven of those are not a preview-only, pre-apply risk the way the original
-- 10 are. They are a live production exposure today, independent of whether
-- 0011-0024 ever ship. Closing them is not scope creep; it is what the same
-- root cause, followed to every migration it touches, actually requires.
-- `claim_offer_operation`/`complete_offer_operation`/`apply_offer_transition`
-- are called only from other SECURITY DEFINER functions in 0002/0003 (which
-- run as the functions' owner and so need no EXECUTE grant of their own --
-- object owners bypass privilege checks on their own objects); revoking
-- anon/authenticated changes nothing about how `offer_create`/`offer_advance`
-- etc. call them internally.
--
-- This migration creates no table and no function; it only adds the missing
-- revokes. It never edits 0001-0024 (append-only, per
-- supabase/migrations/README.md, "Correcting a migration that has already
-- been applied").
--
-- WHO MAY CALL EACH FUNCTION AFTER THIS MIGRATION
-- -----------------------------------------------------------------------------
--   rate_limit_hit(...)   -- service_role ONLY. Its existing
--                            `grant execute ... to service_role` (0012) is
--                            untouched; only anon/authenticated are revoked.
--   every other function   -- nobody. Each is either called internally by
--     listed below            another SECURITY DEFINER function (running as
--                              the owner, which needs no grant) or run by the
--                              pg_cron scheduler as the database owner,
--                              exactly like `sweep_expired_presence()` and
--                              `offer_expire_sweep()` already were before
--                              this migration -- a role grant was never
--                              needed for either caller.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0001_rebuild_foundation.sql -- applied to production. Internal audit-log
-- writer, the new-member trigger body, and the presence sweep were never
-- meant to be client-callable; none carries a `grant execute ... to
-- authenticated`, so `revoke ... from public` alone left them anon-reachable.
-- -----------------------------------------------------------------------------
revoke all on function public.record_audit_event(uuid, text, text, uuid, jsonb) from anon, authenticated;
revoke all on function public.handle_new_member() from anon, authenticated;
revoke all on function public.sweep_expired_presence() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0002_ride_coordinator_state.sql (claim_offer_operation and
-- apply_offer_transition re-created with the identical signature by
-- 0003_resolve_transition_conflicts.sql, D-30) -- applied to production. The
-- state-machine choke points: internal only, reached from offer_create/
-- offer_advance/offer_cancel/etc., never from a client directly.
-- -----------------------------------------------------------------------------
revoke all on function public.claim_offer_operation(uuid, text, uuid, text) from anon, authenticated;
revoke all on function public.complete_offer_operation(uuid, text, uuid, integer) from anon, authenticated;
revoke all on function public.apply_offer_transition(uuid, text, integer, uuid, text, text, integer, integer) from anon, authenticated;
revoke all on function public.offer_expire_sweep() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0012_durable_rate_limit.sql -- issue #55. service_role keeps its grant
-- (0012's own header explains why anon/authenticated must never reach this
-- function: caller-supplied p_max/p_window_ms would let a client defeat or
-- weaponise its own rate limit).
-- -----------------------------------------------------------------------------
revoke all on function public.rate_limit_hit(text, bigint, integer, timestamptz) from anon, authenticated;
revoke all on function public.rate_limit_sweep() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0015_incidents_functions.sql -- issue #90.
-- -----------------------------------------------------------------------------
revoke all on function public.expire_stale_incidents() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0017_lostfound_functions.sql -- issue #90.
-- -----------------------------------------------------------------------------
revoke all on function public.expire_stale_lostfound_items() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0020_recurring_offer_functions.sql -- issue #90. offer_create_for_member
-- takes an explicit actor id -- the sharpest of the original 10, an anon
-- caller could otherwise forge a recurring-offer post as any member.
-- -----------------------------------------------------------------------------
revoke all on function public.offer_create_for_member(uuid, text, uuid, uuid, timestamptz, timestamptz, integer, text) from anon, authenticated;
revoke all on function public.instantiate_recurring_offers() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0022_waitlist_eta_noshow_functions.sql -- issue #90.
-- offer_reserve_seat_for_member takes an explicit actor id, same exposure as
-- offer_create_for_member above.
-- -----------------------------------------------------------------------------
revoke all on function public.offer_reserve_seat_for_member(uuid, uuid, text, integer) from anon, authenticated;
revoke all on function public.promote_from_waitlist(uuid) from anon, authenticated;
revoke all on function public.promote_waitlist_sweep() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0023_ride_history_leaderboard.sql -- issue #90.
-- -----------------------------------------------------------------------------
revoke all on function public.record_completed_ride(uuid) from anon, authenticated;
revoke all on function public.record_completed_rides_sweep() from anon, authenticated;

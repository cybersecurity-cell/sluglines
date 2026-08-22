-- =============================================================================
-- 2026-08-22-schedule-sweeps.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf),
--          2026-08-22. See Docs/DECISIONS.md D-46 and issue #46.
--
-- Installs pg_cron and schedules the two sweeps that rev. 5.3 sec.6 specifies and
-- that `0001` and `0002` created but deliberately did not schedule. Until this
-- ran, both functions were unreachable by anything: neither is granted to any
-- client role, precisely because the scheduler was meant to be their only caller.
--
-- THE TWO INTERVALS ARE DIFFERENT, ON PURPOSE
-- -----------------------------------------------------------------------------
-- They buy different things, so they are not tuned to the same number.
--
--   offer_expire_sweep    every minute
--
--     Load-bearing for correctness of the *public* board. `0005`'s
--     `get_public_open_offer_counts()` filters offers on `state in ('OPEN',
--     'PARTIALLY_RESERVED')` and does NOT filter on `window_end`, so an offer
--     whose window has closed keeps being counted on the public board until
--     something moves it to EXPIRED. Nothing else does. Every minute of lag here
--     is a minute of a visibly wrong count, so this runs at pg_cron's floor.
--
--   sweep_expired_presence  every 5 minutes
--
--     Retention hygiene, not correctness. Both presence read paths already
--     compute liveness from `expires_at` rather than from the row's existence --
--     `get_public_spot_counts()` filters `pc.expires_at > now()`, and
--     `lib/domain/fast-board.ts` has `isPresenceLive()` (D-33) -- so an unswept
--     row is never counted or rendered. What the sweep buys is that rows about
--     where a member physically stood do not accumulate forever, which is what
--     the privacy posture in rev. 5.3 sec.10/sec.13 is there to prevent.
--
--     Against a default TTL of 20 minutes (`presence_checkin`'s `p_ttl_minutes`
--     default in `0001`, hard-capped at 60), a 5-minute sweep bounds an expired
--     row's life at TTL + 5 min. That is the retention claim this interval can
--     actually support, and it is the number recorded in D-46. Tightening it to
--     the 1-minute floor would buy 4 minutes on a 20-minute TTL; the cost of
--     being wrong in the other direction -- location rows kept indefinitely --
--     is what the interval is chosen against, and 5 minutes is inside it.
--
-- IDEMPOTENT. `cron.schedule(name, schedule, command)` upserts by job name from
-- pg_cron 1.4 onward (this project has 1.6.4), so re-running this file retunes
-- the existing jobs rather than creating duplicates.
-- =============================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'offer_expire_sweep',
  '* * * * *',
  $job$select public.offer_expire_sweep();$job$
);

select cron.schedule(
  'sweep_expired_presence',
  '*/5 * * * *',
  $job$select public.sweep_expired_presence();$job$
);

-- =============================================================================
-- 0005_public_aggregates.sql
--
-- APPLIED: no
--
-- rev. 5.3 sec.8 M1 "Public data functions": the two anonymous-callable
-- SECURITY DEFINER aggregates the M1/M3/dashboard slices have all been holding
-- a typed contract for without a database to answer it --
-- src/lib/domain/public-counts.ts pins the function names, the row shape and
-- the string-to-number coercion; tests/public-counts.test.mjs already exercises
-- every code path against a fake client. This file is what makes the real RPC
-- answer instead of `unavailable`.
--
--   get_public_spot_counts()
--   get_public_open_offer_counts()
--
-- Both return exactly:
--
--   (spot_slug, corridor, direction, waiting_count, driver_offer_count, rider_request_count)
--
-- Counts only. No member id, no poster id, no offer id, no timestamp -- the
-- SELECT list below is the whole contract, and it is checked column-by-column
-- in tests/sql-migration-harness.test.mjs so a later edit cannot widen it
-- without a test failing.
--
-- rev. 5.3's own §8 M1 privacy note is carried forward rather than re-argued:
-- "a count of 1 at a named spot approximates one person's presence; this is
-- accepted for the pilot because standing at a public slug line is already
-- publicly observable." What is NOT accepted is going further than a count --
-- no display name, no vehicle, no arrival time, ever leaves this function.
--
-- NOT IN THIS FILE: get_public_offer_summary(offer_id uuid). rev. 5.3 sec.8 M1
-- names it in the same paragraph, but it is a different shape (one offer's
-- share-link card: stop names, a rounded window, seats, state) with a
-- different threat model (an unguessable UUIDv4 is the only access control,
-- so it needs the edge-side per-IP rate limit rev. 5.3 says to build with it)
-- and no committed TypeScript contract calls it yet. Folding it in here would
-- be scope the task did not ask for and no test is holding open.
--
-- WHY THIS FILE NEEDS 0004 APPLIED FIRST
-- -----------------------------------------------------------------------------
-- Neither presence_checkins (0001) nor offers (0002) stores a spot's slug,
-- corridor or direction -- they store location_id, a uuid, because the
-- rev. 5.3 sec.11 P1 locations directory (0004) is where that mapping lives.
-- These two functions therefore join public.locations, which means this file
-- cannot answer a single row until 0004 has run. That is a real dependency,
-- not an ordinal coincidence, and it is why this slice applies 0004 alongside
-- it rather than leaving 0004 unapplied as the M3 dashboard slice's "next"
-- note assumed it would stay a little longer.
--
-- Only ACTIVE locations are aggregated (`where l.is_active`), the same gate
-- 0004's own read policy uses: a spot with no live line is not part of "what
-- is happening right now," and a 0 for it would not be a measurement anyone
-- took.
--
-- RATE LIMITING
-- -----------------------------------------------------------------------------
-- rev. 5.3 sec.8 M10 is explicit that a SQL function cannot see caller IPs, and
-- assigns per-IP throttling to edge middleware built in P2. Nothing below
-- attempts it; that is a Next.js-side follow-on, not a gap in this file.
--
-- SECURITY POSTURE -- the one rule this file bends, and how
-- -----------------------------------------------------------------------------
-- Every other function in this repo is granted to `authenticated` only,
-- because R10 forbids `grant execute ... to anon`. R10's own doc comment in
-- supabase/migrations/README.md names the reason: "anonymous-callable
-- functions arrive in P2 with their own review." This IS that review. Both
-- functions below:
--
--   * are `security definer`, `stable`, `language sql` -- a single read query,
--     nothing procedural, nothing that can be asked to do a write;
--   * pin `search_path` (R8);
--   * are `revoke ... from public` before anything is granted back (R9), so
--     the anon/authenticated grant that follows is the only path in;
--   * are granted `execute` to `anon` AND `authenticated` -- a signed-in
--     member reads the same aggregate a visitor does, by design (rev. 5.3
--     sec.8 M1 note 1 in the dashboard slice: no second, richer counting path
--     for members);
--   * touch no table that isn't already `select`-only for `authenticated` and
--     fully revoked from `anon` -- `locations`, `presence_checkins`, `offers`.
--     The anon grant here is on the *function*, not on any table: an
--     anonymous client still cannot `select * from presence_checkins`, it can
--     only call a function that runs as owner and returns six aggregate
--     columns.
--
-- scripts/sql-lint.mjs's R10 gains a named, code-level allowlist for exactly
-- these two qualified function names -- not a rule relaxation, an exception
-- enumerated in the analyser itself and asserted by
-- tests/sql-migration-harness.test.mjs. Granting `anon` execute on anything
-- else still fails the gate.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- get_public_spot_counts -- one row per active spot, waiting_count measured
-- from presence_checkins. The other two columns are always 0 here; the open
-- offer counts are the other function's job, and src/lib/domain/public-counts.ts
-- sums the two per slug rather than expecting either to answer alone.
--
-- `pc.expires_at > now()` is the read-time expiry rev. 5.3 sec.8 M4 specifies:
-- an expired check-in is not counted even if sweep_expired_presence() has not
-- yet deleted it, so the count is never stale by more than the sweep interval
-- in the wrong (over-counting) direction.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_spot_counts()
returns table (
  spot_slug            text,
  corridor             text,
  direction            text,
  waiting_count        bigint,
  driver_offer_count   bigint,
  rider_request_count  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    l.slug as spot_slug,
    l.corridor,
    l.direction,
    count(pc.member_id) as waiting_count,
    0::bigint as driver_offer_count,
    0::bigint as rider_request_count
  from public.locations l
  left join public.presence_checkins pc
         on pc.location_id = l.id
        and pc.expires_at > now()
  where l.is_active
  group by l.slug, l.corridor, l.direction
  order by l.corridor, l.direction, l.slug;
$fn$;

revoke all on function public.get_public_spot_counts() from public;
grant execute on function public.get_public_spot_counts() to anon, authenticated;


-- -----------------------------------------------------------------------------
-- get_public_open_offer_counts -- one row per active spot, driver/rider offer
-- counts measured from offers whose origin is that spot and whose state is
-- still board-visible (OPEN or PARTIALLY_RESERVED -- the same two states
-- offers_select_visible_for_caller in 0002 treats as "the board"). Anything
-- RESERVED or later has stopped accepting riders and is no longer an open
-- offer to count here; anything DRAFT never published.
--
-- waiting_count is always 0 here for the same reason the sibling function
-- always returns 0 for the other two columns.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_open_offer_counts()
returns table (
  spot_slug            text,
  corridor             text,
  direction            text,
  waiting_count        bigint,
  driver_offer_count   bigint,
  rider_request_count  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    l.slug as spot_slug,
    l.corridor,
    l.direction,
    0::bigint as waiting_count,
    count(*) filter (where o.poster_role = 'driver') as driver_offer_count,
    count(*) filter (where o.poster_role = 'rider') as rider_request_count
  from public.locations l
  left join public.offers o
         on o.origin_location_id = l.id
        and o.state in ('OPEN', 'PARTIALLY_RESERVED')
  where l.is_active
  group by l.slug, l.corridor, l.direction
  order by l.corridor, l.direction, l.slug;
$fn$;

revoke all on function public.get_public_open_offer_counts() from public;
grant execute on function public.get_public_open_offer_counts() to anon, authenticated;

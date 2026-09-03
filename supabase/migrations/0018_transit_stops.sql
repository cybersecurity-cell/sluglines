-- =============================================================================
-- 0018_transit_stops.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp), applied 2026-09-02
--
-- Option B slice 3 (Docs/DECISIONS.md D-65's deferral, closed here for issue
-- #90): the `stops` table `src/lib/ai/tools.ts`'s `transit.explain_alternatives`
-- has been waiting on since the AI runtime transplant. Non-carpool transit
-- alternatives (a bus stop, a Metro station, the lot itself) that the agent can
-- read and describe honestly -- no live feed, so no times.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's stops table
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13), and this is the one
-- table in the Option B sequence where "adapted from" means something stronger
-- than a moderator-helper swap: Sluglines-AI's `stops` (its `0001_schema.sql`)
-- is *fundamental* -- every offer references one via `origin_stop_id`/
-- `dest_stop_id`, and `is_lot` was added later (its `0011_stop_lot_flag.sql`)
-- to classify which stops are commuter lots. **sluglines is architecturally
-- different**: this repo's `offers` table already references
-- `origin_location_id`/`destination_location_id` -> `locations` (0001/0004),
-- not stops -- carpool matching here has never gone through a stop id. So here,
-- `stops` is a **standalone per-location lookup table**, read only by
-- `transit.explain_alternatives`, and is not wired into `offers` in any way.
-- Nothing about `offers` changes in this file.
--
-- Column shape kept from the reference (`id`, `location_id`, `name`, `is_lot`,
-- a timestamp), minus `aliases` -- nothing in this repo's tool reads it, and
-- Sluglines-AI's own `unique (location_id, name)` constraint is kept for the
-- same reason 0016 keeps constraints the tool doesn't directly need: it is a
-- real data-integrity property (two stops of the same name at the same
-- location is always a data error), not schema invented for a task that never
-- asked for it.
--
-- WHY THE TABLE SHIPS EMPTY
-- -----------------------------------------------------------------------------
-- Sluglines-AI's own seed data is a single pilot corridor ("Horner Road" paired
-- with L'Enfant Plaza / Navy Yard / 14th Street) that does not correspond to
-- any location in this repo's real directory (0004's ~20 named I-395/I-95 and
-- I-66 lots -- Bob's - Old Keene Mill Rd, Cardinal Forest Plaza, Potomac
-- Mills, and so on; no "Horner Road" among them). That directory's own
-- `lines_from`/`lines_to` columns name corridor bus-line destinations, not
-- curated transit-stop records, and turning them into `stops` rows would be
-- this session inventing a mapping no source states -- exactly what the task
-- instructs against. There is no authoritative per-location stop data to seed
-- from, so this table ships with its columns and constraints only, zero rows.
-- Real stop data is a follow-up migration once someone curates it; until then
-- `transit.explain_alternatives` returns an honestly empty list plus its
-- `liveTransitData: false` marker, never a fabricated one.
--
-- SECURITY POSTURE -- unchanged from every other file in this harness: RLS on,
-- no insert/update/delete policy for any role, revoked from anon, granted
-- SELECT to authenticated only. Reference data like this has no write path in
-- this slice at all -- not even a SECURITY DEFINER function -- because nothing
-- in scope needs one; seeding real stops later is a migration, the same way
-- 0004 seeds `locations`.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- stops
-- -----------------------------------------------------------------------------
create table public.stops (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  is_lot       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (location_id, name)
);

create index idx_stops_location on public.stops (location_id);

alter table public.stops enable row level security;

revoke all on table public.stops from anon;
revoke all on table public.stops from authenticated;
grant select on table public.stops to authenticated;

-- Every member may read every location's stops -- transit.explain_alternatives
-- reads `ctx.locationId`'s stops through the caller's own session, the same
-- "real table, caller's own RLS session" pattern as ride.list_offers,
-- incidents.get_active and lostfound.search, but stops carry no member data
-- and no per-location privacy boundary the way offers/incidents/lostfound
-- items do, so the policy is a plain authenticated read, not a same-location
-- filter. `to authenticated` already excludes anonymous callers; `auth.uid()
-- is not null` states the real predicate this policy relies on (R6 forbids
-- the literal unconditional `true` -- same reasoning as 0011's
-- ai_kill_switches_select_authenticated).
create policy stops_select_authenticated
  on public.stops
  for select
  to authenticated
  using (auth.uid() is not null);

-- No insert/update/delete policy exists, for any role. Stops are reference
-- data maintained by migration (see the file header for why this one ships
-- empty), never a client write.

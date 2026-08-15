-- =============================================================================
-- 0004_spot_locations_directory.sql
--
-- APPLIED: no
--
-- GENERATED FILE -- DO NOT EDIT BY HAND.
--   Source:    src/lib/domain/locations.ts
--   Generator: scripts/seed-locations.mjs   (`npm run seed:locations`)
--   Guard:     tests/spot-locations-directory.test.mjs re-runs the generator and
--              compares the result with this file byte-for-byte.
-- Editing this file directly turns that test red; edit the domain module instead.
--
-- The rev. 5.3 sec.11 P1 spot directory: the table `locations`, the foreign keys
-- 0001 and 0002 both deferred to it by name, and the idempotent seed.
--
-- WHAT "THE 43 SPOTS" ACTUALLY ARE
-- -----------------------------------------------------------------------------
-- rev. 5.3 and Docs/DECISIONS.md both say "43 spots", taken from the content
-- inventory's `slugPickupPages: 43`. That total counts the `/slug_pickup/`
-- *index* page alongside the spot pages, so the legacy site has 42 spot pages,
-- not 43. This file seeds 50: those 42, plus the 8 spots the curated
-- directory has added since (chiefly the I-66 corridor, which the legacy site
-- never covered). The arithmetic and the evidence are in Docs/DECISIONS.md D-31;
-- the test asserts all 42 inventory slugs are present rather than asserting a
-- round number, because the inventory list is the thing the gate is about.
--
-- SECURITY POSTURE (rev. 5.3 sec.6, sec.12 constraints 2 and 6)
-- -----------------------------------------------------------------------------
-- Default deny, as everywhere else. RLS on; no insert/update/delete policy for
-- any role; nothing granted to `anon`. The directory is reference data, so it
-- has no SECURITY DEFINER writer at all -- the only way a row changes is a
-- migration, which is a stricter posture than the other tables, not a looser one.
--
-- The read policy is `using (is_active)` rather than `using (true)`, and that is
-- a real narrowing rather than a way past sql-lint's R6: an authenticated client
-- may read the spots it can actually offer or reserve a ride at. Inactive spots
-- stay in the table because 0002's offers reference them historically and the
-- legacy pages still describe them, but no client needs to enumerate them.
-- Anonymous read of the directory is rev. 5.3 sec.8 M1 Phase 2 work and arrives
-- with 0027's aggregate functions, under its own review.
--
-- IDEMPOTENCE
-- -----------------------------------------------------------------------------
-- The seed is a single upsert keyed on `slug`, with a `where` clause that skips
-- rows whose payload is unchanged. Re-running the file reports `0 inserted,
-- 0 updated` and touches no `updated_at`. The policy is dropped-if-exists before
-- creation and the constraint additions are guarded by catalogue lookups, so the
-- whole file is re-runnable -- 0001 and 0002 are not, and this one has to be,
-- because a seed that can only be applied once is a seed that can never be
-- corrected.
--
-- `id` is `gen_random_uuid()`, so location ids differ between environments. The
-- stable cross-environment key is `slug`; nothing should join on the uuid across
-- a dump boundary.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- locations  (rev. 5.3 sec.11 P1)
-- -----------------------------------------------------------------------------
create table if not exists public.locations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                  check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  route_slug    text not null unique
                  check (lower(route_slug) = slug),
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  corridor      text not null check (corridor in ('I-395 / I-95', 'I-66')),
  direction     text not null check (direction in ('Morning', 'Afternoon')),
  county        text not null check (char_length(btrim(county)) between 1 and 60),
  destination   text not null,
  description   text not null,
  latitude      numeric(9, 6) check (latitude between -90 and 90),
  longitude     numeric(9, 6) check (longitude between -180 and 180),
  is_active     boolean not null default false,
  peak_hours    text,
  parking       text,
  lines_from    text[],
  lines_to      text[],
  community_url text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A spot has both coordinates or neither. Half a coordinate is a bug that
  -- renders as a map pin off the coast of Africa rather than as an error.
  constraint locations_coordinates_paired
    check ((latitude is null) = (longitude is null))
);

comment on table public.locations is
  'rev. 5.3 sec.11 P1 spot directory. Reference data: no client write path exists, by design. '
  'Generated from src/lib/domain/locations.ts by scripts/seed-locations.mjs.';

comment on column public.locations.slug is
  'Canonical lower-case key. Equals the legacy /slug_pickup/<slug>/ URL slug and is the stable '
  'cross-environment identifier; id is not.';

comment on column public.locations.route_slug is
  'Case-preserved path segment served at /spots/<route_slug>. Constrained to lower() = slug, so '
  'the two can differ in case and in nothing else.';

comment on column public.locations.is_active is
  'Whether a line is believed to be running. Defaults to false: a spot with no evidence of a live '
  'line is not offered to members, and the read policy keys on this column.';

comment on column public.locations.latitude is
  'Null where no surveyed coordinate exists -- four legacy-only spots publish none. Never guessed. '
  'See Docs/DECISIONS.md D-31.';

alter table public.locations enable row level security;

revoke all on table public.locations from anon;
revoke all on table public.locations from authenticated;
grant select on table public.locations to authenticated;

-- Dropped first so the whole file is re-runnable; `create policy` has no
-- `if not exists` form.
drop policy if exists locations_select_active on public.locations;

create policy locations_select_active
  on public.locations
  for select
  to authenticated
  using (is_active);

-- No insert/update/delete policy exists, for any role, by design. The directory
-- changes by migration only.

create index if not exists idx_locations_corridor_direction
  on public.locations (corridor, direction, county);

create index if not exists idx_locations_active
  on public.locations (is_active)
  where is_active;


-- -----------------------------------------------------------------------------
-- The foreign keys 0001 and 0002 deferred to this migration by name.
--
-- 0001: "location_id intentionally carries NO foreign key yet: the locations
--        table is rev. 5.3 sec.11 P1's directory seed and does not exist."
-- 0002: the same sentence, for offers.origin_location_id / destination_location_id.
--
-- Added NOT VALID. This is deliberate and is not a weakening: a NOT VALID
-- foreign key is enforced in full on every future insert and update, and only
-- skips the scan of rows that already exist. Those rows matter here -- the
-- preview branch carries offers written by the D-28 live suite with synthetic
-- location uuids that reference nothing, so a validating ALTER would abort and
-- the constraint would not be added at all. Validating them is a later slice's
-- job, after those rows are reconciled:
--
--   alter table public.offers validate constraint offers_origin_location_id_fkey;
--
-- Each addition is guarded on pg_constraint rather than on a bare ALTER, because
-- ADD CONSTRAINT has no IF NOT EXISTS form and this file must be re-runnable.
-- -----------------------------------------------------------------------------
do $fk$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('members',           'members_location_id_fkey',              'location_id',             'set null'),
      ('presence_checkins', 'presence_checkins_location_id_fkey',    'location_id',             'restrict'),
      ('offers',            'offers_origin_location_id_fkey',        'origin_location_id',      'restrict'),
      ('offers',            'offers_destination_location_id_fkey',   'destination_location_id', 'restrict')
    ) as t(table_name, constraint_name, column_name, on_delete)
  loop
    if to_regclass('public.' || r.table_name) is null then
      raise notice 'locations fk: public.% does not exist, skipping %', r.table_name, r.constraint_name;
      continue;
    end if;

    if exists (
      select 1
      from pg_constraint
      where conname = r.constraint_name
        and conrelid = ('public.' || r.table_name)::regclass
    ) then
      continue;
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) '
      'references public.locations (id) on delete %s not valid',
      r.table_name, r.constraint_name, r.column_name, r.on_delete
    );
  end loop;
end
$fk$;


-- -----------------------------------------------------------------------------
-- The seed: 50 spots, generated from src/lib/domain/locations.ts.
--
-- Upsert on `slug`, skipping rows whose payload is unchanged, so a second run
-- reports 0/0 and moves no updated_at. `xmax = 0` distinguishes an inserted row
-- from an updated one in the RETURNING clause -- an inserted row has no previous
-- version, so its xmax is zero.
-- -----------------------------------------------------------------------------
do $seed$
declare
  v_inserted integer;
  v_updated  integer;
  v_total    integer;
begin
  with seed (slug, route_slug, name, corridor, direction, county, destination, description, latitude, longitude, is_active, peak_hours, parking, lines_from, lines_to, community_url, notes) as (
    values
      ('bobs-old-keene-mill-rd', 'Bobs-Old-Keene-Mill-Rd', 'Bob''s - Old Keene Mill Rd', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, L''Enfant Plaza, and downtown DC', 'One of the oldest and best-known Springfield slug lines. Morning riders use Bob''s / Old Keene Mill for common Pentagon and downtown DC destinations.', 38.7783912::numeric, -77.1873566::numeric, true, '5:45 AM - 8:00 AM', 'Large commuter parking area around Springfield Plaza and nearby lots.', array['L''Enfant Plaza', '14th Street', '18th Street', 'Pentagon']::text[], array['L''Enfant Plaza', '14th Street', '18th Street', 'Pentagon']::text[], 'https://www.facebook.com/groups/springfieldsluglines/', null::text),
      ('cardinal-forest-plaza', 'cardinal-forest-plaza', 'Cardinal Forest Plaza', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Cardinal Forest Plaza is a morning slug line location in Fairfax serving the I-395 / I-95 corridor.', 38.7794583::numeric, -77.2314818::numeric, true, '6:00 AM - 8:30 AM', null::text, array['L''Enfant Plaza', 'Pentagon', '14th Street']::text[], null::text[], null::text, null::text),
      ('franconia-springfield', 'Franconia-Springfield', 'Franconia - Springfield', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, downtown DC, and Northern Virginia commuter destinations', 'Franconia - Springfield is a morning slug line location in Fairfax serving the I-395 / I-95 corridor.', 38.767306::numeric, -77.168972::numeric, false, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('lorton', 'Lorton', 'Lorton', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, downtown DC, and Northern Virginia commuter destinations', 'Lorton is a morning slug line location in Fairfax serving the I-395 / I-95 corridor.', 38.715012::numeric, -77.213593::numeric, false, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('rolling-valley', 'Rolling-Valley', 'Rolling Valley', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Rolling Valley is a morning slug line location in Fairfax serving the I-395 / I-95 corridor.', 38.7758648::numeric, -77.2629826::numeric, true, '6:00 AM - 8:30 AM', null::text, array['Pentagon', 'L''Enfant Plaza', '14th Street']::text[], null::text[], null::text, null::text),
      ('saratoga', 'Saratoga', 'Saratoga', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, downtown DC, and Northern Virginia commuter destinations', 'Saratoga is a morning slug line location in Fairfax serving the I-395 / I-95 corridor.', 38.7454983::numeric, -77.2100791::numeric, false, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('sydenstricker-rd', 'Sydenstricker-Rd', 'Sydenstricker Rd', 'I-395 / I-95', 'Morning', 'Fairfax', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Sydenstricker Rd is a morning slug line location in Fairfax serving the I-395 / I-95 corridor.', 38.755989::numeric, -77.238098::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('springfield-town-center', 'springfield-town-center', 'Springfield Town Center', 'I-395 / I-95', 'Morning', 'Fairfax', 'L''Enfant Plaza, 14th at Commerce Dept., and 18th Street', 'Frontier Garage commuter parking leased by Fairfax County. The legacy page records "there are no sluglines at this time" — commuters park here and walk to Franconia-Springfield Metro.', null::numeric, null::numeric, false, null::text, '800 commuter spaces at the Frontier Garage on levels 2, 4 and 6.', array['L''Enfant Plaza', '14th at Commerce Dept.', '18th Street']::text[], array['L''Enfant Plaza', '14th at Commerce Dept.', '14th & Madison Dr', '19th & F Street']::text[], 'https://www.facebook.com/groups/STCSluglines/', 'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. No coordinates on the legacy page.'),
      ('van-dorn-st', 'van-dorn-st', 'Van Dorn St', 'I-395 / I-95', 'Morning', 'Fairfax / Alexandria', 'L''Enfant Plaza, 14th Street, and 18th Street', 'Van Dorn Metro park-and-ride. The legacy page title carries an explicit [Inactive] marker.', null::numeric, null::numeric, false, '7:00 AM - 8:00 AM', '361 spaces at the Van Dorn Metro park-and-ride.', array['L''Enfant Plaza', '14th Street', '18th Street']::text[], array['L''Enfant Plaza', '14th & Madison Ave', '19th & F Street']::text[], null::text, 'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. Marked [Inactive] on the legacy page. No coordinates on the legacy page.'),
      ('landmark-mall', 'landmark-mall', 'Landmark Mall', 'I-395 / I-95', 'Morning', 'Fairfax / Alexandria', 'L''Enfant Plaza, 14th Street, and 18th Street', 'Bus stop #4000576 on the Landmark Mall roadway. The legacy page title carries an explicit [Inactive] marker.', null::numeric, null::numeric, false, '7:00 AM - 8:00 AM', 'Lower level of the Landmark Mall garage, rows K-O, next to bus stop #4000576. An Alexandria permit was required.', array['L''Enfant Plaza', '14th Street', '18th Street']::text[], null::text[], 'https://www.facebook.com/groups/dcsluglines/', 'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. Marked [Inactive] on the legacy page. No coordinates on the legacy page.'),
      ('route-3-gordon-rd', 'Route-3-Gordon-Rd', 'Route 3 - Gordon Rd', 'I-395 / I-95', 'Morning', 'Stafford / Fredericksburg', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Route 3 - Gordon Rd is a morning slug line location in Stafford / Fredericksburg serving the I-395 / I-95 corridor.', 38.2895891::numeric, -77.5634542::numeric, true, '5:30 AM - 7:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('route-17', 'Route-17', 'Route 17', 'I-395 / I-95', 'Morning', 'Stafford / Fredericksburg', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Route 17 is a morning slug line location in Stafford / Fredericksburg serving the I-395 / I-95 corridor.', 38.3461443::numeric, -77.5018604::numeric, true, '5:30 AM - 7:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('route-208', 'Route-208', 'Route 208', 'I-395 / I-95', 'Morning', 'Stafford / Fredericksburg', 'Pentagon, downtown DC, and Northern Virginia commuter destinations', 'Route 208 is a morning slug line location in Stafford / Fredericksburg serving the I-395 / I-95 corridor.', 38.25132::numeric, -77.508324::numeric, false, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('dale-city', 'Dale-City', 'Dale City', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, downtown DC, and Northern Virginia commuter destinations', 'Dale City is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.646938::numeric, -77.341232::numeric, false, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('horner-rd', 'Horner-Rd', 'Horner Rd', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Horner Rd is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.658592::numeric, -77.280746::numeric, true, '6:00 AM - 8:30 AM', null::text, array['Pentagon', 'L''Enfant Plaza', '14th Street']::text[], null::text[], null::text, null::text),
      ('montclair-fire-station', 'Montclair-Fire-Station', 'Montclair Fire Station', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Montclair Fire Station is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.62624::numeric, -77.348183::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/montclairslugs/', null::text),
      ('montclair-northgate', 'Montclair-Northgate', 'Montclair Northgate', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Montclair Northgate is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.6105087::numeric, -77.359309::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/montclairslugs/', null::text),
      ('old-hechingers', 'Old-Hechingers', 'Old Hechingers', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Old Hechingers is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.674301::numeric, -77.255623::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('potomac-mills', 'Potomac-Mills', 'Potomac Mills', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, Crystal City, Rosslyn, and DC', 'Potomac Mills is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.640717::numeric, -77.293884::numeric, true, '6:30 AM - 8:15 AM', 'Commuter parking around Potomac Mills Circle.', null::text[], array['The Pentagon', '15th Street & New York Ave', 'Rosslyn']::text[], 'https://www.facebook.com/groups/potomacmillssluglines/', null::text),
      ('route-123', 'Route-123', 'Route 123', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Route 123 is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.6701716::numeric, -77.2509748::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('route-234', 'Route-234', 'Route 234', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Route 234 is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.576817::numeric, -77.315826::numeric, true, '5:45 AM - 8:00 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('tacketts-mill', 'Tacketts-Mill', 'Tacketts Mill', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Tacketts Mill is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.675777::numeric, -77.276543::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('telegraph-rd', 'Telegraph-Rd', 'Telegraph Rd', 'I-395 / I-95', 'Morning', 'Prince William', 'Pentagon, L''Enfant Plaza, and 14th Street', 'Telegraph Rd is a morning slug line location in Prince William serving the I-395 / I-95 corridor.', 38.658051::numeric, -77.288749::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('route-610-mine-rd', 'Route-610-Mine-Rd', 'Route 610 - Mine Rd', 'I-395 / I-95', 'Morning', 'Stafford / Fredericksburg', 'Pentagon and L''Enfant Plaza', 'Route 610 - Mine Rd is a morning slug line location in Stafford / Fredericksburg serving the I-395 / I-95 corridor.', 38.4669945::numeric, -77.4160618::numeric, true, '5:30 AM - 7:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('route-610-staffordboro-blvd', 'Route-610-Staffordboro-Blvd', 'Route 610 - Staffordboro Blvd', 'I-395 / I-95', 'Morning', 'Stafford / Fredericksburg', 'Pentagon and L''Enfant Plaza', 'Route 610 - Staffordboro Blvd is a morning slug line location in Stafford / Fredericksburg serving the I-395 / I-95 corridor.', 38.4752647::numeric, -77.4129771::numeric, true, '5:30 AM - 7:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('route-630', 'Route-630', 'Route 630', 'I-395 / I-95', 'Morning', 'Stafford / Fredericksburg', 'Pentagon and L''Enfant Plaza', 'Route 630 is a morning slug line location in Stafford / Fredericksburg serving the I-395 / I-95 corridor.', 38.4212359::numeric, -77.4254927::numeric, true, '5:30 AM - 7:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('mark-center', 'Mark-Center', 'Mark Center', 'I-395 / I-95', 'Afternoon', 'Fairfax / Alexandria', 'Springfield, Lorton, and Fairfax-area lines', 'Mark Center is a afternoon slug line location in Fairfax / Alexandria serving the I-395 / I-95 corridor.', 38.8310454::numeric, -77.1176246::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/markcenterslugs/', null::text),
      ('tysons-corner', 'Tysons-Corner', 'Tysons Corner', 'I-395 / I-95', 'Afternoon', 'Fairfax / Alexandria', 'Fairfax and Springfield-area lines', 'Tysons Corner is a afternoon slug line location in Fairfax / Alexandria serving the I-395 / I-95 corridor.', 38.931906::numeric, -77.230132::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], null::text, null::text),
      ('crystal-city-12th-st', 'Crystal-City-12th-St', 'Crystal City 12th St', 'I-395 / I-95', 'Afternoon', 'Arlington', 'Fairfax, Prince William, and Stafford', 'Crystal City 12th St is a afternoon slug line location in Arlington serving the I-395 / I-95 corridor.', 38.8620732::numeric, -77.048738::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/crystalcitysluglines/', null::text),
      ('crystal-city-23rd-st', 'Crystal-City-23rd-St', 'Crystal City 23rd St', 'I-395 / I-95', 'Afternoon', 'Arlington', 'Fairfax, Prince William, and Stafford', 'Crystal City 23rd St is a afternoon slug line location in Arlington serving the I-395 / I-95 corridor.', 38.85238::numeric, -77.04964::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/crystalcitysluglines/', null::text),
      ('rosslyn', 'Rosslyn', 'Rosslyn', 'I-395 / I-95', 'Afternoon', 'Arlington', 'Northern Virginia corridors', 'Rosslyn is a afternoon slug line location in Arlington serving the I-395 / I-95 corridor.', 38.898092::numeric, -77.071726::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/rosslynsluglines/', null::text),
      ('the-pentagon', 'The-Pentagon', 'The Pentagon', 'I-395 / I-95', 'Afternoon', 'Arlington', 'All Northern Virginia corridors', 'The Pentagon is a afternoon slug line location in Arlington serving the I-395 / I-95 corridor.', 38.8680768::numeric, -77.0524506::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/pentagonsluglines/', null::text),
      ('14th-st-and-constitution-ave', '14th-St-and-Constitution-Ave', '14th St and Constitution Ave', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '14th St and Constitution Ave is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.889938::numeric, -77.032021::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('14th-st-and-g-st', '14th-St-and-G-St', '14th St and G St', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '14th St and G St is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.8981415::numeric, -77.0320751::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('14th-st-and-independence', '14th-St-and-Independence', '14th St and Independence', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '14th St and Independence is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.88733::numeric, -77.032156::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('14th-st-at-commerce-dept', '14th-St-at-Commerce-Dept', '14th St at Commerce Dept.', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '14th St at Commerce Dept. is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.89462::numeric, -77.03207::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('15th-st-and-new-york-ave', '15th-St-and-New-York-Ave', '15th St and New York Ave', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '15th St and New York Ave is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.8990078::numeric, -77.033381::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('19th-st-and-f-st', '19th-St-and-F-St', '19th St and F St', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '19th St and F St is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.896695::numeric, -77.043543::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('19th-st-and-i-st', '19th-St-and-I-St', '19th St and I St', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', '19th St and I St is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.900711::numeric, -77.043549::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('lenfant-plaza', 'LEnfant-Plaza', 'L''Enfant Plaza', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Fairfax, Prince William, and Stafford', 'L''Enfant Plaza is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.88489::numeric, -77.023402::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/lenfantslugs/', null::text),
      ('navy-yard', 'Navy-Yard', 'Navy Yard', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Northern Virginia commuter lots', 'Navy Yard is a afternoon slug line location in Washington DC serving the I-395 / I-95 corridor.', 38.8765811::numeric, -77.0014703::numeric, true, null::text, null::text, null::text[], null::text[], null::text, null::text),
      ('state-department', 'state-department', 'State Department', 'I-395 / I-95', 'Afternoon', 'Washington DC', 'Horner Rd and Telegraph Rd', 'A proposed pickup point the legacy page describes as "a new pickup location ... still explored". Its own comment thread records that the line never formed.', null::numeric, null::numeric, false, null::text, null::text, array['Horner Rd', 'Telegraph Rd']::text[], array['Horner Rd', 'Telegraph Rd']::text[], 'https://www.facebook.com/groups/dcsluglines/', 'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. Never operated. No coordinates on the legacy page.'),
      ('vienna-metro-south-knr', 'Vienna-Metro-South-KnR', 'Vienna Metro South KnR', 'I-66', 'Morning', 'Fairfax', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'Vienna Metro South KnR is a morning slug line location in Fairfax serving the I-66 corridor.', 38.8774069::numeric, -77.2706202::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], 'https://www.facebook.com/groups/viennaslugs/', null::text),
      ('fairfax-govt', 'Fairfax-Govt', 'Fairfax Govt', 'I-66', 'Morning', 'Fairfax', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'Fairfax Govt is a morning slug line location in Fairfax serving the I-66 corridor.', 38.8542902::numeric, -77.3604273::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('stringfellow-pnr', 'Stringfellow-PnR', 'Stringfellow PnR', 'I-66', 'Morning', 'Fairfax', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'Stringfellow PnR is a morning slug line location in Fairfax serving the I-66 corridor.', 38.854028::numeric, -77.404472::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('herndon-monroe-pnr', 'Herndon-Monroe-PnR', 'Herndon-Monroe PnR', 'I-66', 'Morning', 'Fairfax', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'Herndon-Monroe PnR is a morning slug line location in Fairfax serving the I-66 corridor.', 38.9513106::numeric, -77.3823065::numeric, true, '6:00 AM - 8:30 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('cushing-road', 'Cushing-Road', 'Cushing Road', 'I-66', 'Morning', 'Prince William', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'Cushing Road is a morning slug line location in Prince William serving the I-66 corridor.', 38.7950597::numeric, -77.563859::numeric, true, '5:45 AM - 8:00 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('east-gate', 'East-Gate', 'East Gate', 'I-66', 'Morning', 'Loudoun', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'East Gate is a morning slug line location in Loudoun serving the I-66 corridor.', 38.9119294::numeric, -77.4914467::numeric, true, '5:45 AM - 8:00 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('stone-ridge', 'Stone-Ridge', 'Stone Ridge', 'I-66', 'Morning', 'Loudoun', 'Pentagon, Rosslyn, and L''Enfant Plaza', 'Stone Ridge is a morning slug line location in Loudoun serving the I-66 corridor.', 38.938222::numeric, -77.555917::numeric, true, '5:45 AM - 8:00 AM', null::text, null::text[], null::text[], null::text, null::text),
      ('foggy-bottom', 'Foggy-Bottom', 'Foggy Bottom', 'I-66', 'Afternoon', 'Washington DC', 'Fairfax, Loudoun, and Prince William I-66 lines', 'Foggy Bottom is a afternoon slug line location in Washington DC serving the I-66 corridor.', 38.90075::numeric, -77.049611::numeric, true, '3:30 PM - 6:30 PM', null::text, null::text[], null::text[], null::text, null::text)
  ),
  upserted as (
    insert into public.locations (
        slug,
        route_slug,
        name,
        corridor,
        direction,
        county,
        destination,
        description,
        latitude,
        longitude,
        is_active,
        peak_hours,
        parking,
        lines_from,
        lines_to,
        community_url,
        notes
    )
    select
        seed.slug,
        seed.route_slug,
        seed.name,
        seed.corridor,
        seed.direction,
        seed.county,
        seed.destination,
        seed.description,
        seed.latitude,
        seed.longitude,
        seed.is_active,
        seed.peak_hours,
        seed.parking,
        seed.lines_from,
        seed.lines_to,
        seed.community_url,
        seed.notes
    from seed
    on conflict (slug) do update set
        route_slug = excluded.route_slug,
        name = excluded.name,
        corridor = excluded.corridor,
        direction = excluded.direction,
        county = excluded.county,
        destination = excluded.destination,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        is_active = excluded.is_active,
        peak_hours = excluded.peak_hours,
        parking = excluded.parking,
        lines_from = excluded.lines_from,
        lines_to = excluded.lines_to,
        community_url = excluded.community_url,
        notes = excluded.notes,
        updated_at = now()
      where (
          public.locations.route_slug,
          public.locations.name,
          public.locations.corridor,
          public.locations.direction,
          public.locations.county,
          public.locations.destination,
          public.locations.description,
          public.locations.latitude,
          public.locations.longitude,
          public.locations.is_active,
          public.locations.peak_hours,
          public.locations.parking,
          public.locations.lines_from,
          public.locations.lines_to,
          public.locations.community_url,
          public.locations.notes
      ) is distinct from (
          excluded.route_slug,
          excluded.name,
          excluded.corridor,
          excluded.direction,
          excluded.county,
          excluded.destination,
          excluded.description,
          excluded.latitude,
          excluded.longitude,
          excluded.is_active,
          excluded.peak_hours,
          excluded.parking,
          excluded.lines_from,
          excluded.lines_to,
          excluded.community_url,
          excluded.notes
      )
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted),
    count(*) filter (where not inserted)
  into v_inserted, v_updated
  from upserted;

  select count(*) into v_total from public.locations;

  -- The rev. 5.3 sec.11 P1 gate, enforced by the migration itself rather than
  -- only by a test: the seeded count must equal the inventory list length. A
  -- row added out of band fails here rather than silently surviving.
  if v_total <> 50 then
    raise exception
      'locations seed: expected % rows after seeding, found % -- the table has rows this migration did not write',
      50, v_total;
  end if;

  raise notice 'locations seed: % inserted, % updated, % total', v_inserted, v_updated, v_total;
end
$seed$;

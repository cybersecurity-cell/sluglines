#!/usr/bin/env node
// =============================================================================
// seed-locations.mjs -- generates supabase/migrations/0004_spot_locations_directory.sql
// from src/lib/domain/locations.ts.
//
// WHY THIS IS GENERATED RATHER THAN HAND-WRITTEN
// -----------------------------------------------------------------------------
// The spot inventory has to exist twice: once as TypeScript the app renders from
// and once as SQL the database is seeded from. Two hand-maintained copies of 50
// rows drift, and the drift is silent -- a spot renamed in one place and not the
// other produces a page that works and a row that is wrong, with no failure
// anywhere. So exactly one copy is authored (the domain module) and the other is
// derived, and `tests/spot-locations-directory.test.mjs` re-runs this generator
// and compares its output byte-for-byte with the committed .sql. Drift is a red
// test rather than a discovery.
//
// This script has no database connection and makes no network calls. It reads
// one module and writes one file. Applying the SQL it emits is a separate,
// separately authorised act -- see supabase/migrations/README.md.
//
// Usage:
//   node scripts/seed-locations.mjs            # --check (default)
//   node scripts/seed-locations.mjs --check    # exit 1 if the committed file is stale
//   node scripts/seed-locations.mjs --write    # regenerate the committed file
// Exit codes: 0 clean/written, 1 stale, 2 usage/IO error.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SPOT_LOCATIONS } from '../src/lib/domain/locations.ts'

export const MIGRATION_PATH = 'supabase/migrations/0004_spot_locations_directory.sql'

// Column list, in the order the table declares it. Used for the INSERT, the
// VALUES rows, the DO UPDATE SET clause and the change-detection tuple, so those
// four can never fall out of step with each other.
const SEED_COLUMNS = [
  'slug',
  'route_slug',
  'name',
  'corridor',
  'direction',
  'county',
  'destination',
  'description',
  'latitude',
  'longitude',
  'is_active',
  'peak_hours',
  'parking',
  'lines_from',
  'lines_to',
  'community_url',
  'notes',
]

// Everything except `slug`: the conflict target is never rewritten by its own
// upsert, and including it would make the change-detection tuple trivially equal.
const UPDATABLE_COLUMNS = SEED_COLUMNS.filter((column) => column !== 'slug')

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

const text = (value) => (value === undefined || value === null ? 'null::text' : quote(value))

const numeric = (value) =>
  value === undefined || value === null ? 'null::numeric' : `${value}::numeric`

const bool = (value) => (value ? 'true' : 'false')

const textArray = (value) =>
  value === undefined || value === null || value.length === 0
    ? 'null::text[]'
    : `array[${value.map(quote).join(', ')}]::text[]`

/**
 * One VALUES row. Every literal is cast explicitly, including the nulls: in a
 * VALUES list Postgres infers each column's type from the first row, so an
 * uncast null in row 1 would type the whole column as `unknown` and fail on the
 * first row that supplies a value.
 */
function renderRow(location) {
  const cells = [
    text(location.slug),
    text(location.routeSlug),
    text(location.name),
    text(location.corridor),
    text(location.direction),
    text(location.county),
    text(location.destination),
    text(location.description),
    numeric(location.latitude),
    numeric(location.longitude),
    bool(location.active),
    text(location.peakHours),
    text(location.parking),
    textArray(location.linesFrom),
    textArray(location.linesTo),
    text(location.fbUrl),
    text(location.notes),
  ]

  return `      (${cells.join(', ')})`
}

export function renderLocationsMigration(locations = SPOT_LOCATIONS) {
  const rows = locations.map(renderRow).join(',\n')
  const insertColumns = SEED_COLUMNS.map((column) => `        ${column}`).join(',\n')
  const selectColumns = SEED_COLUMNS.map((column) => `        seed.${column}`).join(',\n')
  const updateSet = UPDATABLE_COLUMNS.map(
    (column) => `        ${column} = excluded.${column}`
  ).join(',\n')
  const currentTuple = UPDATABLE_COLUMNS.map((column) => `          public.locations.${column}`).join(
    ',\n'
  )
  const proposedTuple = UPDATABLE_COLUMNS.map((column) => `          excluded.${column}`).join(',\n')

  return `-- =============================================================================
-- ${path.basename(MIGRATION_PATH)}
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied
--          2026-08-22 under the project owner's authorisation of 2026-08-21.
--          Rehearsed first on preview branch phase-3-4-staging (xqonrogwwytkmqfinszp).
--          See Docs/DECISIONS.md D-41 and supabase/migrations/README.md.
--
-- This header is emitted by the generator, not written into the .sql, because
-- the .sql is regenerated and compared byte-for-byte. Editing the file instead
-- would turn the guard red the next time anyone runs the generator.
--
-- GENERATED FILE -- DO NOT EDIT BY HAND.
--   Source:    src/lib/domain/locations.ts
--   Generator: scripts/seed-locations.mjs   (\`npm run seed:locations\`)
--   Guard:     tests/spot-locations-directory.test.mjs re-runs the generator and
--              compares the result with this file byte-for-byte.
-- Editing this file directly turns that test red; edit the domain module instead.
--
-- The rev. 5.3 sec.11 P1 spot directory: the table \`locations\`, the foreign keys
-- 0001 and 0002 both deferred to it by name, and the idempotent seed.
--
-- WHAT "THE 43 SPOTS" ACTUALLY ARE
-- -----------------------------------------------------------------------------
-- rev. 5.3 and Docs/DECISIONS.md both say "43 spots", taken from the content
-- inventory's \`slugPickupPages: 43\`. That total counts the \`/slug_pickup/\`
-- *index* page alongside the spot pages, so the legacy site has 42 spot pages,
-- not 43. This file seeds ${locations.length}: those 42, plus the ${
    locations.length - 42
  } spots the curated
-- directory has added since (chiefly the I-66 corridor, which the legacy site
-- never covered). The arithmetic and the evidence are in Docs/DECISIONS.md D-31;
-- the test asserts all 42 inventory slugs are present rather than asserting a
-- round number, because the inventory list is the thing the gate is about.
--
-- SECURITY POSTURE (rev. 5.3 sec.6, sec.12 constraints 2 and 6)
-- -----------------------------------------------------------------------------
-- Default deny, as everywhere else. RLS on; no insert/update/delete policy for
-- any role; nothing granted to \`anon\`. The directory is reference data, so it
-- has no SECURITY DEFINER writer at all -- the only way a row changes is a
-- migration, which is a stricter posture than the other tables, not a looser one.
--
-- The read policy is \`using (is_active)\` rather than \`using (true)\`, and that is
-- a real narrowing rather than a way past sql-lint's R6: an authenticated client
-- may read the spots it can actually offer or reserve a ride at. Inactive spots
-- stay in the table because 0002's offers reference them historically and the
-- legacy pages still describe them, but no client needs to enumerate them.
-- Anonymous read of the directory is rev. 5.3 sec.8 M1 Phase 2 work and arrives
-- with 0027's aggregate functions, under its own review.
--
-- IDEMPOTENCE
-- -----------------------------------------------------------------------------
-- The seed is a single upsert keyed on \`slug\`, with a \`where\` clause that skips
-- rows whose payload is unchanged. Re-running the file reports \`0 inserted,
-- 0 updated\` and touches no \`updated_at\`. The policy is dropped-if-exists before
-- creation and the constraint additions are guarded by catalogue lookups, so the
-- whole file is re-runnable -- 0001 and 0002 are not, and this one has to be,
-- because a seed that can only be applied once is a seed that can never be
-- corrected.
--
-- \`id\` is \`gen_random_uuid()\`, so location ids differ between environments. The
-- stable cross-environment key is \`slug\`; nothing should join on the uuid across
-- a dump boundary.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- locations  (rev. 5.3 sec.11 P1)
-- -----------------------------------------------------------------------------
create table if not exists public.locations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                  check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*\$'),
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

-- Dropped first so the whole file is re-runnable; \`create policy\` has no
-- \`if not exists\` form.
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
do \$fk\$
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
\$fk\$;


-- -----------------------------------------------------------------------------
-- The seed: ${locations.length} spots, generated from src/lib/domain/locations.ts.
--
-- Upsert on \`slug\`, skipping rows whose payload is unchanged, so a second run
-- reports 0/0 and moves no updated_at. \`xmax = 0\` distinguishes an inserted row
-- from an updated one in the RETURNING clause -- an inserted row has no previous
-- version, so its xmax is zero.
-- -----------------------------------------------------------------------------
do \$seed\$
declare
  v_inserted integer;
  v_updated  integer;
  v_total    integer;
begin
  with seed (${SEED_COLUMNS.join(', ')}) as (
    values
${rows}
  ),
  upserted as (
    insert into public.locations (
${insertColumns}
    )
    select
${selectColumns}
    from seed
    on conflict (slug) do update set
${updateSet},
        updated_at = now()
      where (
${currentTuple}
      ) is distinct from (
${proposedTuple}
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
  if v_total <> ${locations.length} then
    raise exception
      'locations seed: expected % rows after seeding, found % -- the table has rows this migration did not write',
      ${locations.length}, v_total;
  end if;

  raise notice 'locations seed: % inserted, % updated, % total', v_inserted, v_updated, v_total;
end
\$seed\$;
`
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
function main(argv) {
  const mode = argv.includes('--write') ? 'write' : 'check'
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const file = path.join(root, MIGRATION_PATH)
  const generated = renderLocationsMigration()

  if (mode === 'write') {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, generated)
    console.log(`seed-locations: wrote ${MIGRATION_PATH} (${SPOT_LOCATIONS.length} spots)`)
    return 0
  }

  if (!fs.existsSync(file)) {
    console.error(`seed-locations: ${MIGRATION_PATH} does not exist; run with --write`)
    return 1
  }

  if (fs.readFileSync(file, 'utf8') !== generated) {
    console.error(
      `seed-locations: ${MIGRATION_PATH} is stale.\n` +
        '  src/lib/domain/locations.ts has changed since it was generated.\n' +
        '  Re-run `npm run seed:locations` and review the diff before committing.'
    )
    return 1
  }

  console.log(`seed-locations: ${MIGRATION_PATH} is up to date (${SPOT_LOCATIONS.length} spots)`)
  return 0
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-locations.mjs')) {
  process.exit(main(process.argv.slice(2)))
}

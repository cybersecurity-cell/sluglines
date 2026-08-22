// The rev. 5.3 §11 P1 spot-directory gate.
//
// The measurement rev. 5.3 states is "43/43 spots, verified against the
// inventory list by slug, idempotent (second run: 0 inserts)". Two of those
// three are provable statically and are proved here; the third is provable only
// against a live Postgres, so what this file asserts is the *shape* that makes
// it true, and says so rather than implying more.
//
// On the number 43: the content inventory's `slugPickupPages: 43` counts the
// `/slug_pickup/` index page alongside the spot pages. The legacy site has 42
// spot pages. This file asserts the property the gate is actually about — every
// legacy spot slug is present — and pins the arithmetic so the off-by-one cannot
// be rediscovered as a surprise. See Docs/DECISIONS.md D-31.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import {
  SPOT_LOCATIONS,
  SPOT_LOCATION_COUNT,
  activeSpotLocations,
  canonicalSlug,
  findSpotLocation,
  groupSpotLocations,
  hasSpotLocation,
  inactiveSpotLocations,
  nearestSpotLocations,
  spotLocationDistance,
} from '../src/lib/domain/locations.ts'
import { SPOT_DIRECTORY, findSpotBySlug, getSpotDetailHref } from '../src/lib/spot-directory.ts'
import { renderLocationsMigration, MIGRATION_PATH } from '../scripts/seed-locations.mjs'

const root = process.cwd()
const migrationFile = path.join(root, MIGRATION_PATH)
const sql = fs.readFileSync(migrationFile, 'utf8')
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'src/data/legacy-site-content.json'), 'utf8'))

// -----------------------------------------------------------------------------
// The inventory arithmetic, stated rather than assumed
// -----------------------------------------------------------------------------
const slugPickupRoutes = legacy.routes.filter((route) => route.path.startsWith('/slug_pickup/'))
const spotPages = slugPickupRoutes.filter((route) => route.template === 'slug-page-code.php')
const indexPages = slugPickupRoutes.filter((route) => route.path === '/slug_pickup/')

assert.equal(legacy.totals.slugPickupPages, 43, 'the inventory total this repo has always quoted')
assert.equal(slugPickupRoutes.length, 43, 'and it is the count of /slug_pickup/** routes')
assert.equal(indexPages.length, 1, 'one of which is the directory index, not a spot')
assert.equal(spotPages.length, 42, 'so the legacy site publishes 42 spot pages')
assert.equal(indexPages.length + spotPages.length, legacy.totals.slugPickupPages, '42 + 1 = 43')

// -----------------------------------------------------------------------------
// Coverage: every legacy spot slug is in the directory
//
// This is the assertion rev. 5.3 asks for, in the form it asks for it — "by
// slug", not by count. The `≥40` tolerance it replaced "silently permitted
// losing three"; a count assertion permits losing one and gaining one.
// -----------------------------------------------------------------------------
const missing = spotPages.map((route) => route.slug).filter((slug) => !hasSpotLocation(slug))

assert.deepEqual(missing, [], `legacy spot pages absent from the directory: ${missing.join(', ')}`)

// The four that exist only in the legacy inventory are carried as inactive, and
// named here so that adding a fifth is a deliberate act rather than a diff nobody
// reads. Their legacy pages say so in their own words: two carry an "[Inactive]"
// title, one says "there are no sluglines at this time", one records in its own
// comment thread that the line never formed.
const LEGACY_ONLY = ['landmark-mall', 'springfield-town-center', 'state-department', 'van-dorn-st']

for (const slug of LEGACY_ONLY) {
  const location = findSpotLocation(slug)
  assert.ok(location, `${slug} must be in the directory`)
  assert.equal(location.active, false, `${slug} is legacy-only and must not be marked active`)
  assert.equal(location.latitude, null, `${slug} publishes no coordinate; it must not be guessed`)
  assert.equal(location.longitude, null)
  assert.match(location.notes ?? '', /Legacy-only/, `${slug} must record why it is here`)
}

// The other side of the same ledger: spots the curated directory adds that the
// legacy site never had. Asserted as a set difference rather than a count so a
// silent addition shows up as a failing diff.
const legacySlugs = new Set(spotPages.map((route) => route.slug))
const directoryOnly = SPOT_LOCATIONS.map((l) => l.slug)
  .filter((slug) => !legacySlugs.has(slug))
  .sort()

assert.deepEqual(
  directoryOnly,
  [
    'cushing-road',
    'east-gate',
    'fairfax-govt',
    'foggy-bottom',
    'herndon-monroe-pnr',
    'stone-ridge',
    'stringfellow-pnr',
    'vienna-metro-south-knr',
  ],
  'spots added since the legacy site: the I-66 corridor, which it never covered'
)

assert.equal(SPOT_LOCATION_COUNT, spotPages.length + directoryOnly.length, '42 legacy + 8 added = 50')
assert.equal(SPOT_LOCATION_COUNT, 50)

// -----------------------------------------------------------------------------
// The directory data itself
// -----------------------------------------------------------------------------
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const slugs = SPOT_LOCATIONS.map((location) => location.slug)
const routeSlugs = SPOT_LOCATIONS.map((location) => location.routeSlug)

assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique')
assert.equal(new Set(routeSlugs).size, routeSlugs.length, 'route slugs are unique')

for (const location of SPOT_LOCATIONS) {
  const where = `${location.slug}:`

  // The database enforces both of these as CHECK constraints. Asserting them
  // here means the seed cannot be written in a form the table would reject.
  assert.match(location.slug, SLUG_PATTERN, `${where} slug must match the table's CHECK`)
  assert.equal(location.routeSlug.toLowerCase(), location.slug, `${where} slug is lower(route_slug)`)

  assert.ok(['I-395 / I-95', 'I-66'].includes(location.corridor), `${where} corridor`)
  assert.ok(['Morning', 'Afternoon'].includes(location.direction), `${where} direction`)
  assert.ok(location.name.trim().length > 0 && location.name.length <= 80, `${where} name`)
  assert.ok(location.county.trim().length > 0 && location.county.length <= 60, `${where} county`)
  assert.ok(location.destination.trim().length > 0, `${where} destination`)
  assert.ok(location.description.trim().length > 0, `${where} description`)
  assert.equal(typeof location.active, 'boolean', `${where} active`)

  // locations_coordinates_paired, in TypeScript.
  assert.equal(
    location.latitude === null,
    location.longitude === null,
    `${where} a spot has both coordinates or neither`
  )

  if (location.latitude !== null) {
    // Northern Virginia and DC. A transposed sign or a swapped pair lands
    // outside this box, which is the failure mode worth catching.
    assert.ok(location.latitude > 38 && location.latitude < 39.5, `${where} latitude out of region`)
    assert.ok(location.longitude > -78 && location.longitude < -76.5, `${where} longitude out of region`)
  }
}

assert.equal(
  SPOT_LOCATIONS.filter((location) => location.latitude === null).length,
  LEGACY_ONLY.length,
  'exactly the legacy-only spots lack coordinates'
)
assert.equal(activeSpotLocations().length + inactiveSpotLocations().length, SPOT_LOCATION_COUNT)

// -----------------------------------------------------------------------------
// Query helpers
// -----------------------------------------------------------------------------
assert.equal(findSpotLocation('Horner-Rd')?.name, 'Horner Rd')
assert.equal(findSpotLocation('horner-rd')?.name, 'Horner Rd', 'lookup is case-insensitive')
assert.equal(findSpotLocation('  Horner-Rd  ')?.name, 'Horner Rd', 'and trims')
assert.equal(findSpotLocation('no-such-spot'), undefined)
assert.equal(canonicalSlug('Bobs-Old-Keene-Mill-Rd'), 'bobs-old-keene-mill-rd')

const groups = groupSpotLocations()
assert.deepEqual(groups.map((group) => group.corridor), ['I-395 / I-95', 'I-66'])
assert.equal(
  groups.flatMap((g) => g.directions.flatMap((d) => d.counties.flatMap((c) => c.locations))).length,
  SPOT_LOCATION_COUNT,
  'grouping partitions the directory: every spot appears exactly once'
)
for (const group of groups) {
  assert.deepEqual(
    group.directions.map((direction) => direction.direction),
    ['Morning', 'Afternoon'],
    `${group.corridor}: directions are emitted in commute-day order`
  )
}

// Distance: the Pentagon is nearest to itself, and a spot with no coordinate is
// never nearest — it is excluded rather than ranked.
const pentagon = findSpotLocation('The-Pentagon')
assert.ok(pentagon)
assert.equal(Math.round(spotLocationDistance(pentagon, { latitude: 38.8680768, longitude: -77.0524506 })), 0)
assert.equal(spotLocationDistance(findSpotLocation('landmark-mall'), { latitude: 38.86, longitude: -77.05 }), Infinity)

const nearest = nearestSpotLocations({ latitude: 38.8680768, longitude: -77.0524506 }, { limit: 3 })
assert.equal(nearest.length, 3)
assert.equal(nearest[0].location.slug, 'the-pentagon')
assert.ok(nearest[0].miles <= nearest[1].miles && nearest[1].miles <= nearest[2].miles, 'sorted ascending')
assert.equal(
  nearestSpotLocations({ latitude: 38.86, longitude: -77.05 }).length,
  SPOT_LOCATION_COUNT - LEGACY_ONLY.length,
  'uncoordinated spots are excluded from a distance ranking, not ranked last'
)

// -----------------------------------------------------------------------------
// The presentation adapter still behaves the way the components expect
// -----------------------------------------------------------------------------
assert.equal(SPOT_DIRECTORY.length, SPOT_LOCATION_COUNT)
assert.equal(findSpotBySlug('Horner-Rd')?.slug, 'Horner-Rd', 'route casing is preserved')
assert.equal(findSpotBySlug('horner-rd')?.slug, 'Horner-Rd')
assert.equal(getSpotDetailHref(findSpotBySlug('Horner-Rd')), '/spots/Horner-Rd')
// Inactive spots link to /spots as well: the legacy path is now a 301 into it
// (Docs/DECISIONS.md D-32), and rev. 5.3 §9 makes all 43 legacy spot URLs live
// landing pages rather than only the running ones.
assert.equal(getSpotDetailHref(findSpotBySlug('landmark-mall')), '/spots/landmark-mall')
assert.equal(
  SPOT_DIRECTORY.every((spot) => canonicalSlug(spot.slug) === findSpotLocation(spot.slug)?.slug),
  true,
  'every DirectorySpot round-trips to its domain record'
)

// -----------------------------------------------------------------------------
// The migration is generated, not hand-written
//
// This is the assertion that makes every claim above transfer to the database:
// the SQL is a pure function of the domain module, re-computed here and compared
// byte-for-byte. Editing the .sql by hand fails this; changing the .ts without
// regenerating fails this.
// -----------------------------------------------------------------------------
assert.equal(
  sql,
  renderLocationsMigration(),
  `${MIGRATION_PATH} is stale or hand-edited — run \`npm run seed:locations\``
)

assert.match(sql, /^-- =+\n-- 0004_spot_locations_directory\.sql/, 'names itself in its header')
// Was `APPLIED: no`. Issue #19 applied 0001-0007 to production on 2026-08-22
// (D-41); this file's header is emitted by the generator, so the state and its
// TARGET line are asserted here rather than in the .sql the guard regenerates.
assert.match(sql, /--\s*APPLIED:\s*production\b/, 'applied to production, D-41')
assert.match(sql, /--\s*TARGET:[\s\S]*?bwpguotjzczmieeepczf/, 'the header names the database it ran against')
assert.match(sql, /--\s*TARGET:[\s\S]{0,400}?2026-08-22/, 'and the date it ran')
assert.match(sql, /GENERATED FILE -- DO NOT EDIT BY HAND/)

// -----------------------------------------------------------------------------
// Seed shape: the row count, and idempotence as far as text can carry it
// -----------------------------------------------------------------------------
const seedBlock = sql.slice(sql.indexOf('do $seed$'))
assert.ok(seedBlock.length > 0, 'the seed is a single DO block')

const seedRows = seedBlock.split('\n').filter((line) => /^\s{6}\('[a-z0-9-]+', /.test(line))
assert.equal(seedRows.length, SPOT_LOCATION_COUNT, 'one VALUES row per directory entry')

for (const location of SPOT_LOCATIONS) {
  assert.ok(
    seedRows.some((row) => row.startsWith(`      ('${location.slug}', `)),
    `${location.slug} is missing from the seed`
  )
}

// Idempotence. The database proves this; the text proves the shape that makes it
// possible, which is what a static gate can honestly claim.
assert.match(seedBlock, /on conflict \(slug\) do update set/, 'upsert keyed on the natural key')
assert.match(seedBlock, /is distinct from/, 'unchanged rows are skipped, so a re-run reports 0/0')
assert.match(seedBlock, /returning \(xmax = 0\) as inserted/, 'inserted and updated are counted apart')
assert.match(seedBlock, /raise notice 'locations seed: % inserted, % updated, % total'/)
assert.match(
  seedBlock,
  new RegExp(`if v_total <> ${SPOT_LOCATION_COUNT} then`),
  'the migration asserts its own seeded count'
)

assert.match(sql, /create table if not exists public\.locations/)
assert.match(sql, /drop policy if exists locations_select_active on public\.locations;/)
assert.match(sql, /create index if not exists idx_locations_corridor_direction/)
assert.match(sql, /from pg_constraint/, 'constraint additions are guarded, so the file re-runs')

// -----------------------------------------------------------------------------
// Security posture, restated for this table specifically
//
// sql-lint's R3/R4/R5/R6/R7/R11 already cover this across the whole sequence.
// It is repeated here, table by table, for the reason tests/sql-migration-harness
// repeats it for the M3 tables: a rule engine passing is a weaker statement than
// a named assertion about the table an attacker would want.
// -----------------------------------------------------------------------------
// Negative assertions run against the statements only. The header comment
// explains the posture by quoting the shapes it rejects — `using (true)` among
// them — so a naive grep over the whole file would fail on its own rationale.
// Every comment in this generated file is a full `--` line, so dropping those is
// sufficient here; it is not a general SQL comment stripper.
const sqlCode = sql
  .split('\n')
  .filter((line) => !/^\s*--/.test(line))
  .join('\n')

assert.match(sql, /alter table public\.locations enable row level security;/)
assert.match(sql, /revoke all on table public\.locations from anon;/)
assert.match(sql, /revoke all on table public\.locations from authenticated;/)
assert.match(sql, /grant select on table public\.locations to authenticated;/)
assert.equal(
  /grant\s+(?!select\b)[a-z, ]*\bon\s+table\s+public\.locations/i.test(sqlCode),
  false,
  'only SELECT may be granted on locations'
)
assert.equal(/\bto\s+anon\b/i.test(sqlCode), false, 'nothing is granted to anon')
assert.equal(
  /create policy[\s\S]*?on public\.locations[\s\S]*?for\s+(insert|update|delete|all)\b/i.test(sqlCode),
  false,
  'the directory has no client write policy of any kind'
)
assert.match(
  sql,
  /create policy locations_select_active\s+on public\.locations\s+for select\s+to authenticated\s+using \(is_active\);/,
  'read is authenticated-only and narrowed to active spots'
)
assert.equal(/using \(true\)/i.test(sqlCode), false)

// The foreign keys 0001 and 0002 deferred here by name are added, NOT VALID, and
// the reason is in the file rather than only in the decision log.
for (const constraint of [
  'members_location_id_fkey',
  'presence_checkins_location_id_fkey',
  'offers_origin_location_id_fkey',
  'offers_destination_location_id_fkey',
]) {
  assert.ok(sql.includes(constraint), `${constraint} must be added by this migration`)
}
assert.match(sql, /not valid/, 'existing preview rows carry synthetic location ids; see the header')
assert.match(sql, /validate constraint offers_origin_location_id_fkey/, 'the follow-up is written down')

// -----------------------------------------------------------------------------
// rev. 5.3 §11 P1 boundary measurement: zero imports of lib/ai, repo-wide
//
// tests/domain-boundaries.test.mjs asserts the lib/domain half. This is the
// other half of the same gate, stated over all of src/: "grep: 0 lib/ai imports
// outside M8". M8 does not exist, so the permitted count is zero everywhere.
// -----------------------------------------------------------------------------
function collectSources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSources(full)
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [full] : []
  })
}

const AI_IMPORT = /(?:from|import\()\s*['"](?:@\/lib\/ai|(?:\.{1,2}\/)+(?:lib\/)?ai)(?:\/[^'"]*)?['"]/

const aiImporters = collectSources(path.join(root, 'src'))
  .concat(collectSources(path.join(root, 'scripts')))
  .concat(collectSources(path.join(root, 'tests')))
  .filter((file) => AI_IMPORT.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(root, file).replace(/\\/g, '/'))

assert.deepEqual(aiImporters, [], `lib/ai is imported by: ${aiImporters.join(', ')}`)
assert.equal(fs.existsSync(path.join(root, 'src/lib/ai')), false, 'lib/ai does not exist yet (D-10)')

console.log(
  `spot directory: ${SPOT_LOCATION_COUNT} spots seeded (${spotPages.length} legacy inventory + ` +
    `${directoryOnly.length} added), ${activeSpotLocations().length} active, 0 lib/ai imports`
)

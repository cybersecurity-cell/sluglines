// Transit stops schema (Option B slice 3, issue #90, Docs/DECISIONS.md D-70) —
// 0018's RLS posture and grants, static-checked the same way
// tests/incidents-schema.test.mjs and tests/lostfound-schema.test.mjs already
// check their own slices.
//
// sql:check / lintMigrations already prove the general default-deny shape
// across every migration; this file states the stops-specific properties
// directly so a future edit that narrows or widens either is a named failure
// rather than a silent drift.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const schema = migrations.find((m) => m.file === '0018_transit_stops.sql')
assert.ok(schema, '0018_transit_stops.sql must exist')

// -----------------------------------------------------------------------------
// Exactly one table, default-deny.
// -----------------------------------------------------------------------------
assert.deepEqual(
  schema.statements.filter((s) => s.kind === 'create_table').map((s) => s.table),
  ['public.stops'],
  '0018 creates exactly the stops table'
)

assert.ok(
  schema.statements.some((s) => s.kind === 'enable_rls' && s.table === 'public.stops'),
  'stops must enable row level security'
)

for (const role of ['anon', 'authenticated']) {
  assert.ok(
    schema.statements.some(
      (s) =>
        s.kind === 'revoke_table' &&
        s.table === 'public.stops' &&
        s.privileges.includes('all') &&
        s.roles.includes(role)
    ),
    `stops must revoke all from ${role} before granting anything back`
  )
}

const grants = schema.statements.filter((s) => s.kind === 'grant_table' && s.table === 'public.stops')
assert.ok(grants.length > 0, 'stops must state its grants explicitly')
for (const grant of grants) {
  assert.equal(grant.privileges.trim(), 'select', 'stops: only SELECT may be granted')
  assert.deepEqual(grant.roles, ['authenticated'], 'stops: SELECT may go to authenticated only')
}

// Exactly one SELECT policy, authenticated only, no unconditional predicate.
const policies = schema.statements.filter((s) => s.kind === 'create_policy' && s.table === 'public.stops')
assert.equal(policies.length, 1, 'stops must carry exactly one SELECT policy')
for (const policy of policies) {
  assert.equal(policy.command, 'select', `stops: policy "${policy.policy}" must be read-only`)
  assert.deepEqual(policy.roles, ['authenticated'], `stops: policy "${policy.policy}" must name authenticated`)
  assert.equal(policy.unconditional, false, `stops: policy "${policy.policy}" must not use a true predicate`)
}

// No insert/update/delete policy exists, for any role (R4) — stops is
// migration-seeded reference data in this slice, not a client write surface.
for (const policy of policies) {
  assert.notEqual(policy.command, 'insert')
  assert.notEqual(policy.command, 'update')
  assert.notEqual(policy.command, 'delete')
}

// Nothing in 0018 is reachable by an anonymous client at all.
for (const grant of schema.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0018 must grant nothing to ${role}: ${grant.flat}`)
  }
}

// location_id carries a real FK to public.locations.
assert.match(schema.sql, /location_id\s+uuid not null references public\.locations\s*\(id\)/i)

// is_lot exists, boolean, defaulting false.
assert.match(schema.sql, /is_lot\s+boolean not null default false/i)

// No functions are created by this file — stops has no write path in this
// slice at all, not even a SECURITY DEFINER one (the file header explains
// why: it ships empty, pending real per-location stop data).
assert.equal(
  schema.statements.some((s) => s.kind === 'create_function'),
  false,
  '0018 must not define any function'
)

// The table ships with no seed rows — no fabricated stop names, per the file
// header's explanation of why no authoritative per-location data exists yet.
assert.equal(
  /insert\s+into\s+public\.stops/i.test(schema.sql.replace(/^--.*$/gm, '')),
  false,
  '0018 must not seed any stops rows'
)

// stops is not wired into offers: this repo's offers table already references
// locations directly (origin_location_id/destination_location_id), and this
// migration must not touch it.
assert.equal(/\balter\s+table\s+public\.offers\b/i.test(schema.sql), false, '0018 must not alter public.offers')
assert.equal(/\bstop_id\b/i.test(schema.sql), false, '0018 must not add any stop_id column anywhere')

console.log('transit-stops-schema: all assertions passed')

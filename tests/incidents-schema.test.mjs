// Incidents schema (Option B slice 1, issue #90, Docs/DECISIONS.md D-68) —
// 0014/0015's RLS posture and function grants, static-checked the same way
// tests/sql-migration-harness.test.mjs already checks 0002's M3 tables.
//
// sql:check / lintMigrations already prove the general default-deny shape
// across every migration; this file states the incidents-specific properties
// directly, table by table and function by function, so a future edit that
// narrows or widens either is a named failure rather than a silent drift.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const schema = migrations.find((m) => m.file === '0014_incidents_schema.sql')
const functions = migrations.find((m) => m.file === '0015_incidents_functions.sql')

assert.ok(schema, '0014_incidents_schema.sql must exist')
assert.ok(functions, '0015_incidents_functions.sql must exist')

// -----------------------------------------------------------------------------
// 0014 — exactly the two tables, both default-deny.
// -----------------------------------------------------------------------------
const INCIDENT_TABLES = ['public.incidents', 'public.incident_confirmations']

assert.deepEqual(
  schema.statements
    .filter((s) => s.kind === 'create_table')
    .map((s) => s.table)
    .sort(),
  [...INCIDENT_TABLES].sort(),
  '0014 creates exactly the incidents and incident_confirmations tables'
)

for (const table of INCIDENT_TABLES) {
  assert.ok(
    schema.statements.some((s) => s.kind === 'enable_rls' && s.table === table),
    `${table} must enable row level security`
  )

  for (const role of ['anon', 'authenticated']) {
    assert.ok(
      schema.statements.some(
        (s) => s.kind === 'revoke_table' && s.table === table && s.privileges.includes('all') && s.roles.includes(role)
      ),
      `${table} must revoke all from ${role} before granting anything back`
    )
  }

  const grants = schema.statements.filter((s) => s.kind === 'grant_table' && s.table === table)
  assert.ok(grants.length > 0, `${table} must state its grants explicitly`)
  for (const grant of grants) {
    assert.equal(grant.privileges.trim(), 'select', `${table}: only SELECT may be granted`)
    assert.deepEqual(grant.roles, ['authenticated'], `${table}: SELECT may go to authenticated only`)
  }

  // Both tables carry a same-location policy and a moderator policy — never an
  // insert/update/delete policy, per R4: every write goes through 0015.
  const policies = schema.statements.filter((s) => s.kind === 'create_policy' && s.table === table)
  assert.equal(policies.length, 2, `${table} must carry exactly two SELECT policies (same-location, moderator)`)
  for (const policy of policies) {
    assert.equal(policy.command, 'select', `${table}: policy "${policy.policy}" must be read-only`)
    assert.deepEqual(policy.roles, ['authenticated'], `${table}: policy "${policy.policy}" must name authenticated`)
    assert.equal(policy.unconditional, false, `${table}: policy "${policy.policy}" must not use a true predicate`)
  }
}

// Nothing in 0014 is reachable by an anonymous client at all.
for (const grant of schema.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0014 must grant nothing to ${role}: ${grant.flat}`)
  }
}

// The moderator predicate is caller_is_moderator() (0002), never Sluglines-AI's
// is_moderator() — D-65's whole point for every table in this repo. Comment
// lines are stripped first: the header's own prose names is_moderator() when
// explaining the adaptation, which is documentation, not a policy predicate.
const schemaCode = schema.sql.replace(/^--.*$/gm, '')
assert.equal(/\bis_moderator\s*\(/i.test(schemaCode.replace(/caller_is_moderator/gi, '')), false)
assert.match(schemaCode, /caller_is_moderator\(\)/, '0014 policies must call caller_is_moderator()')

// incidents.location_id carries a real FK — unlike 0002 (written before 0004),
// the locations directory already exists by this ordinal.
assert.match(schema.sql, /location_id\s+uuid not null references public\.locations\s*\(id\)/i)

// -----------------------------------------------------------------------------
// 0015 — the write path. Every entry point is a SECURITY DEFINER function,
// granted to authenticated only; the sweep and the TTL helper are internal.
// -----------------------------------------------------------------------------
const CLIENT_ENTRY_POINTS = [
  'public.report_incident',
  'public.confirm_incident',
  'public.resolve_incident',
  'public.cancel_incident',
]
const INTERNAL_FUNCTIONS = ['public.incident_ttl_for_type', 'public.expire_stale_incidents']

const createdFns = functions.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
for (const fn of [...CLIENT_ENTRY_POINTS, ...INTERNAL_FUNCTIONS]) {
  assert.ok(createdFns.includes(fn), `${fn} must be created by 0015`)
}

const revokedFromPublic = new Set(
  functions.statements.filter((s) => s.kind === 'revoke_function' && s.roles.includes('public')).map((s) => s.fn)
)
for (const fn of createdFns) {
  assert.ok(revokedFromPublic.has(fn), `${fn} must be revoked from PUBLIC (Postgres grants EXECUTE to PUBLIC by default)`)
}

assert.deepEqual(
  functions.statements
    .filter((s) => s.kind === 'grant_function')
    .map((s) => s.fn)
    .sort(),
  [...CLIENT_ENTRY_POINTS].sort(),
  'exactly the four client entry points are granted execute, and only to authenticated'
)
for (const grant of functions.statements.filter((s) => s.kind === 'grant_function')) {
  assert.deepEqual(grant.roles, ['authenticated'], `execute on ${grant.fn} may only be granted to authenticated`)
}

// The sweep and the TTL helper are internal: never granted to any client role,
// same discipline as offer_expire_sweep()/apply_offer_transition() in 0002.
for (const internal of INTERNAL_FUNCTIONS) {
  assert.equal(
    functions.statements.some((s) => s.kind === 'grant_function' && s.fn === internal),
    false,
    `${internal} must not be granted to any client role`
  )
}

// Every SECURITY DEFINER function pins search_path (R8, restated directly).
for (const s of functions.statements) {
  if (s.kind === 'create_function' && s.securityDefiner) {
    assert.ok(s.pinsSearchPath, `${s.fn} is SECURITY DEFINER and must pin search_path`)
  }
}

// The schedule itself is deliberately absent (0008's precedent): a migration
// carrying cron.schedule would fail on any branch without pg_cron and would
// schedule production's sweep onto every preview branch. Comment lines are
// stripped first: the header's own prose explains this absence by naming
// cron.schedule, which is documentation, not a statement.
const functionsCode = functions.sql.replace(/^--.*$/gm, '')
assert.equal(/cron\.schedule|create extension\s+pg_cron/i.test(functionsCode), false,
  '0015 must not schedule the sweep — that is a supabase/operations/ concern, not a migration')

// record_audit_event (0001), never Sluglines-AI's log_audit_event, in the
// actual statements (comment lines are prose explaining the adaptation and
// legitimately name both).
assert.match(functionsCode, /record_audit_event\(/)
assert.equal(/log_audit_event\(/i.test(functionsCode), false)

console.log('incidents-schema: all assertions passed')

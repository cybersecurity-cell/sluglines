// Lost & found schema (Option B slice 2, issue #90, Docs/DECISIONS.md D-69) —
// 0016/0017's RLS posture and function grants, static-checked the same way
// tests/incidents-schema.test.mjs already checks 0014/0015.
//
// sql:check / lintMigrations already prove the general default-deny shape
// across every migration; this file states the lostfound-specific properties
// directly, table by table and function by function, so a future edit that
// narrows or widens either is a named failure rather than a silent drift.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const schema = migrations.find((m) => m.file === '0016_lostfound_schema.sql')
const functions = migrations.find((m) => m.file === '0017_lostfound_functions.sql')

assert.ok(schema, '0016_lostfound_schema.sql must exist')
assert.ok(functions, '0017_lostfound_functions.sql must exist')

// -----------------------------------------------------------------------------
// 0016 — exactly the three tables, all default-deny.
// -----------------------------------------------------------------------------
const LOSTFOUND_TABLES = ['public.lostfound_items', 'public.lostfound_claims', 'public.lostfound_messages']

assert.deepEqual(
  schema.statements
    .filter((s) => s.kind === 'create_table')
    .map((s) => s.table)
    .sort(),
  [...LOSTFOUND_TABLES].sort(),
  '0016 creates exactly the lostfound_items, lostfound_claims and lostfound_messages tables'
)

for (const table of LOSTFOUND_TABLES) {
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

  // No table carries an insert/update policy, for any role (R4) — every write
  // goes through 0017, including the report and message-send that Sluglines-AI
  // wrote as plain insert policies (0016's header explains why that would fail
  // R4 in this repo).
  const policies = schema.statements.filter((s) => s.kind === 'create_policy' && s.table === table)
  assert.ok(policies.length > 0, `${table} must carry at least one SELECT policy`)
  for (const policy of policies) {
    assert.equal(policy.command, 'select', `${table}: policy "${policy.policy}" must be read-only`)
    assert.deepEqual(policy.roles, ['authenticated'], `${table}: policy "${policy.policy}" must name authenticated`)
    assert.equal(policy.unconditional, false, `${table}: policy "${policy.policy}" must not use a true predicate`)
  }
}

// lostfound_items: same-location (active states), own, claimant, moderator.
assert.equal(
  schema.statements.filter((s) => s.kind === 'create_policy' && s.table === 'public.lostfound_items').length,
  4,
  'lostfound_items must carry exactly four SELECT policies (same-location, own, claimant, moderator)'
)

// lostfound_claims: claimant, item-reporter, moderator.
assert.equal(
  schema.statements.filter((s) => s.kind === 'create_policy' && s.table === 'public.lostfound_claims').length,
  3,
  'lostfound_claims must carry exactly three SELECT policies (claimant, item-reporter, moderator)'
)

// lostfound_messages: participant, moderator.
assert.equal(
  schema.statements.filter((s) => s.kind === 'create_policy' && s.table === 'public.lostfound_messages').length,
  2,
  'lostfound_messages must carry exactly two SELECT policies (participant, moderator)'
)

// Nothing in 0016 is reachable by an anonymous client at all.
for (const grant of schema.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0016 must grant nothing to ${role}: ${grant.flat}`)
  }
}

// The moderator predicate is caller_is_moderator() (0002), never Sluglines-AI's
// is_moderator() — same discipline as 0014's incidents-schema test. Comment
// lines are stripped first: the header's own prose names is_moderator() when
// explaining the adaptation, which is documentation, not a policy predicate.
const schemaCode = schema.sql.replace(/^--.*$/gm, '')
assert.equal(/\bis_moderator\s*\(/i.test(schemaCode.replace(/caller_is_moderator/gi, '')), false)
assert.match(schemaCode, /caller_is_moderator\(\)/, '0016 policies must call caller_is_moderator()')

// lostfound_items.location_id carries a real FK — same as 0014's
// incidents.location_id, since the locations directory already exists (0004).
assert.match(schema.sql, /location_id\s+uuid not null references public\.locations\s*\(id\)/i)

// The stop columns are deliberately absent — see 0016's header. Stated
// directly so a future edit re-adding them without the transit `stops` slice
// is caught here rather than only in prose.
assert.equal(/origin_stop_id|dest_stop_id/i.test(schemaCode), false,
  '0016 must not reference origin_stop_id/dest_stop_id — stops does not exist in this repo yet')
assert.equal(/\bstops\s*\(/i.test(schemaCode), false, '0016 must not reference a stops table')

// -----------------------------------------------------------------------------
// 0016's three recursion-breaking visibility helpers — SECURITY DEFINER,
// stable, and (unlike 0017's internal functions) granted directly to
// authenticated, because each is evaluated as part of the querying member's
// own SELECT rather than called from inside another SECURITY DEFINER function.
// -----------------------------------------------------------------------------
const VISIBILITY_HELPERS = [
  'public.lostfound_is_item_reporter',
  'public.lostfound_is_item_claimant',
  'public.lostfound_is_claim_participant',
]

const schemaCreatedFns = schema.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
for (const fn of VISIBILITY_HELPERS) {
  assert.ok(schemaCreatedFns.includes(fn), `${fn} must be created by 0016`)
}

assert.deepEqual(
  schema.statements
    .filter((s) => s.kind === 'grant_function')
    .map((s) => s.fn)
    .sort(),
  [...VISIBILITY_HELPERS].sort(),
  '0016 grants execute on exactly the three visibility helpers, and only to authenticated'
)
for (const grant of schema.statements.filter((s) => s.kind === 'grant_function')) {
  assert.deepEqual(grant.roles, ['authenticated'], `execute on ${grant.fn} may only be granted to authenticated`)
}

const schemaRevokedFromPublic = new Set(
  schema.statements.filter((s) => s.kind === 'revoke_function' && s.roles.includes('public')).map((s) => s.fn)
)
for (const fn of schemaCreatedFns) {
  assert.ok(schemaRevokedFromPublic.has(fn), `${fn} must be revoked from PUBLIC`)
}

// -----------------------------------------------------------------------------
// 0017 — the write path. Every entry point is a SECURITY DEFINER function,
// granted to authenticated only; the sweep is internal.
// -----------------------------------------------------------------------------
const CLIENT_ENTRY_POINTS = [
  'public.report_lostfound_item',
  'public.create_lostfound_claim',
  'public.respond_to_lostfound_claim',
  'public.withdraw_lostfound_claim',
  'public.send_lostfound_message',
  'public.reunite_lostfound_item',
  'public.cancel_lostfound_item',
]
const INTERNAL_FUNCTIONS = ['public.expire_stale_lostfound_items']

const createdFns = functions.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
for (const fn of [...CLIENT_ENTRY_POINTS, ...INTERNAL_FUNCTIONS]) {
  assert.ok(createdFns.includes(fn), `${fn} must be created by 0017`)
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
  'exactly the seven client entry points are granted execute, and only to authenticated'
)
for (const grant of functions.statements.filter((s) => s.kind === 'grant_function')) {
  assert.deepEqual(grant.roles, ['authenticated'], `execute on ${grant.fn} may only be granted to authenticated`)
}

// The sweep is internal: never granted to any client role, same discipline as
// expire_stale_incidents() in 0015.
for (const internal of INTERNAL_FUNCTIONS) {
  assert.equal(
    functions.statements.some((s) => s.kind === 'grant_function' && s.fn === internal),
    false,
    `${internal} must not be granted to any client role`
  )
}

// Every SECURITY DEFINER function pins search_path (R8, restated directly),
// across both 0016 and 0017.
for (const m of [schema, functions]) {
  for (const s of m.statements) {
    if (s.kind === 'create_function' && s.securityDefiner) {
      assert.ok(s.pinsSearchPath, `${s.fn} is SECURITY DEFINER and must pin search_path`)
    }
  }
}

// The schedule itself is deliberately absent (0008's precedent, restated by
// 0015 for incidents): a migration carrying cron.schedule would fail on any
// branch without pg_cron and would schedule production's sweep onto every
// preview branch. Comment lines are stripped first: the header's own prose
// explains this absence by naming cron.schedule, which is documentation, not
// a statement.
const functionsCode = functions.sql.replace(/^--.*$/gm, '')
assert.equal(/cron\.schedule|create extension\s+pg_cron/i.test(functionsCode), false,
  '0017 must not schedule the sweep — that is a supabase/operations/ concern, not a migration')

// record_audit_event (0001), never Sluglines-AI's log_audit_event, in the
// actual statements (comment lines are prose explaining the adaptation and
// legitimately name both).
assert.match(functionsCode, /record_audit_event\(/)
assert.equal(/log_audit_event\(/i.test(functionsCode), false)

// notification_outbox does not exist in this repo — 0017 must not reference
// it (0017's header explains why it was dropped from the source's functions).
assert.equal(/notification_outbox/i.test(functionsCode), false,
  '0017 must not reference notification_outbox — that table does not exist in this repo')

console.log('lostfound-schema: all assertions passed')

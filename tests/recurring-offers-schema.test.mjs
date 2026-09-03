// Recurring offers schema (Option B slice 4, issue #90, Docs/DECISIONS.md D-71) —
// 0019/0020's RLS posture, offers-table additions and function grants,
// static-checked the same way tests/incidents-schema.test.mjs,
// tests/lostfound-schema.test.mjs and tests/transit-stops-schema.test.mjs
// already check their own slices.
//
// The review-critical property of this slice is that instantiation reuses the
// M3 offer state machine rather than raw-inserting into public.offers — this
// file asserts that directly, not just the general default-deny shape sql:check
// already proves.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const schema = migrations.find((m) => m.file === '0019_recurring_offers_schema.sql')
const functions = migrations.find((m) => m.file === '0020_recurring_offer_functions.sql')

assert.ok(schema, '0019_recurring_offers_schema.sql must exist')
assert.ok(functions, '0020_recurring_offer_functions.sql must exist')

// -----------------------------------------------------------------------------
// 0019 — exactly the two new tables, all default-deny.
// -----------------------------------------------------------------------------
const RECURRING_TABLES = ['public.recurring_offer_templates', 'public.recurring_offer_skips']

assert.deepEqual(
  schema.statements
    .filter((s) => s.kind === 'create_table')
    .map((s) => s.table)
    .sort(),
  [...RECURRING_TABLES].sort(),
  '0019 creates exactly recurring_offer_templates and recurring_offer_skips'
)

for (const table of RECURRING_TABLES) {
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

  // R4: no insert/update/delete policy on either table, for any role — every
  // write goes through 0020's SECURITY DEFINER functions.
  const policies = schema.statements.filter((s) => s.kind === 'create_policy' && s.table === table)
  assert.equal(policies.length, 2, `${table} must carry exactly two SELECT policies (own, moderator)`)
  for (const policy of policies) {
    assert.equal(policy.command, 'select', `${table}: policy "${policy.policy}" must be read-only`)
    assert.deepEqual(policy.roles, ['authenticated'], `${table}: policy "${policy.policy}" must name authenticated`)
    assert.equal(policy.unconditional, false, `${table}: policy "${policy.policy}" must not use a true predicate`)
  }
}

// Nothing in 0019 is reachable by an anonymous client at all.
for (const grant of schema.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0019 must grant nothing to ${role}: ${grant.flat}`)
  }
}

// 0019 defines no functions of its own — every write is in 0020.
assert.equal(
  schema.statements.some((s) => s.kind === 'create_function'),
  false,
  '0019 must not define any function — writes belong in 0020'
)

const schemaCode = schema.sql.replace(/^--.*$/gm, '')

// The moderator predicate is caller_is_moderator() (0002), never Sluglines-AI's
// is_moderator().
assert.equal(/\bis_moderator\s*\(/i.test(schemaCode.replace(/caller_is_moderator/gi, '')), false)
assert.match(schemaCode, /caller_is_moderator\(\)/, '0019 policies must call caller_is_moderator()')

// -----------------------------------------------------------------------------
// The architectural adaptation: templates name locations, never stops.
// -----------------------------------------------------------------------------
assert.match(
  schemaCode,
  /origin_location_id\s+uuid not null references public\.locations\s*\(id\)/i,
  'recurring_offer_templates.origin_location_id must reference public.locations'
)
assert.match(
  schemaCode,
  /destination_location_id\s+uuid not null references public\.locations\s*\(id\)/i,
  'recurring_offer_templates.destination_location_id must reference public.locations'
)
assert.equal(
  /origin_stop_id|dest_stop_id/i.test(schemaCode),
  false,
  '0019 must not reference origin_stop_id/dest_stop_id — sluglines offers are location-keyed, not stop-keyed'
)
assert.equal(
  /\bstops\s*\(/i.test(schemaCode),
  false,
  '0019 must not reference the stops table (0018) at all — the two features are unrelated'
)

// poster_role is a plain text + CHECK, matching offers.poster_role (0002), not
// a new enum.
assert.match(schemaCode, /poster_role\s+text not null check \(poster_role in \('driver', 'rider'\)\)/i)

// -----------------------------------------------------------------------------
// offers gains exactly two columns plus the idempotency backstop index — the
// one deliberate exception to "this slice must not alter public.offers".
// -----------------------------------------------------------------------------
assert.match(
  schemaCode,
  /alter table public\.offers[\s\S]*?add column if not exists recurring_template_id uuid references public\.recurring_offer_templates\s*\(id\) on delete set null/i,
  'offers.recurring_template_id must be added, nullable, on delete set null'
)
assert.match(
  schemaCode,
  /add column if not exists occurrence_date date/i,
  'offers.occurrence_date must be added'
)
assert.match(
  schemaCode,
  /create unique index if not exists offers_recurring_occurrence_idx\s*\n?\s*on public\.offers \(recurring_template_id, occurrence_date\)\s*\n?\s*where \(recurring_template_id is not null\)/i,
  'offers_recurring_occurrence_idx must be a partial unique index on (recurring_template_id, occurrence_date)'
)

// recurring_offer_skips carries its own uniqueness guard against a duplicate
// skip of the same day.
assert.match(schemaCode, /unique \(template_id, occurrence_date\)/i)

console.log('recurring-offers-schema (0019): all assertions passed')

// -----------------------------------------------------------------------------
// 0020 — the write path. Five client entry points; two internal functions.
// -----------------------------------------------------------------------------
const CLIENT_ENTRY_POINTS = [
  'public.create_recurring_offer',
  'public.pause_recurring_offer',
  'public.resume_recurring_offer',
  'public.cancel_recurring_offer',
  'public.skip_recurring_offer_occurrence',
]
const INTERNAL_FUNCTIONS = ['public.offer_create_for_member', 'public.instantiate_recurring_offers']

const createdFns = functions.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
for (const fn of [...CLIENT_ENTRY_POINTS, ...INTERNAL_FUNCTIONS]) {
  assert.ok(createdFns.includes(fn), `${fn} must be created by 0020`)
}
assert.equal(createdFns.length, 7, '0020 must define exactly these seven functions — no unskip, no other extras')

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
  'exactly the five client entry points are granted execute, and only to authenticated'
)
for (const grant of functions.statements.filter((s) => s.kind === 'grant_function')) {
  assert.deepEqual(grant.roles, ['authenticated'], `execute on ${grant.fn} may only be granted to authenticated`)
}

for (const internal of INTERNAL_FUNCTIONS) {
  assert.equal(
    functions.statements.some((s) => s.kind === 'grant_function' && s.fn === internal),
    false,
    `${internal} must not be granted to any client role — it is reachable only from inside this file`
  )
}

// Every SECURITY DEFINER function pins search_path (R8, restated directly).
for (const m of [schema, functions]) {
  for (const s of m.statements) {
    if (s.kind === 'create_function' && s.securityDefiner) {
      assert.ok(s.pinsSearchPath, `${s.fn} is SECURITY DEFINER and must pin search_path`)
    }
  }
}

const functionsCode = functions.sql.replace(/^--.*$/gm, '')

// -----------------------------------------------------------------------------
// The review-critical property: instantiation preserves the offer state
// machine, idempotency and audit trail rather than bypassing them.
// -----------------------------------------------------------------------------

// offer_create() (0002) is left completely untouched — 0020 must not redefine
// it under its original signature. Only the new offer_create_for_member() may
// appear, and offer_create() itself must never be granted execute again here
// (which would indicate a second, competing definition).
assert.equal(
  /create\s+or\s+replace\s+function\s+public\.offer_create\s*\(/i.test(functionsCode),
  false,
  '0020 must not redefine public.offer_create() — see the file header for why'
)
assert.match(
  functionsCode,
  /create\s+or\s+replace\s+function\s+public\.offer_create_for_member\s*\(/i,
  '0020 must define offer_create_for_member() as a new, separate internal function'
)

// offer_create_for_member() claims and completes an idempotency key through
// the same 0002 machinery every client entry point uses.
const forMemberBody = /offer_create_for_member[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(forMemberBody, /claim_offer_operation\(/, 'offer_create_for_member must claim an idempotency key')
assert.match(forMemberBody, /complete_offer_operation\(/, 'offer_create_for_member must complete its idempotency claim')
assert.match(forMemberBody, /record_audit_event\(/, 'offer_create_for_member must write an audit event')
assert.equal(
  /auth\.uid\(\)/.test(forMemberBody),
  false,
  'offer_create_for_member must take its actor from the p_actor_id parameter, never auth.uid()'
)

// instantiate_recurring_offers() must never insert into offers directly — it
// creates through offer_create_for_member() and transitions through
// apply_offer_transition(), never a raw INSERT or a raw `update offers set
// state = ...`.
const sweepBody = /instantiate_recurring_offers[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(sweepBody, /offer_create_for_member\(/, 'instantiate_recurring_offers must create through offer_create_for_member()')
assert.match(sweepBody, /apply_offer_transition\(/, 'instantiate_recurring_offers must transition through apply_offer_transition()')
assert.equal(
  /insert\s+into\s+public\.offers/i.test(sweepBody),
  false,
  'instantiate_recurring_offers must never insert into public.offers directly'
)
assert.equal(
  /update\s+public\.offers\s+set\s+state/i.test(sweepBody),
  false,
  'instantiate_recurring_offers must never write offers.state directly — only apply_offer_transition() may'
)
// The deterministic per-(template, occurrence date) idempotency key, the
// application-level half of the "guarded twice" idempotency (the unique index
// in 0019 is the other half).
assert.match(sweepBody, /'recurring:'\s*\|\|/, 'instantiate_recurring_offers must build a deterministic idempotency key')

// cancel_recurring_offer() and skip_recurring_offer_occurrence() cascade
// through apply_offer_transition() too, never a raw state write.
for (const fnName of ['cancel_recurring_offer', 'skip_recurring_offer_occurrence']) {
  const body = new RegExp(`${fnName}[\\s\\S]*?\\$fn\\$([\\s\\S]*?)\\$fn\\$`, 'i').exec(functionsCode)[1]
  assert.match(body, /apply_offer_transition\(/, `${fnName} must cascade-cancel through apply_offer_transition()`)
  assert.equal(
    /update\s+public\.offers\s+set\s+state/i.test(body),
    false,
    `${fnName} must never write offers.state directly`
  )
}

// The schedule itself is deliberately absent (0008/0015/0017's precedent).
assert.equal(
  /cron\.schedule|create extension\s+pg_cron/i.test(functionsCode),
  false,
  '0020 must not schedule the sweep — that is a supabase/operations/ concern, not a migration'
)

// record_audit_event (0001), never Sluglines-AI's log_audit_event.
assert.match(functionsCode, /record_audit_event\(/)
assert.equal(/log_audit_event\(/i.test(functionsCode), false)

console.log('recurring-offers-schema (0020): all assertions passed')

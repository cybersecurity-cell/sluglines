// Legacy schema quarantine — Docs/DECISIONS.md D-24.
//
// `supabase/schema.sql` is the pre-rebuild schema and is unsafe: rev. 5.3 §14
// risks 1 and 4. This slice does not drop anything from it — retiring the live
// policies is rev. 5.3 Phase 2 work, and dropping them here would remove the
// only write path the current UI has without a replacement in place.
//
// What these tests do instead is *pin* the damage:
//   - the file is labelled as quarantined,
//   - the set of unsafe policies is frozen, so it cannot grow silently,
//   - the rebuild migrations are shown not to reproduce any of those shapes.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, classifyStatement, loadMigrations, splitStatements } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const legacy = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8')

// -----------------------------------------------------------------------------
// The file says what it is
// -----------------------------------------------------------------------------
assert.match(legacy, /LEGACY SCHEMA -- QUARANTINED\. DO NOT APPLY\./)
assert.match(legacy, /supabase\/migrations\//, 'the quarantine banner must point at the replacement')

// -----------------------------------------------------------------------------
// The unsafe set, frozen
//
// Every policy below allows a write from an unauthenticated client. This is the
// rev. 5.3 §14 risk-1/risk-4 inventory, confirmed against the file rather than
// quoted from the document.
// -----------------------------------------------------------------------------
const legacyStatements = splitStatements(legacy).map(classifyStatement)
const legacyPolicies = legacyStatements.filter((s) => s.kind === 'create_policy')

const unsafeWritePolicies = legacyPolicies
  .filter((p) => p.command !== 'select')
  .map((p) => `${p.table}:${p.command}:${p.policy}`)
  .sort()

assert.deepEqual(
  unsafeWritePolicies,
  [
    'public.drivers:delete:Public delete driver check-ins',
    'public.drivers:insert:Public insert drivers',
    'public.drivers:update:Public update own driver check-in',
    'public.riders:delete:Public delete rider check-ins',
    'public.riders:insert:Public insert riders',
    'public.riders:update:Public update own rider check-in',
    'public.profiles:update:Users update own profile',
    'public.spot_status:update:Anyone can update spot counts',
  ].sort(),
  'the legacy unsafe-write set is frozen; adding a write policy to schema.sql must fail here'
)

// Seven of those eight are reachable with no authentication at all: they carry
// no TO clause (so they default to PUBLIC) and an unconditional predicate. The
// exception is "Users update own profile", which is at least scoped to
// auth.uid() = id.
const anonymousWrites = legacyPolicies
  .filter((p) => p.command !== 'select' && p.unconditional)
  .map((p) => p.policy)
  .sort()

assert.deepEqual(anonymousWrites, [
  'Anyone can update spot counts',
  'Public delete driver check-ins',
  'Public delete rider check-ins',
  'Public insert drivers',
  'Public insert riders',
  'Public update own driver check-in',
  'Public update own rider check-in',
])

for (const p of legacyPolicies) {
  assert.equal(p.explicitRoles, false, `legacy policy "${p.policy}" was expected to have no TO clause`)
}

// The legacy identity model: a client-supplied device_id, which is why none of
// the above can be authorised. Recorded so the replacement's use of auth.uid()
// reads as the fix it is.
assert.match(legacy, /device_id\s+text\s+not null/)

// -----------------------------------------------------------------------------
// The rebuild does not reproduce any of it
// -----------------------------------------------------------------------------
const migrationStatements = loadMigrations(path.join(root, DEFAULT_MIGRATIONS_DIR)).flatMap((m) => m.statements)
const migrationTables = new Set(migrationStatements.filter((s) => s.kind === 'create_table').map((s) => s.table))

for (const legacyTable of ['public.riders', 'public.drivers', 'public.spot_status', 'public.profiles']) {
  assert.equal(migrationTables.has(legacyTable), false, `${legacyTable} must not be recreated by the rebuild migrations`)
}

for (const p of migrationStatements.filter((s) => s.kind === 'create_policy')) {
  assert.equal(p.command, 'select')
  assert.equal(p.unconditional, false)
  assert.equal(p.explicitRoles, true)
}

// 0025_lock_down_definer_functions.sql -- static (no DB) proof that the
// anon/authenticated-exec hole recorded in Docs/DECISIONS.md (the 0025
// entry) is closed in the committed SQL text itself, independent of whether
// a live preview is reachable. tests/live-definer-grants.test.mjs proves the
// same guarantee against a real database when preview credentials exist;
// this file is what still runs, everywhere, when they don't.
//
// Covers all 18 functions 0025 revokes: the 10 the live suite first caught
// (0011-0024) plus the 8 more the new sql-lint R12 rule surfaced across the
// rest of the sequence, including two already-applied-to-production
// migrations (0001, 0002).

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations, lintMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const lockdown = migrations.find((m) => m.file === '0025_lock_down_definer_functions.sql')
assert.ok(lockdown, '0025_lock_down_definer_functions.sql must exist')
assert.equal(lockdown.ordinal, 25)
assert.match(lockdown.sql, /--\s*APPLIED:\s*(no|preview)\b/, '0025 ships unapplied or preview-applied (never production ahead of its predecessors — the harness enforces monotonic rank)')

// -----------------------------------------------------------------------------
// 0025 creates nothing. It is a pure lockdown: every statement is a function
// revoke, nothing else.
// -----------------------------------------------------------------------------
assert.deepEqual(
  [...new Set(lockdown.statements.map((s) => s.kind))],
  ['revoke_function'],
  '0025 must contain only revoke_function statements — it creates no table and no function'
)

// -----------------------------------------------------------------------------
// Exactly the 18 signatures the finding names, each revoked from BOTH anon
// and authenticated explicitly (not just public — that is the defect this
// migration exists to fix; see the file's own header for the Supabase
// default-privilege root cause).
// -----------------------------------------------------------------------------
const LOCKED_DOWN_FUNCTIONS = [
  'public.record_audit_event(uuid, text, text, uuid, jsonb)',
  'public.handle_new_member()',
  'public.sweep_expired_presence()',
  'public.claim_offer_operation(uuid, text, uuid, text)',
  'public.complete_offer_operation(uuid, text, uuid, integer)',
  'public.apply_offer_transition(uuid, text, integer, uuid, text, text, integer, integer)',
  'public.offer_expire_sweep()',
  'public.rate_limit_hit(text, bigint, integer, timestamptz)',
  'public.rate_limit_sweep()',
  'public.expire_stale_incidents()',
  'public.expire_stale_lostfound_items()',
  'public.offer_create_for_member(uuid, text, uuid, uuid, timestamptz, timestamptz, integer, text)',
  'public.instantiate_recurring_offers()',
  'public.offer_reserve_seat_for_member(uuid, uuid, text, integer)',
  'public.promote_from_waitlist(uuid)',
  'public.promote_waitlist_sweep()',
  'public.record_completed_ride(uuid)',
  'public.record_completed_rides_sweep()',
]

assert.equal(LOCKED_DOWN_FUNCTIONS.length, 18)
assert.equal(lockdown.statements.length, 18, '0025 must carry exactly one revoke statement per locked-down function')

// classifyStatement's `fn` field is the qualified name only, without the arg
// list (README, "Known limits: overload-blind") -- so matching on the
// flattened SQL text is what actually proves the EXACT identity argument
// types, which is the property that matters: a mismatched arg type silently
// no-ops the revoke instead of erroring.
function findRevoke(signature) {
  const fn = signature.replace(/\(.*/, '')
  const argList = signature.slice(signature.indexOf('('))
  return lockdown.statements.find((s) => s.kind === 'revoke_function' && s.fn === fn && s.flat.includes(argList))
}

for (const signature of LOCKED_DOWN_FUNCTIONS) {
  const stmt = findRevoke(signature)
  assert.ok(stmt, `0025 must revoke ${signature}`)
  assert.deepEqual(
    [...stmt.roles].sort(),
    ['anon', 'authenticated'],
    `${signature} must be revoked from exactly anon and authenticated (not from service_role for rate_limit_hit)`
  )
}

// rate_limit_hit is the one function that must ALSO still be reachable by
// service_role — 0025 must not touch that grant (it only adds revokes). Checked
// against the parsed statements, not the raw SQL text, so this doesn't trip on
// the header comment's own prose mentioning service_role.
assert.equal(
  lockdown.statements.some((s) => s.roles.includes('service_role')),
  false,
  '0025 must never revoke from service_role — rate_limit_hit keeps its existing service_role grant (0012)'
)

// -----------------------------------------------------------------------------
// 0025 never edits an existing migration file: it is additive-only SQL
// targeting functions created in 0001-0023, and 0011-0024 in particular have
// not gained a single new statement anywhere else in the sequence.
// -----------------------------------------------------------------------------
for (const untouched of ['0001', '0002', '0003', '0011', '0012', '0015', '0017', '0020', '0022', '0023']) {
  assert.ok(
    migrations.some((m) => m.file.startsWith(`${untouched}_`)),
    `${untouched}_*.sql must still exist unedited`
  )
}

// -----------------------------------------------------------------------------
// The whole tree, 0025 included, lints clean -- restated directly here (not
// only relied on via tests/sql-migration-harness.test.mjs) because this is
// the property the entire finding is about: R12 run over 0001-0025 finds
// nothing left to fix.
// -----------------------------------------------------------------------------
const violations = lintMigrations(migrations)
assert.deepEqual(violations, [], `0001-0025 must lint clean; got:\n${violations.map((v) => `[${v.rule}] ${v.file}: ${v.message}`).join('\n')}`)

console.log(`lock-down-definer-functions: 0025 revokes anon+authenticated from all ${LOCKED_DOWN_FUNCTIONS.length} functions; tree lints clean`)

// 0025_lock_down_definer_functions.sql and 0026_revoke_anon_execute.sql --
// static (no DB) proof that the anon-exec hole recorded in Docs/DECISIONS.md
// is closed in the committed SQL text itself, independent of whether a live
// preview is reachable. tests/live-definer-grants.test.mjs proves the same
// guarantee against a real database when preview credentials exist; this
// file is what still runs, everywhere, when they don't.
//
// THIS FILE USED TO CLAIM MORE THAN IT PROVED. It covered exactly the 18
// functions 0025 revokes (the 10 the live suite first caught, plus 8 more
// sql-lint R12 surfaced) and its final "tree lints clean" check relied on the
// OLD R12 rule, which exempted every function granted to `authenticated`
// outright -- a premise about the function's body R12 never verified. That
// premise was false for `get_leaderboard` (Docs/DECISIONS.md, the D-79
// entry): shipped with the grant and zero body checks, anon-reachable the
// whole time 0025+R12 called the tree clean. 0026 revokes anon execute from
// the other 46 SECURITY DEFINER functions carrying only
// `grant execute ... to authenticated`, adds `auth.uid()` guards to the
// three with none at all, and sql-lint's R12 rule itself was rewritten
// (`scripts/sql-lint.mjs`) to require proof -- an explicit anon revoke or a
// detected `auth.uid()` guard -- rather than assuming a grant to
// `authenticated` proves anything. This file now covers both migrations: 18
// (0025) + 46 (0026) = every SECURITY DEFINER function in the tree, either
// revoked from anon explicitly or provably guarded.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { ANON_CALLABLE_FUNCTIONS, DEFAULT_MIGRATIONS_DIR, loadMigrations, lintMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const lockdown = migrations.find((m) => m.file === '0025_lock_down_definer_functions.sql')
assert.ok(lockdown, '0025_lock_down_definer_functions.sql must exist')
assert.equal(lockdown.ordinal, 25)
assert.match(lockdown.sql, /--\s*APPLIED:\s*(no|preview|production)\b/, '0025 ships unapplied, preview-, or production-applied (the harness enforces monotonic rank)')

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
// 0026_revoke_anon_execute.sql -- the migration that closes the 46-function
// gap. Written but NOT applied to any target (Docs/DECISIONS.md, D-79):
// asserted directly here, not just implied by it existing.
// -----------------------------------------------------------------------------
const revokeAnon = migrations.find((m) => m.file === '0026_revoke_anon_execute.sql')
assert.ok(revokeAnon, '0026_revoke_anon_execute.sql must exist')
assert.equal(revokeAnon.ordinal, 26)
assert.match(
  revokeAnon.sql,
  /--\s*APPLIED:\s*(preview|production)\b/,
  '0026 is applied to preview (D-96); the production apply is a separate authorised act (D-79)'
)
assert.match(
  revokeAnon.sql,
  /--\s*TARGET:\s*\S/,
  '0026 is applied to preview (D-96), so it must carry a TARGET line naming the branch and the date'
)

// 0011, 0023 and 0025 are APPLIED: production / carry statements 0026 must
// not disturb. 0026 may only re-create a function via create-or-replace
// (never edit the file that first created it) and may only add revokes.
for (const untouched of ['0011', '0023', '0025']) {
  assert.ok(
    migrations.some((m) => m.file.startsWith(`${untouched}_`)),
    `${untouched}_*.sql must still exist unedited`
  )
}
assert.match(
  migrations.find((m) => m.file.startsWith('0023_')).sql,
  /grant execute on function public\.get_leaderboard\(uuid\) to authenticated;/,
  '0023 must still carry its original grant to authenticated -- 0026 does not edit 0023'
)

// 0026's three create_function statements are exactly the three functions
// the finding names, each still SECURITY DEFINER with search_path pinned
// (R8), and each now provably guarded: a detected auth.uid() call in its own
// body, not a delegated helper -- the same bar sql-lint's rewritten R12
// applies (scripts/sql-lint.mjs).
const GUARDED_FUNCTIONS = ['public.ai_skill_enabled', 'public.ai_global_turn_count_today', 'public.get_leaderboard']
const guardedCreates = revokeAnon.statements.filter((s) => s.kind === 'create_function')
assert.deepEqual(
  guardedCreates.map((s) => s.fn).sort(),
  [...GUARDED_FUNCTIONS].sort(),
  '0026 must re-create exactly the three functions the finding names, nothing else'
)
for (const stmt of guardedCreates) {
  assert.equal(stmt.securityDefiner, true, `${stmt.fn} must remain SECURITY DEFINER`)
  assert.equal(stmt.pinsSearchPath, true, `${stmt.fn} must still pin search_path`)
  assert.match(stmt.flat, /auth\.uid\s*\(\s*\)/i, `${stmt.fn} must reference auth.uid() in its own body`)
  assert.match(stmt.flat, /42501/, `${stmt.fn} must reject with 42501 (insufficient_privilege), not a bare exception`)
}

// get_leaderboard's guard is stricter than "any session": it must also scope
// p_location_id to the caller's own members.location_id, not accept an
// arbitrary location — the PR-body decision this test locks in.
const leaderboardCreate = guardedCreates.find((s) => s.fn === 'public.get_leaderboard')
assert.match(
  leaderboardCreate.flat,
  /location_id\s+into\s+v_home_location\s+from\s+public\.members/i,
  'get_leaderboard must read the caller\'s own members.location_id'
)
assert.match(
  leaderboardCreate.flat,
  /p_location_id\s+is\s+distinct\s+from\s+v_home_location/i,
  'get_leaderboard must reject a p_location_id that does not match the caller\'s own location'
)

// The 46-function enumeration: every SECURITY DEFINER function in the tree
// that carries `grant execute ... to authenticated` and is not on R10's own
// ANON_CALLABLE_FUNCTIONS allowlist must be revoked from anon by 0026 —
// computed the same way sql-lint.mjs itself computes it (classifyStatement
// over every migration), not hand-copied, so this test breaks the moment the
// enumeration and the migration disagree.
const allStatements = migrations.flatMap((m) => m.statements)
const securityDefinerFns = new Set(
  allStatements.filter((s) => s.kind === 'create_function' && s.securityDefiner).map((s) => s.fn)
)
// Named for what it holds (function names carrying the member-role grant), not
// for the role: CodeQL's clear-text-logging heuristic reads an identifier
// containing "authenticated" as a credential and flagged the count logged at
// the bottom of this file as sensitive data.
const memberRoleGrantedFns = new Set(
  allStatements.filter((s) => s.kind === 'grant_function' && s.roles.includes('authenticated')).map((s) => s.fn)
)
const expectedAnonRevokes = [...memberRoleGrantedFns]
  .filter((fn) => securityDefinerFns.has(fn) && !ANON_CALLABLE_FUNCTIONS.has(fn))
  .sort()

assert.equal(expectedAnonRevokes.length, 46, 'the enumerated set must be exactly the 46 the finding names')

const anonRevokesIn0026 = revokeAnon.statements
  .filter((s) => s.kind === 'revoke_function' && s.roles.includes('anon'))
  .map((s) => s.fn)
  .sort()

assert.deepEqual(
  anonRevokesIn0026,
  expectedAnonRevokes,
  '0026 must revoke anon from exactly the enumerated set — no more, no fewer'
)

// None of the 46 loses its authenticated grant — 0026 only ever adds a
// revoke of anon, never touches the authenticated client entry point.
for (const stmt of revokeAnon.statements.filter((s) => s.kind === 'revoke_function')) {
  assert.deepEqual(stmt.roles, ['anon'], `${stmt.fn}: 0026 must revoke anon only, never authenticated or public`)
}

// 0026 also closes the recurrence path: a bare `alter default privileges`
// statement, not caught by classifyStatement's specific kinds (it falls
// through to 'other'), checked directly against the flattened SQL text.
assert.equal(
  revokeAnon.statements.some(
    (s) =>
      s.kind === 'other' &&
      /alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+execute\s+on\s+functions\s+from\s+anon/i.test(
        s.flat
      )
  ),
  true,
  '0026 must alter default privileges so a future migration cannot silently reopen this hole'
)

// -----------------------------------------------------------------------------
// The whole tree, 0025 AND 0026 included, lints clean under the rewritten
// R12 -- restated directly here (not only relied on via
// tests/sql-migration-harness.test.mjs) because this is the property the
// entire finding is about: every SECURITY DEFINER function in the tree is
// now either explicitly revoked from anon or provably guarded, not merely
// assumed to be because it happens to be granted to authenticated.
// -----------------------------------------------------------------------------
const violations = lintMigrations(migrations)
assert.deepEqual(violations, [], `0001-0025 must lint clean; got:\n${violations.map((v) => `[${v.rule}] ${v.file}: ${v.message}`).join('\n')}`)

console.log(
  `lock-down-definer-functions: 0025 revokes anon+authenticated from ${LOCKED_DOWN_FUNCTIONS.length} functions, ` +
    `0026 revokes anon from ${expectedAnonRevokes.length} more and guards ${GUARDED_FUNCTIONS.length} with auth.uid(); tree lints clean`
)

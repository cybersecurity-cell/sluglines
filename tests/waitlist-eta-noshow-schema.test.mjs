// Waitlist / ETA / no-show schema (Option B slice 5, issue #90) —
// 0021/0022's RLS posture, grants and promotion path, static-checked the same
// way tests/incidents-schema.test.mjs, tests/lostfound-schema.test.mjs and
// tests/recurring-offers-schema.test.mjs already check their own slices.
//
// The review-critical property of this slice is that waitlist promotion
// reuses the M3 offer state machine (offer_reserve_seat_for_member() ->
// apply_offer_transition()) rather than a raw insert/update into
// reservations/offers — this file asserts that directly, plus that
// report_no_show() never bypasses the choke point for the one offer mutation
// it does make.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const schema = migrations.find((m) => m.file === '0021_waitlist_eta_noshow_schema.sql')
const functions = migrations.find((m) => m.file === '0022_waitlist_eta_noshow_functions.sql')

assert.ok(schema, '0021_waitlist_eta_noshow_schema.sql must exist')
assert.ok(functions, '0022_waitlist_eta_noshow_functions.sql must exist')

// -----------------------------------------------------------------------------
// 0021 — exactly the three new tables, all default-deny.
// -----------------------------------------------------------------------------
const WAITLIST_TABLES = ['public.offer_waitlist', 'public.eta_updates', 'public.no_show_reports']

assert.deepEqual(
  schema.statements
    .filter((s) => s.kind === 'create_table')
    .map((s) => s.table)
    .sort(),
  [...WAITLIST_TABLES].sort(),
  '0021 creates exactly offer_waitlist, eta_updates and no_show_reports'
)

for (const table of WAITLIST_TABLES) {
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

  // R4: no insert/update/delete policy on any of the three tables, for any
  // role — every write goes through 0022's SECURITY DEFINER functions,
  // including leaving the waitlist (Sluglines-AI's own delete-own policy is
  // dropped; see the schema file's header).
  const policies = schema.statements.filter((s) => s.kind === 'create_policy' && s.table === table)
  assert.ok(policies.length > 0, `${table} must carry at least one SELECT policy`)
  for (const policy of policies) {
    assert.equal(policy.command, 'select', `${table}: policy "${policy.policy}" must be read-only`)
    assert.deepEqual(policy.roles, ['authenticated'], `${table}: policy "${policy.policy}" must name authenticated`)
    assert.equal(policy.unconditional, false, `${table}: policy "${policy.policy}" must not use a true predicate`)
  }
}

// Nothing in 0021 is reachable by an anonymous client at all.
for (const grant of schema.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0021 must grant nothing to ${role}: ${grant.flat}`)
  }
}

// 0021 defines no functions of its own — every write is in 0022.
assert.equal(
  schema.statements.some((s) => s.kind === 'create_function'),
  false,
  '0021 must not define any function — writes belong in 0022'
)

const schemaCode = schema.sql.replace(/^--.*$/gm, '')

// The moderator predicate is caller_is_moderator() (0002), never Sluglines-AI's
// is_moderator().
assert.equal(/\bis_moderator\s*\(/i.test(schemaCode.replace(/caller_is_moderator/gi, '')), false)
assert.match(schemaCode, /caller_is_moderator\(\)/, '0021 policies must call caller_is_moderator()')

// offer_waitlist's owner-visibility policy reuses 0002's recursion-breaking
// caller_owns_offer() helper rather than a fresh EXISTS subquery on offers.
assert.match(schemaCode, /caller_owns_offer\(offer_id\)/, 'offer_waitlist must reuse caller_owns_offer()')

// eta_updates's participant-visibility policy reuses 0002's
// caller_is_offer_participant() helper.
assert.match(schemaCode, /caller_is_offer_participant\(offer_id\)/, 'eta_updates must reuse caller_is_offer_participant()')

// -----------------------------------------------------------------------------
// The waitlist_state enum and the FIFO/uniqueness indexes.
// -----------------------------------------------------------------------------
assert.match(schemaCode, /create type public\.waitlist_state as enum \('ACTIVE', 'PROMOTED', 'CANCELLED'\)/i)

assert.match(
  schemaCode,
  /create unique index if not exists idx_offer_waitlist_active_rider\s*\n?\s*on public\.offer_waitlist \(offer_id, rider_id\)\s*\n?\s*where \(state = 'ACTIVE'\)/i,
  'offer_waitlist must carry a partial unique index on (offer_id, rider_id) for ACTIVE entries'
)
assert.match(
  schemaCode,
  /create index if not exists idx_offer_waitlist_offer_fifo/i,
  'offer_waitlist must carry a FIFO promotion index'
)

// offer_id columns cascade; the tables reference this repo's real column
// names (offers.poster_id via the offer_id FK target, not a stop or a
// Sluglines-AI-specific column).
for (const table of ['offer_waitlist', 'eta_updates', 'no_show_reports']) {
  assert.match(
    schemaCode,
    new RegExp(`create table if not exists public\\.${table} \\(`, 'i'),
    `${table} must be created`
  )
}
assert.match(schemaCode, /offer_id\s+uuid not null references public\.offers \(id\) on delete cascade/i)

// No stops dependency at all — unlike transit (0018) this slice references
// nothing from that table, and unlike recurring offers (0019) it needed no
// architectural adaptation because offers/reservations already exist in the
// shape this slice needs.
assert.equal(/\bstops\s*\(/i.test(schemaCode), false, '0021 must not reference the stops table')

// No confirmation-TTL columns and no notification_outbox writes — deliberately
// out of scope (see the schema file's header).
assert.equal(/must_confirm_by|ttl_prompt_sent_at/i.test(schemaCode), false, '0021 must not add confirmation-TTL columns')
assert.equal(/notification_outbox/i.test(schemaCode), false, '0021 must not reference notification_outbox')
assert.equal(/alter table public\.(offers|reservations)/i.test(schemaCode), false, '0021 must not alter offers or reservations')

console.log('waitlist-eta-noshow-schema (0021): all assertions passed')

// -----------------------------------------------------------------------------
// 0022 — the write path. Four client entry points; three internal functions.
// -----------------------------------------------------------------------------
const CLIENT_ENTRY_POINTS = [
  'public.offer_waitlist_join',
  'public.offer_waitlist_leave',
  'public.post_eta_update',
  'public.report_no_show',
]
const INTERNAL_FUNCTIONS = [
  'public.offer_reserve_seat_for_member',
  'public.promote_from_waitlist',
  'public.promote_waitlist_sweep',
]

const createdFns = functions.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
for (const fn of [...CLIENT_ENTRY_POINTS, ...INTERNAL_FUNCTIONS]) {
  assert.ok(createdFns.includes(fn), `${fn} must be created by 0022`)
}
assert.equal(createdFns.length, 7, '0022 must define exactly these seven functions')

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
// The review-critical property: promotion preserves the offer state machine,
// idempotency and audit trail rather than bypassing them.
// -----------------------------------------------------------------------------

// offer_reserve_seat() (0002) is left completely untouched — 0022 must not
// redefine it under its original signature. Only the new
// offer_reserve_seat_for_member() may appear.
assert.equal(
  /create\s+or\s+replace\s+function\s+public\.offer_reserve_seat\s*\(/i.test(functionsCode),
  false,
  '0022 must not redefine public.offer_reserve_seat() — see the file header for why'
)
assert.match(
  functionsCode,
  /create\s+or\s+replace\s+function\s+public\.offer_reserve_seat_for_member\s*\(/i,
  '0022 must define offer_reserve_seat_for_member() as a new, separate internal function'
)

// offer_reserve_seat_for_member() claims and completes an idempotency key
// through the same 0002 machinery every client entry point uses, and reaches
// state changes only through apply_offer_transition() — never a raw write.
const forMemberBody = /offer_reserve_seat_for_member[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(forMemberBody, /claim_offer_operation\(/, 'offer_reserve_seat_for_member must claim an idempotency key')
assert.match(forMemberBody, /complete_offer_operation\(/, 'offer_reserve_seat_for_member must complete its idempotency claim')
assert.match(forMemberBody, /apply_offer_transition\(/, 'offer_reserve_seat_for_member must transition through apply_offer_transition()')
assert.equal(
  /update\s+public\.offers\s+set\s+state/i.test(forMemberBody),
  false,
  'offer_reserve_seat_for_member must never write offers.state directly'
)
assert.equal(
  /auth\.uid\(\)/.test(forMemberBody),
  false,
  'offer_reserve_seat_for_member must take its actor from the p_actor_id parameter, never auth.uid()'
)
// It does write a reservation row directly — that part of offer_reserve_seat()
// has no state-machine choke point of its own (reservations.state is written
// directly by every M3 entry point, e.g. offer_confirm/offer_cancel in 0002).
assert.match(forMemberBody, /insert into public\.reservations/i, 'offer_reserve_seat_for_member must insert the reservation row')

// promote_from_waitlist() must never insert into reservations or write
// offers.state directly — only offer_reserve_seat_for_member() (and, through
// it, apply_offer_transition()) may.
const promoteBody = /promote_from_waitlist[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(promoteBody, /offer_reserve_seat_for_member\(/, 'promote_from_waitlist must promote through offer_reserve_seat_for_member()')
assert.equal(
  /insert\s+into\s+public\.reservations/i.test(promoteBody),
  false,
  'promote_from_waitlist must never insert into reservations directly'
)
assert.equal(
  /update\s+public\.offers\s+set\s+state/i.test(promoteBody),
  false,
  'promote_from_waitlist must never write offers.state directly'
)
assert.match(promoteBody, /skip locked/i, 'promote_from_waitlist must skip locked waitlist rows for cross-offer concurrency')

// promote_waitlist_sweep() drives promote_from_waitlist() and isolates each
// offer's attempt so one failure cannot abort the whole run.
const sweepBody = /promote_waitlist_sweep[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(sweepBody, /promote_from_waitlist\(/, 'promote_waitlist_sweep must call promote_from_waitlist()')
assert.match(sweepBody, /exception\s+when\s+others/i, 'promote_waitlist_sweep must isolate one offer\'s failure from the rest of the run')

// offer_waitlist_leave() soft-cancels rather than deleting (R4: no delete
// policy exists on offer_waitlist, so this must be the only way out).
const leaveBody = /offer_waitlist_leave[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(leaveBody, /set state = 'CANCELLED'/, 'offer_waitlist_leave must soft-cancel, not delete')
assert.equal(/delete\s+from\s+public\.offer_waitlist/i.test(leaveBody), false, 'offer_waitlist_leave must never hard-delete')

// report_no_show() reaches apply_offer_transition() for its one offer
// mutation (the "everyone no-showed" cancel), never a raw state write, and it
// must not call promote_from_waitlist() at all (see the file header for why).
const noShowBody = /report_no_show[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(functionsCode)[1]
assert.match(noShowBody, /apply_offer_transition\(/, 'report_no_show must cancel the offer through apply_offer_transition() when everyone no-showed')
assert.equal(
  /update\s+public\.offers\s+set\s+state/i.test(noShowBody),
  false,
  'report_no_show must never write offers.state directly'
)
assert.equal(
  /promote_from_waitlist\(/i.test(noShowBody),
  false,
  'report_no_show must not promote the waitlist — a confirmed offer has no OPEN/PARTIALLY_RESERVED edge to reopen into'
)

// The schedule itself is deliberately absent (0008/0015/0017/0020's precedent).
assert.equal(
  /cron\.schedule|create extension\s+pg_cron/i.test(functionsCode),
  false,
  '0022 must not schedule the sweep — that is a supabase/operations/ concern, not a migration'
)

// record_audit_event (0001), never Sluglines-AI's log_audit_event.
assert.match(functionsCode, /record_audit_event\(/)
assert.equal(/log_audit_event\(/i.test(functionsCode), false)

console.log('waitlist-eta-noshow-schema (0022): all assertions passed')

// -----------------------------------------------------------------------------
// 0029 — report_no_show is guarded (issue #138, D-88): ARRIVING or later, at
// most five reports per reporter per day, and the subject can read the row.
// Replace, not overload; 0022 is untouched (the assertions above still read it).
// -----------------------------------------------------------------------------
const guard = migrations.find((m) => m.file === '0029_no_show_report_guard.sql')
assert.ok(guard, '0029_no_show_report_guard.sql must exist')
const guardCode = guard.sql.replace(/^--.*$/gm, '')
for (const stmt of guard.statements.filter((st) => st.kind === 'create_function')) {
  assert.equal(stmt.securityDefiner, true, `${stmt.fn} must remain SECURITY DEFINER`)
  assert.equal(stmt.pinsSearchPath, true, `${stmt.fn} must still pin search_path`)
}
assert.match(guard.sql, /--\s*APPLIED:\s*no\b/, '0029 ships unapplied; applying it is a separate authorised act')

const noShowHeader0022 = /create or replace function public\.report_no_show\(([^)]*)\)\s*returns\s+(\w+)/i.exec(functionsCode)
const noShowHeader0029 = /create or replace function public\.report_no_show\(([^)]*)\)\s*returns\s+(\w+)/i.exec(guardCode)
assert.ok(noShowHeader0029, '0029 must re-create report_no_show')
assert.equal(noShowHeader0029[1].replace(/\s+/g, ' ').trim(), noShowHeader0022[1].replace(/\s+/g, ' ').trim(), 'same argument list, or it overloads instead of replacing')
assert.equal(noShowHeader0029[2], noShowHeader0022[2], 'same return type')

const guardedBody = /report_no_show[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(guardCode)[1]
assert.match(guardedBody, /auth\.uid\(\)/, 'still keyed on auth.uid()')

// 1. State: ARRIVING or PICKED_UP, never CONFIRMED.
assert.match(guardedBody, /if v_offer\.state not in \('ARRIVING', 'PICKED_UP'\) then/, 'a no-show is reportable only once the driver is arriving or has picked up')
assert.equal(/not in \('CONFIRMED'/.test(guardedBody), false)
assert.match(noShowBody, /not in \('CONFIRMED', 'ARRIVING', 'PICKED_UP'\)/, "0022's guard admitted CONFIRMED — the defect #138 names")

// 2. The per-reporter cap, before any write, raising the published PT429.
assert.match(guardedBody, /where r\.reported_by = v_actor\s+and r\.created_at > now\(\) - interval '1 day'/, 'the cap counts the reporter\'s own reports over a rolling day')
assert.match(guardedBody, /if v_reports_today >= 5 then/, 'five per day')
assert.match(guardedBody, /errcode = 'PT429'/, 'the cap raises LIMIT_REACHED')
assert.ok(
  guardedBody.indexOf('v_reports_today >= 5') < guardedBody.indexOf('update public.reservations'),
  'the cap is checked before the reservation is touched'
)

// Unchanged mechanics: poster only, reservation CONFIRMED, cancel through the
// choke point (now on ARRIVING, the first state where the branch can be true),
// never a raw offers.state write, never a waitlist promotion.
assert.match(guardedBody, /only the poster may report a no-show/)
assert.match(guardedBody, /if v_reservation\.state <> 'CONFIRMED' then/)
assert.match(guardedBody, /if v_offer\.state = 'ARRIVING' and v_live_count = 0 then/, 'everyone-no-showed cancels only when the driver is arriving with nobody left')
assert.match(guardedBody, /apply_offer_transition\(/)
assert.equal(/update\s+public\.offers\s+set\s+state/i.test(guardedBody), false)
assert.equal(/promote_from_waitlist\(/i.test(guardedBody), false)
assert.match(guardedBody, /record_audit_event\(v_actor, 'no_show\.reported'/)

// 3. The subject can read the row; still select-only, still `to authenticated`.
assert.match(guardCode, /create policy no_show_reports_select_subject\s+on public\.no_show_reports\s+for select\s+to authenticated\s+using \(rider_id = auth\.uid\(\)\)/i, 'the accused rider can read reports about them')
assert.equal(/create policy [^;]*for (insert|update|delete|all)/i.test(guardCode), false, 'no write policy, for any role')
assert.match(guardCode, /drop policy if exists no_show_reports_select_subject/, 're-runnable')

// Grants travel with the re-creation, on the exact signature.
assert.match(guardCode, /revoke all on function public\.report_no_show\(uuid\) from public;/)
assert.match(guardCode, /revoke all on function public\.report_no_show\(uuid\) from anon;/)
assert.match(guardCode, /grant execute on function public\.report_no_show\(uuid\) to authenticated;/)
assert.match(guardCode, /create index if not exists idx_no_show_reports_reporter\s+on public\.no_show_reports \(reported_by, created_at desc\)/i, 'the cap has an index')

console.log('waitlist-eta-noshow-schema (0029): all assertions passed')

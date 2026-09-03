// Ride history / leaderboard / dashboard summary (Option B slice 6, the last
// slice, issue #90) -- 0023/0024's RLS posture, grants and completion-recording
// path, static-checked the same way tests/incidents-schema.test.mjs,
// tests/lostfound-schema.test.mjs, tests/recurring-offers-schema.test.mjs and
// tests/waitlist-eta-noshow-schema.test.mjs already check their own slices.
//
// The review-critical property of this slice is that recording a completed
// ride never touches offers.state, offers.revision or reservations.state --
// offer_advance() (0002) is applied to production and frozen, so this file
// asserts record_completed_ride()/record_completed_rides_sweep() only read a
// terminal offer and insert into completed_rides, plus that
// get_dashboard_summary() is moderator-gated.

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { DEFAULT_MIGRATIONS_DIR, loadMigrations } from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const migrations = loadMigrations(migrationsDir)

const leaderboard = migrations.find((m) => m.file === '0023_ride_history_leaderboard.sql')
const dashboard = migrations.find((m) => m.file === '0024_dashboard_summary.sql')

assert.ok(leaderboard, '0023_ride_history_leaderboard.sql must exist')
assert.ok(dashboard, '0024_dashboard_summary.sql must exist')

// -----------------------------------------------------------------------------
// 0023 -- exactly two new tables, both default-deny.
// -----------------------------------------------------------------------------
const LEADERBOARD_TABLES = ['public.completed_rides', 'public.app_settings']

assert.deepEqual(
  leaderboard.statements
    .filter((s) => s.kind === 'create_table')
    .map((s) => s.table)
    .sort(),
  [...LEADERBOARD_TABLES].sort(),
  '0023 creates exactly completed_rides and app_settings'
)

for (const table of LEADERBOARD_TABLES) {
  assert.ok(
    leaderboard.statements.some((s) => s.kind === 'enable_rls' && s.table === table),
    `${table} must enable row level security`
  )

  for (const role of ['anon', 'authenticated']) {
    assert.ok(
      leaderboard.statements.some(
        (s) => s.kind === 'revoke_table' && s.table === table && s.privileges.includes('all') && s.roles.includes(role)
      ),
      `${table} must revoke all from ${role} before granting anything back`
    )
  }

  const grants = leaderboard.statements.filter((s) => s.kind === 'grant_table' && s.table === table)
  assert.ok(grants.length > 0, `${table} must state its grants explicitly`)
  for (const grant of grants) {
    assert.equal(grant.privileges.trim(), 'select', `${table}: only SELECT may be granted`)
    assert.deepEqual(grant.roles, ['authenticated'], `${table}: SELECT may go to authenticated only`)
  }

  // R4: no insert/update/delete policy on either table, for any role -- every
  // write goes through this file's SECURITY DEFINER functions.
  const policies = leaderboard.statements.filter((s) => s.kind === 'create_policy' && s.table === table)
  assert.ok(policies.length > 0, `${table} must carry at least one SELECT policy`)
  for (const policy of policies) {
    assert.equal(policy.command, 'select', `${table}: policy "${policy.policy}" must be read-only`)
    assert.deepEqual(policy.roles, ['authenticated'], `${table}: policy "${policy.policy}" must name authenticated`)
    assert.equal(policy.unconditional, false, `${table}: policy "${policy.policy}" must not use a true predicate`)
  }
}

// Nothing in 0023 is reachable by an anonymous client at all.
for (const grant of leaderboard.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0023 must grant nothing to ${role}: ${grant.flat}`)
  }
}

const leaderboardCode = leaderboard.sql.replace(/^--.*$/gm, '')

// The moderator predicate is caller_is_moderator() (0002), never Sluglines-AI's
// is_moderator().
assert.equal(/\bis_moderator\s*\(/i.test(leaderboardCode.replace(/caller_is_moderator/gi, '')), false)
assert.match(leaderboardCode, /caller_is_moderator\(\)/, '0023 must call caller_is_moderator()')

// record_audit_event (0001), never Sluglines-AI's log_audit_event.
assert.match(leaderboardCode, /record_audit_event\(/)
assert.equal(/log_audit_event\(/i.test(leaderboardCode), false)

// No stops dependency, and no origin/dest route columns -- see the migration
// header for why the route granularity is dropped rather than renamed onto
// locations.
assert.equal(/\bstops\s*\(/i.test(leaderboardCode), false, '0023 must not reference the stops table')
assert.equal(/alter table public\.(offers|reservations)/i.test(leaderboardCode), false, '0023 must not alter offers or reservations')

// completed_rides carries no second origin/dest location pair -- only the
// single location_id column, per the migration header's "drop the route
// granularity entirely" choice.
const completedRidesTableSql = /create table if not exists public\.completed_rides \(([\s\S]*?)\n\);/i.exec(leaderboardCode)[1]
assert.equal(
  /origin_stop_id|dest_stop_id|origin_location_id|dest(ination)?_location_id/i.test(completedRidesTableSql),
  false,
  '0023 must not carry a second origin/dest location pair on completed_rides -- location_id only'
)

// completed_rides carries a real FK to locations and a uniqueness guard that
// makes recording idempotent.
assert.match(
  leaderboardCode,
  /create table if not exists public\.completed_rides \(/i,
  'completed_rides must be created'
)
assert.match(leaderboardCode, /location_id\s+uuid not null references public\.locations \(id\)/i)
assert.match(leaderboardCode, /unique \(offer_id, member_id\)/i, 'completed_rides must be unique per (offer_id, member_id)')

console.log('leaderboard-dashboard-schema (0023 tables): all assertions passed')

// -----------------------------------------------------------------------------
// 0023 -- the six functions: two client-callable, four internal.
// -----------------------------------------------------------------------------
const LEADERBOARD_CLIENT_ENTRY_POINTS = ['public.get_leaderboard', 'public.set_app_setting']
const LEADERBOARD_INTERNAL_FUNCTIONS = [
  'public.mask_display_name',
  'public.record_completed_ride',
  'public.record_completed_rides_sweep',
]

const leaderboardFns = leaderboard.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
for (const fn of [...LEADERBOARD_CLIENT_ENTRY_POINTS, ...LEADERBOARD_INTERNAL_FUNCTIONS]) {
  assert.ok(leaderboardFns.includes(fn), `${fn} must be created by 0023`)
}
assert.equal(leaderboardFns.length, 5, '0023 must define exactly these five functions')

const leaderboardRevokedFromPublic = new Set(
  leaderboard.statements.filter((s) => s.kind === 'revoke_function' && s.roles.includes('public')).map((s) => s.fn)
)
for (const fn of leaderboardFns) {
  assert.ok(leaderboardRevokedFromPublic.has(fn), `${fn} must be revoked from PUBLIC`)
}

assert.deepEqual(
  leaderboard.statements
    .filter((s) => s.kind === 'grant_function')
    .map((s) => s.fn)
    .sort(),
  [...LEADERBOARD_CLIENT_ENTRY_POINTS].sort(),
  'exactly get_leaderboard and set_app_setting are granted execute, and only to authenticated'
)
for (const grant of leaderboard.statements.filter((s) => s.kind === 'grant_function')) {
  assert.deepEqual(grant.roles, ['authenticated'], `execute on ${grant.fn} may only be granted to authenticated`)
}

for (const internal of LEADERBOARD_INTERNAL_FUNCTIONS) {
  assert.equal(
    leaderboard.statements.some((s) => s.kind === 'grant_function' && s.fn === internal),
    false,
    `${internal} must not be granted to any client role`
  )
}

// Every SECURITY DEFINER function pins search_path (R8, restated directly).
for (const s of leaderboard.statements) {
  if (s.kind === 'create_function' && s.securityDefiner) {
    assert.ok(s.pinsSearchPath, `${s.fn} is SECURITY DEFINER and must pin search_path`)
  }
}

// -----------------------------------------------------------------------------
// The review-critical property: recording a completion never bypasses the
// state machine -- it makes no writes to offers or reservations at all.
// -----------------------------------------------------------------------------
const recordBody = /record_completed_ride[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(leaderboardCode)[1]
assert.match(recordBody, /v_offer\.state <> 'COMPLETED'/, 'record_completed_ride must require the offer already be COMPLETED')
assert.match(recordBody, /insert into public\.completed_rides/i, 'record_completed_ride must insert into completed_rides')
assert.equal(
  /update\s+public\.offers/i.test(recordBody),
  false,
  'record_completed_ride must never write to offers -- COMPLETED is terminal, nothing to transition'
)
assert.equal(
  /update\s+public\.reservations|insert\s+into\s+public\.reservations/i.test(recordBody),
  false,
  'record_completed_ride must never write to reservations'
)
assert.equal(
  /apply_offer_transition\(/i.test(recordBody),
  false,
  'record_completed_ride must not call apply_offer_transition() -- it makes no offer state change at all'
)
assert.match(recordBody, /on conflict \(offer_id, member_id\) do nothing/i, 'record_completed_ride must be idempotent per offer/member')
assert.match(recordBody, /state = 'CONFIRMED'/i, 'record_completed_ride must credit only riders whose reservation is still CONFIRMED')

const sweepBody = /record_completed_rides_sweep[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(leaderboardCode)[1]
assert.match(sweepBody, /record_completed_ride\(/, 'record_completed_rides_sweep must call record_completed_ride()')
assert.match(sweepBody, /state = 'COMPLETED'/i, 'record_completed_rides_sweep must scan COMPLETED offers')
assert.match(sweepBody, /exception\s+when\s+others/i, 'record_completed_rides_sweep must isolate one offer\'s failure from the rest of the run')

// The schedule itself is deliberately absent (0008/0015/0017/0020/0022's precedent).
assert.equal(
  /cron\.schedule|create extension\s+pg_cron/i.test(leaderboardCode),
  false,
  '0023 must not schedule the sweep -- that is a supabase/operations/ concern, not a migration'
)

// get_leaderboard aggregates across completed_rides via SECURITY DEFINER
// (RLS would otherwise restrict a caller to their own rows) and exposes only
// the masked name plus totals.
const leaderboardFnSig = /create or replace function public\.get_leaderboard[\s\S]*?returns table \(([\s\S]*?)\)\s*\n?language/i.exec(leaderboardCode)[1]
const leaderboardFnBody = /create or replace function public\.get_leaderboard[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(leaderboardCode)[1]
assert.match(leaderboardFnBody, /mask_display_name\(/i, 'get_leaderboard must return a masked name, not raw display_name')
assert.equal(
  /display_name/i.test(leaderboardFnSig),
  false,
  'get_leaderboard must not return a raw display_name column -- only masked_name'
)

// set_app_setting is the only writer of app_settings and re-checks
// caller_is_moderator() itself rather than relying on a client-visible RLS
// update policy (R4 has no carve-out for a moderator-checked update).
const setAppSettingBody = /set_app_setting[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(leaderboardCode)[1]
assert.match(setAppSettingBody, /caller_is_moderator\(\)/, 'set_app_setting must check caller_is_moderator()')
assert.match(setAppSettingBody, /update public\.app_settings/i, 'set_app_setting must update app_settings')
assert.equal(
  leaderboardCode.includes('app_settings_update_moderator'),
  false,
  '0023 must not carry a client-facing UPDATE policy on app_settings -- R4 has no moderator carve-out'
)

console.log('leaderboard-dashboard-schema (0023 functions): all assertions passed')

// -----------------------------------------------------------------------------
// 0024 -- no new table; one moderator-gated function.
// -----------------------------------------------------------------------------
assert.equal(
  dashboard.statements.some((s) => s.kind === 'create_table'),
  false,
  '0024 must create no new table'
)

const dashboardFns = dashboard.statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)
assert.deepEqual(dashboardFns, ['public.get_dashboard_summary'], '0024 must define exactly get_dashboard_summary')

assert.ok(
  dashboard.statements.some(
    (s) => s.kind === 'revoke_function' && s.fn === 'public.get_dashboard_summary' && s.roles.includes('public')
  ),
  'get_dashboard_summary must be revoked from PUBLIC'
)
assert.deepEqual(
  dashboard.statements
    .filter((s) => s.kind === 'grant_function')
    .map((s) => s.fn),
  ['public.get_dashboard_summary'],
  'get_dashboard_summary must be the only function granted execute'
)
for (const grant of dashboard.statements.filter((s) => s.kind === 'grant_function')) {
  assert.deepEqual(grant.roles, ['authenticated'], 'execute on get_dashboard_summary may only be granted to authenticated')
}

const dashboardDef = dashboard.statements.find((s) => s.kind === 'create_function')
assert.ok(dashboardDef.securityDefiner, 'get_dashboard_summary must be SECURITY DEFINER')
assert.ok(dashboardDef.pinsSearchPath, 'get_dashboard_summary must pin search_path')

const dashboardCode = dashboard.sql.replace(/^--.*$/gm, '')
const dashboardBody = /get_dashboard_summary[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(dashboardCode)[1]

// Moderator-gated: raises for a non-moderator caller rather than filtering
// results silently.
assert.match(dashboardBody, /if not public\.caller_is_moderator\(\) then/i, 'get_dashboard_summary must gate on caller_is_moderator()')
assert.match(dashboardBody, /raise exception/i, 'get_dashboard_summary must raise for a non-moderator caller')

// Every aggregated table must actually exist in this repo's migrations --
// moderation_reports (Sluglines-AI) is not among them.
for (const table of ['offers', 'completed_rides', 'incidents', 'lostfound_items', 'presence_checkins', 'offer_waitlist']) {
  assert.match(dashboardBody, new RegExp(`from public\\.${table}\\b`, 'i'), `get_dashboard_summary must aggregate over public.${table}`)
}
assert.equal(/moderation_reports/i.test(dashboardCode), false, '0024 must not reference moderation_reports -- it does not exist in this repo')
assert.equal(/is_moderator\s*\(\s*\)/i.test(dashboardCode.replace(/caller_is_moderator/gi, '')), false)

console.log('leaderboard-dashboard-schema (0024): all assertions passed')

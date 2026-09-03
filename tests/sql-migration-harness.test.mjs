// Migration harness tests — Docs/DECISIONS.md D-21..D-23.
//
// Two jobs:
//   1. The committed migrations satisfy the rev. 5.3 default-deny posture.
//   2. The analyser that proves (1) can actually fail. A gate that cannot fail
//      is a gate that only looks green (the D-10 lesson), so every rule is
//      exercised against a deliberately-unsafe in-memory fixture.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  ANON_CALLABLE_FUNCTIONS,
  DEFAULT_MIGRATIONS_DIR,
  analyzeSql,
  classifyStatement,
  lintMigrations,
  loadMigrations,
  splitStatements,
} from '../scripts/sql-lint.mjs'

const root = process.cwd()
const migrationsDir = path.join(root, DEFAULT_MIGRATIONS_DIR)
const rulesOf = (violations) => [...new Set(violations.map((v) => v.rule))].sort()

// -----------------------------------------------------------------------------
// Harness exists and is documented
// -----------------------------------------------------------------------------
assert.equal(fs.existsSync(migrationsDir), true, 'supabase/migrations must exist')
assert.equal(fs.existsSync(path.join(migrationsDir, 'README.md')), true, 'migrations README must exist')

const migrations = loadMigrations(migrationsDir)
assert.ok(migrations.length >= 1, 'at least one migration must be present')

// The sequence restarts at 0001 in this repo; rev. 5.3's 0025_* ordinal belongs
// to Sluglines-AI's sequence (Docs/DECISIONS.md D-22).
assert.equal(migrations[0].file, '0001_rebuild_foundation.sql')
assert.equal(migrations[0].ordinal, 1)

// -----------------------------------------------------------------------------
// Where each migration has been applied
//
// THE TRIPWIRE, AND WHY IT IS NOW A LEDGER INSTEAD
//
// This block has been rewritten twice, both times by the session that earned it.
// It began as "every file must say `APPLIED: no`", because nothing had a database
// to be applied to. D-28 gave the repo a preview branch and it became "no
// committed migration may claim production" -- a tripwire waiting for an
// authorisation that had not been given, and its own comment said so: "Production
// is applied by its own authorised session, which is the session that gets to
// change this test."
//
// That session was 2026-08-22 (issue #19, Docs/DECISIONS.md D-41). `0001`-`0007`
// are applied to bwpguotjzczmieeepczf. So the blanket refusal is relaxed --
// visibly, in the same diff as the apply, never quietly.
//
// What replaces it is stricter about everything the tripwire was not. A file may
// now say `production`, but only by carrying a TARGET line that names the ref and
// a date, and ONLY IF EVERY EARLIER ORDINAL SAYS IT TOO. That last rule is the
// one worth having: a sequence where 0006 is applied and 0004 is not is a
// database whose state no file describes, and it is the failure a blanket ban
// could never have caught because it forbade the safe case along with the unsafe
// one.
// -----------------------------------------------------------------------------
const PRODUCTION_REF = 'bwpguotjzczmieeepczf'
const PREVIEW_REF = 'xqonrogwwytkmqfinszp'
const RANK = { no: 0, preview: 1, production: 2 }

let previousRank = null

for (const m of migrations) {
  const applied = /--\s*APPLIED:\s*(no|preview|production)\b/.exec(m.sql)
  assert.ok(applied, `${m.file} must carry an APPLIED header line of no | preview | production`)

  const state = applied[1]

  // A file that claims a target must name it, or the header records nothing.
  if (state !== 'no') {
    assert.match(
      m.sql,
      /--\s*TARGET:\s*\S/,
      `${m.file} is APPLIED: ${state} and must carry a TARGET line naming the database`
    )
    const ref = state === 'production' ? PRODUCTION_REF : PREVIEW_REF
    assert.equal(m.sql.includes(ref), true, `${m.file} is APPLIED: ${state} and must name ${ref}`)
    assert.match(
      m.sql,
      /--\s*TARGET:[\s\S]{0,400}?\b20\d{2}-\d{2}-\d{2}\b/,
      `${m.file} is APPLIED: ${state} and its TARGET line must carry the date it was applied`
    )
  }

  // Monotonic down the sequence. 0006 applied over an unapplied 0004 is a
  // database no file in this directory describes.
  if (previousRank !== null) {
    assert.ok(
      RANK[state] <= previousRank,
      `${m.file} claims APPLIED: ${state} but an earlier ordinal claims less. ` +
        'A migration cannot have reached a target its predecessors have not.'
    )
  }
  previousRank = RANK[state]

  // Unchanged, and the reason is unchanged: a project ref belongs in a comment
  // recording where a file ran, never in a statement that would run against it.
  assert.equal(
    new RegExp(PRODUCTION_REF).test(m.sql.replace(/^--.*$/gm, '')),
    false,
    `${m.file} must not reference the production project ref outside comments`
  )
}

// -----------------------------------------------------------------------------
// Positive: the committed migrations lint clean
// -----------------------------------------------------------------------------
const violations = lintMigrations(migrations)
assert.deepEqual(
  violations,
  [],
  `committed migrations must pass sql-lint; got:\n${violations.map((v) => `[${v.rule}] ${v.file}: ${v.message}`).join('\n')}`
)

// -----------------------------------------------------------------------------
// Positive: no anonymous or authenticated direct table write, stated directly
// rather than only via the rule engine
// -----------------------------------------------------------------------------
const statements = migrations.flatMap((m) => m.statements)
const functions = statements.filter((s) => s.kind === 'create_function').map((s) => s.fn)

const tablesIn = (file) =>
  migrations
    .find((m) => m.file === file)
    .statements.filter((s) => s.kind === 'create_table')
    .map((s) => s.table)
    .sort()

assert.deepEqual(
  tablesIn('0001_rebuild_foundation.sql'),
  ['public.audit_events', 'public.members', 'public.presence_checkins'],
  'the foundation migration creates exactly the three rev. 5.3 §8 M2/M4/M7 tables'
)
assert.deepEqual(
  tablesIn('0002_ride_coordinator_state.sql'),
  [
    'public.offer_idempotency_keys',
    'public.offer_pickup_details',
    'public.offer_transitions',
    'public.offers',
    'public.reservations',
  ],
  'the M3 migration creates the state machine tables and the two rev. 5.3 §12 constraint 6 machinery tables'
)
assert.ok(functions.length >= 7, 'the write path is a set of SECURITY DEFINER functions')

for (const policy of statements.filter((s) => s.kind === 'create_policy')) {
  assert.equal(policy.command, 'select', `policy "${policy.policy}" must be read-only`)
  assert.deepEqual(policy.roles, ['authenticated'], `policy "${policy.policy}" must target authenticated only`)
  assert.equal(policy.unconditional, false, `policy "${policy.policy}" must not use a true predicate`)
}

for (const grant of statements.filter((s) => s.kind === 'grant_table')) {
  assert.equal(grant.privileges.trim(), 'select', `only SELECT may be granted on ${grant.table}`)
  assert.equal(grant.roles.includes('anon'), false, `nothing may be granted to anon on ${grant.table}`)
}

// R10's own exception, restated here rather than reused as a blanket pass: the
// two rev. 5.3 §8 M1 aggregate functions are anon-callable by explicit review
// (0005's own header); every other function is authenticated-only.
//
// One further, narrower exception (issue #55): `rate_limit_hit()` is callable
// by `service_role` only, never `anon` or `authenticated` — see
// `0012_durable_rate_limit.sql` for why a client that could call it directly
// could defeat or weaponise it. `service_role`'s key never reaches a browser,
// so this is not the anon-reachability R10 defends against; it is a distinct,
// deliberately narrow allowlist, checked explicitly rather than folded into
// ANON_CALLABLE_FUNCTIONS, which is specifically about the `anon` role.
const SERVICE_ROLE_ONLY_FUNCTIONS = new Set(['public.rate_limit_hit'])

for (const grant of statements.filter((s) => s.kind === 'grant_function')) {
  const expectedRoles = ANON_CALLABLE_FUNCTIONS.has(grant.fn)
    ? ['anon', 'authenticated']
    : SERVICE_ROLE_ONLY_FUNCTIONS.has(grant.fn)
      ? ['service_role']
      : ['authenticated']
  assert.deepEqual(grant.roles, expectedRoles, `execute on ${grant.fn} may only be granted to ${expectedRoles.join(', ')}`)
}

// Every SECURITY DEFINER function is revoked from PUBLIC. Without this, Postgres'
// default EXECUTE-to-PUBLIC grant makes the tables' default-deny irrelevant.
const revokedFromPublic = new Set(
  statements.filter((s) => s.kind === 'revoke_function' && s.roles.includes('public')).map((s) => s.fn)
)
for (const fn of functions) {
  assert.equal(revokedFromPublic.has(fn), true, `${fn} must be revoked from PUBLIC`)
}

// -----------------------------------------------------------------------------
// Positive: zero anonymous — and zero authenticated — direct table writes on the
// M3 tables, stated table by table rather than left to the aggregate loops above
//
// This is the property `sql:check` exists to prove, applied to the two tables
// rev. 5.3 §12 constraint 6 is about. `offers` and `reservations` are where a
// direct client write would be worth the most to an attacker: seats, state and
// participation are all decided by rows in them.
// -----------------------------------------------------------------------------
const M3_TABLES = [
  'public.offers',
  'public.reservations',
  'public.offer_pickup_details',
  'public.offer_transitions',
  'public.offer_idempotency_keys',
]

const rlsEnabledTables = statements.filter((s) => s.kind === 'enable_rls').map((s) => s.table)

for (const table of M3_TABLES) {
  assert.ok(rlsEnabledTables.includes(table), `${table} must enable row level security`)

  for (const role of ['anon', 'authenticated']) {
    assert.ok(
      statements.some(
        (s) => s.kind === 'revoke_table' && s.table === table && s.privileges.includes('all') && s.roles.includes(role)
      ),
      `${table} must revoke all from ${role} before granting anything back`
    )
  }

  const grants = statements.filter((s) => s.kind === 'grant_table' && s.table === table)
  assert.ok(grants.length > 0, `${table} must state its grants explicitly`)
  for (const grant of grants) {
    assert.equal(grant.privileges.trim(), 'select', `${table}: only SELECT may be granted`)
    assert.deepEqual(grant.roles, ['authenticated'], `${table}: SELECT may go to authenticated only`)
  }

  const policies = statements.filter((s) => s.kind === 'create_policy' && s.table === table)
  assert.equal(policies.length, 1, `${table} must carry exactly one policy`)
  for (const policy of policies) {
    assert.equal(policy.command, 'select', `${table}: policy "${policy.policy}" must be read-only`)
    assert.deepEqual(policy.roles, ['authenticated'], `${table}: policy "${policy.policy}" must name authenticated`)
    assert.equal(policy.unconditional, false, `${table}: policy "${policy.policy}" must not use a true predicate`)
  }
}

// Nothing in the M3 migration is reachable by an anonymous client at all: no
// grant of any kind, on any object, to anon or public.
const m3 = migrations.find((m) => m.file === '0002_ride_coordinator_state.sql')
for (const grant of m3.statements.filter((s) => s.kind === 'grant_table' || s.kind === 'grant_function')) {
  for (const role of ['anon', 'public']) {
    assert.equal(grant.roles.includes(role), false, `0002 must grant nothing to ${role}: ${grant.flat}`)
  }
}

// The client-callable surface of the M3 migration, enumerated. A new writer
// granted to authenticated has to be added here deliberately — which is the
// point, since every name on this list is a place a write decision is made.
assert.deepEqual(
  m3.statements
    .filter((s) => s.kind === 'grant_function')
    .map((s) => s.fn)
    .sort(),
  [
    'public.caller_has_confirmed_seat',
    'public.caller_is_moderator',
    'public.caller_is_offer_participant',
    'public.caller_owns_offer',
    'public.offer_advance',
    'public.offer_cancel',
    'public.offer_confirm',
    'public.offer_create',
    'public.offer_publish',
    'public.offer_release_seat',
    'public.offer_reserve_seat',
    'public.offer_set_pickup_details',
  ],
  'exactly these functions are granted to authenticated by 0002'
)

// The choke point and the sweep are internal: revoked from PUBLIC, granted to
// nobody. A client-callable apply_offer_transition() would bypass every
// authorisation check in the entry points that call it.
for (const internal of ['public.apply_offer_transition', 'public.offer_expire_sweep', 'public.offer_transition_allowed', 'public.claim_offer_operation', 'public.complete_offer_operation']) {
  assert.ok(functions.includes(internal), `${internal} must exist`)
  assert.equal(
    m3.statements.some((s) => s.kind === 'grant_function' && s.fn === internal),
    false,
    `${internal} must not be granted to any client role`
  )
}

// Negative: the same rules fire on an unsafe `offers` migration. Without this the
// block above only proves the committed file is clean, not that a dirty one
// would be caught (the D-10 lesson).
const unsafeOffers = rulesOf(
  lintMigrations([
    analyzeSql(
      '0001_unsafe_offers.sql',
      `create table public.offers (id uuid primary key, state text);
       create table public.reservations (id uuid primary key);
       alter table public.offers enable row level security;
       alter table public.reservations enable row level security;
       revoke all on table public.offers from anon;
       revoke all on table public.reservations from anon;
       create policy offers_write on public.offers for update to anon using (true);
       grant insert, update on table public.reservations to anon;`
    ),
  ])
)
assert.deepEqual(unsafeOffers, ['R4', 'R5', 'R6', 'R7'], 'an anonymous write path to offers/reservations must be caught')

// rev. 5.3 §12 constraint 3 — no phone or contact columns in application tables.
const migrationSql = migrations.map((m) => m.sql).join('\n').replace(/^--.*$/gm, '')
for (const forbidden of ['phone', 'phone_number', 'email', 'contact', 'device_id']) {
  assert.equal(
    new RegExp(`\\b${forbidden}\\s+(text|varchar|citext)\\b`, 'i').test(migrationSql),
    false,
    `migrations must not declare a ${forbidden} column`
  )
}

// -----------------------------------------------------------------------------
// Negative: each rule fires on an unsafe fixture
// -----------------------------------------------------------------------------

// R4 / R5 / R6 — the legacy "Public delete rider check-ins" shape.
const openWrite = rulesOf(
  lintMigrations([
    analyzeSql(
      '0001_open_write.sql',
      `create table public.riders (id uuid primary key);
       alter table public.riders enable row level security;
       revoke all on table public.riders from anon;
       create policy "Public delete rider check-ins" on public.riders for delete to anon using (true);`
    ),
  ])
)
assert.deepEqual(openWrite, ['R4', 'R5', 'R6'])

// R5 / R4 — an omitted TO clause defaults to PUBLIC, and an omitted FOR clause
// defaults to ALL. Both defaults must be read as permissive, not as unspecified.
const impliedDefaults = rulesOf(
  lintMigrations([
    analyzeSql(
      '0001_implied.sql',
      `create table public.t (id uuid primary key);
       alter table public.t enable row level security;
       revoke all on table public.t from anon;
       create policy t_all on public.t using (auth.uid() = id);`
    ),
  ])
)
assert.deepEqual(impliedDefaults, ['R4', 'R5'])

// R3 / R7 / R11 — no RLS, and a write privilege handed to anon.
const noRls = rulesOf(
  lintMigrations([
    analyzeSql(
      '0001_no_rls.sql',
      `create table public.spot_status (id uuid primary key);
       grant insert, update on table public.spot_status to anon;`
    ),
  ])
)
assert.deepEqual(noRls, ['R11', 'R3', 'R7']) // rulesOf() sorts lexically, so R11 precedes R3

// R8 / R9 / R12 — the default-EXECUTE-to-PUBLIC hole, an unpinned
// search_path, and (R12) no explicit revoke from anon/authenticated either.
const looseFunction = rulesOf(
  lintMigrations([
    analyzeSql(
      '0001_loose_fn.sql',
      `create or replace function public.wipe()
       returns void
       language plpgsql
       security definer
       as $$ begin delete from public.members; end; $$;`
    ),
  ])
)
assert.deepEqual(looseFunction, ['R12', 'R8', 'R9']) // rulesOf() sorts lexically, so R12 precedes R8/R9

// R10 — an anonymous execute grant.
const anonExecute = lintMigrations([
  analyzeSql(
    '0001_anon_exec.sql',
    `create or replace function public.f() returns void language sql set search_path = public as $$ select 1 $$;
     revoke all on function public.f() from public;
     grant execute on function public.f() to anon;`
  ),
])
assert.deepEqual(rulesOf(anonExecute), ['R10'])

// R12 — a SECURITY DEFINER function revoked from PUBLIC (satisfying R9) but
// never explicitly from anon/authenticated is still anon-reachable on
// Supabase, because anon/authenticated are not PUBLIC there (Docs/
// DECISIONS.md, the 0025 entry). `revoke ... from public` alone must not
// satisfy this rule — that is exactly the gap 0025 exists to close.
const definerNotRevokedFromAnon = rulesOf(
  lintMigrations([
    analyzeSql(
      '0001_internal_fn.sql',
      `create or replace function public.internal_sweep()
       returns void
       language plpgsql
       security definer
       set search_path = public, pg_temp
       as $$ begin delete from public.members where false; end; $$;
       revoke all on function public.internal_sweep() from public;`
    ),
  ])
)
assert.deepEqual(definerNotRevokedFromAnon, ['R12'])

// R12 is satisfied once the same function is explicitly revoked from anon
// and authenticated, even split across roles, and even in a LATER migration
// than the one that created it — the "0025 closes gaps in 0011-0024 without
// editing them" shape.
const definerRevokedAcrossMigrations = lintMigrations([
  analyzeSql(
    '0001_internal_fn.sql',
    `create or replace function public.internal_sweep()
     returns void
     language plpgsql
     security definer
     set search_path = public, pg_temp
     as $$ begin delete from public.members where false; end; $$;
     revoke all on function public.internal_sweep() from public;`
  ),
  analyzeSql(
    '0002_lock_down.sql',
    `revoke all on function public.internal_sweep() from anon, authenticated;`
  ),
])
assert.deepEqual(rulesOf(definerRevokedAcrossMigrations), [])

// R12 does not fire on a SECURITY DEFINER function granted to authenticated
// — that is the legitimate client entry point, governed by R10 instead.
const definerGrantedToAuthenticated = lintMigrations([
  analyzeSql(
    '0001_client_fn.sql',
    `create or replace function public.client_write()
     returns void
     language plpgsql
     security definer
     set search_path = public, pg_temp
     as $$ begin null; end; $$;
     revoke all on function public.client_write() from public;
     grant execute on function public.client_write() to authenticated;`
  ),
])
assert.deepEqual(rulesOf(definerGrantedToAuthenticated), [])

// R1 / R2 — filename and ordinal conventions.
assert.deepEqual(rulesOf(lintMigrations([analyzeSql('setup.sql', '')])), ['R1'])
assert.deepEqual(rulesOf(lintMigrations([analyzeSql('0025_product_events.sql', '')])), ['R2'])
assert.deepEqual(
  rulesOf(lintMigrations([analyzeSql('0001_a.sql', ''), analyzeSql('0003_b.sql', '')])),
  ['R2'],
  'a gap in the sequence is a violation'
)

// -----------------------------------------------------------------------------
// Scanner correctness — the reason a regex split was not good enough
// -----------------------------------------------------------------------------
const bodyWithSemicolons = `create or replace function public.f()
returns void language plpgsql as $$
begin
  perform 1;
  perform 2;
end;
$$;
select 1`
assert.equal(splitStatements(bodyWithSemicolons).length, 2, 'semicolons inside a $$ body must not split a statement')

assert.equal(splitStatements(`select 'a;b'; select 2`).length, 2, 'semicolons inside a string must not split a statement')
assert.equal(splitStatements(`-- create table x (y int);\nselect 1`).length, 1, 'commented-out SQL must be ignored')
assert.equal(splitStatements(`/* create table x; /* nested */ */ select 1`).length, 1, 'nested block comments must be ignored')

assert.equal(classifyStatement('create table if not exists members (id uuid)').table, 'public.members')
assert.equal(classifyStatement('CREATE TABLE Public."Members" (id uuid)').table, 'public.members')

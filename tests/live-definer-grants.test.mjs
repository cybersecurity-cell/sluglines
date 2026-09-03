// Live test for 0025_lock_down_definer_functions.sql — the anon/authenticated
// -exec hole recorded in Docs/DECISIONS.md (the 0025 entry). Same shape as
// live-rls.test.mjs/live-rate-limit.test.mjs: skips silently with no preview
// credentials, refuses to run against production, and proves a claim the
// static analyser (scripts/sql-lint.mjs R12) cannot — that anon really is
// refused by the *database*, not merely absent from a grant statement's text.
//
// PRECONDITION: 0025 (and its dependencies 0001-0024) must already be applied
// to the target branch. Until then this file still runs and still skips
// cleanly wherever .env.preview.local is absent.
//
// Covers all 18 SECURITY DEFINER functions 0025 locks down: the 10 the live
// suite first caught (0011-0024) plus the 8 more the R12 static rule
// surfaced by the same root cause elsewhere in the sequence, including two
// functions in 0001/0002 — already applied to PRODUCTION.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const PRODUCTION_REF = 'bwpguotjzczmieeepczf'
const ENV_FILE = '.env.preview.local'

function loadEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  return out
}

const fileEnv = loadEnvFile(path.join(process.cwd(), ENV_FILE))
const env = (key) => process.env[key] ?? fileEnv[key]

const SUPABASE_URL = env('SUPABASE_URL')
const ANON_KEY = env('SUPABASE_ANON_KEY')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.log(
    `live-definer-grants: SKIPPED — no preview credentials.\n` +
      `  Populate ${ENV_FILE} with:\n` +
      `    supabase branches get <branch> --project-ref ${PRODUCTION_REF} -o env > ${ENV_FILE}`
  )
  process.exit(0)
}

const supabaseUrl = new URL(SUPABASE_URL)
assert.equal(supabaseUrl.protocol, 'https:', `SUPABASE_URL must be https, got ${supabaseUrl.protocol}`)
assert.match(
  supabaseUrl.hostname,
  /^[a-z0-9]{20}\.supabase\.co$/,
  `SUPABASE_URL must be a supabase.co project host, got ${supabaseUrl.hostname}`
)
const targetRef = supabaseUrl.hostname.split('.')[0]
assert.notEqual(targetRef, PRODUCTION_REF, `refusing to run live tests against production (${PRODUCTION_REF})`)

console.log(`live-definer-grants: target preview project ${targetRef}`)

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(SUPABASE_URL, SERVICE_KEY, clientOpts)
const anon = createClient(SUPABASE_URL, ANON_KEY, clientOpts)

const uuid = () => randomUUID()
const now = new Date().toISOString()
const soon = new Date(Date.now() + 60_000).toISOString()

// Every SECURITY DEFINER function 0025 locks down, with argument shapes that
// match its signature exactly (values are dummy — a permission check happens
// before the function body ever runs, so what they contain does not matter).
const DEFINER_FUNCTIONS = [
  // 0001_rebuild_foundation.sql — applied to production.
  { name: 'record_audit_event', args: { p_actor_id: uuid(), p_action: 'test', p_entity_type: 'test' } },
  { name: 'handle_new_member', args: {} },
  { name: 'sweep_expired_presence', args: {} },
  // 0002_ride_coordinator_state.sql / 0003 — applied to production.
  {
    name: 'claim_offer_operation',
    args: { p_actor_id: uuid(), p_operation: 'test', p_offer_id: uuid(), p_idempotency_key: uuid() },
  },
  {
    name: 'complete_offer_operation',
    args: { p_actor_id: uuid(), p_idempotency_key: uuid(), p_offer_id: uuid(), p_result_revision: 1 },
  },
  {
    name: 'apply_offer_transition',
    args: {
      p_offer_id: uuid(),
      p_to_state: 'OPEN',
      p_expected_revision: 1,
      p_actor_id: uuid(),
      p_operation: 'test',
      p_idempotency_key: uuid(),
    },
  },
  { name: 'offer_expire_sweep', args: {} },
  // 0012_durable_rate_limit.sql — service_role ONLY (issue #55).
  { name: 'rate_limit_hit', args: { p_key: `live-definer-grants:${uuid()}`, p_window_ms: 60_000, p_max: 2, p_now: now } },
  { name: 'rate_limit_sweep', args: {} },
  // 0015_incidents_functions.sql
  { name: 'expire_stale_incidents', args: {} },
  // 0017_lostfound_functions.sql
  { name: 'expire_stale_lostfound_items', args: {} },
  // 0020_recurring_offer_functions.sql
  {
    name: 'offer_create_for_member',
    args: {
      p_actor_id: uuid(),
      p_poster_role: 'driver',
      p_origin_location_id: uuid(),
      p_destination_location_id: uuid(),
      p_window_start: now,
      p_window_end: soon,
      p_seats_total: 1,
      p_idempotency_key: uuid(),
    },
  },
  { name: 'instantiate_recurring_offers', args: {} },
  // 0022_waitlist_eta_noshow_functions.sql
  {
    name: 'offer_reserve_seat_for_member',
    args: { p_actor_id: uuid(), p_offer_id: uuid(), p_idempotency_key: uuid(), p_seats: 1 },
  },
  { name: 'promote_from_waitlist', args: { p_offer_id: uuid() } },
  { name: 'promote_waitlist_sweep', args: {} },
  // 0023_ride_history_leaderboard.sql
  { name: 'record_completed_ride', args: { p_offer_id: uuid() } },
  { name: 'record_completed_rides_sweep', args: {} },
]

assert.equal(DEFINER_FUNCTIONS.length, 18, 'this list must cover exactly the 18 functions 0025 locks down')

// PERMISSION_DENIED (42501) is the ONLY acceptable evidence of refusal here.
// The first draft of this test accepted any error, and that was wrong: an
// anon caller with EXECUTE still granted reaches the function body and can
// fail for an unrelated reason (a foreign key on a random dummy id, an
// idempotency-claim miss) that looks like a refusal but proves nothing about
// the grant — exactly the D-29 lesson tests/live-rls.test.mjs already
// applies to codeless failures, pushed one step further: not just "carries a
// SQLSTATE" but "carries *this* SQLSTATE". Running this file against the
// unpatched preview (before 0025 is applied) demonstrated the gap directly:
// several of these functions "passed" on a business-logic error while still
// being fully callable by anon.
//
// The one deliberate exception: handle_new_member() returns `trigger`, a
// pseudo-type PostgREST's schema cache never exposes as an RPC target
// (PGRST202, "could not find the function ... in the schema cache") —
// unreachable by protocol, independent of any grant, both before and after
// 0025. Revoking it is still correct defence in depth; the assertion for it
// just can't be 42501.
const PERMISSION_DENIED = '42501'
const NOT_RPC_EXPOSED_EXCEPTIONS = new Set(['handle_new_member'])

// The whole probe runs inside try/finally: a still-vulnerable rate_limit_hit
// (FAIL case) writes a real row to rate_limit_windows, and an assertion
// thrown from anywhere below must not skip cleaning that row up.
try {
  let failures = 0
  for (const { name, args } of DEFINER_FUNCTIONS) {
    const { error } = await anon.rpc(name, args)
    if (!error) {
      failures += 1
      console.error(`  FAIL anon.${name}(): expected refusal, the call unexpectedly SUCCEEDED`)
      continue
    }
    if (error.code !== PERMISSION_DENIED && !NOT_RPC_EXPOSED_EXCEPTIONS.has(name)) {
      failures += 1
      console.error(
        `  FAIL anon.${name}(): refused, but NOT by a permission check ` +
          `(${error.code ?? 'no-code'}: ${error.message}) — this proves the call reached the function body, ` +
          'meaning EXECUTE is still granted to anon'
      )
      continue
    }
    console.log(`  ok  anon.${name}() refused: ${error.code ?? 'no-code'}: ${error.message}`)
  }
  assert.equal(failures, 0, `${failures} of ${DEFINER_FUNCTIONS.length} function(s) were callable by anon — see FAIL lines above`)

  // rate_limit_hit keeps its service_role grant — 0025 revokes anon/authenticated
  // only. Full positive coverage (window/cap behaviour) lives in
  // tests/live-rate-limit.test.mjs; this is a narrow symmetry check that 0025
  // did not also revoke the one grant this function is supposed to keep.
  const serviceRoleStillWorks = await service.rpc('rate_limit_hit', {
    p_key: `live-definer-grants:service-role-smoke:${uuid()}`,
    p_window_ms: 60_000,
    p_max: 5,
    p_now: now,
  })
  assert.equal(serviceRoleStillWorks.error, null, `service_role must still call rate_limit_hit: ${serviceRoleStillWorks.error?.message}`)
  console.log('  ok  service_role: rate_limit_hit still callable after 0025')
} finally {
  await service.from('rate_limit_windows').delete().like('bucket_key', 'live-definer-grants:%')
}

console.log('live-definer-grants: ok')

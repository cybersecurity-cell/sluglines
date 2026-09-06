// Live RLS integration tests — Docs/DECISIONS.md D-28.
//
// This is the suite supabase/migrations/README.md promises and deliberately did
// not have: "positive/negative RLS tests need a live Postgres, and the live suite
// is added when a target database exists". It exists now — the preview branch
// named in supabase/config.toml — so this file makes the claim the static
// analyser cannot make.
//
// What sql-lint.mjs proves:  the SQL text contains no shape that could grant a
//                            client a direct table write.
// What this file proves:     a real anonymous client and a real authenticated
//                            client, speaking PostgREST over the network with
//                            real JWTs, are actually refused those writes, and
//                            the SECURITY DEFINER entry points actually work.
//
// Those are different claims (README: "conflating them is exactly the failure
// supabase/schema.sql represents"), and only the second one is evidence that a
// policy *behaves*.
//
// SAFETY
// -----------------------------------------------------------------------------
// This suite creates and deletes auth users and writes rows. It refuses to run
// against the production project ref under any circumstances — see the guard
// below, which is the first thing that executes. It skips silently when no
// preview credentials are present, so `npm run test` stays green on a checkout
// that has never been pointed at a database (.env.preview.local is gitignored).

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  BOARD_VISIBLE_STATES,
  CORRIDOR_OFFER_COLUMNS,
  PILOT_CORRIDOR_SLUGS,
  TRANSITION_ERRCODES,
  buildCorridorBoard,
  corridorLocationIdsForDirection,
  resolvePilotCorridor,
} from '../src/lib/domain/index.ts'

const PRODUCTION_REF = 'bwpguotjzczmieeepczf'
const ENV_FILE = '.env.preview.local'

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------
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
    `live-rls: SKIPPED — no preview credentials.\n` +
      `  Populate ${ENV_FILE} with:\n` +
      `    supabase branches get <branch> --project-ref ${PRODUCTION_REF} -o env > ${ENV_FILE}`
  )
  process.exit(0)
}

// The guard. A preview branch has its own project ref; the parent ref is
// production and is never a legal target for this file.
// The URL and keys come from a gitignored local file. Pin the shape of the URL
// before the service-role key is ever sent to it: without this, editing
// .env.preview.local is enough to point an admin-privileged request — carrying
// that key — at an arbitrary host. The production-ref check below stops the
// right-host/wrong-project mistake; this stops the wrong-host one.
const supabaseUrl = new URL(SUPABASE_URL)
assert.equal(supabaseUrl.protocol, 'https:', `SUPABASE_URL must be https, got ${supabaseUrl.protocol}`)
assert.match(
  supabaseUrl.hostname,
  /^[a-z0-9]{20}\.supabase\.co$/,
  `SUPABASE_URL must be a supabase.co project host, got ${supabaseUrl.hostname}`
)

const targetRef = supabaseUrl.hostname.split('.')[0]
assert.notEqual(
  targetRef,
  PRODUCTION_REF,
  `refusing to run destructive live tests against the production project (${PRODUCTION_REF})`
)

console.log(`live-rls: target preview project ${targetRef}`)

// -----------------------------------------------------------------------------
// Evidence recorder — every assertion prints the observed database response, so
// a reviewer reads what happened rather than that something passed.
// -----------------------------------------------------------------------------
const evidence = []
function record(label, observed) {
  evidence.push({ label, observed })
  console.log(`  ok  ${label}\n        -> ${observed}`)
}

const describeError = (e) => `${e.code ?? 'no-code'}: ${e.message}`

/**
 * Assert a client operation was refused *by the database*, and record how.
 *
 * The `error.code` requirement is not pedantry. The first run of this suite
 * "passed" a revision-conflict assertion on `upstream request timeout` — a
 * gateway 504 with no code, which proves nothing about RLS or about the state
 * machine. A refusal is only evidence when Postgres named it. See D-29.
 */
async function expectRefused(label, op) {
  const { error } = await op
  assert.ok(error, `${label}: expected refusal, but the operation SUCCEEDED`)
  assert.ok(
    error.code,
    `${label}: expected a database refusal carrying a SQLSTATE, got a transport-level failure ` +
      `(${error.message}). A codeless failure is not evidence of a policy.`
  )
  record(label, describeError(error))
  return error
}

/** Assert a client operation succeeded, and return its data. */
async function expectOk(label, op, describe = (d) => JSON.stringify(d)) {
  const { data, error } = await op
  assert.equal(error, null, `${label}: expected success, got ${error && describeError(error)}`)
  record(label, describe(data))
  return data
}

// -----------------------------------------------------------------------------
// Admin plumbing (service_role, out-of-band — not part of what is under test)
// -----------------------------------------------------------------------------
const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// randomUUID rather than Math.random: this seeds the password of a real (if
// short-lived) Supabase account, and Math.random is predictable from prior outputs.
const stamp = `${Date.now().toString(36)}${randomUUID().replace(/-/g, '').slice(0, 12)}`
const createdUserIds = []

async function createUser(tag) {
  const email = `live-rls-${tag}-${stamp}@sluglines.test`
  const password = `Pw-${stamp}-${tag}!`
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const body = await res.json()
  assert.equal(res.status, 200, `admin create user ${tag} failed: ${JSON.stringify(body)}`)
  createdUserIds.push(body.id)
  return { id: body.id, email, password }
}

async function deleteUser(id) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders })
}

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } }
const anon = createClient(SUPABASE_URL, ANON_KEY, clientOpts)
const admin = createClient(SUPABASE_URL, SERVICE_KEY, clientOpts)

async function signIn(user) {
  const c = createClient(SUPABASE_URL, ANON_KEY, clientOpts)
  const { data, error } = await c.auth.signInWithPassword({ email: user.email, password: user.password })
  assert.equal(error, null, `sign-in failed for ${user.email}: ${error && error.message}`)
  assert.ok(data.session?.access_token, 'sign-in must yield an access token')
  return c
}

// -----------------------------------------------------------------------------
let failed = false
try {
  const posterUser = await createUser('poster')
  const riderUser = await createUser('rider')
  const outsiderUser = await createUser('outsider')

  const poster = await signIn(posterUser)
  const rider = await signIn(riderUser)
  const outsider = await signIn(outsiderUser)

  // ---------------------------------------------------------------------------
  // 0001: the auth.users trigger populated members, and only the caller's row is
  // readable. This is the foundation every predicate below is written against.
  // ---------------------------------------------------------------------------
  console.log('\n0001 foundation — members')
  const ownMembers = await expectOk(
    'member reads members and sees exactly their own row',
    poster.from('members').select('id, display_name, role'),
    (d) => `${d.length} row(s), id=${d[0]?.id}, role=${d[0]?.role}`
  )
  assert.equal(ownMembers.length, 1, 'members_select_self must expose exactly one row')
  assert.equal(ownMembers[0].id, posterUser.id, 'and it must be the caller')
  assert.equal(ownMembers[0].role, 'member', 'handle_new_member must default role to member, not moderator')

  await expectRefused(
    'member cannot self-promote to moderator (no update policy on members)',
    poster.from('members').update({ role: 'moderator' }).eq('id', posterUser.id)
  )

  // ---------------------------------------------------------------------------
  // ANONYMOUS — the §6 claim, negative half.
  // Every table is `revoke all ... from anon` behind default-deny RLS, so an
  // anonymous client has neither the privilege nor a policy.
  // ---------------------------------------------------------------------------
  console.log('\nanon — writes and reads must be refused')

  const anonOfferRow = {
    poster_id: posterUser.id,
    poster_role: 'driver',
    origin_location_id: crypto.randomUUID(),
    destination_location_id: crypto.randomUUID(),
    window_start: new Date(Date.now() + 3600e3).toISOString(),
    window_end: new Date(Date.now() + 7200e3).toISOString(),
    seats_total: 1,
  }

  await expectRefused('anon INSERT into offers is refused', anon.from('offers').insert(anonOfferRow))
  await expectRefused(
    'anon INSERT into reservations is refused',
    anon.from('reservations').insert({ offer_id: crypto.randomUUID(), rider_id: posterUser.id, seats: 1 })
  )
  await expectRefused(
    'anon UPDATE of offers is refused',
    anon.from('offers').update({ state: 'CONFIRMED' }).neq('id', crypto.randomUUID())
  )
  await expectRefused(
    'anon DELETE from reservations is refused',
    anon.from('reservations').delete().neq('id', crypto.randomUUID())
  )
  await expectRefused('anon SELECT of offers is refused', anon.from('offers').select('id'))
  await expectRefused('anon SELECT of members is refused', anon.from('members').select('id'))
  // R10: the state machine entry points are not granted to anon, so the function
  // is not even reachable — the write path is closed at both ends.
  await expectRefused(
    'anon RPC offer_create is refused (no execute grant to anon)',
    anon.rpc('offer_create', {
      p_poster_role: 'driver',
      p_origin_location_id: crypto.randomUUID(),
      p_destination_location_id: crypto.randomUUID(),
      p_window_start: anonOfferRow.window_start,
      p_window_end: anonOfferRow.window_end,
      p_seats_total: 1,
      p_idempotency_key: `anon-${stamp}`,
    })
  )

  // ---------------------------------------------------------------------------
  // AUTHENTICATED — the §6 claim, the half that actually matters.
  // A logged-in member is the realistic attacker: they hold a valid JWT. They
  // still hold no write privilege on any table.
  // ---------------------------------------------------------------------------
  console.log('\nmember — direct table writes must be refused')
  await expectRefused('member INSERT into offers is refused', poster.from('offers').insert(anonOfferRow))
  await expectRefused(
    'member INSERT into reservations is refused',
    rider.from('reservations').insert({ offer_id: crypto.randomUUID(), rider_id: riderUser.id, seats: 1 })
  )
  await expectRefused(
    'member INSERT into offer_transitions (ledger forgery) is refused',
    poster.from('offer_transitions').insert({
      offer_id: crypto.randomUUID(),
      operation: 'forged',
      from_state: 'DRAFT',
      to_state: 'COMPLETED',
      from_revision: 1,
      to_revision: 2,
    })
  )

  // ---------------------------------------------------------------------------
  // THE STATE MACHINE — the positive half. Same client, same JWT, same network
  // path; the only difference is that the write goes through a SECURITY DEFINER
  // function instead of at the table.
  // ---------------------------------------------------------------------------
  console.log('\nmember — transitions through the SECURITY DEFINER entry points')

  const key = (op) => `${op}-${stamp}`
  const windowStart = new Date(Date.now() + 3600e3).toISOString()
  const windowEnd = new Date(Date.now() + 7200e3).toISOString()

  // offer_create's origin/destination carry a real FK to `locations` (0004), so
  // the positive path needs two distinct rows that actually exist in this
  // branch, not synthetic uuids. Fetched via service_role rather than a member
  // client so this fixture lookup does not depend on locations_select_active
  // behaving correctly — that policy is not what this section is testing.
  const { data: seededLocations, error: seededLocationsError } = await admin
    .from('locations')
    .select('id')
    .eq('is_active', true)
    .order('slug')
    .limit(2)
  assert.equal(
    seededLocationsError,
    null,
    `fetching seeded locations failed: ${seededLocationsError && describeError(seededLocationsError)}`
  )
  assert.ok(
    seededLocations.length >= 2,
    `live-rls needs at least 2 active seeded locations in ${targetRef} to exercise offer_create, found ` +
      `${seededLocations.length}. Apply migration 0004 (the locations directory, see ` +
      'supabase/migrations/README.md) to this preview branch — regenerate it first with ' +
      '`npm run seed:locations` if it is stale.'
  )
  const [originLocation, destinationLocation] = seededLocations

  const offerId = await expectOk(
    'poster offer_create succeeds',
    poster.rpc('offer_create', {
      p_poster_role: 'driver',
      p_origin_location_id: originLocation.id,
      p_destination_location_id: destinationLocation.id,
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_seats_total: 1,
      p_idempotency_key: key('create'),
    }),
    (d) => `offer ${d}`
  )
  assert.ok(offerId, 'offer_create must return the new offer id')

  const readOffer = async (client, label) => {
    const { data, error } = await client.from('offers').select('state, revision, seats_taken').eq('id', offerId)
    assert.equal(error, null, `${label}: read failed ${error && describeError(error)}`)
    return data
  }

  let rows = await readOffer(poster, 'poster reads own DRAFT')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].state, 'DRAFT')
  assert.equal(rows[0].revision, 1)
  record('offer_create leaves the offer DRAFT at revision 1', `state=${rows[0].state} revision=${rows[0].revision}`)

  // A DRAFT is visible to its poster and to nobody else.
  const outsiderDraft = await expectOk(
    'outsider cannot see a DRAFT offer',
    outsider.from('offers').select('id').eq('id', offerId),
    (d) => `${d.length} row(s) visible`
  )
  assert.equal(outsiderDraft.length, 0, 'offers_select_visible_for_caller must hide DRAFT from non-participants')

  const revAfterPublish = await expectOk(
    'poster offer_publish succeeds (DRAFT -> OPEN)',
    poster.rpc('offer_publish', {
      p_offer_id: offerId,
      p_expected_revision: 1,
      p_idempotency_key: key('publish'),
    }),
    (d) => `revision ${d}`
  )
  assert.equal(revAfterPublish, 2, 'one hop must bump revision by exactly one')

  rows = await readOffer(poster, 'poster reads OPEN')
  assert.equal(rows[0].state, 'OPEN')

  // Now OPEN: the board read half of the policy opens it to every member.
  const outsiderOpen = await expectOk(
    'outsider CAN see the offer once OPEN (board read half of the policy)',
    outsider.from('offers').select('id, state').eq('id', offerId),
    (d) => `${d.length} row(s), state=${d[0]?.state}`
  )
  assert.equal(outsiderOpen.length, 1, 'an OPEN offer is visible to any authenticated member')

  // ---------------------------------------------------------------------------
  // Revision check — the D-29 regression test, and no longer gated.
  //
  // 0002 raised a revision conflict as SQLSTATE 40001 (serialization_failure).
  // The stack treats that class as transient and retries it; a revision conflict
  // is permanent, so every retry re-read the same revision and failed
  // identically until the gateway gave up — measured at 125,058 ms, returning
  // `upstream request timeout` with no SQLSTATE. The same call straight at the
  // database returned 40001 in 382 ms, so the SQL was right and the errcode was
  // wrong.
  //
  // 0003 raises TRANSITION_ERRCODES.CONFLICT (PT409) instead, so the block below
  // runs on every live run. It asserts the two properties that were broken: the
  // refusal is PROMPT, and it is NAMED. A timeout satisfies neither.
  // ---------------------------------------------------------------------------
  const conflictStarted = Date.now()
  const conflictResponse = await poster.rpc('offer_publish', {
    p_offer_id: offerId,
    p_expected_revision: 1,
    p_idempotency_key: key('publish-stale'),
  })
  const conflictElapsed = Date.now() - conflictStarted
  const conflict = await expectRefused(
    'stale revision is refused promptly (optimistic concurrency)',
    conflictResponse
  )
  assert.ok(
    conflictElapsed < 15000,
    `a revision conflict must fail fast, took ${conflictElapsed}ms (D-29: 40001 was retried by PostgREST)`
  )
  assert.equal(
    conflict.code,
    TRANSITION_ERRCODES.CONFLICT,
    `a revision conflict must arrive as ${TRANSITION_ERRCODES.CONFLICT}, got ${describeError(conflict)}`
  )
  assert.notEqual(conflict.code, '40001', 'D-29: 40001 is retried as transient and must not be raised')
  assert.match(conflict.message, /revision conflict/i, 'the refusal must say what it refused')
  // The PTnnn form's other half: PostgREST reads the code as an HTTP status, so
  // a caller that never inspects the body still sees a conflict rather than a
  // 500 or a 504.
  assert.equal(conflictResponse.status, 409, `a revision conflict must arrive as HTTP 409, got ${conflictResponse.status}`)
  record(
    'the conflict refusal is prompt, named and a 409',
    `${conflictElapsed}ms, HTTP ${conflictResponse.status}, ${conflict.code}`
  )

  // ...and it did not apply anything on its way to being refused.
  rows = await readOffer(poster, 'poster reads after the refused conflict')
  assert.equal(rows[0].revision, 2, 'a refused conflict must not bump the revision')
  assert.equal(rows[0].state, 'OPEN', 'a refused conflict must not move the state')

  // Idempotency: the same key replays the first call's result and applies nothing.
  const replay = await expectOk(
    'replayed idempotency key returns the first result and applies nothing',
    poster.rpc('offer_publish', {
      p_offer_id: offerId,
      p_expected_revision: 1,
      p_idempotency_key: key('publish'),
    }),
    (d) => `revision ${d} (unchanged)`
  )
  assert.equal(replay, revAfterPublish, 'a replay must return the recorded revision')
  rows = await readOffer(poster, 'poster reads after replay')
  assert.equal(rows[0].revision, 2, 'a replay must not bump the revision')
  assert.equal(rows[0].state, 'OPEN', 'a replay must not move the state')

  // ---------------------------------------------------------------------------
  // Issue #133 — only the poster or a moderator may cancel an offer. 0002's
  // offer_cancel let any rider holding a live seat cancel the whole offer and
  // every other rider's reservation with it; 0027 re-creates it with a
  // poster-or-moderator guard. This block reads whichever definition the branch
  // is running and says which: it PASSES only where 0027 has been applied.
  // ---------------------------------------------------------------------------
  console.log("\n#133 — offer_cancel is the poster's (or a moderator's), never a rider's")

  const cancelOfferId = await expectOk(
    'poster offer_create (two seats) for the cancel-authorisation fixture',
    poster.rpc('offer_create', {
      p_poster_role: 'driver',
      p_origin_location_id: originLocation.id,
      p_destination_location_id: destinationLocation.id,
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_seats_total: 2,
      p_idempotency_key: key('cancel-fixture-create'),
    }),
    (d) => `offer ${d}`
  )
  let cancelRev = await expectOk(
    'poster offer_publish puts the fixture on the board',
    poster.rpc('offer_publish', {
      p_offer_id: cancelOfferId,
      p_expected_revision: 1,
      p_idempotency_key: key('cancel-fixture-publish'),
    }),
    (d) => `revision ${d}`
  )
  cancelRev = await expectOk(
    'rider offer_reserve_seat takes one of the two seats (OPEN -> PARTIALLY_RESERVED)',
    rider.rpc('offer_reserve_seat', {
      p_offer_id: cancelOfferId,
      p_expected_revision: cancelRev,
      p_idempotency_key: key('cancel-fixture-reserve'),
      p_seats: 1,
    }),
    (d) => `revision ${d}`
  )

  const riderCancel = await expectRefused(
    'rider holding a live seat CANNOT cancel the offer',
    rider.rpc('offer_cancel', {
      p_offer_id: cancelOfferId,
      p_expected_revision: cancelRev,
      p_idempotency_key: key('cancel-by-rider'),
    })
  )
  assert.equal(
    riderCancel.code,
    TRANSITION_ERRCODES.FORBIDDEN,
    `a rider's cancel must be refused as 42501 (0027 applied); 0002 accepts it — got ${describeError(riderCancel)}`
  )
  const outsiderCancel = await expectRefused(
    'a member holding no seat cannot cancel it either',
    outsider.rpc('offer_cancel', {
      p_offer_id: cancelOfferId,
      p_expected_revision: cancelRev,
      p_idempotency_key: key('cancel-by-outsider'),
    })
  )
  assert.equal(outsiderCancel.code, TRANSITION_ERRCODES.FORBIDDEN)

  // Neither refusal moved anything.
  const afterRefusals = await expectOk(
    'the offer is unchanged after both refusals',
    poster.from('offers').select('state, revision, seats_taken').eq('id', cancelOfferId),
    (d) => `state=${d[0]?.state} revision=${d[0]?.revision} seats_taken=${d[0]?.seats_taken}`
  )
  assert.equal(afterRefusals[0].state, 'PARTIALLY_RESERVED')
  assert.equal(afterRefusals[0].revision, cancelRev)
  assert.equal(afterRefusals[0].seats_taken, 1)

  const posterCancelRev = await expectOk(
    "poster offer_cancel succeeds and cascades to the rider's live seat",
    poster.rpc('offer_cancel', {
      p_offer_id: cancelOfferId,
      p_expected_revision: cancelRev,
      p_idempotency_key: key('cancel-by-poster'),
    }),
    (d) => `revision ${d}`
  )
  assert.equal(posterCancelRev, cancelRev + 1, 'a cancel is one hop')
  const riderSeatAfter = await expectOk(
    "rider reads their own reservation after the poster's cancel",
    rider.from('reservations').select('state').eq('offer_id', cancelOfferId).eq('rider_id', riderUser.id),
    (d) => `${d.length} row(s), state=${d[0]?.state}`
  )
  assert.equal(riderSeatAfter.length, 1, 'the rider can read their own reservation (reservations_select_participant)')
  assert.equal(riderSeatAfter[0].state, 'CANCELLED', "the poster's cancel cascades to live seats, as 0002 always did")

  // ---------------------------------------------------------------------------
  // Issue #137 — offer_create bounds the window and caps open offers per member
  // (0028). Each refusal is named by SQLSTATE; against a branch still on 0002
  // the first three calls SUCCEED and this section fails there, naming why.
  // ---------------------------------------------------------------------------
  console.log('\n#137 — offer_create bounds: window length, horizon, staleness, per-member cap')

  const boundedCreate = (start, end, keySuffix) =>
    poster.rpc('offer_create', {
      p_poster_role: 'driver',
      p_origin_location_id: originLocation.id,
      p_destination_location_id: destinationLocation.id,
      p_window_start: start.toISOString(),
      p_window_end: end.toISOString(),
      p_seats_total: 1,
      p_idempotency_key: key(`bounds-${keySuffix}`),
    })
  const nowMs = Date.now()
  const hour = 3600e3

  const tooLong = await expectRefused(
    'a 5-hour window is refused (limit 4 hours)',
    boundedCreate(new Date(nowMs + hour), new Date(nowMs + 6 * hour), 'too-long')
  )
  assert.equal(tooLong.code, TRANSITION_ERRCODES.INVALID_ARGUMENT, `expected 22023, got ${describeError(tooLong)}`)
  const tooFar = await expectRefused(
    'a window starting in 15 days is refused (limit 14)',
    boundedCreate(new Date(nowMs + 15 * 24 * hour), new Date(nowMs + 15 * 24 * hour + hour), 'too-far')
  )
  assert.equal(tooFar.code, TRANSITION_ERRCODES.INVALID_ARGUMENT, `expected 22023, got ${describeError(tooFar)}`)
  const tooOld = await expectRefused(
    'a window that started 2 hours ago is refused (limit 1 hour ago)',
    boundedCreate(new Date(nowMs - 2 * hour), new Date(nowMs - hour), 'too-old')
  )
  assert.equal(tooOld.code, TRANSITION_ERRCODES.INVALID_ARGUMENT, `expected 22023, got ${describeError(tooOld)}`)

  // The cap. The poster holds one OPEN offer here (the main fixture); four
  // more reach the limit of five, and the sixth is refused as PT429 with the
  // HTTP status PostgREST derives from it.
  const capOfferIds = []
  for (let i = 0; i < 4; i += 1) {
    const id = await expectOk(
      `poster offer_create #${i + 2} of 5 towards the cap`,
      boundedCreate(new Date(nowMs + hour), new Date(nowMs + 2 * hour), `cap-${i}`),
      (d) => `offer ${d}`
    )
    const rev = await expectOk(
      '...and publishes it (only open offers count)',
      poster.rpc('offer_publish', { p_offer_id: id, p_expected_revision: 1, p_idempotency_key: key(`cap-publish-${i}`) }),
      (d) => `revision ${d}`
    )
    capOfferIds.push({ id, rev })
  }
  const capResponse = await boundedCreate(new Date(nowMs + hour), new Date(nowMs + 2 * hour), 'cap-over')
  const capRefusal = await expectRefused('a sixth open offer is refused (per-member cap of 5)', capResponse)
  assert.equal(capRefusal.code, TRANSITION_ERRCODES.LIMIT_REACHED, `expected PT429, got ${describeError(capRefusal)}`)
  assert.equal(capResponse.status, 429, `PT429 must arrive as HTTP 429, got ${capResponse.status}`)

  // Leave the branch's board as it was found.
  for (const [i, { id, rev }] of capOfferIds.entries()) {
    await expectOk(
      `poster offer_cancel clears cap fixture #${i + 1}`,
      poster.rpc('offer_cancel', { p_offer_id: id, p_expected_revision: rev, p_idempotency_key: key(`cap-cancel-${i}`) }),
      (d) => `revision ${d}`
    )
  }

  // Authorisation inside the entry point: the poster may not take their own seat.
  await expectRefused(
    'poster cannot reserve a seat on their own offer',
    poster.rpc('offer_reserve_seat', {
      p_offer_id: offerId,
      p_expected_revision: 2,
      p_idempotency_key: key('self-reserve'),
      p_seats: 1,
    })
  )

  // The two-hop fill: a one-seat offer goes OPEN -> PARTIALLY_RESERVED -> RESERVED
  // inside one transaction, so the revision moves by two.
  const revAfterReserve = await expectOk(
    'rider offer_reserve_seat succeeds (OPEN -> PARTIALLY_RESERVED -> RESERVED)',
    rider.rpc('offer_reserve_seat', {
      p_offer_id: offerId,
      p_expected_revision: 2,
      p_idempotency_key: key('reserve'),
      p_seats: 1,
    }),
    (d) => `revision ${d}`
  )
  assert.equal(revAfterReserve, 4, 'a one-seat offer filling is two hops, so revision 2 -> 4')

  rows = await readOffer(poster, 'poster reads RESERVED')
  assert.equal(rows[0].state, 'RESERVED')
  assert.equal(rows[0].seats_taken, 1)
  record('the fill is two revision-checked hops', `state=${rows[0].state} seats_taken=${rows[0].seats_taken} revision=${rows[0].revision}`)

  const outsiderReserved = await expectOk(
    'outsider can no longer see the offer once RESERVED',
    outsider.from('offers').select('id').eq('id', offerId),
    (d) => `${d.length} row(s) visible`
  )
  assert.equal(outsiderReserved.length, 0, 'RESERVED is outside the board-read states')

  const outsiderRes = await expectOk(
    'outsider cannot see the reservation',
    outsider.from('reservations').select('id').eq('offer_id', offerId),
    (d) => `${d.length} row(s) visible`
  )
  assert.equal(outsiderRes.length, 0, 'reservations_select_participant admits rider and poster only')

  const posterSeesRes = await expectOk(
    'poster CAN see the reservation on their own offer',
    poster.from('reservations').select('id, state, rider_id').eq('offer_id', offerId),
    (d) => `${d.length} row(s), state=${d[0]?.state}`
  )
  assert.equal(posterSeesRes.length, 1)
  assert.equal(posterSeesRes[0].rider_id, riderUser.id)

  // Only the poster confirms.
  await expectRefused(
    'rider cannot confirm the offer (poster only)',
    rider.rpc('offer_confirm', {
      p_offer_id: offerId,
      p_expected_revision: 4,
      p_idempotency_key: key('rider-confirm'),
    })
  )

  const revAfterConfirm = await expectOk(
    'poster offer_confirm succeeds (RESERVED -> CONFIRMED)',
    poster.rpc('offer_confirm', {
      p_offer_id: offerId,
      p_expected_revision: 4,
      p_idempotency_key: key('confirm'),
    }),
    (d) => `revision ${d}`
  )
  assert.equal(revAfterConfirm, 5)

  const confirmedRes = await expectOk(
    'confirming the offer also confirms the live reservation',
    rider.from('reservations').select('state').eq('offer_id', offerId),
    (d) => `reservation state=${d[0]?.state}`
  )
  assert.equal(confirmedRes[0].state, 'CONFIRMED')

  // Pickup details: confirmed participants only.
  await expectOk(
    'poster offer_set_pickup_details succeeds',
    poster.rpc('offer_set_pickup_details', {
      p_offer_id: offerId,
      p_vehicle_description: 'blue hatchback',
      p_pickup_instructions: 'kiss and ride lane',
    }),
    () => 'accepted'
  )
  const riderPickup = await expectOk(
    'confirmed rider CAN read pickup details',
    rider.from('offer_pickup_details').select('vehicle_description').eq('offer_id', offerId),
    (d) => `${d.length} row(s), vehicle=${d[0]?.vehicle_description}`
  )
  assert.equal(riderPickup.length, 1)
  const outsiderPickup = await expectOk(
    'outsider CANNOT read pickup details',
    outsider.from('offer_pickup_details').select('vehicle_description').eq('offer_id', offerId),
    (d) => `${d.length} row(s) visible`
  )
  assert.equal(outsiderPickup.length, 0)

  // The ride itself.
  let rev = revAfterConfirm
  for (const [i, expectedState] of ['ARRIVING', 'PICKED_UP', 'COMPLETED'].entries()) {
    const next = await expectOk(
      `poster offer_advance -> ${expectedState}`,
      poster.rpc('offer_advance', {
        p_offer_id: offerId,
        p_expected_revision: rev,
        p_idempotency_key: key(`advance-${i}`),
      }),
      (d) => `revision ${d}`
    )
    assert.equal(next, rev + 1, 'each advance is exactly one hop')
    rev = next
    rows = await readOffer(poster, `poster reads ${expectedState}`)
    assert.equal(rows[0].state, expectedState, `offer must be ${expectedState}`)
  }
  assert.equal(rev, 8, 'the full happy path is seven hops from revision 1')

  // The ledger: append-only, one row per hop, visible to participants.
  const ledger = await expectOk(
    'offer_transitions records every hop and is readable by the participant',
    poster
      .from('offer_transitions')
      .select('from_state, to_state, from_revision, to_revision, operation')
      .eq('offer_id', offerId)
      .order('to_revision', { ascending: true }),
    (d) => `${d.length} hop(s): ${d.map((r) => `${r.from_state}->${r.to_state}`).join(', ')}`
  )
  assert.equal(ledger.length, 7, 'seven hops: publish, two-hop fill, confirm, and three advances')
  for (const hop of ledger) {
    assert.equal(hop.to_revision, hop.from_revision + 1, 'every hop bumps the revision by exactly one')
  }
  assert.deepEqual(
    ledger.map((r) => `${r.from_state}->${r.to_state}`),
    [
      'DRAFT->OPEN',
      'OPEN->PARTIALLY_RESERVED',
      'PARTIALLY_RESERVED->RESERVED',
      'RESERVED->CONFIRMED',
      'CONFIRMED->ARRIVING',
      'ARRIVING->PICKED_UP',
      'PICKED_UP->COMPLETED',
    ],
    'the ledger must be the rev. 5.3 §8 M3 path, in order'
  )

  await expectRefused(
    'member cannot rewrite the append-only ledger',
    poster.from('offer_transitions').update({ to_state: 'CANCELLED' }).eq('offer_id', offerId)
  )
  const outsiderLedger = await expectOk(
    'outsider cannot read the ledger of an offer they are not in',
    outsider.from('offer_transitions').select('id').eq('offer_id', offerId),
    (d) => `${d.length} row(s) visible`
  )
  assert.equal(outsiderLedger.length, 0)

  // ---------------------------------------------------------------------------
  // Issue #132 — the pilot corridor resolves to real `locations` rows, an offer
  // posted on them lands on `/board`, and the placeholder ids PR #115 shipped
  // are refused by the 0004 foreign key exactly as the issue describes.
  //
  // `POST /api/offers` and `/board` themselves are not reachable from this
  // suite (no Next server here, and Vercel Authentication blocks every preview
  // — #47), so this exercises the same three steps they take, through the same
  // PostgREST path, the same RLS policy (`locations_select_active`, as a
  // member, not service_role) and the same domain functions
  // (`resolvePilotCorridor`, `corridorLocationIdsForDirection`,
  // `buildCorridorBoard`). What it does not prove is the HTTP layer on top;
  // D-82 records that as the remaining check.
  // ---------------------------------------------------------------------------
  console.log('\n#132 — pilot corridor: slug lookup, post, board read-back')

  const corridorRows = await expectOk(
    'member resolves both pilot corridor slugs through locations_select_active',
    poster.from('locations').select('id,slug').in('slug', [...PILOT_CORRIDOR_SLUGS]),
    (d) => d.map((r) => `${r.slug}=${r.id}`).join(' ')
  )
  const resolvedCorridor = resolvePilotCorridor(corridorRows)
  assert.equal(
    resolvedCorridor.ok,
    true,
    `pilot corridor row(s) missing or inactive on ${targetRef}: ` +
      `${resolvedCorridor.ok ? '' : resolvedCorridor.missing.join(', ')} — 0004 seeds both, active`
  )
  const { hornerRdId, lenfantPlazaId } = resolvedCorridor.corridor
  const corridorIds = corridorLocationIdsForDirection(resolvedCorridor.corridor, 'horner-to-lenfant')

  // The defect itself, observed live: the two literals corridor.ts used to
  // commit are not rows, and the NOT VALID FK still refuses them on insert.
  // 23503 is the SQLSTATE transition-http.ts now maps to 422 unknown_location.
  const fkRefusal = await expectRefused(
    'offer_create with the old placeholder uuids is refused by the 0004 foreign key',
    poster.rpc('offer_create', {
      p_poster_role: 'driver',
      p_origin_location_id: '11111111-1111-4111-8111-111111111111',
      p_destination_location_id: '22222222-2222-4222-8222-222222222222',
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_seats_total: 1,
      p_idempotency_key: key('corridor-placeholder'),
    })
  )
  assert.equal(
    fkRefusal.code,
    TRANSITION_ERRCODES.FOREIGN_KEY_VIOLATION,
    `a non-directory uuid must fail as 23503 (foreign_key_violation), got ${describeError(fkRefusal)}`
  )

  const corridorOfferId = await expectOk(
    'offer_create on the resolved pilot corridor ids succeeds',
    poster.rpc('offer_create', {
      p_poster_role: 'driver',
      p_origin_location_id: corridorIds.originId,
      p_destination_location_id: corridorIds.destinationId,
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_seats_total: 3,
      p_idempotency_key: key('corridor-create'),
    }),
    (d) => `offer ${d}`
  )
  const corridorRevision = await expectOk(
    'offer_publish puts it on the board',
    poster.rpc('offer_publish', {
      p_offer_id: corridorOfferId,
      p_expected_revision: 1,
      p_idempotency_key: key('corridor-publish'),
    }),
    (d) => `revision ${d}`
  )

  // Exactly the query src/lib/corridor-board.ts runs, as a different member.
  const boardRows = await expectOk(
    "another member reads /board's filter and finds the offer",
    outsider
      .from('offers')
      .select(CORRIDOR_OFFER_COLUMNS)
      .in('state', BOARD_VISIBLE_STATES)
      .or(
        `and(origin_location_id.eq.${hornerRdId},destination_location_id.eq.${lenfantPlazaId}),` +
          `and(origin_location_id.eq.${lenfantPlazaId},destination_location_id.eq.${hornerRdId})`
      )
      .order('window_start', { ascending: true }),
    (d) => `${d.length} row(s) on the board, ${d.filter((r) => r.id === corridorOfferId).length} of them this offer`
  )
  assert.ok(boardRows.some((r) => r.id === corridorOfferId), 'the posted offer must be on the board')
  const corridorBoard = buildCorridorBoard(boardRows, { viewerId: outsiderUser.id, corridor: resolvedCorridor.corridor })
  const shown = corridorBoard.offers.find((o) => o.id === corridorOfferId)
  assert.ok(shown, 'the view model must carry the posted offer')
  assert.equal(shown.directionLabel, "Horner Rd -> L'Enfant Plaza", 'labelled by the resolved ids, not by a literal')
  assert.equal(shown.seatsRemaining, 3)
  assert.equal(shown.isMine, false, 'another member is not its poster')
  record('the board labels the posted offer by its resolved corridor', `${shown.directionLabel}, ${shown.seatsRemaining} seats`)

  // Leave the branch's board as it was found.
  await expectOk(
    'poster offer_cancel clears the fixture off the board',
    poster.rpc('offer_cancel', {
      p_offer_id: corridorOfferId,
      p_expected_revision: corridorRevision,
      p_idempotency_key: key('corridor-cancel'),
    }),
    (d) => `revision ${d}`
  )

  console.log(`\nlive-rls: ${evidence.length} assertions passed against ${targetRef}`)
} catch (err) {
  failed = true
  console.error(`\nlive-rls: FAILED — ${err.message}`)
  console.error(err.stack)
} finally {
  for (const id of createdUserIds) await deleteUser(id)
  console.log(`live-rls: cleaned up ${createdUserIds.length} test user(s)`)
}

process.exit(failed ? 1 : 0)

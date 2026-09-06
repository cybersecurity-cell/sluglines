// Offer state machine — asserted against rev. 5.3 §8 M3.
//
// The point of these tests is that the machine in src/lib/domain/offer-state.ts
// is a transcription of a specific diagram, not a design choice made here. Each
// block below names the §8 M3 line it enforces.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  CONFIRMED_OR_LATER_STATES,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  LIVE_RESERVATION_STATES,
  OFFER_STATES,
  OFFER_TRANSITIONS,
  OFFER_TRANSITION_OPERATIONS,
  OPEN_OFFER_STATES,
  RESERVATION_STATES,
  REVISION_START,
  TERMINAL_OFFER_STATES,
  TRANSITION_ERRCODES,
  canTransition,
  checkRevision,
  checkTransition,
  checkTransitionRequest,
  isConflictError,
  isIdempotencyKey,
  isOfferState,
  isRetryableError,
  isTerminalOfferState,
  isTransitionErrcode,
  nextOfferStates,
  nextRevision,
  offerEdgeList,
  operationForEdge,
  stateAfterRelease,
  stateAfterReservation,
  toTransitionCheck,
  transitionErrcodeOf,
  transitionPath,
} from '../src/lib/domain/index.ts'

// -----------------------------------------------------------------------------
// The transition table is exactly the §8 M3 diagram
// -----------------------------------------------------------------------------
const SPEC_EDGES = [
  // DRAFT -> OPEN -> PARTIALLY_RESERVED -> RESERVED -> CONFIRMED
  ['DRAFT', 'OPEN'],
  ['OPEN', 'PARTIALLY_RESERVED'],
  ['PARTIALLY_RESERVED', 'RESERVED'],
  ['RESERVED', 'CONFIRMED'],
  // CONFIRMED -> ARRIVING -> PICKED_UP -> COMPLETED
  ['CONFIRMED', 'ARRIVING'],
  ['ARRIVING', 'PICKED_UP'],
  ['PICKED_UP', 'COMPLETED'],
  // OPEN | PARTIALLY_RESERVED | RESERVED -> CANCELLED
  ['OPEN', 'CANCELLED'],
  ['PARTIALLY_RESERVED', 'CANCELLED'],
  ['RESERVED', 'CANCELLED'],
  // CONFIRMED | ARRIVING -> CANCELLED  (the two edges rev. 5 added; M9's cancel
  // SMS event, P4's waitlist renotify and the R3 ride.cancel_confirmed tool all
  // depended on them while the diagram was missing them)
  ['CONFIRMED', 'CANCELLED'],
  ['ARRIVING', 'CANCELLED'],
  // OPEN | PARTIALLY_RESERVED -> EXPIRED
  ['OPEN', 'EXPIRED'],
  ['PARTIALLY_RESERVED', 'EXPIRED'],
  // RESERVED -> RELEASED -> OPEN
  ['RESERVED', 'RELEASED'],
  ['RELEASED', 'OPEN'],
  // PARTIALLY_RESERVED -> RELEASED -> OPEN | PARTIALLY_RESERVED
  ['PARTIALLY_RESERVED', 'RELEASED'],
  ['RELEASED', 'PARTIALLY_RESERVED'],
]

const actualEdges = Object.entries(OFFER_TRANSITIONS)
  .flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`))
  .sort()

assert.deepEqual(
  actualEdges,
  [...new Set(SPEC_EDGES.map(([f, t]) => `${f}->${t}`))].sort(),
  'the transition table must be exactly the rev. 5.3 §8 M3 edge set — no more, no fewer'
)

for (const [from, to] of SPEC_EDGES) {
  assert.equal(canTransition(from, to), true, `${from} -> ${to} is in the spec`)
}

// -----------------------------------------------------------------------------
// Illegal transitions the machine must refuse
// -----------------------------------------------------------------------------
assert.equal(canTransition('DRAFT', 'CONFIRMED'), false, 'a draft cannot skip straight to confirmed')
assert.equal(canTransition('OPEN', 'CONFIRMED'), false, 'confirmation requires a reservation first')
assert.equal(canTransition('EXPIRED', 'OPEN'), false, 'expiry is terminal; re-opening is a new offer')
assert.equal(canTransition('CANCELLED', 'OPEN'), false)
assert.equal(canTransition('COMPLETED', 'CANCELLED'), false)
assert.equal(canTransition('PICKED_UP', 'CANCELLED'), false, 'bail-out is only legal up to ARRIVING')
assert.equal(canTransition('CONFIRMED', 'EXPIRED'), false, 'only pre-confirmation offers expire')
assert.equal(canTransition('RELEASED', 'RESERVED'), false, 'release recomputes state from remaining seats')

// -----------------------------------------------------------------------------
// Terminal states
// -----------------------------------------------------------------------------
assert.deepEqual([...TERMINAL_OFFER_STATES].sort(), ['CANCELLED', 'COMPLETED', 'EXPIRED'])
for (const state of OFFER_STATES) {
  assert.equal(
    isTerminalOfferState(state),
    nextOfferStates(state).length === 0,
    `${state}: terminal flag and outgoing-edge count must agree`
  )
}

// Every non-terminal state is reachable from DRAFT — no orphan states.
const reachable = new Set(['DRAFT'])
const queue = ['DRAFT']
while (queue.length > 0) {
  for (const next of nextOfferStates(queue.pop())) {
    if (!reachable.has(next)) {
      reachable.add(next)
      queue.push(next)
    }
  }
}
assert.deepEqual([...reachable].sort(), [...OFFER_STATES].sort(), 'every state must be reachable from DRAFT')

// -----------------------------------------------------------------------------
// Metric state sets (rev. 5.3 §13)
// -----------------------------------------------------------------------------
assert.deepEqual([...OPEN_OFFER_STATES], ['OPEN', 'PARTIALLY_RESERVED'], 'board-non-empty counts these two states')
assert.deepEqual(
  [...CONFIRMED_OR_LATER_STATES],
  ['CONFIRMED', 'ARRIVING', 'PICKED_UP', 'COMPLETED'],
  'the north-star metric is CONFIRMED-or-later, not COMPLETED'
)
for (const state of [...OPEN_OFFER_STATES, ...CONFIRMED_OR_LATER_STATES]) {
  assert.equal(isOfferState(state), true)
}

// -----------------------------------------------------------------------------
// Guards and reasons
// -----------------------------------------------------------------------------
assert.equal(isOfferState('OPEN'), true)
assert.equal(isOfferState('open'), false, 'states are case-sensitive')
assert.equal(isOfferState('PENDING'), false)
assert.equal(isOfferState(undefined), false)
assert.equal(isOfferState(7), false)

assert.deepEqual(checkTransition('OPEN', 'PARTIALLY_RESERVED'), { ok: true })
assert.deepEqual(checkTransition('OPEN', 'OPEN'), { ok: false, reason: 'no-op transition: offer is already OPEN' })
assert.deepEqual(checkTransition('COMPLETED', 'CANCELLED'), {
  ok: false,
  reason: 'COMPLETED is terminal; no transition out of it is legal',
})
assert.deepEqual(checkTransition('DRAFT', 'CONFIRMED'), {
  ok: false,
  reason: 'illegal transition DRAFT -> CONFIRMED',
})

// The table is not mutable through nextOfferStates() by accident.
assert.notEqual(nextOfferStates('OPEN'), nextOfferStates('PARTIALLY_RESERVED'))
assert.equal(nextOfferStates('COMPLETED').length, 0)

// -----------------------------------------------------------------------------
// Multi-hop paths — the two outcomes §8 M3 spells with two edges
// -----------------------------------------------------------------------------
assert.deepEqual(
  transitionPath('OPEN', 'RESERVED'),
  ['PARTIALLY_RESERVED', 'RESERVED'],
  'a one-seat offer filling goes through PARTIALLY_RESERVED; there is no OPEN -> RESERVED edge'
)
assert.deepEqual(
  transitionPath('RESERVED', 'OPEN'),
  ['RELEASED', 'OPEN'],
  'a released seat returns to OPEN through RELEASED, as the diagram draws it'
)
assert.deepEqual(transitionPath('DRAFT', 'OPEN'), ['OPEN'], 'a single-edge path is the edge')
assert.deepEqual(transitionPath('DRAFT', 'COMPLETED').length, 7, 'the longest happy path is seven hops')
assert.equal(transitionPath('OPEN', 'OPEN'), null, 'a state is not a path to itself')
assert.equal(transitionPath('CANCELLED', 'OPEN'), null, 'nothing leaves a terminal state')
assert.equal(transitionPath('COMPLETED', 'DRAFT'), null, 'DRAFT has no inbound edge at all')

// Every hop a path returns is a legal single edge — a path may not smuggle in an
// edge the table does not have.
for (const from of OFFER_STATES) {
  for (const to of OFFER_STATES) {
    const hops = transitionPath(from, to)
    if (hops === null) continue
    let cursor = from
    for (const hop of hops) {
      assert.equal(canTransition(cursor, hop), true, `path ${from} -> ${to} used illegal hop ${cursor} -> ${hop}`)
      cursor = hop
    }
    assert.equal(cursor, to)
  }
}

// -----------------------------------------------------------------------------
// Seat-count recompute — §8 M3 "recomputes state from remaining count"
// -----------------------------------------------------------------------------
assert.equal(stateAfterReservation(1, 1), 'RESERVED', 'a one-seat offer is full at one seat')
assert.equal(stateAfterReservation(3, 1), 'PARTIALLY_RESERVED')
assert.equal(stateAfterReservation(3, 2), 'PARTIALLY_RESERVED')
assert.equal(stateAfterReservation(3, 3), 'RESERVED')
assert.throws(() => stateAfterReservation(3, 4), RangeError, 'seats taken may not exceed seats offered')
assert.throws(() => stateAfterReservation(3, 0), RangeError, 'zero seats taken is not a reservation outcome')
assert.throws(() => stateAfterReservation(0, 0), RangeError)

assert.equal(stateAfterRelease(0), 'OPEN', 'the last seat back reopens the offer')
assert.equal(stateAfterRelease(1), 'PARTIALLY_RESERVED', 'one of several seats back is still partially reserved')
assert.throws(() => stateAfterRelease(-1), RangeError)

// The recompute results are states the machine can actually be in from here.
assert.equal(canTransition('PARTIALLY_RESERVED', stateAfterReservation(2, 2)), true)
assert.equal(canTransition('RELEASED', stateAfterRelease(0)), true)
assert.equal(canTransition('RELEASED', stateAfterRelease(2)), true)

// -----------------------------------------------------------------------------
// Operations — rev. 5.3 §12 constraint 6's writer side
// -----------------------------------------------------------------------------

// Every edge an operation claims is a legal edge.
for (const op of OFFER_TRANSITION_OPERATIONS) {
  assert.ok(op.edges.length > 0, `${op.fn} must claim at least one edge`)
  for (const [from, to] of op.edges) {
    assert.equal(canTransition(from, to), true, `${op.fn} claims illegal edge ${from} -> ${to}`)
  }
}

// …and every edge in the graph has exactly one writer. This is the invariant
// worth having: an edge with no operation is a transition nothing can perform,
// and an edge with two operations is two places a rule can be enforced
// differently.
const claimed = OFFER_TRANSITION_OPERATIONS.flatMap((op) => op.edges.map(([f, t]) => `${f}->${t}`))
assert.deepEqual([...claimed].sort(), offerEdgeList(), 'the operations must cover the graph exactly once')
assert.equal(new Set(claimed).size, claimed.length, 'no edge may be claimed by two operations')

assert.equal(operationForEdge('DRAFT', 'OPEN').fn, 'offer_publish')
assert.equal(operationForEdge('RESERVED', 'CONFIRMED').fn, 'offer_confirm')
assert.equal(operationForEdge('ARRIVING', 'CANCELLED').fn, 'offer_cancel')
assert.equal(operationForEdge('OPEN', 'EXPIRED').fn, 'offer_expire_sweep')
assert.equal(operationForEdge('OPEN', 'CONFIRMED'), undefined, 'an illegal edge has no writer')

// The sweep is the only operation without a session, and the only one not
// granted to a client role. Those two facts must not drift apart.
for (const op of OFFER_TRANSITION_OPERATIONS) {
  assert.equal(
    op.clientCallable,
    op.actor !== 'system',
    `${op.fn}: a system operation must not be client-callable, and a member operation must be`
  )
}
assert.deepEqual(
  OFFER_TRANSITION_OPERATIONS.filter((op) => !op.clientCallable).map((op) => op.fn),
  ['offer_expire_sweep']
)

// -----------------------------------------------------------------------------
// Revision checks and idempotency keys — the guards, in the domain layer
// -----------------------------------------------------------------------------
assert.equal(REVISION_START, 1)
assert.equal(nextRevision(1), 2, 'a revision steps by exactly one')
assert.equal(nextRevision(41), 42)
assert.throws(() => nextRevision(0), RangeError, 'revisions start at 1')
assert.throws(() => nextRevision(1.5), RangeError)

assert.deepEqual(checkRevision(4, 4), { ok: true })
assert.deepEqual(checkRevision(5, 4), {
  ok: false,
  reason: 'revision conflict: offer is at revision 5, caller expected 4',
  errcode: TRANSITION_ERRCODES.CONFLICT,
})
assert.equal(checkRevision(4, '4').ok, false, 'a string revision is not a revision')
assert.equal(checkRevision(4, '4').errcode, TRANSITION_ERRCODES.INVALID_ARGUMENT)
assert.equal(checkRevision(4, null).errcode, TRANSITION_ERRCODES.INVALID_ARGUMENT)
assert.equal(checkRevision(4, undefined).errcode, TRANSITION_ERRCODES.INVALID_ARGUMENT)

assert.equal(isIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MIN_LENGTH)), true)
assert.equal(isIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MIN_LENGTH - 1)), false)
assert.equal(isIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH)), true)
assert.equal(isIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1)), false)
assert.equal(isIdempotencyKey(`  ${'a'.repeat(4)}  `), false, 'padding does not make a key long enough')
assert.equal(isIdempotencyKey(''), false)
assert.equal(isIdempotencyKey(null), false)
assert.equal(isIdempotencyKey(12345678), false, 'a key is a string')

// The race the revision check exists to stop: two riders act on revision 4, the
// first commits at 5, the second must be refused rather than applied to a state
// it never saw.
const staleReserve = checkTransitionRequest({
  from: 'PARTIALLY_RESERVED',
  to: 'RESERVED',
  currentRevision: 5,
  expectedRevision: 4,
  idempotencyKey: 'rider-two-reserve-01',
})
assert.equal(staleReserve.ok, false)
assert.equal(staleReserve.errcode, TRANSITION_ERRCODES.CONFLICT, 'a stale revision is a conflict, not an illegal state')

assert.deepEqual(
  checkTransitionRequest({
    from: 'PARTIALLY_RESERVED',
    to: 'RESERVED',
    currentRevision: 5,
    expectedRevision: 5,
    idempotencyKey: 'rider-two-reserve-01',
  }),
  { ok: true }
)

// Gate order: a caller holding a stale revision is told so, rather than being
// told about a transition from a state it was never looking at.
const staleAndIllegal = checkTransitionRequest({
  from: 'CANCELLED',
  to: 'OPEN',
  currentRevision: 9,
  expectedRevision: 4,
  idempotencyKey: 'some-valid-key-1',
})
assert.equal(staleAndIllegal.errcode, TRANSITION_ERRCODES.CONFLICT, 'revision is checked before legality')

// …and a malformed key is rejected before either, because it is the one failure
// that makes a retry unsafe rather than merely wrong.
const badKey = checkTransitionRequest({
  from: 'CANCELLED',
  to: 'OPEN',
  currentRevision: 9,
  expectedRevision: 4,
  idempotencyKey: 'short',
})
assert.equal(badKey.errcode, TRANSITION_ERRCODES.INVALID_ARGUMENT)

const illegalOnly = checkTransitionRequest({
  from: 'OPEN',
  to: 'CONFIRMED',
  currentRevision: 2,
  expectedRevision: 2,
  idempotencyKey: 'legal-length-key',
})
assert.equal(illegalOnly.errcode, TRANSITION_ERRCODES.ILLEGAL_STATE)
assert.deepEqual(toTransitionCheck(illegalOnly), { ok: false, reason: 'illegal transition OPEN -> CONFIRMED' })
assert.deepEqual(toTransitionCheck({ ok: true }), { ok: true })

// The codes are distinct — a caller branching on them must be able to.
assert.equal(new Set(Object.values(TRANSITION_ERRCODES)).size, Object.keys(TRANSITION_ERRCODES).length)

// -----------------------------------------------------------------------------
// Reservation states
// -----------------------------------------------------------------------------
assert.deepEqual([...RESERVATION_STATES], ['ACTIVE', 'CONFIRMED', 'RELEASED', 'CANCELLED'])
assert.deepEqual([...LIVE_RESERVATION_STATES], ['ACTIVE', 'CONFIRMED'], 'these are the states that hold a seat')
assert.equal(
  RESERVATION_STATES.includes('NO_SHOW'),
  false,
  'NO_SHOW is rev. 5.3 §11 Phase 4 and has no writer yet; a state with no writer cannot be reached'
)

// =============================================================================
// The SQL is the same machine — 0002_ride_coordinator_state.sql, as corrected by
// 0003_resolve_transition_conflicts.sql
//
// rev. 5.3 §12 constraint 6 makes the SQL authoritative, so these assertions run
// in the direction that matters: the committed SQL is read, and required to say
// what the domain module says. Neither file can move alone.
//
// The harness is append-only, so a correction to an applied file arrives as a
// later `create or replace` rather than as an edit (D-29). What the database
// ends up running is therefore the *last* definition of each function across the
// sequence, and that is what these assertions must read — reading 0002 alone
// would now test a definition no database has.
// =============================================================================
const readMigration = (file) => ({
  file,
  sql: fs.readFileSync(path.join(process.cwd(), 'supabase/migrations', file), 'utf8'),
})

// In apply order. Later entries supersede earlier ones. 0027 re-creates
// offer_cancel with the poster-or-moderator guard (issue #133, D-83).
const M3_MIGRATIONS = [
  readMigration('0002_ride_coordinator_state.sql'),
  readMigration('0003_resolve_transition_conflicts.sql'),
  readMigration('0027_offer_cancel_poster_or_moderator.sql'),
]

const migration = M3_MIGRATIONS.map((m) => m.sql).join('\n')

const definitionsOf = (name) => {
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\s*\\(([\\s\\S]*?)\\$fn\\$([\\s\\S]*?)\\$fn\\$`,
    'i'
  )
  return M3_MIGRATIONS.map((m) => {
    const found = pattern.exec(m.sql)
    return found && { file: m.file, header: found[1], body: found[2] }
  }).filter(Boolean)
}

/** The definition the database actually runs: the last one in the sequence. */
const sqlFunction = (name) => {
  const defs = definitionsOf(name)
  assert.ok(defs.length > 0, `the M3 migrations must define public.${name}()`)
  return defs[defs.length - 1]
}

// --- the edge list ------------------------------------------------------------
const sqlEdges = [...sqlFunction('offer_transition_allowed').body.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)'\)/g)]
  .map((m) => `${m[1]}->${m[2]}`)
  .sort()

assert.deepEqual(
  sqlEdges,
  offerEdgeList(),
  'offer_transition_allowed() must be the same edge set as src/lib/domain/offer-state.ts'
)
assert.equal(new Set(sqlEdges).size, sqlEdges.length, 'the SQL edge list must not repeat an edge')

// --- the state sets -----------------------------------------------------------
const offersDdl = /create table if not exists public\.offers \(([\s\S]*?)\n\);/.exec(migration)[1]
const sqlOfferStates = /check \(state in \(([\s\S]*?)\)\)/.exec(offersDdl)[1].match(/'([A-Z_]+)'/g)
assert.deepEqual(
  sqlOfferStates.map((s) => s.replace(/'/g, '')).sort(),
  [...OFFER_STATES].sort(),
  'offers.state CHECK must be exactly the domain state set'
)

const reservationsDdl = /create table if not exists public\.reservations \(([\s\S]*?)\n\);/.exec(migration)[1]
const sqlReservationStates = /check \(state in \(([^)]*)\)\)/.exec(reservationsDdl)[1].match(/'([A-Z_]+)'/g)
assert.deepEqual(
  sqlReservationStates.map((s) => s.replace(/'/g, '')).sort(),
  [...RESERVATION_STATES].sort(),
  'reservations.state CHECK must be exactly the domain reservation state set'
)

// --- every operation exists, with the arguments constraint 6 requires ---------
for (const op of OFFER_TRANSITION_OPERATIONS) {
  const fn = sqlFunction(op.fn)

  assert.match(fn.header, /security definer/i, `${op.fn} must be SECURITY DEFINER`)
  assert.match(fn.header, /set search_path/i, `${op.fn} must pin search_path`)

  if (!op.clientCallable) continue

  assert.match(fn.header, /p_expected_revision\s+integer/i, `${op.fn} must take the caller's expected revision`)
  assert.match(fn.header, /p_idempotency_key\s+text/i, `${op.fn} must take an idempotency key`)

  // The key is claimed before anything is applied, and the claim is completed
  // after. A claim taken after the effect would leave a retry free to re-apply.
  const claim = fn.body.indexOf('claim_offer_operation(')
  const apply = fn.body.indexOf('apply_offer_transition(')
  const complete = fn.body.indexOf('complete_offer_operation(')
  assert.ok(claim > -1, `${op.fn} must claim an idempotency key`)
  assert.ok(apply > -1, `${op.fn} must apply its hops through the choke point`)
  assert.ok(complete > -1, `${op.fn} must complete its idempotency claim`)
  assert.ok(claim < apply, `${op.fn} must claim the key before applying anything`)
  assert.ok(apply < complete, `${op.fn} must complete the claim after applying`)

  // A replayed call returns the recorded result and applies nothing.
  assert.match(fn.body, /if v_replay is not null then\s*\n\s*return/i, `${op.fn} must return early on replay`)

  // auth.uid() is the actor. A caller-supplied member id would be the legacy
  // device_id hole in a new shape (rev. 5.3 §14 risk 1).
  assert.match(fn.body, /auth\.uid\(\)/, `${op.fn} must take its actor from auth.uid()`)
  assert.equal(/p_actor_id\s+uuid/i.test(fn.header), false, `${op.fn} must not let a caller name the actor`)
}

// --- the choke point ----------------------------------------------------------
const choke = sqlFunction('apply_offer_transition')

// Order inside the choke point is the race defence, so it is asserted as order:
// lock, then compare, then check the edge, then write.
const lock = choke.body.indexOf('for update')
const compare = choke.body.indexOf('p_expected_revision <> v_revision')
const edgeCheck = choke.body.indexOf('offer_transition_allowed(')
const write = choke.body.indexOf('update public.offers')
assert.ok(lock > -1, 'the choke point must lock the offer row')
assert.ok(lock < compare, 'the row must be locked before its revision is compared')
assert.ok(compare < edgeCheck, 'a stale caller is refused before its transition is judged')
assert.ok(edgeCheck < write, 'the edge is checked before the row is written')

assert.match(
  choke.body,
  new RegExp(`errcode = '${TRANSITION_ERRCODES.CONFLICT}'`),
  `a revision conflict must raise SQLSTATE ${TRANSITION_ERRCODES.CONFLICT}`
)
assert.match(choke.body, /errcode = '55000'/, 'an illegal transition must raise SQLSTATE 55000')
assert.match(choke.body, /insert into public\.offer_transitions/, 'every applied hop must be recorded')
assert.match(choke.body, /revision\s+=\s+v_next/, 'the revision must move with the state')

// The SQLSTATEs the domain module tells callers to branch on are the ones the
// SQL actually raises.
for (const code of Object.values(TRANSITION_ERRCODES)) {
  assert.ok(migration.includes(`errcode = '${code}'`), `the M3 migrations must raise SQLSTATE ${code}`)
}

// --- idempotency machinery ----------------------------------------------------
const claimFn = sqlFunction('claim_offer_operation')
assert.match(
  claimFn.body,
  new RegExp(`errcode = '${TRANSITION_ERRCODES.IN_FLIGHT}'`),
  `an in-flight idempotency claim must raise SQLSTATE ${TRANSITION_ERRCODES.IN_FLIGHT}`
)
assert.match(
  claimFn.body,
  new RegExp(`char_length\\(v_key\\) < ${IDEMPOTENCY_KEY_MIN_LENGTH}`),
  'the SQL key minimum must match the domain constant'
)
assert.match(
  claimFn.body,
  new RegExp(`char_length\\(v_key\\) > ${IDEMPOTENCY_KEY_MAX_LENGTH}`),
  'the SQL key maximum must match the domain constant'
)
assert.match(claimFn.body, /on conflict \(actor_id, idempotency_key\) do nothing/i, 'the claim must be a real claim')
assert.match(claimFn.body, /v_op is distinct from p_operation/i, 'a key reused for another operation must be refused')
assert.match(claimFn.body, /still in flight/i, 'an incomplete concurrent claim must not read as a result')

assert.match(
  migration,
  /primary key \(actor_id, idempotency_key\)/,
  'the claim table primary key is the serialisation point; without it two retries can both proceed'
)
assert.match(
  migration,
  /constraint offer_transitions_revision_steps_by_one check \(to_revision = from_revision \+ 1\)/,
  'the ledger must enforce that a revision steps by exactly one'
)

// --- the partial-unique live-seat constraint (rev. 5.3 §8 M3) -----------------
const liveIndex = /create unique index if not exists reservations_one_live_seat_per_rider([\s\S]*?);/.exec(migration)[0]
assert.match(liveIndex, /on public\.reservations \(offer_id, rider_id\)/)
for (const state of LIVE_RESERVATION_STATES) {
  assert.ok(liveIndex.includes(`'${state}'`), `the live-seat index must cover ${state}`)
}
assert.equal(
  liveIndex.includes("'RELEASED'"),
  false,
  'a released seat must not block the rider from reserving again'
)

// =============================================================================
// D-29 — the conflict paths fail fast and are named
//
// 0002 raised both conflict paths as SQLSTATE 40001 (serialization_failure).
// 40001 is the class the stack treats as transient and retries; a revision
// conflict is permanent, so through PostgREST the most ordinary contention
// outcome in the whole design became a 125-second gateway timeout carrying no
// SQLSTATE at all — i.e. it was delivered as exactly the transport error that
// TRANSITION_ERRCODES exists to be distinguishable from.
//
// 0003 re-raises them as PostgREST's PTnnn form, which also sets the HTTP status
// (409 Conflict, 425 Too Early). These assertions are what stops 40001 coming
// back.
// =============================================================================
for (const name of ['apply_offer_transition', 'claim_offer_operation']) {
  assert.equal(
    /errcode = '40001'/.test(sqlFunction(name).body),
    false,
    `${name} must not raise 40001: it is retried as transient, and neither conflict path is (D-29)`
  )
}

assert.equal(
  Object.values(TRANSITION_ERRCODES).includes('40001'),
  false,
  'no published transition errcode may be 40001'
)

// A conflict must be catchable by the UI on the first response, so the two codes
// callers branch on are required to be distinct and non-retryable-by-the-stack.
assert.notEqual(TRANSITION_ERRCODES.CONFLICT, TRANSITION_ERRCODES.IN_FLIGHT)
assert.equal(new Set(Object.values(TRANSITION_ERRCODES)).size, Object.values(TRANSITION_ERRCODES).length)
for (const code of [TRANSITION_ERRCODES.CONFLICT, TRANSITION_ERRCODES.IN_FLIGHT]) {
  assert.match(code, /^PT[1-5]\d{2}$/, `${code} must be PostgREST's PTnnn form so it sets an HTTP status`)
}
assert.equal(TRANSITION_ERRCODES.CONFLICT, 'PT409', 'a revision conflict is 409 Conflict')
assert.equal(TRANSITION_ERRCODES.IN_FLIGHT, 'PT425', 'an in-flight duplicate key is 425 Too Early')

// 0003 must REPLACE the two functions, not overload them. `create or replace`
// keys on the argument type list, so a single changed parameter would leave
// 0002's definition live alongside a second one and the fix would silently not
// apply.
for (const name of ['apply_offer_transition', 'claim_offer_operation']) {
  const defs = definitionsOf(name)
  assert.equal(defs.length, 2, `${name} must be defined by 0002 and re-created by 0003`)
  assert.equal(defs[1].file, '0003_resolve_transition_conflicts.sql')
  assert.equal(
    defs[0].header.replace(/\s+/g, ' ').trim(),
    defs[1].header.replace(/\s+/g, ' ').trim(),
    `0003 must re-create ${name} with 0002's exact signature, or it creates an overload instead of replacing`
  )
  assert.match(defs[1].header, /security definer/i, `${name} must remain SECURITY DEFINER`)
  assert.match(defs[1].header, /set search_path = public, pg_temp/i, `${name} must keep search_path pinned`)
}

// ...and must change nothing else. Normalising the two conflict codes back to
// 40001 has to make 0003's bodies identical to 0002's: that is the whole claim
// of the migration, stated as a test rather than as a comment.
const normalise = (body) =>
  body
    .replace(/^\s*--.*$/gm, '')
    .replace(/'PT409'|'PT425'/g, "'40001'")
    .replace(/\s+/g, ' ')
    .trim()

for (const name of ['apply_offer_transition', 'claim_offer_operation']) {
  const [before, after] = definitionsOf(name)
  assert.equal(
    normalise(after.body),
    normalise(before.body),
    `0003 must change nothing in ${name} but the raised SQLSTATE`
  )
}

// The revision check still comes before the edge check in the re-created choke
// point — the errcode moved, the order that makes it correct did not.
const fixedLock = choke.body.indexOf('for update')
const fixedCompare = choke.body.indexOf('p_expected_revision <> v_revision')
const fixedEdge = choke.body.indexOf('offer_transition_allowed(')
assert.ok(fixedLock > -1 && fixedLock < fixedCompare, 'the re-created choke point must still lock before comparing')
assert.ok(fixedCompare < fixedEdge, 'the re-created choke point must still refuse a stale caller before judging the edge')

// --- the caller-side half of the contract -------------------------------------
// A UI that cannot tell a conflict from a transport failure cannot show the §10
// "seat just taken" message, which is the entire point of the code.
assert.equal(isConflictError({ code: TRANSITION_ERRCODES.CONFLICT }), true)
assert.equal(isConflictError({ code: TRANSITION_ERRCODES.IN_FLIGHT }), false)
assert.equal(isConflictError({ message: 'upstream request timeout' }), false, 'a codeless failure is not a conflict')
assert.equal(isConflictError(null), false)
assert.equal(isConflictError(undefined), false)
assert.equal(isConflictError('PT409'), false, 'the code must be carried by an error object, not be one')

assert.equal(isRetryableError({ code: TRANSITION_ERRCODES.IN_FLIGHT }), true)
assert.equal(isRetryableError({ code: TRANSITION_ERRCODES.CONFLICT }), false, 'a revision conflict must never be retried')
assert.equal(isRetryableError({ code: '40001' }), false, 'the retryable-looking code is no longer raised')

assert.equal(transitionErrcodeOf({ code: TRANSITION_ERRCODES.ILLEGAL_STATE }), '55000')
assert.equal(transitionErrcodeOf({ code: '42P01' }), undefined, 'an unpublished SQLSTATE is not a transition errcode')
assert.equal(transitionErrcodeOf({}), undefined)
assert.equal(isTransitionErrcode('PT409'), true)
assert.equal(isTransitionErrcode('40001'), false)

// checkRevision, the domain-side prediction of the same refusal, reports the
// same code the SQL now raises.
const stale = checkRevision(2, 1)
assert.equal(stale.ok, false)
assert.equal(stale.errcode, TRANSITION_ERRCODES.CONFLICT)
assert.equal(isConflictError({ code: stale.errcode }), true, 'the predicted code must be the one callers catch')

// =============================================================================
// 0027 — offer_cancel is the poster's or a moderator's, never a rider's
// (issue #133, D-83). Same discipline as the 0003 block above: the correction
// must REPLACE, not overload; must change exactly the guard; and the effective
// definition the tests read must be 0027's.
// =============================================================================
{
  const cancelOp = OFFER_TRANSITION_OPERATIONS.find((op) => op.fn === 'offer_cancel')
  assert.equal(cancelOp.actor, 'poster_or_moderator', 'the domain module must say who may cancel: the poster or a moderator')
  assert.equal(
    OFFER_TRANSITION_OPERATIONS.some((op) => op.actor === 'participant'),
    false,
    'no operation is "participant"-callable any more: a rider holding a seat may not end the ride for everyone'
  )

  const defs = definitionsOf('offer_cancel')
  assert.equal(defs.length, 2, 'offer_cancel must be defined by 0002 and re-created by 0027')
  assert.equal(defs[0].file, '0002_ride_coordinator_state.sql')
  assert.equal(defs[1].file, '0027_offer_cancel_poster_or_moderator.sql')
  assert.equal(
    defs[0].header.replace(/\s+/g, ' ').trim(),
    defs[1].header.replace(/\s+/g, ' ').trim(),
    "0027 must re-create offer_cancel with 0002's exact signature, or it creates an overload instead of replacing"
  )
  assert.match(defs[1].header, /security definer/i, 'offer_cancel must remain SECURITY DEFINER')
  assert.match(defs[1].header, /set search_path = public, pg_temp/i, 'offer_cancel must keep search_path pinned')

  const [before, after] = defs
  const OLD_GUARD =
    /if v_poster <> v_actor\s+and not exists \(\s*select 1\s+from public\.reservations r\s+where r\.offer_id = p_offer_id\s+and r\.rider_id = v_actor\s+and r\.state in \('ACTIVE', 'CONFIRMED'\)\s*\) then\s+raise exception 'only a participant may cancel this offer' using errcode = '42501';/i
  const NEW_GUARD =
    /if v_poster <> v_actor and not public\.caller_is_moderator\(\) then\s+raise exception 'only the poster or a moderator may cancel this offer' using errcode = '42501';/i
  assert.match(before.body, OLD_GUARD, "0002's offer_cancel admitted any rider holding a live seat — the defect #133 names")
  assert.match(after.body, NEW_GUARD, "0027's offer_cancel must gate on the poster or caller_is_moderator()")
  assert.equal(OLD_GUARD.test(after.body), false, '0027 must not keep the reservation-holder branch of the guard')
  assert.equal(
    /from public\.reservations r\s+where/i.test(after.body),
    false,
    "0027's guard must not consult reservations at all — a seat is not authority over the offer"
  )

  // Everything but the guard is byte-for-byte 0002: the idempotency claim and
  // completion, the lock, the P0002, the hop, the cascade to live reservations.
  const rewritten = before.body.replace(
    OLD_GUARD,
    "if v_poster <> v_actor and not public.caller_is_moderator() then raise exception 'only the poster or a moderator may cancel this offer' using errcode = '42501';"
  )
  assert.equal(normalise(after.body), normalise(rewritten), '0027 must change nothing in offer_cancel but the guard')
  assert.match(after.body, /update public\.reservations\s+set\s+state\s+=\s+'CANCELLED'/i, "the poster's cancel still cascades to every live seat")

  // The grants travel with the re-creation: revoked from PUBLIC and anon,
  // granted to authenticated, on the exact signature.
  const sql0027 = M3_MIGRATIONS[2].sql
  assert.match(sql0027, /revoke all on function public\.offer_cancel\(uuid, integer, text\) from public;/)
  assert.match(sql0027, /revoke all on function public\.offer_cancel\(uuid, integer, text\) from anon;/)
  assert.match(sql0027, /grant execute on function public\.offer_cancel\(uuid, integer, text\) to authenticated;/)
  assert.match(sql0027, /--\s*APPLIED:\s*no\b/, '0027 ships unapplied; applying it is a separate authorised act')
}

// Offer state machine — asserted against rev. 5.3 §8 M3.
//
// The point of these tests is that the machine in src/lib/domain/offer-state.ts
// is a transcription of a specific diagram, not a design choice made here. Each
// block below names the §8 M3 line it enforces.

import { strict as assert } from 'node:assert'
import {
  CONFIRMED_OR_LATER_STATES,
  OFFER_STATES,
  OFFER_TRANSITIONS,
  OPEN_OFFER_STATES,
  TERMINAL_OFFER_STATES,
  canTransition,
  checkTransition,
  isOfferState,
  isTerminalOfferState,
  nextOfferStates,
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

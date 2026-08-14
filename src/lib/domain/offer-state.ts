/**
 * Offer state machine — rev. 5.3 §8 M3.
 *
 * This is the *specification* of the machine, expressed as data so it can be
 * asserted against. It is deliberately pure: no I/O, no Supabase client, no
 * React. It decides nothing at runtime on its own.
 *
 * Authority note (rev. 5.3 §12 constraint 6): the authoritative transitions are
 * SECURITY DEFINER SQL functions with revision checks and idempotency keys. This
 * module exists so the UI can render legal actions and so the SQL functions have
 * a committed, testable reference to be checked against — it is **not** the
 * enforcement point, and adding a transition here does not create one.
 *
 * The SQL side is `supabase/migrations/0002_ride_coordinator_state.sql`, which
 * transcribes the same edge list into `offer_transition_allowed()` and routes
 * every write through it. `tests/offer-state-machine.test.mjs` compares the two
 * edge-for-edge, so the SQL and this module cannot drift apart silently.
 */

export const OFFER_STATES = [
  'DRAFT',
  'OPEN',
  'PARTIALLY_RESERVED',
  'RESERVED',
  'CONFIRMED',
  'ARRIVING',
  'PICKED_UP',
  'COMPLETED',
  'RELEASED',
  'CANCELLED',
  'EXPIRED',
] as const

export type OfferState = (typeof OFFER_STATES)[number]

/**
 * Transitions, transcribed from the rev. 5.3 §8 M3 diagram. Each key lists every
 * state reachable in one step.
 *
 * `RELEASED → OPEN | PARTIALLY_RESERVED` carries the rev. 5.3 note that "a rider
 * releasing one seat of several recomputes state from remaining count" — the
 * destination depends on seats remaining, which is why both edges exist.
 */
export const OFFER_TRANSITIONS: Readonly<Record<OfferState, readonly OfferState[]>> = {
  DRAFT: ['OPEN'],
  OPEN: ['PARTIALLY_RESERVED', 'CANCELLED', 'EXPIRED'],
  PARTIALLY_RESERVED: ['RESERVED', 'RELEASED', 'CANCELLED', 'EXPIRED'],
  RESERVED: ['CONFIRMED', 'RELEASED', 'CANCELLED'],
  CONFIRMED: ['ARRIVING', 'CANCELLED'],
  ARRIVING: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['COMPLETED'],
  RELEASED: ['OPEN', 'PARTIALLY_RESERVED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
}

/** States with no outgoing transition. */
export const TERMINAL_OFFER_STATES: readonly OfferState[] = ['COMPLETED', 'CANCELLED', 'EXPIRED']

/**
 * States counted by the rev. 5.3 §13 "board-non-empty" metric and by
 * `offers_visible_for_caller` (rev. 5.3 §8 M3) as browsable by a member who is not
 * already a participant.
 */
export const OPEN_OFFER_STATES: readonly OfferState[] = ['OPEN', 'PARTIALLY_RESERVED']

/**
 * States that count towards the rev. 5.3 §13 north-star metric, "rides reaching
 * CONFIRMED-or-later". `COMPLETED` is reported but never gated.
 */
export const CONFIRMED_OR_LATER_STATES: readonly OfferState[] = [
  'CONFIRMED',
  'ARRIVING',
  'PICKED_UP',
  'COMPLETED',
]

export function isOfferState(value: unknown): value is OfferState {
  return typeof value === 'string' && (OFFER_STATES as readonly string[]).includes(value)
}

export function isTerminalOfferState(state: OfferState): boolean {
  return TERMINAL_OFFER_STATES.includes(state)
}

export function nextOfferStates(state: OfferState): readonly OfferState[] {
  return OFFER_TRANSITIONS[state]
}

export function canTransition(from: OfferState, to: OfferState): boolean {
  return OFFER_TRANSITIONS[from].includes(to)
}

export type TransitionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

/**
 * Non-throwing transition check with a reason, for surfacing at a boundary.
 * Callers that want an exception should raise it themselves; this module does
 * not choose an error type for its consumers.
 */
export function checkTransition(from: OfferState, to: OfferState): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: `no-op transition: offer is already ${from}` }
  }
  if (isTerminalOfferState(from)) {
    return { ok: false, reason: `${from} is terminal; no transition out of it is legal` }
  }
  if (!canTransition(from, to)) {
    return { ok: false, reason: `illegal transition ${from} -> ${to}` }
  }
  return { ok: true }
}

/**
 * Shortest legal hop sequence from one state to another, excluding `from` and
 * including `to`; `null` when no path exists.
 *
 * This exists because two §8 M3 outcomes are two hops, not one, and the machine
 * as drawn has no single edge for either:
 *
 *   - a one-seat offer filling: `OPEN -> PARTIALLY_RESERVED -> RESERVED`, because
 *     the diagram has no `OPEN -> RESERVED` edge and this module does not invent
 *     one to make a convenient case shorter;
 *   - a seat being given back: `RESERVED -> RELEASED -> OPEN`, which is how the
 *     diagram spells it.
 *
 * The SQL applies each hop through the same choke point, so both hops are
 * revision-checked and both appear in `offer_transitions`.
 */
export function transitionPath(from: OfferState, to: OfferState): readonly OfferState[] | null {
  if (from === to) return null

  const visited: OfferState[] = [from]
  const queue: OfferState[][] = [[from]]

  while (queue.length > 0) {
    const path = queue.shift() as OfferState[]
    for (const next of OFFER_TRANSITIONS[path[path.length - 1]]) {
      if (visited.includes(next)) continue
      const extended = path.concat(next)
      if (next === to) return extended.slice(1)
      visited.push(next)
      queue.push(extended)
    }
  }

  return null
}

/**
 * The state an offer holds once `seatsTaken` of `seatsTotal` are spoken for.
 *
 * Mirrors the recompute in `offer_reserve_seat()`. Note that it never returns
 * `OPEN`: an offer with zero seats taken is not *recomputed* into `OPEN`, it
 * simply never left it.
 */
export function stateAfterReservation(seatsTotal: number, seatsTaken: number): OfferState {
  if (!Number.isInteger(seatsTotal) || seatsTotal < 1) {
    throw new RangeError(`seatsTotal must be a positive integer, got ${seatsTotal}`)
  }
  if (!Number.isInteger(seatsTaken) || seatsTaken < 1 || seatsTaken > seatsTotal) {
    throw new RangeError(`seatsTaken must be an integer in 1..${seatsTotal}, got ${seatsTaken}`)
  }
  return seatsTaken >= seatsTotal ? 'RESERVED' : 'PARTIALLY_RESERVED'
}

/**
 * The state an offer returns to after a release, computed from the seats still
 * held — rev. 5.3 §8 M3: "a rider releasing one seat of several recomputes state
 * from remaining count". Mirrors the recompute in `offer_release_seat()`.
 */
export function stateAfterRelease(seatsRemaining: number): OfferState {
  if (!Number.isInteger(seatsRemaining) || seatsRemaining < 0) {
    throw new RangeError(`seatsRemaining must be a non-negative integer, got ${seatsRemaining}`)
  }
  return seatsRemaining === 0 ? 'OPEN' : 'PARTIALLY_RESERVED'
}

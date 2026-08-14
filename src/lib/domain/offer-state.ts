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
 * The SQL side does not exist yet: `offers` is a Phase 1 table (see
 * `supabase/migrations/README.md`). This module lands first so the machine is
 * pinned before any code depends on it.
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

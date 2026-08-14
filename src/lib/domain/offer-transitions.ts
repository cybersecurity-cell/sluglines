/**
 * Offer transition *operations* — the writer side of rev. 5.3 §8 M3.
 *
 * `offer-state.ts` says which edges exist. This module says which SECURITY
 * DEFINER function owns each edge, who may call it, and what a caller must
 * supply for the call to be accepted:
 *
 *   rev. 5.3 §12 constraint 6 — "State transitions are SECURITY DEFINER SQL
 *   functions with revision checks and idempotency keys."
 *
 * Same authority note as `offer-state.ts`: this is a committed *reference*, not
 * the enforcement point. `supabase/migrations/0002_ride_coordinator_state.sql`
 * enforces. The two are compared statically by
 * `tests/offer-state-machine.test.mjs` — the operation names here must be the
 * function names there, the edge union here must be the whole graph, and the
 * error codes and key bounds here must be the ones the SQL raises.
 */

import { OFFER_TRANSITIONS, canTransition } from './offer-state.ts'
import type { OfferState, TransitionCheck } from './offer-state.ts'

/** Offer revisions start here and step by exactly one per applied hop. */
export const REVISION_START = 1

/**
 * Idempotency keys are client-supplied opaque strings. The bounds are a shape
 * check, not an authenticity check — the key is scoped to the calling member, so
 * one member cannot replay or block another's operation by guessing a key.
 */
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8
export const IDEMPOTENCY_KEY_MAX_LENGTH = 200

/**
 * SQLSTATEs the SQL raises, kept here so a caller can branch on a stable code
 * rather than on message text. The UI distinction rev. 5.3 §10 requires — "seat
 * just taken" vs. a network failure — is exactly `CONFLICT` vs. a transport
 * error.
 */
export const TRANSITION_ERRCODES = {
  /** Optimistic-concurrency failure: the offer moved under the caller. */
  CONFLICT: '40001',
  /** The edge does not exist, or the offer is not in a state the operation accepts. */
  ILLEGAL_STATE: '55000',
  /** A malformed argument, including a malformed or re-used idempotency key. */
  INVALID_ARGUMENT: '22023',
  /** No session, or a session that does not own the row. */
  FORBIDDEN: '42501',
  /** The offer or reservation does not exist. */
  NOT_FOUND: 'P0002',
} as const

export type TransitionErrcode = (typeof TRANSITION_ERRCODES)[keyof typeof TRANSITION_ERRCODES]

/** Who the SQL requires `auth.uid()` to be for the call to be accepted. */
export type TransitionActor =
  | 'poster'
  | 'rider'
  /** The poster or any rider holding a live reservation (the §8 M3 bail-out). */
  | 'participant'
  /** No session: a sweep run by the scheduler as the function owner. */
  | 'system'

export interface OfferTransitionOperation {
  /** Unqualified name of the SECURITY DEFINER function in `public`. */
  readonly fn: string
  /** Every single-hop edge this operation may apply. Each must be legal. */
  readonly edges: readonly (readonly [OfferState, OfferState])[]
  readonly actor: TransitionActor
  /** `false` means the function is never granted to `authenticated`. */
  readonly clientCallable: boolean
  /** Where in rev. 5.3 the operation comes from. */
  readonly source: string
}

/**
 * The operations, one per §8 M3 write path.
 *
 * The invariant asserted by the tests is that the union of `edges` is the entire
 * `OFFER_TRANSITIONS` graph: no edge without a writer, and no writer claiming an
 * edge the machine does not have.
 */
export const OFFER_TRANSITION_OPERATIONS: readonly OfferTransitionOperation[] = [
  {
    fn: 'offer_publish',
    edges: [['DRAFT', 'OPEN']],
    actor: 'poster',
    clientCallable: true,
    source: '§8 M3 "DRAFT -> OPEN"',
  },
  {
    // Two edges because a one-seat offer fills in one call: the machine has no
    // OPEN -> RESERVED edge, so the call applies both hops rather than skipping.
    fn: 'offer_reserve_seat',
    edges: [
      ['OPEN', 'PARTIALLY_RESERVED'],
      ['PARTIALLY_RESERVED', 'RESERVED'],
    ],
    actor: 'rider',
    clientCallable: true,
    source: '§8 M3 + POST /api/reservations',
  },
  {
    // RELEASED is transient: it is entered and left inside one transaction, so
    // no client ever observes an offer sitting in it.
    fn: 'offer_release_seat',
    edges: [
      ['PARTIALLY_RESERVED', 'RELEASED'],
      ['RESERVED', 'RELEASED'],
      ['RELEASED', 'OPEN'],
      ['RELEASED', 'PARTIALLY_RESERVED'],
    ],
    actor: 'rider',
    clientCallable: true,
    source: '§8 M3 "RESERVED -> RELEASED -> OPEN"',
  },
  {
    fn: 'offer_confirm',
    edges: [['RESERVED', 'CONFIRMED']],
    actor: 'poster',
    clientCallable: true,
    source: '§8 M3 + POST /api/offers/confirm',
  },
  {
    fn: 'offer_advance',
    edges: [
      ['CONFIRMED', 'ARRIVING'],
      ['ARRIVING', 'PICKED_UP'],
      ['PICKED_UP', 'COMPLETED'],
    ],
    actor: 'poster',
    clientCallable: true,
    source: '§8 M3 + POST /api/offers/advance',
  },
  {
    // Includes the two edges rev. 5 added (CONFIRMED | ARRIVING -> CANCELLED),
    // which M9's cancel SMS event and P4's waitlist renotify both depend on.
    fn: 'offer_cancel',
    edges: [
      ['OPEN', 'CANCELLED'],
      ['PARTIALLY_RESERVED', 'CANCELLED'],
      ['RESERVED', 'CANCELLED'],
      ['CONFIRMED', 'CANCELLED'],
      ['ARRIVING', 'CANCELLED'],
    ],
    actor: 'participant',
    clientCallable: true,
    source: '§8 M3 + POST /api/offers/cancel',
  },
  {
    // Time-driven, so it carries no idempotency key: re-running the sweep finds
    // nothing left to expire, which is idempotence by construction.
    fn: 'offer_expire_sweep',
    edges: [
      ['OPEN', 'EXPIRED'],
      ['PARTIALLY_RESERVED', 'EXPIRED'],
    ],
    actor: 'system',
    clientCallable: false,
    source: '§8 M3 "OPEN | PARTIALLY_RESERVED -> EXPIRED"',
  },
]

/** The operation that owns an edge, or `undefined` if the graph has no writer for it. */
export function operationForEdge(from: OfferState, to: OfferState): OfferTransitionOperation | undefined {
  return OFFER_TRANSITION_OPERATIONS.find((op) => op.edges.some(([f, t]) => f === from && t === to))
}

export function isIdempotencyKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length >= IDEMPOTENCY_KEY_MIN_LENGTH && trimmed.length <= IDEMPOTENCY_KEY_MAX_LENGTH
}

export function nextRevision(current: number): number {
  if (!Number.isInteger(current) || current < REVISION_START) {
    throw new RangeError(`revision must be an integer >= ${REVISION_START}, got ${current}`)
  }
  return current + 1
}

export type TransitionRequestCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly errcode: TransitionErrcode }

/**
 * The optimistic-concurrency check, in the domain layer so the UI can predict
 * the outcome the SQL will reach. It is *not* the guard: the SQL re-reads the
 * revision under `for update` inside the transaction, which is the only place
 * the comparison is safe against a concurrent writer.
 */
export function checkRevision(currentRevision: number, expectedRevision: unknown): TransitionRequestCheck {
  if (!Number.isInteger(expectedRevision)) {
    return {
      ok: false,
      reason: `expected_revision must be an integer, got ${String(expectedRevision)}`,
      errcode: TRANSITION_ERRCODES.INVALID_ARGUMENT,
    }
  }
  if (expectedRevision !== currentRevision) {
    return {
      ok: false,
      reason: `revision conflict: offer is at revision ${currentRevision}, caller expected ${String(expectedRevision)}`,
      errcode: TRANSITION_ERRCODES.CONFLICT,
    }
  }
  return { ok: true }
}

export interface TransitionRequest {
  readonly from: OfferState
  readonly to: OfferState
  readonly currentRevision: number
  readonly expectedRevision: unknown
  readonly idempotencyKey: unknown
}

/**
 * All three gates in the order the SQL applies them: argument shape, then
 * revision, then legality. The order matters — a caller holding a stale revision
 * gets `CONFLICT` rather than a misleading "illegal transition" describing a
 * state it was never looking at.
 */
export function checkTransitionRequest(request: TransitionRequest): TransitionRequestCheck {
  if (!isIdempotencyKey(request.idempotencyKey)) {
    return {
      ok: false,
      reason: `idempotency_key must be ${IDEMPOTENCY_KEY_MIN_LENGTH} to ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
      errcode: TRANSITION_ERRCODES.INVALID_ARGUMENT,
    }
  }

  const revision = checkRevision(request.currentRevision, request.expectedRevision)
  if (!revision.ok) return revision

  if (!canTransition(request.from, request.to)) {
    return {
      ok: false,
      reason: `illegal transition ${request.from} -> ${request.to}`,
      errcode: TRANSITION_ERRCODES.ILLEGAL_STATE,
    }
  }

  return { ok: true }
}

/** Narrowing re-export so a caller can use one check shape for both modules. */
export function toTransitionCheck(result: TransitionRequestCheck): TransitionCheck {
  return result.ok ? { ok: true } : { ok: false, reason: result.reason }
}

/**
 * Reservation states. rev. 5.3 §8 M3 specifies "reservations with partial-unique
 * ACTIVE constraint" and §13 counts "no-show-marked reservations ÷ CONFIRMED
 * reservations", so `ACTIVE` and `CONFIRMED` are both named by the spec.
 *
 * `NO_SHOW` is deliberately absent: rev. 5.3 §11 Phase 4 owns the no-show flow,
 * and this slice ships no writer for it. A state with no writer is a state that
 * cannot be reached, and committing one now would only make the CHECK list look
 * more complete than the machine is.
 */
export const RESERVATION_STATES = ['ACTIVE', 'CONFIRMED', 'RELEASED', 'CANCELLED'] as const

export type ReservationState = (typeof RESERVATION_STATES)[number]

/**
 * Reservation states that occupy a seat. The partial unique index on
 * `(offer_id, rider_id)` covers exactly these, which is what stops one rider
 * from holding two seats on one offer.
 */
export const LIVE_RESERVATION_STATES: readonly ReservationState[] = ['ACTIVE', 'CONFIRMED']

/** Every edge in the graph, as `FROM->TO` strings. Used by the SQL cross-check. */
export function offerEdgeList(): readonly string[] {
  return Object.entries(OFFER_TRANSITIONS)
    .flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`))
    .sort()
}

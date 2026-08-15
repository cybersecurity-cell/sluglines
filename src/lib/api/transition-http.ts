/**
 * HTTP translation for the M3 write path — the caller-side half of D-30.
 *
 * `lib/domain` publishes the SQLSTATEs the SECURITY DEFINER functions raise and
 * the predicates that classify them (`isConflictError`, `isRetryableError`,
 * `transitionErrcodeOf`). This module is the one place that turns those into a
 * status line and a response body, so no route re-invents the mapping and no
 * route can quietly omit a code.
 *
 * Deliberately pure: no `next/server`, no Supabase client, no I/O. That is what
 * lets `tests/api-routes.test.mjs` execute the mapping directly under
 * `node --experimental-strip-types` instead of asserting on route source text.
 *
 * Authority note, unchanged from `offer-state.ts`: none of this is the
 * enforcement point. The database refuses; this module reports the refusal. A
 * caller that bypassed these routes entirely would meet the same refusals from
 * RLS and the same `auth.uid()` checks inside each function.
 */

import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  REVISION_START,
  TRANSITION_ERRCODES,
  isIdempotencyKey,
  transitionErrcodeOf,
} from '../domain/offer-transitions.ts'
import type { TransitionErrcode } from '../domain/offer-transitions.ts'

/**
 * Stable machine-readable classification, carried in every error body. The UI
 * branches on this, never on `message`.
 */
export const TRANSITION_ERROR_KINDS = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'invalid_argument',
  'illegal_state',
  'conflict',
  'in_flight',
  'unavailable',
  'not_implemented',
] as const

export type TransitionErrorKind = (typeof TRANSITION_ERROR_KINDS)[number]

/**
 * SQLSTATE -> HTTP status.
 *
 * `CONFLICT` is the only code that maps to **409**, and that exclusivity is the
 * point: rev. 5.3 §10 asks the UI to explain "seat just taken" rather than report
 * a generic failure, and D-30 made that code arrive as a status line. A client
 * that reads nothing but the status line still gets the §10 distinction right.
 * `ILLEGAL_STATE` is therefore 422 and not 409 — it also means "re-read the
 * offer", but it is not the seat-just-taken case and must not be shown as one.
 *
 * `IN_FLIGHT` keeps PostgREST's own 425: it is the single genuinely transient
 * outcome, and 425 Too Early says exactly that.
 */
export const TRANSITION_HTTP_STATUS: Readonly<Record<TransitionErrcode, number>> = {
  [TRANSITION_ERRCODES.CONFLICT]: 409,
  [TRANSITION_ERRCODES.IN_FLIGHT]: 425,
  [TRANSITION_ERRCODES.ILLEGAL_STATE]: 422,
  [TRANSITION_ERRCODES.INVALID_ARGUMENT]: 400,
  [TRANSITION_ERRCODES.FORBIDDEN]: 403,
  [TRANSITION_ERRCODES.NOT_FOUND]: 404,
}

export const TRANSITION_ERROR_KIND_BY_ERRCODE: Readonly<Record<TransitionErrcode, TransitionErrorKind>> = {
  [TRANSITION_ERRCODES.CONFLICT]: 'conflict',
  [TRANSITION_ERRCODES.IN_FLIGHT]: 'in_flight',
  [TRANSITION_ERRCODES.ILLEGAL_STATE]: 'illegal_state',
  [TRANSITION_ERRCODES.INVALID_ARGUMENT]: 'invalid_argument',
  [TRANSITION_ERRCODES.FORBIDDEN]: 'forbidden',
  [TRANSITION_ERRCODES.NOT_FOUND]: 'not_found',
}

/**
 * A refusal that carried no SQLSTATE. D-29 is precisely the bug where a real
 * conflict arrived in this shape, so this is reported as an upstream failure —
 * 502, not 500 — and never as a decision the database made.
 */
export const TRANSPORT_FAILURE_STATUS = 502

/**
 * Messages are authored here, not forwarded from Postgres. The SQL's own
 * `raise exception` text is written for an operator and names offers and
 * revisions; rev. 5.3 §12 constraint 3 keeps member-adjacent text out of
 * anything it does not have to reach. The contract a client depends on is
 * `kind` + `errcode`, which are stable; `message` is a default the UI may
 * replace.
 */
const MESSAGE_BY_KIND: Readonly<Record<TransitionErrorKind, string>> = {
  unauthenticated: 'Sign in to continue.',
  forbidden: 'You are not allowed to perform this action on this offer.',
  not_found: 'That offer no longer exists.',
  invalid_argument: 'The request was malformed.',
  illegal_state: 'This offer is not in a state that allows that action.',
  conflict: 'This offer changed while you were deciding. Re-open it and try again.',
  in_flight: 'That request is still being processed. Retry with the same idempotency key.',
  unavailable: 'The coordinator is unreachable. Retry with the same idempotency key.',
  not_implemented: 'That endpoint is not available yet.',
}

/**
 * Retry safety, not retry likelihood.
 *
 * Both of these are safe to retry *only because* the operation carries an
 * idempotency key: a same-key retry either finds the first call still committing
 * or replays its result, and applies nothing twice. A conflict is never
 * retryable at all — every retry re-reads the same revision and fails
 * identically (D-29).
 */
const RETRYABLE_KINDS: readonly TransitionErrorKind[] = ['in_flight', 'unavailable']

export interface TransitionErrorBody {
  readonly error: {
    readonly kind: TransitionErrorKind
    readonly message: string
    /** The SQLSTATE the database raised, or `null` when the refusal carried none. */
    readonly errcode: TransitionErrcode | null
    /** Safe to retry with the *same* idempotency key. Never true for a conflict. */
    readonly retryable: boolean
  }
}

export interface TransitionFailure {
  readonly status: number
  readonly body: TransitionErrorBody
}

export function transitionError(kind: TransitionErrorKind, errcode: TransitionErrcode | null = null): TransitionErrorBody {
  return {
    error: {
      kind,
      message: MESSAGE_BY_KIND[kind],
      errcode,
      retryable: RETRYABLE_KINDS.includes(kind),
    },
  }
}

/**
 * Classify a `supabase-js` failure into a status and a body.
 *
 * The `undefined` branch of `transitionErrcodeOf` is load-bearing: no SQLSTATE
 * means the refusal never reached Postgres's error path, so it is reported as
 * `unavailable` and is retryable with the same key — not as `conflict`, which
 * would tell the UI a seat was taken when nothing is known to have happened.
 */
export function transitionFailure(error: unknown): TransitionFailure {
  const errcode = transitionErrcodeOf(error)
  if (errcode === undefined) {
    return { status: TRANSPORT_FAILURE_STATUS, body: transitionError('unavailable') }
  }
  return {
    status: TRANSITION_HTTP_STATUS[errcode],
    body: transitionError(TRANSITION_ERROR_KIND_BY_ERRCODE[errcode], errcode),
  }
}

export const UNAUTHENTICATED_STATUS = 401
export const NOT_IMPLEMENTED_STATUS = 501

// -----------------------------------------------------------------------------
// Request validation
//
// There is no Zod in this project's dependency tree and this slice does not add
// one for three fields. The checks below are the same three the SQL applies, in
// the same order, so a malformed request is refused before it costs a round trip
// — but the SQL still applies all three itself, because a route is not a
// security boundary (rev. 5.3 §12 constraint 6).
// -----------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** The body every M3 transition route accepts. Field names match the SQL parameters. */
export interface TransitionInput {
  readonly offerId: string
  readonly expectedRevision: number
  readonly idempotencyKey: string
}

export type TransitionInputResult =
  | { readonly ok: true; readonly value: TransitionInput }
  | { readonly ok: false; readonly status: number; readonly body: TransitionErrorBody }

function invalid(): { readonly ok: false; readonly status: number; readonly body: TransitionErrorBody } {
  return {
    ok: false,
    status: TRANSITION_HTTP_STATUS[TRANSITION_ERRCODES.INVALID_ARGUMENT],
    body: transitionError('invalid_argument', TRANSITION_ERRCODES.INVALID_ARGUMENT),
  }
}

/**
 * Validate a decoded JSON body.
 *
 * `headerKey` is the `Idempotency-Key` request header, used when the body omits
 * `idempotency_key`. Supporting the header costs nothing and lets a generic HTTP
 * client retry safely without knowing this API's field names; the body field
 * wins when both are present.
 */
export function parseTransitionInput(raw: unknown, headerKey: string | null = null): TransitionInputResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return invalid()

  const body = raw as Record<string, unknown>
  const idempotencyKey = body.idempotency_key ?? headerKey ?? undefined

  if (!isIdempotencyKey(idempotencyKey)) return invalid()
  if (!isUuid(body.offer_id)) return invalid()

  const expectedRevision = body.expected_revision
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < REVISION_START) return invalid()

  return {
    ok: true,
    value: {
      offerId: body.offer_id,
      expectedRevision: expectedRevision as number,
      idempotencyKey: idempotencyKey.trim(),
    },
  }
}

/** Re-exported so a route file states its bounds without reaching past this module. */
export { IDEMPOTENCY_KEY_MIN_LENGTH, IDEMPOTENCY_KEY_MAX_LENGTH, REVISION_START }

export interface TransitionSuccessBody {
  readonly ok: true
  readonly offer_id: string
  /** The offer's revision *after* the hop, as returned by the SQL function. */
  readonly revision: number
}

export function transitionSuccess(offerId: string, revision: unknown): TransitionSuccessBody {
  return { ok: true, offer_id: offerId, revision: Number(revision) }
}

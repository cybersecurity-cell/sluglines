/**
 * POST /api/reservations — PR 5 "thin coordination loop".
 *
 * `tests/api-routes.test.mjs`'s own comment named this exact gap: "the bare
 * path is not this slice" when `/api/reservations/{confirm,no-show}` shipped.
 * This is that bare path — the one write nothing in the product could perform
 * before this PR: a rider claiming a seat.
 *
 * DIFFERENT SHAPE FROM `offer-transition-route.ts`, ON PURPOSE
 * ---------------------------------------------------------------------------
 * `offer_reserve_seat(p_offer_id, p_expected_revision, p_idempotency_key,
 * p_seats)` takes a fourth argument the three-argument M3 transition factory
 * cannot pass — see that file's own comment, which names this route as the
 * reason `offer_reserve_seat` is deliberately absent from its operation table.
 *
 * THE §10 "SEAT JUST TAKEN" DISTINCTION NEEDS NO NEW CODE HERE
 * ---------------------------------------------------------------------------
 * `offer_reserve_seat` raises through the same choke point
 * (`apply_offer_transition`) as every other transition, so it raises the same
 * `TRANSITION_ERRCODES`: `PT409` when the revision the caller held is stale —
 * the case where another rider's reservation landed first, i.e. "seat just
 * taken" — and no SQLSTATE at all for a transport failure. `transitionFailure`
 * already maps the first to 409/`conflict`/not-retryable and the second to
 * 502/`unavailable`/retryable; this route reuses it rather than re-deriving the
 * distinction, which is what keeps the mapping in one place (D-30).
 *
 * The one refusal specific to this function, "only N seat(s) remain" (`55000`,
 * raised when the caller's seat count no longer fits even though their
 * revision *was* current), is reported as `illegal_state`/422 — not `conflict`
 * — because the seat math, not the caller's view of the offer, is what is
 * wrong; the client's fix is still the same one `conflict` asks for
 * (re-read the offer), so the UI may treat the two kinds alike without this
 * route collapsing them into one code.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TRANSITION_ERRCODES, isIdempotencyKey } from '@/lib/domain/offer-transitions.ts'
import {
  REVISION_START,
  UNAUTHENTICATED_STATUS,
  isUuid,
  transitionError,
  transitionFailure,
  transitionSuccess,
} from './transition-http.ts'
import type { TransitionErrorBody } from './transition-http.ts'

const MIN_SEATS = 1
const MAX_SEATS = 4
const DEFAULT_SEATS = 1

interface ReserveSeatInput {
  readonly offerId: string
  readonly expectedRevision: number
  readonly idempotencyKey: string
  readonly seats: number
}

type ReserveSeatInputResult =
  | { readonly ok: true; readonly value: ReserveSeatInput }
  | { readonly ok: false; readonly status: number; readonly body: TransitionErrorBody }

function invalid(): ReserveSeatInputResult {
  return {
    ok: false,
    status: 400,
    body: transitionError('invalid_argument', TRANSITION_ERRCODES.INVALID_ARGUMENT),
  }
}

/** Same three checks as `parseTransitionInput`, plus the seat count this call adds. */
function parseReserveSeatInput(raw: unknown, headerKey: string | null): ReserveSeatInputResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return invalid()

  const body = raw as Record<string, unknown>
  const idempotencyKey = body.idempotency_key ?? headerKey ?? undefined

  if (!isIdempotencyKey(idempotencyKey)) return invalid()
  if (!isUuid(body.offer_id)) return invalid()

  const expectedRevision = body.expected_revision
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < REVISION_START) return invalid()

  const seats = body.seats ?? DEFAULT_SEATS
  if (!Number.isInteger(seats) || (seats as number) < MIN_SEATS || (seats as number) > MAX_SEATS) return invalid()

  return {
    ok: true,
    value: {
      offerId: body.offer_id,
      expectedRevision: expectedRevision as number,
      idempotencyKey: (idempotencyKey as string).trim(),
      seats: seats as number,
    },
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function reservationCreateRoute() {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient()

    const { data, error: sessionError } = await supabase.auth.getUser()
    if (sessionError !== null || data.user === null) {
      return NextResponse.json(transitionError('unauthenticated'), { status: UNAUTHENTICATED_STATUS })
    }

    const parsed = parseReserveSeatInput(await readJson(request), request.headers.get('idempotency-key'))
    if (!parsed.ok) {
      return NextResponse.json(parsed.body, { status: parsed.status })
    }

    // The actor is not passed: offer_reserve_seat() reads auth.uid() itself and
    // refuses the poster reserving a seat on their own offer (42501).
    const { data: revision, error } = await supabase.rpc('offer_reserve_seat', {
      p_offer_id: parsed.value.offerId,
      p_expected_revision: parsed.value.expectedRevision,
      p_idempotency_key: parsed.value.idempotencyKey,
      p_seats: parsed.value.seats,
    })

    if (error !== null) {
      const failure = transitionFailure(error)
      return NextResponse.json(failure.body, { status: failure.status })
    }

    return NextResponse.json(transitionSuccess(parsed.value.offerId, revision), { status: 200 })
  }
}

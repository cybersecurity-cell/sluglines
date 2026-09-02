/**
 * The one POST handler behind every M3 transition route.
 *
 * Every route under `src/app/api/offers/**` and `src/app/api/reservations/**`
 * that has a writer is `export const POST = offerTransitionRoute('<fn>')`. There
 * is no per-route logic to drift, and no route can accidentally skip the session
 * check, the argument check, or the D-30 error translation.
 *
 * What this handler is *not*: the security boundary. rev. 5.3 §12 constraint 6
 * puts every transition behind a SECURITY DEFINER function that reads
 * `auth.uid()` itself, re-reads the revision under `for update`, and checks the
 * edge. This handler never names the actor — it forwards the member's session
 * cookies and lets the database decide who is calling. The `getUser()` call
 * below buys a clean 401 instead of a `42501`; it does not authorise anything.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OFFER_TRANSITION_OPERATIONS } from '@/lib/domain/offer-transitions.ts'
import {
  UNAUTHENTICATED_STATUS,
  parseTransitionInput,
  transitionError,
  transitionFailure,
  transitionSuccess,
} from './transition-http.ts'

/**
 * The transition functions this factory can call: the `clientCallable`
 * operations whose signature is `(offer_id, expected_revision, idempotency_key)`.
 *
 * `offer_publish` and `offer_reserve_seat`/`offer_release_seat` are deliberately
 * absent — publish belongs to the compose flow and the two seat operations are
 * `/api/reservations` itself (`offer_reserve_seat` also takes a seat count), and
 * neither is one of the routes this slice ships.
 */
export type OfferTransitionFn = 'offer_advance' | 'offer_cancel' | 'offer_confirm'

/**
 * Import-time guard: the name wired into a route must be an operation the domain
 * layer publishes as client-callable. A typo, or a rename in
 * `offer-transitions.ts` that a route did not follow, fails the build rather
 * than producing a 404 from PostgREST at runtime.
 */
function operationOrThrow(fn: OfferTransitionFn) {
  const operation = OFFER_TRANSITION_OPERATIONS.find((candidate) => candidate.fn === fn)
  if (operation === undefined) {
    throw new Error(`${fn} is not a published offer transition operation`)
  }
  if (!operation.clientCallable) {
    throw new Error(`${fn} is never granted to authenticated; it cannot back an API route`)
  }
  return operation
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    // A body that is not JSON is a malformed argument, which
    // `parseTransitionInput` already reports; returning null routes it there
    // rather than raising a second shape of the same error.
    return null
  }
}

export function offerTransitionRoute(fn: OfferTransitionFn) {
  const operation = operationOrThrow(fn)

  return async function POST(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient()

    const { data, error: sessionError } = await supabase.auth.getUser()
    if (sessionError !== null || data.user === null) {
      return NextResponse.json(transitionError('unauthenticated'), { status: UNAUTHENTICATED_STATUS })
    }

    const parsed = parseTransitionInput(await readJson(request), request.headers.get('idempotency-key'))
    if (!parsed.ok) {
      return NextResponse.json(parsed.body, { status: parsed.status })
    }

    // The actor is not passed: `operation.actor` documents who the SQL will
    // require `auth.uid()` to be, and the SQL is what enforces it.
    const { data: revision, error } = await supabase.rpc(operation.fn, {
      p_offer_id: parsed.value.offerId,
      p_expected_revision: parsed.value.expectedRevision,
      p_idempotency_key: parsed.value.idempotencyKey,
    })

    if (error !== null) {
      const failure = transitionFailure(error)
      return NextResponse.json(failure.body, { status: failure.status })
    }

    return NextResponse.json(transitionSuccess(parsed.value.offerId, revision), { status: 200 })
  }
}

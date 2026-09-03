/**
 * POST /api/offers/waitlist — issue #90, Option B slice 5.
 *
 * `tests/api-routes.test.mjs`'s self-invalidating check (`deferred-endpoints.ts`)
 * fires the moment a deferred route's named dependency lands in a migration.
 * `0021_waitlist_eta_noshow_schema.sql` names its table `offer_waitlist` — one
 * of the two dependencies `/api/offers/waitlist`'s deferred entry named — so
 * this route is what that check demanded once this slice's schema existed.
 * `offers/eta` and `reservations/no-show` are unaffected: their own deferred
 * entries name `offer_set_eta` and `reservation_mark_no_show`, and this
 * slice's functions are `post_eta_update()` and `report_no_show()` — neither
 * of those two names appears in any migration, so both routes correctly
 * remain 501 stubs.
 *
 * `offer_waitlist_join(p_offer_id uuid)` (0022) has a different shape from the
 * M3 transitions `offer-transition-route.ts` calls: no `expected_revision`,
 * because joining the waitlist is idempotent by construction (the partial
 * unique index on `(offer_id, rider_id)` where `state = 'ACTIVE'`, 0021)
 * rather than an optimistic-concurrency hop on an existing row — the same
 * shape difference `recurring-offer-skip-route.ts` documents for
 * `skip_recurring_offer_occurrence()`.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TRANSITION_ERRCODES } from '@/lib/domain/offer-transitions.ts'
import { UNAUTHENTICATED_STATUS, isUuid, transitionError, transitionFailure } from './transition-http.ts'
import type { TransitionErrorBody } from './transition-http.ts'

interface JoinInput {
  readonly offerId: string
}

type JoinInputResult =
  | { readonly ok: true; readonly value: JoinInput }
  | { readonly ok: false; readonly status: number; readonly body: TransitionErrorBody }

function invalid(): JoinInputResult {
  return {
    ok: false,
    status: 400,
    body: transitionError('invalid_argument', TRANSITION_ERRCODES.INVALID_ARGUMENT),
  }
}

function parseJoinInput(raw: unknown): JoinInputResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return invalid()

  const body = raw as Record<string, unknown>
  if (!isUuid(body.offer_id)) return invalid()

  return { ok: true, value: { offerId: body.offer_id } }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function offerWaitlistJoinRoute() {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient()

    const { data, error: sessionError } = await supabase.auth.getUser()
    if (sessionError !== null || data.user === null) {
      return NextResponse.json(transitionError('unauthenticated'), { status: UNAUTHENTICATED_STATUS })
    }

    const parsed = parseJoinInput(await readJson(request))
    if (!parsed.ok) {
      return NextResponse.json(parsed.body, { status: parsed.status })
    }

    // The actor is not passed: offer_waitlist_join() reads auth.uid() itself
    // and refuses a poster joining their own offer's waitlist. The function
    // returns public.offer_waitlist (a single row, not a set), so PostgREST
    // hands it back as one JSON object — no `.single()` needed.
    const { data: entry, error } = await supabase.rpc('offer_waitlist_join', { p_offer_id: parsed.value.offerId })

    if (error !== null) {
      const failure = transitionFailure(error)
      return NextResponse.json(failure.body, { status: failure.status })
    }

    return NextResponse.json({ ok: true, waitlist: entry }, { status: 200 })
  }
}

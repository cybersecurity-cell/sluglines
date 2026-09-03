/**
 * POST /api/recurring-offers/skip — issue #90, Docs/DECISIONS.md D-71.
 *
 * `tests/api-routes.test.mjs`'s self-invalidating check (`deferred-endpoints.ts`)
 * fires the moment a deferred route's named dependency lands in a migration.
 * `0019_recurring_offers_schema.sql` names its skip table `recurring_offer_skips`
 * — the exact dependency `/api/recurring-offers/skip`'s deferred entry names —
 * so this route is what that check demanded once this slice's schema existed.
 * `recurring-offers/{cancel,pause,resume}` are unaffected: their deferred
 * entries name a `recurring_offers` table distinct from this slice's
 * `recurring_offer_templates`, so they correctly remain 501 stubs.
 *
 * `skip_recurring_offer_occurrence(p_template_id uuid, p_occurrence_date date)`
 * (0020) has a different shape from the M3 transitions `offer-transition-route.ts`
 * calls: no `expected_revision`, because a skip is idempotent by construction
 * (the unique index on `(template_id, occurrence_date)`, 0019) rather than an
 * optimistic-concurrency hop on an existing row. That is a real shape
 * difference, not an oversight, so this is its own small factory rather than a
 * forced fit into `offerTransitionRoute`.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TRANSITION_ERRCODES } from '@/lib/domain/offer-transitions.ts'
import { UNAUTHENTICATED_STATUS, transitionError, transitionFailure } from './transition-http.ts'
import type { TransitionErrorBody } from './transition-http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface SkipInput {
  readonly templateId: string
  readonly occurrenceDate: string
}

type SkipInputResult =
  | { readonly ok: true; readonly value: SkipInput }
  | { readonly ok: false; readonly status: number; readonly body: TransitionErrorBody }

function invalid(): SkipInputResult {
  return {
    ok: false,
    status: 400,
    body: transitionError('invalid_argument', TRANSITION_ERRCODES.INVALID_ARGUMENT),
  }
}

/** The same two checks the SQL applies, in the same order — see transition-http.ts's own note on why a route still relies on the SQL to enforce them. */
function parseSkipInput(raw: unknown): SkipInputResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return invalid()

  const body = raw as Record<string, unknown>
  if (typeof body.template_id !== 'string' || !UUID.test(body.template_id)) return invalid()
  if (typeof body.occurrence_date !== 'string' || !ISO_DATE.test(body.occurrence_date)) return invalid()

  return { ok: true, value: { templateId: body.template_id, occurrenceDate: body.occurrence_date } }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function skipRecurringOfferOccurrenceRoute() {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient()

    const { data, error: sessionError } = await supabase.auth.getUser()
    if (sessionError !== null || data.user === null) {
      return NextResponse.json(transitionError('unauthenticated'), { status: UNAUTHENTICATED_STATUS })
    }

    const parsed = parseSkipInput(await readJson(request))
    if (!parsed.ok) {
      return NextResponse.json(parsed.body, { status: parsed.status })
    }

    // The actor is not passed: skip_recurring_offer_occurrence() reads
    // auth.uid() itself and authorizes the template owner or a moderator.
    const { error } = await supabase.rpc('skip_recurring_offer_occurrence', {
      p_template_id: parsed.value.templateId,
      p_occurrence_date: parsed.value.occurrenceDate,
    })

    if (error !== null) {
      const failure = transitionFailure(error)
      return NextResponse.json(failure.body, { status: failure.status })
    }

    return NextResponse.json(
      { ok: true, template_id: parsed.value.templateId, occurrence_date: parsed.value.occurrenceDate },
      { status: 200 }
    )
  }
}

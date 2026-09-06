'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseTransitionInput, transitionFailure } from '@/lib/api/transition-http.ts'

/**
 * The two member-owned undo controls `/board` lacked (issue #140): a poster
 * cancels their own offer, a rider gives back their own seat. Server actions,
 * for the reasons `dashboard/actions.ts` measured — no Supabase client in the
 * browser, the form posts without JavaScript — and because rev. 5.3 §8 M3
 * names exactly thirteen POST routes and a release endpoint is not one of
 * them; a Server Action is not a route.
 *
 * WHICH WRITER, AND WHO IT REFUSES
 * ---------------------------------------------------------------------------
 * `offer_cancel(uuid, integer, text)` — the poster (or a moderator, once
 * `0027` lands; a rider is refused 42501 by the function itself, never by
 * this file). `offer_release_seat(uuid, integer, text)` — the rider holding
 * an ACTIVE seat on the offer; a CONFIRMED seat is refused by design (#148).
 * Both take the actor from `auth.uid()` and the offer's revision from the
 * caller, so a stale button (someone else moved the offer) is refused as a
 * conflict rather than applied to a state the member never saw.
 *
 * IDEMPOTENCY WITHOUT A CLIENT-HELD KEY
 * ---------------------------------------------------------------------------
 * A form submit has no memory across a double tap, so the key is derived on
 * the server from what the member is asking for: `board-cancel:<offer>:<rev>`
 * / `board-release:<offer>:<rev>`. The same offer at the same revision is the
 * same request, and `0002`'s idempotency table replays it instead of applying
 * a second hop — exactly the property a client-generated key buys the fetch
 * routes, without shipping a client.
 *
 * OUTCOMES RETURN IN THE URL. `redirect()` stays outside the `try`.
 */

export type BoardActionOutcome = 'cancelled' | 'released'

const DONE = { cancel: 'cancelled', release: 'released' } as const

async function transition(
  operation: 'cancel' | 'release',
  fn: 'offer_cancel' | 'offer_release_seat',
  formData: FormData
): Promise<never> {
  const offerId = formData.get('offer_id')
  const expectedRevision = Number(formData.get('expected_revision'))
  const parsed = parseTransitionInput({
    offer_id: offerId,
    expected_revision: expectedRevision,
    idempotency_key: `board-${operation}:${String(offerId)}:${String(expectedRevision)}`,
  })

  let failureKind: string | null = null

  if (!parsed.ok) {
    failureKind = parsed.body.error.kind
  } else {
    try {
      const supabase = await createClient()
      const { error } = await supabase.rpc(fn, {
        p_offer_id: parsed.value.offerId,
        p_expected_revision: parsed.value.expectedRevision,
        p_idempotency_key: parsed.value.idempotencyKey,
      })
      if (error) failureKind = transitionFailure(error).body.error.kind
    } catch {
      failureKind = 'unavailable'
    }
  }

  // `force-dynamic` re-reads the board on the redirect, so the row the member
  // acted on is gone (or moved) by the time they see the banner.
  redirect(failureKind ? `/board?error=${encodeURIComponent(failureKind)}` : `/board?done=${DONE[operation]}`)
}

export async function cancelOwnOffer(formData: FormData) {
  return transition('cancel', 'offer_cancel', formData)
}

export async function releaseOwnSeat(formData: FormData) {
  return transition('release', 'offer_release_seat', formData)
}

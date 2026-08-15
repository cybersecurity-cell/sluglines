/**
 * POST /api/offers/cancel — rev. 5.3 §8 M3.
 *
 * `OPEN | PARTIALLY_RESERVED | RESERVED | CONFIRMED | ARRIVING -> CANCELLED`.
 * The §8 M3 bail-out, so the actor is `participant`: the poster, or any rider
 * holding a live reservation. `offer_cancel()` decides which of the two the
 * caller is; this route does not.
 *
 * Body: `{ offer_id, expected_revision, idempotency_key }`.
 */

import { offerTransitionRoute } from '@/lib/api/offer-transition-route.ts'

export const POST = offerTransitionRoute('offer_cancel')

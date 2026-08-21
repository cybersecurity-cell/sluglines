/**
 * POST /api/offers/confirm — rev. 5.3 §8 M3.
 *
 * `RESERVED -> CONFIRMED`, the poster only. Confirmation is what makes
 * `offer_pickup_details` readable to the riders, so `offer_confirm()` moves
 * every ACTIVE reservation on the offer to CONFIRMED in the same transaction.
 *
 * Body: `{ offer_id, expected_revision, idempotency_key }`.
 */

import { offerTransitionRoute } from '@/lib/api/offer-transition-route.ts'

export const POST = offerTransitionRoute('offer_confirm')

/**
 * POST /api/offers/advance — rev. 5.3 §8 M3.
 *
 * One hop along `CONFIRMED -> ARRIVING -> PICKED_UP -> COMPLETED`; the next
 * state is derived from the current one by `offer_advance()`, so the body names
 * no destination. The poster only: all three are assertions about the vehicle.
 *
 * Body: `{ offer_id, expected_revision, idempotency_key }`.
 */

import { offerTransitionRoute } from '@/lib/api/offer-transition-route.ts'

export const POST = offerTransitionRoute('offer_advance')

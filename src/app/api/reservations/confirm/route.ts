/**
 * POST /api/reservations/confirm — rev. 5.3 §8 M3.
 *
 * **This is the same operation as `POST /api/offers/confirm`, and that is not an
 * oversight.** rev. 5.3 §8 M3 names both paths, but the machine has exactly one
 * confirm edge (`RESERVED -> CONFIRMED`, poster only) and one writer for it.
 * Reservations reach CONFIRMED as a consequence: `offer_confirm()` updates every
 * ACTIVE reservation on the offer inside the confirming transaction. There is no
 * reservation-scoped confirm function to call, and inventing one would create a
 * second way to reach a state the ledger records as having one.
 *
 * So this route is `offer_confirm` under the reservation-facing path, keyed on
 * the offer. Body: `{ offer_id, expected_revision, idempotency_key }` — the
 * revision is the *offer's*, because that is the row the optimistic-concurrency
 * check reads.
 */

import { offerTransitionRoute } from '@/lib/api/offer-transition-route.ts'

export const POST = offerTransitionRoute('offer_confirm')

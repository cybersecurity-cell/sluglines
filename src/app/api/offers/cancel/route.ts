/**
 * POST /api/offers/cancel — rev. 5.3 §8 M3.
 *
 * `OPEN | PARTIALLY_RESERVED | RESERVED | CONFIRMED | ARRIVING -> CANCELLED`.
 * The actor is `poster_or_moderator` (`0027`, issue #133): cancelling an offer
 * cancels every live seat on it, so it is the poster's call or a moderator's,
 * never a rider's — a rider gives back their own seat through
 * `POST /api/reservations`' release path instead. `offer_cancel()` decides;
 * this route does not, and it forwards a rider's attempt to be refused as 403.
 *
 * Body: `{ offer_id, expected_revision, idempotency_key }`.
 */

import { offerTransitionRoute } from '@/lib/api/offer-transition-route.ts'

export const POST = offerTransitionRoute('offer_cancel')

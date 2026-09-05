/**
 * POST /api/reservations — PR 5 "thin coordination loop".
 *
 * A rider claims a seat: `offer_reserve_seat()`. See
 * `lib/api/reservation-create-route.ts` for why this route needs its own
 * factory rather than `offer-transition-route.ts`, and for the §10
 * "seat just taken" vs. network-failure mapping.
 *
 * Body: `{ offer_id, expected_revision, idempotency_key, seats? }` (`seats`
 * defaults to 1).
 */

import { reservationCreateRoute } from '@/lib/api/reservation-create-route.ts'

export const POST = reservationCreateRoute()

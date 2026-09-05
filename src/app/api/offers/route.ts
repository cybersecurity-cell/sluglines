/**
 * POST /api/offers — PR 5 "thin coordination loop".
 *
 * Post a seat: `offer_create()` then `offer_publish()`, scoped to the one
 * corridor pair this slice ships (`lib/domain/corridor.ts`). See
 * `lib/api/offer-create-route.ts` for the compound-RPC and idempotency-key
 * design this factory implements.
 *
 * Body: `{ poster_role, direction, window_start, window_end, seats_total,
 * idempotency_key }`.
 */

import { offerCreateRoute } from '@/lib/api/offer-create-route.ts'

export const POST = offerCreateRoute()

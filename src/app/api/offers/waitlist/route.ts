/**
 * POST /api/offers/waitlist — issue #90, Option B slice 5.
 *
 * Join the waitlist for a full offer: offer_waitlist_join() (0022) inserts an
 * ACTIVE offer_waitlist row, idempotently, once the offer is RESERVED. A seat
 * that later opens up is offered to the oldest waitlist entry by
 * promote_from_waitlist() (0022), driven by the promote_waitlist_sweep()
 * scheduled job — not by this route.
 *
 * Body: `{ offer_id }`.
 */

import { offerWaitlistJoinRoute } from '@/lib/api/offer-waitlist-join-route.ts'

export const POST = offerWaitlistJoinRoute()

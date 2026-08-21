/**
 * POST /api/offers/waitlist — rev. 5.3 §8 M3 names it; §11 Phase 4 owns its writer.
 *
 * Join the waitlist for a full offer, with the 10-minute soft hold and quiet renotify (§9.4). No waitlist table exists in any migration.
 *
 * Answers **501** with the missing database objects named. See
 * `src/lib/api/deferred-endpoints.ts` for why it is shipped rather than omitted.
 */

import { deferredRoute } from '@/lib/api/deferred-route.ts'

export const POST = deferredRoute('/api/offers/waitlist')

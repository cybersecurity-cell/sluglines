/**
 * POST /api/offers/eta — rev. 5.3 §8 M3 names it; §11 Phase 4 owns its writer.
 *
 * One-tap "running late +5/10/15" in CONFIRMED and ARRIVING (§9.4). No offer_set_eta() exists in any migration.
 *
 * Answers **501** with the missing database objects named. See
 * `src/lib/api/deferred-endpoints.ts` for why it is shipped rather than omitted.
 */

import { deferredRoute } from '@/lib/api/deferred-route.ts'

export const POST = deferredRoute('/api/offers/eta')

/**
 * POST /api/recurring-offers/cancel — rev. 5.3 §8 M3 names it; §11 Phase 4 owns its writer.
 *
 * Delete a recurring template. No recurring_offers table exists in any migration.
 *
 * Answers **501** with the missing database objects named. See
 * `src/lib/api/deferred-endpoints.ts` for why it is shipped rather than omitted.
 */

import { deferredRoute } from '@/lib/api/deferred-route.ts'

export const POST = deferredRoute('/api/recurring-offers/cancel')

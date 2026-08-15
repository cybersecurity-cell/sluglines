/**
 * POST /api/reservations/no-show — rev. 5.3 §8 M3 names it; §11 Phase 4 owns its writer.
 *
 * Record a no-show privately (§9.4). RESERVATION_STATES deliberately omits NO_SHOW: "a state with no writer is a state that cannot be reached".
 *
 * Answers **501** with the missing database objects named. See
 * `src/lib/api/deferred-endpoints.ts` for why it is shipped rather than omitted.
 */

import { deferredRoute } from '@/lib/api/deferred-route.ts'

export const POST = deferredRoute('/api/reservations/no-show')

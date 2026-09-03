/**
 * POST /api/recurring-offers/skip — issue #90, Docs/DECISIONS.md D-71.
 *
 * Skip one occurrence of a recurring template: `skip_recurring_offer_occurrence()`
 * (0020) records the skip and, if that day's offer was already generated and is
 * still cancellable, cancels it through the M3 offer state machine.
 *
 * Body: `{ template_id, occurrence_date }`.
 */

import { skipRecurringOfferOccurrenceRoute } from '@/lib/api/recurring-offer-skip-route.ts'

export const POST = skipRecurringOfferOccurrenceRoute()

/**
 * The viewer's own live seats on the board's offers (issue #140). Read
 * separately from `corridor-board.ts` so the board's offer query stays the
 * one `tests/corridor-board.test.mjs` pins column by column, and so a failed
 * reservations read degrades to "no seats known" rather than an unavailable
 * board — the offers are the board; the seats are decoration on it.
 *
 * `reservations_select_participant` (`0002`) scopes the read to
 * `rider_id = auth.uid()` or offers the caller posted; the explicit
 * `eq('rider_id', viewerId)` states the intent in the query rather than
 * leaning on the policy alone.
 */

import { createClient } from '@/lib/supabase/server'
import type { ViewerReservation } from '@/lib/domain/board.ts'

export const VIEWER_RESERVATION_COLUMNS = 'offer_id,state,seats'

/** Opens its own cookie-bound client, like every IO module here, so `/board` itself never does. */
export async function readViewerReservations(
  viewerId: string,
  offerIds: readonly string[]
): Promise<readonly ViewerReservation[]> {
  if (offerIds.length === 0) return []
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reservations')
      .select(VIEWER_RESERVATION_COLUMNS)
      .eq('rider_id', viewerId)
      .in('offer_id', [...offerIds])
      .in('state', ['ACTIVE', 'CONFIRMED'])
    if (error || !data) return []
    return data as unknown as ViewerReservation[]
  } catch {
    return []
  }
}

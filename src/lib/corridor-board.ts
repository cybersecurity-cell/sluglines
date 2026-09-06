/**
 * Server-side read for `/board`: OPEN/PARTIALLY_RESERVED offers on the one
 * corridor pair this slice ships.
 *
 * Same split as `dashboard.ts` from `fast-board.ts`: `createClient()` binds to
 * `next/headers` cookies, which the §8 dependency rule keeps out of
 * `lib/domain`, so the read lives here and `lib/domain/board.ts` stays a pure
 * function over rows someone else fetched.
 *
 * `public.offers` is `revoke all ... from anon; grant select ... to
 * authenticated` (`0002`), so an unauthenticated caller cannot read this table
 * at all — there is no RLS-empty-result case to distinguish from a real empty
 * board, only signed-in-with-rows, signed-in-with-no-rows, signed-out, and a
 * failed read.
 */

import { BOARD_VISIBLE_STATES, CORRIDOR_OFFER_COLUMNS } from '@/lib/domain/board.ts'
import type { CorridorOfferRow } from '@/lib/domain/board.ts'
import type { ResolvedPilotCorridor } from '@/lib/domain/corridor.ts'
import { readPilotCorridor } from '@/lib/corridor-locations.ts'
import { createClient } from '@/lib/supabase/server'
import { reportUnavailable } from '@/lib/observability.ts'

export type CorridorBoardRead =
  | { readonly state: 'signed-out' }
  | { readonly state: 'unavailable'; readonly reason: string }
  | {
      readonly state: 'ok'
      readonly viewerId: string
      /** The pair's ids on this database — the filter below used them, and the view model labels rows by them. */
      readonly corridor: ResolvedPilotCorridor
      readonly rows: readonly CorridorOfferRow[]
    }

export async function getCorridorBoardOffers(): Promise<CorridorBoardRead> {
  try {
    const supabase = await createClient()

    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth?.user) return { state: 'signed-out' }

    // The pair's ids are resolved by slug on this database (issue #132): a
    // committed literal matched nothing, so the board was empty even when
    // offers existed. A missing row is reported as `unavailable` with the slug
    // named, not rendered as an honest-looking empty board.
    const corridor = await readPilotCorridor(supabase)
    if (!corridor.ok) {
      reportUnavailable('corridor-board.corridor', corridor.reason)
      return { state: 'unavailable', reason: corridor.reason }
    }

    const { hornerRdId: originId, lenfantPlazaId: destinationId } = corridor.corridor

    const { data, error } = await supabase
      .from('offers')
      .select(CORRIDOR_OFFER_COLUMNS)
      .in('state', BOARD_VISIBLE_STATES)
      .or(
        `and(origin_location_id.eq.${originId},destination_location_id.eq.${destinationId}),` +
          `and(origin_location_id.eq.${destinationId},destination_location_id.eq.${originId})`
      )
      .order('window_start', { ascending: true })

    if (error) {
      const reason = `offers read failed (${error.code ?? 'unknown'})`
      reportUnavailable('corridor-board.offers', reason, error)
      return { state: 'unavailable', reason }
    }

    return {
      state: 'ok',
      viewerId: auth.user.id,
      corridor: corridor.corridor,
      rows: (data ?? []) as unknown as CorridorOfferRow[],
    }
  } catch (error) {
    reportUnavailable('corridor-board.client', 'supabase client unavailable', error)
    return { state: 'unavailable', reason: 'supabase client unavailable' }
  }
}

/**
 * `lib/domain/board.ts` — the `/board` view model for PR 5's one corridor pair.
 *
 * Same split as `fast-board.ts`: this module is pure (no I/O, no React), and
 * `src/lib/corridor-board.ts` is the IO half that reads `public.offers` through
 * a cookie-bound Supabase client. `tests/corridor-board.test.mjs` runs every
 * state here with no database, the same reason `fast-board.ts` is split.
 *
 * SCOPE: rev. 5.3 §8 M3 draws `offers_visible_for_caller` over every corridor
 * pair; this slice narrows the *read* to the one pair PR 5 ships end-to-end
 * (`lib/domain/corridor.ts`). That is a narrowing, not a rewrite — widening it
 * later is deleting a filter, not restructuring this module.
 */

import type { OfferState } from './offer-state.ts'
import { OPEN_OFFER_STATES } from './offer-state.ts'
import { corridorDirectionLabel } from './corridor.ts'

/** The states `/board` lists. Re-exported so a caller building the query has one source for it. */
export const BOARD_VISIBLE_STATES: readonly OfferState[] = OPEN_OFFER_STATES

/** Column list `src/lib/corridor-board.ts` selects. Kept here so the shape and the reader travel together. */
export const CORRIDOR_OFFER_COLUMNS =
  'id,poster_id,poster_role,origin_location_id,destination_location_id,window_start,window_end,seats_total,seats_taken,state,revision'

export interface CorridorOfferRow {
  readonly id: string
  readonly poster_id: string
  readonly poster_role: string
  readonly origin_location_id: string
  readonly destination_location_id: string
  readonly window_start: string
  readonly window_end: string
  readonly seats_total: number
  readonly seats_taken: number
  readonly state: string
  readonly revision: number
}

/** One of the viewer's own live seats, as `src/lib/board-reservations.ts` reads it. */
export interface ViewerReservation {
  readonly offer_id: string
  readonly state: string
  readonly seats: number
}

export interface CorridorBoardOffer {
  readonly id: string
  readonly posterRole: string
  /** `"Horner Rd -> L'Enfant Plaza"` or the reverse. */
  readonly directionLabel: string
  readonly windowStart: string
  readonly windowEnd: string
  readonly seatsRemaining: number
  readonly state: OfferState
  readonly revision: number
  /** The offer's own poster is refused a reservation on it by `offer_reserve_seat` itself (42501); this lets the UI grey the button instead of round-tripping to learn that. */
  readonly isMine: boolean
  /** The viewer's live seat on this offer, when they hold one (issue #140). `state` is ACTIVE or CONFIRMED. */
  readonly mySeat?: { readonly state: string; readonly seats: number }
}

export interface CorridorBoard {
  readonly offers: readonly CorridorBoardOffer[]
  readonly empty: boolean
  /** The offers the viewer posted or holds a seat on — the "mine" view issue #140 asked for, drawn from the same rows. */
  readonly yours: readonly CorridorBoardOffer[]
  /** Everyone else's open offers, in window order — what a rider scans for a seat. */
  readonly others: readonly CorridorBoardOffer[]
}

export function seatsRemaining(row: Pick<CorridorOfferRow, 'seats_total' | 'seats_taken'>): number {
  return Math.max(row.seats_total - row.seats_taken, 0)
}

/**
 * `row.state`/`row.poster_role` come from a `text` column, not an enum, so they
 * are passed through rather than narrowed — a value this module does not
 * recognise is not this function's decision to hide.
 */
export function buildCorridorBoard(
  rows: readonly CorridorOfferRow[],
  options: { readonly viewerId: string; readonly reservations?: readonly ViewerReservation[] }
): CorridorBoard {
  const seatByOffer = new Map((options.reservations ?? []).map((r) => [r.offer_id, { state: r.state, seats: r.seats }] as const))
  const offers = rows.map((row) => {
    const mySeat = seatByOffer.get(row.id)
    return {
      id: row.id,
      posterRole: row.poster_role,
      directionLabel: corridorDirectionLabel(row.origin_location_id, row.destination_location_id) ?? 'Unknown corridor',
      windowStart: row.window_start,
      windowEnd: row.window_end,
      seatsRemaining: seatsRemaining(row),
      state: row.state as OfferState,
      revision: row.revision,
      isMine: row.poster_id === options.viewerId,
      ...(mySeat ? { mySeat } : {}),
    }
  })
  const yours = offers.filter((offer) => offer.isMine || offer.mySeat !== undefined)
  const others = offers.filter((offer) => !offer.isMine && offer.mySeat === undefined)

  return { offers, empty: offers.length === 0, yours, others }
}

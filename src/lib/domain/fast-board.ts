/**
 * `lib/domain/fast-board.ts` — the M3 power-user board: every active spot on one
 * screen, ordered by where the line actually is, plus the caller's own presence
 * row (rev. 5.3 §8 M3 "member board", §8 M4 "presence").
 *
 * WHY THIS IS NOT THE M1 SPOT PAGE
 * ---------------------------------------------------------------------------
 * `/spots/<slug>` answers "what is happening at the one spot I opened". The
 * dashboard answers a different question, asked by someone standing on a curb
 * with 40 seconds before they have to start walking: *which of the 43 lines is
 * moving right now, and am I still checked in somewhere I have already left?*
 * That makes ordering load-bearing rather than cosmetic — an alphabetical list
 * puts Bob's first every morning regardless of whether anyone is there — so
 * `buildFastBoard` sorts by measured activity and pins the caller's own spot.
 *
 * IT READS THE SAME AGGREGATES AS THE PUBLIC SURFACE
 * ---------------------------------------------------------------------------
 * Counts come from `public-counts.ts` — `get_public_spot_counts()` and
 * `get_public_open_offer_counts()`, the two §8 M1 functions. Deliberately: the
 * member board must not invent a second, richer counting path that shows a
 * signed-in member something the aggregates do not support. Those functions are
 * §11 Phase 2 objects and are not deployed, so `availability: 'unavailable'`
 * is the state this board is in today, and it renders as "not switched on yet"
 * rather than as 43 rows of zero. A fabricated zero is worse here than on the
 * public page: a commuter who reads "0 waiting" and drives past has been given
 * a measurement nobody made.
 *
 * PRESENCE IS ONE ROW, AND IT EXPIRES
 * ---------------------------------------------------------------------------
 * `presence_checkins` (0001) is keyed by `member_id`, so a member has at most
 * one check-in — the panel is singular by schema, not by choice — and it carries
 * `expires_at` from `presence_checkin(..., p_ttl_minutes)`. An expired row is
 * still readable until `sweep_expired_presence()` runs, so "live" is computed
 * against `expires_at` here rather than trusting the row's existence. The
 * previous dashboard used a two-hour client-side staleness window over a
 * `device_id` column; that model, and the `riders`/`drivers` tables it read, are
 * what D-13 dropped.
 *
 * BOUNDARY (rev. 5.3 §8, enforced by `tests/domain-boundaries.test.mjs`)
 * ---------------------------------------------------------------------------
 * No React, no Next, no `lib/ai`. The IO half — `auth.getUser()`, the
 * `presence_checkins` select, the `locations` lookup — is `src/lib/dashboard.ts`,
 * because `createClient()` reaches `next/headers`. Everything below is a pure
 * function over data someone else fetched, which is what lets
 * `tests/dashboard-fast-board.test.mjs` run every state with no database.
 */

import type { SpotDirection, SpotLocation } from './locations.ts'
import { activeSpotLocations, canonicalSlug } from './locations.ts'
import type { PublicCountsAvailability, PublicCountsSnapshot, PublicSpotCounts } from './public-counts.ts'
import { ZERO_SPOT_COUNTS, countsForSlug } from './public-counts.ts'

// -----------------------------------------------------------------------------
// Presence — the caller's own check-in
// -----------------------------------------------------------------------------

/**
 * Explicit column list, same rule as `LOCATION_COLUMNS`: `select('*')` would
 * ship whatever a later migration adds to a table whose whole purpose is to
 * hold one member's location.
 */
export const PRESENCE_CHECKIN_COLUMNS = 'member_id,location_id,direction,checked_in_at,expires_at'

/** The 0001 SECURITY DEFINER writer the checkout button calls. Never a raw delete. */
export const PRESENCE_CLEAR_FUNCTION = 'presence_clear'

/** `presence_checkins` stores lower-case; `SpotLocation.direction` is capitalised. */
export type PresenceDirection = 'morning' | 'afternoon'

export interface PresenceCheckinRow {
  member_id: string
  location_id: string
  direction: string
  checked_in_at: string
  expires_at: string
}

/**
 * `checked-in` — a live row; the panel shows it and offers checkout.
 * `none`       — signed in, no live row. A measured "you are not checked in".
 * `signed-out` — no session. Not the same as `none`: this member may well be
 *                checked in, we simply cannot see it, and saying "you are not
 *                checked in" to them would be a false statement of their state.
 * `unavailable` — the table or the auth call did not answer. Also not `none`.
 */
export type PresenceState = 'checked-in' | 'none' | 'signed-out' | 'unavailable'

export interface MemberPresence {
  state: PresenceState
  /** Canonical spot key, when the `locations` row resolved. */
  spotSlug?: string
  /** Path segment for `/spots/<routeSlug>`, when it resolved. */
  routeSlug?: string
  /** Display name, when it resolved. Absent is rendered, never faked. */
  spotName?: string
  direction?: PresenceDirection
  checkedInAt?: string
  expiresAt?: string
  /** Whole minutes left on the TTL; `0` once it is due to expire. */
  minutesRemaining?: number
  /** Why the state is `unavailable`, for the server log. Never rendered. */
  reason?: string
}

export const SIGNED_OUT_PRESENCE: MemberPresence = { state: 'signed-out' }
export const NO_PRESENCE: MemberPresence = { state: 'none' }

function toTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? undefined : time
}

/**
 * A row is live while `expires_at` is in the future. An unparseable
 * `expires_at` is treated as expired: the alternative is pinning a member to a
 * spot they cannot clear by any elapsed time.
 */
export function isPresenceLive(row: Pick<PresenceCheckinRow, 'expires_at'>, now = new Date()) {
  const expires = toTime(row.expires_at)
  return expires !== undefined && expires > now.getTime()
}

export function minutesRemaining(expiresAt: string, now = new Date()) {
  const expires = toTime(expiresAt)
  if (expires === undefined) return 0
  return Math.max(0, Math.ceil((expires - now.getTime()) / 60_000))
}

function toPresenceDirection(value: string): PresenceDirection | undefined {
  return value === 'morning' || value === 'afternoon' ? value : undefined
}

/**
 * A `presence_checkins` row plus whatever the `locations` lookup could resolve.
 *
 * `presence_checkins.location_id` is a `uuid` and the committed directory is
 * keyed by slug, so an unresolved spot is a real possibility — `0004` is not
 * applied anywhere yet. The check-in is still reported, and still clearable,
 * with the spot named as unresolved: a member whose row cannot be labelled must
 * not thereby lose the button that deletes it.
 */
export function presenceFromRow(
  row: PresenceCheckinRow,
  spot?: Pick<SpotLocation, 'slug' | 'routeSlug' | 'name'> | null,
  now = new Date()
): MemberPresence {
  if (!isPresenceLive(row, now)) return NO_PRESENCE

  const direction = toPresenceDirection(row.direction)

  return {
    state: 'checked-in',
    ...(spot ? { spotSlug: spot.slug, routeSlug: spot.routeSlug, spotName: spot.name } : {}),
    ...(direction ? { direction } : {}),
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    minutesRemaining: minutesRemaining(row.expires_at, now),
  }
}

/** The direction a member checked into, in the directory's capitalisation. */
export function presenceDirectionLabel(direction?: PresenceDirection): SpotDirection | undefined {
  if (direction === 'morning') return 'Morning'
  if (direction === 'afternoon') return 'Afternoon'
  return undefined
}

// -----------------------------------------------------------------------------
// The board
// -----------------------------------------------------------------------------

export interface FastBoardRow {
  slug: string
  routeSlug: string
  name: string
  corridor: string
  direction: SpotDirection
  county: string
  counts: PublicSpotCounts
  /**
   * People wanting a ride: presence waiting + open rider requests. The two are
   * summed for the same reason `SpotLiveCounts` sums them — from the curb they
   * are one queue — and the split stays available in `counts`.
   */
  waiting: number
  driverOffers: number
  /** Any signal at all. The sort key, and the "is this line moving" test. */
  activity: number
  /** The caller's own check-in is pinned to the top and flagged. */
  isCheckedIn: boolean
}

export interface FastBoardTotals {
  spots: number
  waiting: number
  driverOffers: number
  spotsWithActivity: number
}

export interface FastBoard {
  availability: PublicCountsAvailability
  rows: FastBoardRow[]
  totals: FastBoardTotals
}

export interface FastBoardOptions {
  /** Defaults to the active committed directory — the 43 running lines. */
  locations?: readonly SpotLocation[]
  /** Canonical slug of the caller's check-in, if any. Pinned first. */
  checkedInSlug?: string | null
}

function toRow(
  location: SpotLocation,
  counts: PublicSpotCounts,
  checkedInSlug: string | null
): FastBoardRow {
  const waiting = counts.waiting + counts.riderRequests

  return {
    slug: location.slug,
    routeSlug: location.routeSlug,
    name: location.name,
    corridor: location.corridor,
    direction: location.direction,
    county: location.county,
    counts,
    waiting,
    driverOffers: counts.driverOffers,
    activity: waiting + counts.driverOffers,
    isCheckedIn: checkedInSlug !== null && location.slug === checkedInSlug,
  }
}

/**
 * Every active spot, ordered for someone who is deciding *now*.
 *
 * The order is a product decision and it is asserted in the tests, so a later
 * refactor cannot quietly return to alphabetical:
 *
 *   1. the caller's own check-in, always first — it is the row they act on;
 *   2. busiest first, when counts are `live`. Ties break on riders waiting
 *      (a line with people in it is more decidable than one with only offers),
 *      then on name so the order is stable between two identical loads;
 *   3. when counts are `unavailable` there is nothing to rank by, so the board
 *      falls back to corridor → direction → name: the grouping a commuter
 *      already knows, rather than an arbitrary one that looks like a ranking.
 */
export function buildFastBoard(
  snapshot: PublicCountsSnapshot,
  options: FastBoardOptions = {}
): FastBoard {
  const locations = options.locations ?? activeSpotLocations()
  const checkedInSlug = options.checkedInSlug ? canonicalSlug(options.checkedInSlug) : null
  const isLive = snapshot.availability === 'live'

  const rows = locations.map((location) =>
    toRow(
      location,
      isLive ? countsForSlug(snapshot, location.slug) : { ...ZERO_SPOT_COUNTS },
      checkedInSlug
    )
  )

  rows.sort((left, right) => {
    if (left.isCheckedIn !== right.isCheckedIn) return left.isCheckedIn ? -1 : 1

    if (isLive) {
      if (right.activity !== left.activity) return right.activity - left.activity
      if (right.waiting !== left.waiting) return right.waiting - left.waiting
      return left.name.localeCompare(right.name)
    }

    if (left.corridor !== right.corridor) return left.corridor.localeCompare(right.corridor)
    if (left.direction !== right.direction) return left.direction.localeCompare(right.direction)
    return left.name.localeCompare(right.name)
  })

  return {
    availability: snapshot.availability,
    rows,
    totals: {
      spots: rows.length,
      waiting: rows.reduce((total, row) => total + row.waiting, 0),
      driverOffers: rows.reduce((total, row) => total + row.driverOffers, 0),
      spotsWithActivity: rows.filter((row) => row.activity > 0).length,
    },
  }
}

/** The rows a power user is scanning for: the lines that are actually moving. */
export function activeFastBoardRows(board: FastBoard) {
  return board.availability === 'live' ? board.rows.filter((row) => row.activity > 0) : []
}

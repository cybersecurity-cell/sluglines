/**
 * `lib/domain/public-counts.ts` — the anonymous-readable aggregates behind the
 * M1 public surface (rev. 5.3 §8 M1, "Public data functions").
 *
 * The spec names two SECURITY DEFINER, anonymous-callable functions:
 *
 *   get_public_spot_counts()        -> (spot_slug, corridor, direction,
 *   get_public_open_offer_counts()      waiting_count, driver_offer_count,
 *                                       rider_request_count)
 *
 * Counts only. No member ids, no time columns, no display names — the row shape
 * below is the whole contract, and `PublicSpotCountRow` deliberately has no
 * field that could carry one.
 *
 * NEITHER FUNCTION EXISTS YET
 * ---------------------------------------------------------------------------
 * They are §11 Phase 2 objects; the migrations in this repo stop at `0004`. So
 * every call here is written to *expect* the absence and to report it as a
 * state (`unavailable`) rather than to throw: the public pages must render
 * signed-out, on a database that has none of this, without a runtime error and
 * without claiming a count of zero it did not measure. `unavailable` and
 * "measured zero" are different renders — see `CorridorStatusStrip`.
 *
 * BOUNDARY (rev. 5.3 §8, enforced by `tests/domain-boundaries.test.mjs`)
 * ---------------------------------------------------------------------------
 * No React, no `lib/ai`, no Next. The Supabase client is *injected* rather than
 * constructed here: `createClient()` binds to `next/headers` cookies, which is
 * app infrastructure. `src/lib/public-directory.ts` does that binding. The
 * structural `PublicCountsClient` below is all this module needs, which is also
 * what makes `tests/public-counts.test.mjs` able to run the real code paths
 * against a fake client with no database and no environment.
 */

import type { SpotCorridor, SpotDirection, SpotLocation } from './locations.ts'
import { SPOT_CORRIDORS, SPOT_LOCATIONS, canonicalSlug } from './locations.ts'

/** rev. 5.3 §8 M1. Names are the contract with the Phase 2 migration. */
export const PUBLIC_SPOT_COUNTS_FUNCTION = 'get_public_spot_counts'
export const PUBLIC_OPEN_OFFER_COUNTS_FUNCTION = 'get_public_open_offer_counts'

export const PUBLIC_COUNT_FUNCTIONS = [
  PUBLIC_SPOT_COUNTS_FUNCTION,
  PUBLIC_OPEN_OFFER_COUNTS_FUNCTION,
] as const

/** One row of either public function. Counts only, by design. */
export interface PublicSpotCountRow {
  spot_slug: string
  corridor: string
  direction: string
  waiting_count: number
  driver_offer_count: number
  rider_request_count: number
}

export interface PublicSpotCounts {
  waiting: number
  driverOffers: number
  riderRequests: number
}

export const ZERO_SPOT_COUNTS: PublicSpotCounts = {
  waiting: 0,
  driverOffers: 0,
  riderRequests: 0,
}

/**
 * `live` — the functions answered; the counts are measured.
 * `unavailable` — they are not deployed, not granted, or unreachable. A page
 * that renders `unavailable` as zeros would be publishing an unmeasured claim.
 */
export type PublicCountsAvailability = 'live' | 'unavailable'

export interface PublicCountsSnapshot {
  availability: PublicCountsAvailability
  /** Canonical slug → counts. Empty when `unavailable`. */
  bySlug: Record<string, PublicSpotCounts>
  /** Why the snapshot is `unavailable`, for the server log. Never rendered. */
  reason?: string
}

export const UNAVAILABLE_SNAPSHOT: PublicCountsSnapshot = {
  availability: 'unavailable',
  bySlug: {},
}

/** The one method this module calls. Anything Supabase-shaped satisfies it. */
export interface PublicCountsClient {
  rpc(
    name: string,
    params?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * SQLSTATEs and PostgREST codes that mean "this deployment does not have the
 * function yet", as opposed to "the call failed". Both render the same today,
 * but only these are *expected*: anything else is logged with its code so a
 * genuine breakage is not absorbed into the Phase-2-not-applied case.
 */
const EXPECTED_ABSENCE_CODES = new Set([
  '42883', // undefined_function
  '42P01', // undefined_table
  '42501', // insufficient_privilege — granted to anon in Phase 2
  'PGRST202', // PostgREST: function not found in the schema cache
  'PGRST301', // PostgREST: no suitable role / JWT
])

export function isExpectedAbsence(error: unknown) {
  const code = errorCodeOf(error)
  return code !== undefined && EXPECTED_ABSENCE_CODES.has(code)
}

export function errorCodeOf(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

function toCount(value: unknown) {
  const count = typeof value === 'string' ? Number(value) : value
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

/**
 * Postgres returns `numeric`/`bigint` aggregates as strings over PostgREST, so
 * the coercion is not defensive padding — `"3" + 1` is the bug it prevents.
 * Unknown slugs are kept: a spot the database knows about and this build does
 * not is data, and dropping it would hide a directory drift.
 */
export function normalizeCountRows(rows: unknown): PublicSpotCountRow[] {
  if (!Array.isArray(rows)) return []

  return rows.flatMap((row) => {
    if (row === null || typeof row !== 'object') return []
    const source = row as Record<string, unknown>
    const slug = typeof source.spot_slug === 'string' ? canonicalSlug(source.spot_slug) : ''
    if (!slug) return []

    return [
      {
        spot_slug: slug,
        corridor: typeof source.corridor === 'string' ? source.corridor : '',
        direction: typeof source.direction === 'string' ? source.direction : '',
        waiting_count: toCount(source.waiting_count),
        driver_offer_count: toCount(source.driver_offer_count),
        rider_request_count: toCount(source.rider_request_count),
      },
    ]
  })
}

/** Rows from both functions, summed per slug — a spot appears in either or both. */
export function indexCountRows(rows: readonly PublicSpotCountRow[]): Record<string, PublicSpotCounts> {
  const bySlug: Record<string, PublicSpotCounts> = {}

  for (const row of rows) {
    const current = bySlug[row.spot_slug] ?? { ...ZERO_SPOT_COUNTS }

    bySlug[row.spot_slug] = {
      waiting: current.waiting + row.waiting_count,
      driverOffers: current.driverOffers + row.driver_offer_count,
      riderRequests: current.riderRequests + row.rider_request_count,
    }
  }

  return bySlug
}

/**
 * Calls both public functions and merges them. Resolves to `unavailable` — it
 * never rejects — because the caller is a server component rendering the public
 * front door: a thrown error there is a 500 on the page the whole acquisition
 * wedge depends on (rev. 5.3 §9), and the page is fully readable without counts.
 *
 * A *partial* answer still counts as `live`: if the offer function exists and
 * the presence one does not, the numbers that were measured are shown.
 */
export async function fetchPublicSpotCounts(
  client: PublicCountsClient
): Promise<PublicCountsSnapshot> {
  const results = await Promise.all(
    PUBLIC_COUNT_FUNCTIONS.map(async (fn) => {
      try {
        const { data, error } = await client.rpc(fn)
        if (error) return { rows: [], error }
        return { rows: normalizeCountRows(data), error: undefined }
      } catch (error) {
        return { rows: [], error }
      }
    })
  )

  const failures = results.filter((result) => result.error !== undefined)

  if (failures.length === PUBLIC_COUNT_FUNCTIONS.length) {
    const codes = failures.map((failure) => errorCodeOf(failure.error) ?? 'unknown')
    return {
      availability: 'unavailable',
      bySlug: {},
      reason: failures.every((failure) => isExpectedAbsence(failure.error))
        ? `public count functions not deployed (${codes.join(', ')})`
        : `public count functions failed (${codes.join(', ')})`,
    }
  }

  return {
    availability: 'live',
    bySlug: indexCountRows(results.flatMap((result) => result.rows)),
  }
}

export function countsForSlug(snapshot: PublicCountsSnapshot, slug: string): PublicSpotCounts {
  return snapshot.bySlug[canonicalSlug(slug)] ?? { ...ZERO_SPOT_COUNTS }
}

export function totalCounts(snapshot: PublicCountsSnapshot): PublicSpotCounts {
  return Object.values(snapshot.bySlug).reduce<PublicSpotCounts>(
    (total, counts) => ({
      waiting: total.waiting + counts.waiting,
      driverOffers: total.driverOffers + counts.driverOffers,
      riderRequests: total.riderRequests + counts.riderRequests,
    }),
    { ...ZERO_SPOT_COUNTS }
  )
}

export interface CorridorStatus {
  corridor: SpotCorridor
  /** Active spots in the committed directory — known even with no database. */
  activeSpots: number
  /** Active spots reporting at least one count. `0` when `unavailable`. */
  spotsWithActivity: number
  counts: PublicSpotCounts
  directions: { direction: SpotDirection; activeSpots: number }[]
}

/**
 * The homepage strip (rev. 5.3 §8 M1: "Hero + live corridor status strip
 * (aggregate)"). Aggregated per corridor, never per member: the §8 note accepts
 * that a count of 1 at a named spot approximates one person's presence, and the
 * corridor roll-up is the coarser view the front page shows.
 *
 * Only **active** spots contribute. An inactive spot has no line to report on,
 * and including it would make "0 waiting" read as a quiet line rather than as
 * no line at all.
 */
export function corridorStatus(
  snapshot: PublicCountsSnapshot,
  locations: readonly SpotLocation[] = SPOT_LOCATIONS
): CorridorStatus[] {
  return SPOT_CORRIDORS.map((corridor) => {
    const active = locations.filter(
      (location) => location.corridor === corridor && location.active
    )

    const counts = active.reduce<PublicSpotCounts>(
      (total, location) => {
        const spot = countsForSlug(snapshot, location.slug)
        return {
          waiting: total.waiting + spot.waiting,
          driverOffers: total.driverOffers + spot.driverOffers,
          riderRequests: total.riderRequests + spot.riderRequests,
        }
      },
      { ...ZERO_SPOT_COUNTS }
    )

    return {
      corridor,
      activeSpots: active.length,
      spotsWithActivity: active.filter((location) => {
        const spot = countsForSlug(snapshot, location.slug)
        return spot.waiting + spot.driverOffers + spot.riderRequests > 0
      }).length,
      counts,
      directions: (['Morning', 'Afternoon'] as SpotDirection[]).map((direction) => ({
        direction,
        activeSpots: active.filter((location) => location.direction === direction).length,
      })),
    }
  }).filter((status) => status.activeSpots > 0)
}

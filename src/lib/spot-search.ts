/**
 * Presentation adapter over `lib/domain/spot-search.ts`.
 *
 * `SpotSearch.tsx` filters `DirectorySpot[]`; the domain filters `SpotLocation[]`.
 * Rather than keep two predicates in step by hand, this maps the component's
 * spots back to their domain records, runs the domain filter, and returns the
 * caller's own objects. The matching rule therefore has exactly one definition.
 */

import type { DirectorySpot } from './spot-directory.ts'
import { canonicalSlug, findSpotLocation } from './domain/locations.ts'
import { searchSpotLocations } from './domain/spot-search.ts'
import type { SpotSearchFilters } from './domain/spot-search.ts'

export type SpotFilters = SpotSearchFilters

export function filterSpots(spots: DirectorySpot[], filters: SpotFilters) {
  const bySlug = new Map(spots.map((spot) => [canonicalSlug(spot.slug), spot]))
  const locations = spots
    .map((spot) => findSpotLocation(spot.slug))
    .filter((location): location is NonNullable<typeof location> => Boolean(location))

  return searchSpotLocations(filters, locations).map(
    (location) => bySlug.get(location.slug) as DirectorySpot
  )
}

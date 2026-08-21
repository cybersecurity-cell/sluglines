/**
 * `lib/domain/spot-search.ts` — directory search over `SPOT_LOCATIONS`.
 *
 * Search lives in the domain layer, not in the component that renders the input
 * box, for the reason rev. 5.3 §6 gives generally: what a member is allowed to
 * *find* is the same question as what they are allowed to *use*, and that answer
 * has to be reproducible outside a browser. The filter is pure and synchronous
 * so it can back a client-side box today and a server route tomorrow without
 * changing meaning.
 *
 * The boundary rule applies here as everywhere in `lib/domain`: this file
 * imports `./locations.ts` and nothing else.
 */

import type { SpotCorridor, SpotDirection, SpotLocation } from './locations.ts'
import { SPOT_LOCATIONS, canonicalSlug } from './locations.ts'

export type SpotStatusFilter = 'all' | 'active' | 'inactive'

export interface SpotSearchFilters {
  query: string
  corridor: 'all' | SpotCorridor
  direction: 'all' | SpotDirection
  status: SpotStatusFilter
  county?: 'all' | string
}

export const EMPTY_SPOT_SEARCH: SpotSearchFilters = {
  query: '',
  corridor: 'all',
  direction: 'all',
  status: 'all',
}

/**
 * The fields a free-text query matches: the four the directory box has always
 * matched, plus `slug`, so a member holding a legacy `/slug_pickup/<slug>/` URL
 * can paste its tail and land on the right spot.
 *
 * `linesFrom` / `linesTo` are deliberately **excluded**. Including them reads
 * like an improvement and is not: it turns a search for one spot into a search
 * for every spot that names it on a line list, which is a different feature with
 * a different result shape. `resolveSpotQuery()` below is the exact-match path
 * for callers that already know which spot they want. `notes` is excluded for
 * the same reason: editorial asides produce matches nobody typed toward.
 */
function searchableText(location: SpotLocation) {
  return [location.name, location.county, location.destination, location.corridor, location.slug]
}

export function matchesSpotQuery(location: SpotLocation, query: string) {
  const needle = query.trim().toLowerCase()

  if (needle.length === 0) {
    return true
  }

  return searchableText(location).some((value) => value.toLowerCase().includes(needle))
}

export function matchesSpotStatus(location: SpotLocation, status: SpotStatusFilter) {
  if (status === 'all') return true
  return status === 'active' ? location.active : !location.active
}

export function searchSpotLocations(
  filters: SpotSearchFilters,
  locations: readonly SpotLocation[] = SPOT_LOCATIONS
): SpotLocation[] {
  return locations.filter(
    (location) =>
      matchesSpotQuery(location, filters.query) &&
      (filters.corridor === 'all' || location.corridor === filters.corridor) &&
      (filters.direction === 'all' || location.direction === filters.direction) &&
      (!filters.county || filters.county === 'all' || location.county === filters.county) &&
      matchesSpotStatus(location, filters.status)
  )
}

/**
 * Exact-slug resolution, tried before free-text search. A caller holding a slug
 * wants that spot, not everything whose description happens to contain it.
 */
export function resolveSpotQuery(
  query: string,
  locations: readonly SpotLocation[] = SPOT_LOCATIONS
): SpotLocation | undefined {
  const needle = canonicalSlug(query)

  return locations.find(
    (location) => location.slug === needle || canonicalSlug(location.routeSlug) === needle
  )
}

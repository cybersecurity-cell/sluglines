/**
 * Presentation adapter over the domain spot directory.
 *
 * This file used to *be* the directory — 46 spot literals, imported by six
 * components and one other library. The inventory now lives in
 * `src/lib/domain/locations.ts` (rev. 5.3 §11 P1, `Docs/DECISIONS.md` D-31),
 * which is also what `supabase/migrations/0004_spot_locations_directory.sql` is
 * generated from. What remains here is the mapping into the `DirectorySpot`
 * shape the existing components already consume, so no component changed and no
 * URL moved.
 *
 * The mapping is not an alias: `DirectorySpot.slug` is the domain's `routeSlug`
 * (case-preserving, e.g. `Horner-Rd`), because that is what `/spots/<slug>` has
 * always served. `lat`/`lng` are the domain's `latitude`/`longitude` and are now
 * nullable, since four legacy-only spots publish no coordinates.
 */

import type {
  SpotCorridor as DomainCorridor,
  SpotDirection as DomainDirection,
  SpotLocation,
} from './domain/locations.ts'
import {
  SPOT_LOCATIONS,
  canonicalSlug,
  findSpotLocation,
  groupSpotLocations,
} from './domain/locations.ts'

export type SpotCorridor = DomainCorridor
export type SpotDirection = DomainDirection

export interface DirectorySpot {
  name: string
  slug: string
  lat: number | null
  lng: number | null
  active: boolean
  corridor: SpotCorridor
  direction: SpotDirection
  county: string
  destination: string
  description: string
  peakHours?: string
  parking?: string
  linesFrom?: string[]
  linesTo?: string[]
  fbUrl?: string
  notes?: string
}

export interface CorridorGroup {
  corridor: SpotCorridor
  directions: {
    direction: SpotDirection
    counties: {
      county: string
      spots: DirectorySpot[]
    }[]
  }[]
}

export function toDirectorySpot(location: SpotLocation): DirectorySpot {
  return {
    name: location.name,
    slug: location.routeSlug,
    lat: location.latitude,
    lng: location.longitude,
    active: location.active,
    corridor: location.corridor,
    direction: location.direction,
    county: location.county,
    destination: location.destination,
    description: location.description,
    ...(location.peakHours ? { peakHours: location.peakHours } : {}),
    ...(location.parking ? { parking: location.parking } : {}),
    ...(location.linesFrom ? { linesFrom: location.linesFrom } : {}),
    ...(location.linesTo ? { linesTo: location.linesTo } : {}),
    ...(location.fbUrl ? { fbUrl: location.fbUrl } : {}),
    ...(location.notes ? { notes: location.notes } : {}),
  }
}

export const SPOT_DIRECTORY: DirectorySpot[] = SPOT_LOCATIONS.map(toDirectorySpot)

export function normalizeDirectorySlug(slug: string) {
  return canonicalSlug(slug)
}

export function findSpotBySlug(slug: string) {
  const location = findSpotLocation(slug)

  return location ? toDirectorySpot(location) : undefined
}

/**
 * Every spot links to `/spots/<routeSlug>`, active or not.
 *
 * Inactive spots used to link to `/slug_pickup/<slug>/`, the legacy page. That
 * path now 301s here (`lib/legacy-redirects.ts`), so keeping the old href would
 * mean the directory linking into its own redirect — and rev. 5.3 §9 is
 * explicit that all 43 legacy spot URLs become live landing pages, not just the
 * running ones. `/spots/[slug]` renders an inactive spot as inactive.
 */
export function getSpotDetailHref(spot?: DirectorySpot | null) {
  if (!spot) {
    return '/spots'
  }

  return `/spots/${spot.slug}`
}

export function getActiveSpotLocations() {
  return SPOT_DIRECTORY.filter((spot) => spot.active)
}

export function groupSpotsByCorridor(spots: DirectorySpot[]): CorridorGroup[] {
  const bySlug = new Map(spots.map((spot) => [canonicalSlug(spot.slug), spot]))
  const selected = SPOT_LOCATIONS.filter((location) => bySlug.has(location.slug))

  return groupSpotLocations(selected).map((group) => ({
    corridor: group.corridor,
    directions: group.directions.map((direction) => ({
      direction: direction.direction,
      counties: direction.counties.map((county) => ({
        county: county.county,
        // Reuse the caller's objects rather than re-mapping, so identity is
        // preserved for callers that keyed on it.
        spots: county.locations.map((location) => bySlug.get(location.slug) as DirectorySpot),
      })),
    })),
  }))
}

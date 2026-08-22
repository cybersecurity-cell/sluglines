/**
 * The shape a public spot page renders, and the two ways it can be produced:
 * a `locations` row (`0004_spot_locations_directory.sql`) or the committed
 * directory that migration was generated from.
 *
 * Both mappings live here, next to each other, because the whole point is that
 * they produce the *same* record — the migration's source is
 * `lib/domain/locations.ts`, so a field that only one of them fills is a drift
 * between the table and the file it was generated from, and it should be
 * visible in one screenful.
 *
 * The IO half — actually issuing the select — is `src/lib/public-directory.ts`:
 * the client is cookie-bound and reaches `next/headers`, which the §8 boundary
 * rule keeps out of `lib/domain`.
 */

import type { SpotImage, SpotLocation } from './locations.ts'
import { spotImage } from './locations.ts'

export type PublicLocationSource = 'database' | 'directory'

export interface PublicLocation {
  /** Canonical lower-case key — the database key and the legacy URL slug. */
  slug: string
  /** Case-preserved segment served at `/spots/<routeSlug>`. */
  routeSlug: string
  name: string
  corridor: string
  direction: string
  county: string
  destination: string
  description: string
  latitude: number | null
  longitude: number | null
  isActive: boolean
  peakHours?: string
  parking?: string
  linesFrom: string[]
  linesTo: string[]
  communityUrl?: string
  notes?: string
  /**
   * Absent where no approved photograph exists — which is every spot today
   * (issue #18, D-39). Resolved from the committed directory in *both* mappings
   * below, because it is deliberately not a `locations` column: the row cannot
   * supply it, and the two mappings must still produce the same record.
   */
  image?: SpotImage
  /** Which of the two answered. Rendered nowhere; load-bearing in a bug report. */
  source: PublicLocationSource
}

/**
 * Explicit column list: `select('*')` would ship whatever a later migration
 * adds to the table, including columns added for an authenticated surface.
 */
export const LOCATION_COLUMNS =
  'slug,route_slug,name,corridor,direction,county,destination,description,latitude,longitude,is_active,peak_hours,parking,lines_from,lines_to,community_url,notes'

export interface LocationRow {
  slug: string
  route_slug: string
  name: string
  corridor: string
  direction: string
  county: string
  destination: string
  description: string
  latitude: number | string | null
  longitude: number | string | null
  is_active: boolean
  peak_hours: string | null
  parking: string | null
  lines_from: string[] | null
  lines_to: string[] | null
  community_url: string | null
  notes: string | null
}

/** `numeric` arrives from PostgREST as a string; `"38.77".toFixed` does not exist. */
function toCoordinate(value: number | string | null) {
  if (value === null || value === undefined) return null
  const coordinate = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(coordinate) ? coordinate : null
}

export function publicLocationFromRow(row: LocationRow): PublicLocation {
  return {
    slug: row.slug,
    routeSlug: row.route_slug,
    name: row.name,
    corridor: row.corridor,
    direction: row.direction,
    county: row.county,
    destination: row.destination,
    description: row.description,
    latitude: toCoordinate(row.latitude),
    longitude: toCoordinate(row.longitude),
    isActive: row.is_active,
    ...(row.peak_hours ? { peakHours: row.peak_hours } : {}),
    ...(row.parking ? { parking: row.parking } : {}),
    linesFrom: row.lines_from ?? [],
    linesTo: row.lines_to ?? [],
    ...(row.community_url ? { communityUrl: row.community_url } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...imageFor(row.slug),
    source: 'database',
  }
}

/** The one field the table cannot answer, so both mappings ask the directory. */
function imageFor(slug: string): { image?: SpotImage } {
  const image = spotImage(slug)
  return image ? { image } : {}
}

export function publicLocationFromDirectory(location: SpotLocation): PublicLocation {
  return {
    slug: location.slug,
    routeSlug: location.routeSlug,
    name: location.name,
    corridor: location.corridor,
    direction: location.direction,
    county: location.county,
    destination: location.destination,
    description: location.description,
    latitude: location.latitude,
    longitude: location.longitude,
    isActive: location.active,
    ...(location.peakHours ? { peakHours: location.peakHours } : {}),
    ...(location.parking ? { parking: location.parking } : {}),
    linesFrom: location.linesFrom ?? [],
    linesTo: location.linesTo ?? [],
    ...(location.fbUrl ? { communityUrl: location.fbUrl } : {}),
    ...(location.notes ? { notes: location.notes } : {}),
    ...(location.image ? { image: location.image } : {}),
    source: 'directory',
  }
}

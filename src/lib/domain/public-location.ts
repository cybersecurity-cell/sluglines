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

import type { SpotImage, SpotLocation, SpotProvenance } from './locations.ts'
import { findSpotLocation, spotImage } from './locations.ts'

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
  /**
   * Where this record's operational facts came from and how current they are
   * (issue #36). Like `image`, deliberately not a `locations` column, so both
   * mappings resolve it from the committed directory and a database row cannot
   * disagree with the directory about it.
   *
   * Required, and never absent: a record whose provenance could not be resolved
   * gets `needs-review`, because "we do not know where this came from" is an
   * unconfirmed fact, not an unqualified one.
   */
  provenance: SpotProvenance
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
    provenance: provenanceFor(row.slug),
    source: 'database',
  }
}

/** The one field the table cannot answer, so both mappings ask the directory. */
function imageFor(slug: string): { image?: SpotImage } {
  const image = spotImage(slug)
  return image ? { image } : {}
}

/**
 * Ditto for provenance (#36) — with one difference: it has no "absent" render.
 *
 * A row whose slug is not in the committed directory resolves to `needs-review`
 * rather than to nothing. That is the honest reading: the directory is where
 * provenance is recorded, so a spot it does not know about has no recorded
 * source, and an unsourced operational fact is exactly what this state is for.
 * Defaulting the other way would let a row appear on the site carrying more
 * authority than any record in the directory.
 */
function provenanceFor(slug: string): SpotProvenance {
  return (
    findSpotLocation(slug)?.provenance ?? {
      state: 'needs-review',
      source: 'Not in the committed directory; no source recorded',
    }
  )
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
    provenance: location.provenance,
    source: 'directory',
  }
}

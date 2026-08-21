import type { LocationCardLocation } from '@/components/LocationCard'
import type { DirectorySpot } from './spot-directory.ts'
import { findSpotBySlug } from './spot-directory.ts'

export interface SlugLocation extends LocationCardLocation {
  slug: string
  latitude: number | null
  longitude: number | null
  highway?: string
  is_active?: boolean
}

type LegacyLocationRow = {
  id: string
  spot_name: string
  location?: string | null
  destination: string
  highway?: string | null
  last_updated?: string | null
  is_active?: boolean | null
}

const COORDINATES_BY_NAME: Record<string, { latitude: number; longitude: number; slug?: string }> = {
  'Pentagon City': { latitude: 38.8621, longitude: -77.059, slug: 'pentagon-city' },
  'Horner Road': { latitude: 38.6586, longitude: -77.2807, slug: 'horner-road' },
  'Potomac Mills': { latitude: 38.6407, longitude: -77.2939, slug: 'potomac-mills' },
  'Rippon Landing': { latitude: 38.6109, longitude: -77.2894, slug: 'rippon-landing' },
  'Backlick Road': { latitude: 38.7826, longitude: -77.185, slug: 'backlick-road' },
  Rosslyn: { latitude: 38.8979, longitude: -77.0718, slug: 'rosslyn' },
  'Crystal City': { latitude: 38.8524, longitude: -77.0496, slug: 'crystal-city' },
  'Stafford Courthouse': { latitude: 38.4221, longitude: -77.4083, slug: 'stafford-courthouse' },
}

const FALLBACK_LOCATIONS: SlugLocation[] = [
  {
    id: 'fallback-pentagon-city',
    spot_name: 'Pentagon City',
    slug: 'pentagon-city',
    location: 'S Hayes St & Army Navy Dr, Arlington, VA',
    destination: 'Pentagon / Downtown DC',
    highway: 'I-395',
    latitude: 38.8621,
    longitude: -77.059,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-horner-road',
    spot_name: 'Horner Road',
    slug: 'horner-road',
    location: 'Horner Rd & US-1, Woodbridge, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    latitude: 38.6586,
    longitude: -77.2807,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-potomac-mills',
    spot_name: 'Potomac Mills',
    slug: 'potomac-mills',
    location: 'Smoketown Rd & Clover Rd, Woodbridge, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    latitude: 38.6407,
    longitude: -77.2939,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-rippon-landing',
    spot_name: 'Rippon Landing',
    slug: 'rippon-landing',
    location: 'Rippon Blvd, Woodbridge, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    latitude: 38.6109,
    longitude: -77.2894,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-backlick-road',
    spot_name: 'Backlick Road',
    slug: 'backlick-road',
    location: 'Backlick Rd & Rolling Rd, Springfield, VA',
    destination: 'Pentagon / Rosslyn',
    highway: 'I-395',
    latitude: 38.7826,
    longitude: -77.185,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-rosslyn',
    spot_name: 'Rosslyn',
    slug: 'rosslyn',
    location: 'N Moore St, Arlington, VA',
    destination: 'Downtown DC',
    highway: 'I-66',
    latitude: 38.8979,
    longitude: -77.0718,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-crystal-city',
    spot_name: 'Crystal City',
    slug: 'crystal-city',
    location: '23rd St S, Arlington, VA',
    destination: 'Downtown DC / Pentagon',
    highway: 'I-395',
    latitude: 38.8524,
    longitude: -77.0496,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
  {
    id: 'fallback-stafford-courthouse',
    spot_name: 'Stafford Courthouse',
    slug: 'stafford-courthouse',
    location: 'Courthouse Rd, Stafford, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    latitude: 38.4221,
    longitude: -77.4083,
    is_active: true,
    last_updated: new Date(0).toISOString(),
  },
]

export function toLocationSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function enrichLocation(row: LegacyLocationRow): SlugLocation {
  const coordinates = COORDINATES_BY_NAME[row.spot_name]

  return {
    id: row.id,
    spot_name: row.spot_name,
    slug: coordinates?.slug || toLocationSlug(row.spot_name),
    location: row.location || undefined,
    destination: row.destination,
    highway: row.highway || undefined,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    is_active: row.is_active ?? true,
    last_updated: row.last_updated || new Date().toISOString(),
  }
}

export function getActiveFallbackLocations() {
  const lastUpdated = new Date().toISOString()

  return FALLBACK_LOCATIONS.filter((location) => location.is_active).map((location) => ({
    ...location,
    last_updated: lastUpdated,
  }))
}

export function findFallbackLocationBySlug(slug: string) {
  const normalizedSlug = slug.toLowerCase()
  const directorySpot = findSpotBySlug(slug)

  if (directorySpot) {
    return directorySpotToLocation(directorySpot)
  }

  return FALLBACK_LOCATIONS.find((location) => location.slug.toLowerCase() === normalizedSlug)
}

export function directorySpotToLocation(spot: DirectorySpot): SlugLocation {
  return {
    id: `fallback-${spot.slug.toLowerCase()}`,
    spot_name: spot.name,
    slug: spot.slug,
    location: `${spot.county} County / ${spot.corridor}`,
    destination: spot.destination,
    highway: spot.corridor,
    latitude: spot.lat,
    longitude: spot.lng,
    is_active: spot.active,
    last_updated: new Date().toISOString(),
  }
}

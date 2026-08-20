import {
  projectLocation,
  type Corridor,
  type Direction,
  type LocationRow,
  type LocationSummary,
} from '../domain/location.ts'

export interface LocationFilters {
  query?: string
  corridor?: Corridor
  direction?: Direction
  destination?: string
}

export interface LocationDataSource {
  fetchAll(): Promise<LocationRow[]>
  fetchBySlug(slug: string): Promise<LocationRow | null>
}

export interface LocationRepository {
  list(filters?: LocationFilters): Promise<LocationSummary[]>
  getBySlug(slug: string): Promise<LocationSummary | null>
}

export class DataAccessError extends Error {
  override readonly cause: unknown

  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'DataAccessError'
    this.cause = cause
  }
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function matchesFilters(row: LocationRow, filters: LocationFilters): boolean {
  if (filters.corridor && row.corridor !== filters.corridor) return false
  if (filters.direction && filters.direction !== 'both') {
    if (row.direction !== filters.direction && row.direction !== 'both') return false
  }

  if (filters.destination) {
    const destination = normalize(filters.destination)
    const servesDestination = row.routes.some((route) =>
      [route.destination.slug, route.destination.name].some((value) => normalize(value) === destination),
    )
    if (!servesDestination) return false
  }

  if (filters.query) {
    const query = normalize(filters.query)
    const corpus = [
      row.name,
      row.address,
      row.municipality,
      row.corridor,
      ...row.routes.flatMap((route) => [route.destination.name, route.destination.slug]),
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalize)
      .join(' ')
    if (!corpus.includes(query)) return false
  }

  return true
}

function statusRank(location: LocationSummary): number {
  if (location.status === 'active' && location.freshness.tone === 'verified') return 0
  if (location.status === 'active') return 1
  if (location.status === 'review_needed') return 2
  if (location.status === 'seasonal') return 3
  return 4
}

export function createLocationRepository(
  source: LocationDataSource,
  now = new Date(),
): LocationRepository {
  return {
    async list(filters = {}) {
      try {
        const rows = await source.fetchAll()
        return rows
          .filter((row) => matchesFilters(row, filters))
          .map((row) => projectLocation(row, now))
          .sort((left, right) => statusRank(left) - statusRank(right) || left.name.localeCompare(right.name))
      } catch (error) {
        throw new DataAccessError('Location information is temporarily unavailable.', error)
      }
    },

    async getBySlug(slug) {
      try {
        const row = await source.fetchBySlug(slug)
        return row ? projectLocation(row, now) : null
      } catch (error) {
        throw new DataAccessError('Location information is temporarily unavailable.', error)
      }
    },
  }
}

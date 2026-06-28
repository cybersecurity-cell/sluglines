import type { DirectorySpot } from './spot-directory.ts'

export interface SpotFilters {
  query: string
  corridor: 'all' | DirectorySpot['corridor']
  direction: 'all' | DirectorySpot['direction']
  status: 'all' | 'active' | 'inactive'
}

export function filterSpots(spots: DirectorySpot[], filters: SpotFilters) {
  const query = filters.query.trim().toLowerCase()

  return spots.filter((spot) => {
    const matchesQuery =
      query.length === 0 ||
      [spot.name, spot.county, spot.destination, spot.corridor].some((value) =>
        value.toLowerCase().includes(query)
      )
    const matchesCorridor = filters.corridor === 'all' || spot.corridor === filters.corridor
    const matchesDirection = filters.direction === 'all' || spot.direction === filters.direction
    const matchesStatus =
      filters.status === 'all' ||
      (filters.status === 'active' && spot.active) ||
      (filters.status === 'inactive' && !spot.active)

    return matchesQuery && matchesCorridor && matchesDirection && matchesStatus
  })
}

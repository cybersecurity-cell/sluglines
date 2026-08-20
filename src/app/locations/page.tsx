import type { Metadata } from 'next'

import { LocationGrid } from '@/components/LocationGrid'
import { LocationSearch } from '@/components/LocationSearch'
import { listPublicLocations } from '@/lib/data/public'
import type { Corridor, Direction, LocationSummary } from '@/lib/domain/location'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Slugging locations | Sluglines',
  description: 'Browse source-labelled Northern Virginia slugging pickup locations and common destinations.',
}

const corridors = new Set<Corridor>(['I-95/I-395', 'I-66', 'Other'])
const directions = new Set<Direction>(['inbound', 'outbound', 'both'])

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function LocationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams
  const query = first(values.query).slice(0, 100)
  const corridorValue = first(values.corridor)
  const directionValue = first(values.direction)
  const corridor = corridors.has(corridorValue as Corridor) ? corridorValue as Corridor : undefined
  const direction = directions.has(directionValue as Direction) ? directionValue as Direction : undefined

  let locations: LocationSummary[] = []
  let error: string | undefined
  try {
    locations = await listPublicLocations({ query: query || undefined, corridor, direction })
  } catch {
    error = 'Location information is temporarily unavailable.'
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 md:py-20">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Directory</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Slugging locations</h1>
      <p className="mt-4 max-w-3xl leading-7 text-slate-600">Browse known pickup locations and destination connections. Listings may describe historical or community-reported patterns; always check the freshness label.</p>
      <div className="mt-8"><LocationSearch corridor={corridorValue} direction={directionValue} query={query} /></div>
      <div className="mt-8"><LocationGrid error={error} locations={locations} /></div>
    </div>
  )
}

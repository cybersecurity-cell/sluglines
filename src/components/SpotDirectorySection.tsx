import Link from 'next/link'
import { Navigation } from 'lucide-react'
import {
  DirectorySpot,
  getSpotDetailHref,
  groupSpotsByCorridor,
} from '@/lib/spot-directory'

interface SpotDirectorySectionProps {
  spots: DirectorySpot[]
  title?: string
  description?: string
  limitPerCounty?: number
}

export default function SpotDirectorySection({
  spots,
  title = 'Slug Pickup Locations',
  description = 'Browse established morning and afternoon slug lines by corridor, direction, and county.',
  limitPerCounty,
}: SpotDirectorySectionProps) {
  const grouped = groupSpotsByCorridor(spots)

  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Slug Pickup</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
          </div>
          <Link href="/spots" className="text-sm font-bold text-sky-700 hover:text-sky-900">
            View all locations
          </Link>
        </div>

        <div className="space-y-6">
          {grouped.map((corridorGroup) => (
            <div key={corridorGroup.corridor} className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-lg font-bold text-slate-950">{corridorGroup.corridor}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                {corridorGroup.directions.map((directionGroup) => (
                  <div key={`${corridorGroup.corridor}-${directionGroup.direction}`} className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      {directionGroup.direction} lines
                    </h4>
                    {directionGroup.counties.map((countyGroup) => (
                      <div key={`${corridorGroup.corridor}-${directionGroup.direction}-${countyGroup.county}`} className="rounded-lg border border-slate-200">
                        <div className="bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">{countyGroup.county}</div>
                        <ul className="divide-y divide-slate-100">
                          {(limitPerCounty ? countyGroup.spots.slice(0, limitPerCounty) : countyGroup.spots).map((spot) => (
                            <li key={spot.slug} className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <div className="min-w-0">
                                <Link href={getSpotDetailHref(spot)} className="block truncate text-sm font-semibold text-slate-950 hover:text-sky-700">
                                  {spot.name}
                                </Link>
                                <p className="truncate text-xs text-slate-500">{spot.destination}</p>
                              </div>
                              <a
                                href={`https://google.com/maps/?q=${spot.lat},${spot.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-sky-700"
                                aria-label={`Open ${spot.name} in maps`}
                              >
                                <Navigation className="h-4 w-4" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

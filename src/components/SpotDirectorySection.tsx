import Link from 'next/link'
import Image from 'next/image'
import { getPrimaryFacebookUrlForSpot } from '@/lib/community-channels'
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
    <section className="border-b border-stone-200 bg-[#FAFAF8]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">
              Slug pickup
            </p>
            <h2 className="h-display text-3xl text-[#17202A]">{title}</h2>
            <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
          </div>
          <Link href="/spots" className="text-sm font-bold text-[#2E7D46] hover:text-[#1f5c33]">
            View all locations
          </Link>
        </div>

        <div className="space-y-10">
          {grouped.map((corridorGroup) => (
            <div key={corridorGroup.corridor}>
              <div className="mb-4 flex items-center gap-3 border-b border-stone-300 pb-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#2E7D46]" />
                <h3 className="h-display text-lg text-[#17202A]">{corridorGroup.corridor}</h3>
              </div>
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {corridorGroup.directions.map((directionGroup) => (
                  <div key={`${corridorGroup.corridor}-${directionGroup.direction}`} className="space-y-5">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-wide text-slate-500">
                      {directionGroup.direction} lines
                    </h4>
                    {directionGroup.counties.map((countyGroup) => (
                      <div key={`${corridorGroup.corridor}-${directionGroup.direction}-${countyGroup.county}`}>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                          {countyGroup.county}
                        </p>
                        <ul className="divide-y divide-stone-200 border-y border-stone-200">
                          {(limitPerCounty ? countyGroup.spots.slice(0, limitPerCounty) : countyGroup.spots).map((spot) => {
                            const communityUrl = getPrimaryFacebookUrlForSpot(spot.slug) || spot.fbUrl

                            return (
                              <li key={spot.slug} className="flex items-center justify-between gap-3 py-1.5">
                                <div className="min-w-0">
                                  <Link
                                    href={getSpotDetailHref(spot)}
                                    className="flex min-h-[28px] items-center truncate text-sm font-semibold text-[#17202A] hover:text-[#2E7D46]"
                                  >
                                    {spot.name}
                                  </Link>
                                  <p className="truncate text-xs text-slate-500">{spot.destination}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  {communityUrl && (
                                    <a
                                      href={communityUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-stone-100"
                                      aria-label={`Open ${spot.name} community group on Facebook`}
                                    >
                                      <Image src="/images/facebook-70x70.png" alt="" width={22} height={22} />
                                    </a>
                                  )}
                                  {/* Four legacy-only spots publish no coordinates
                                      (Docs/DECISIONS.md D-31); a maps link built from
                                      `null,null` would land in the Gulf of Guinea. */}
                                  {spot.lat !== null && spot.lng !== null && (
                                    <a
                                      href={`https://google.com/maps/?q=${spot.lat},${spot.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-stone-100"
                                      aria-label={`Open ${spot.name} in Google Maps`}
                                    >
                                      <Image src="/images/direction.png" alt="" width={22} height={22} />
                                    </a>
                                  )}
                                </div>
                              </li>
                            )
                          })}
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

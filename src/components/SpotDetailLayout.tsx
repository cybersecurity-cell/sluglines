import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, ExternalLink, MapPinned, Navigation, Users } from 'lucide-react'
import CommunityLinksCard from '@/components/CommunityLinksCard'
import SpotLiveCounts from '@/components/SpotLiveCounts'
import SpotPhoto from '@/components/SpotPhoto'
import SpotQuickFacts from '@/components/SpotQuickFacts'
import { getPrimaryFacebookUrlForSpot } from '@/lib/community-channels'
import { isSafeExternalLinkUrl } from '@/lib/domain/locations'
import type { PublicCountsAvailability, PublicSpotCounts } from '@/lib/domain/public-counts'
import type { PublicLocation } from '@/lib/public-directory'

interface SpotDetailLayoutProps {
  location: PublicLocation
  counts: PublicSpotCounts
  availability: PublicCountsAvailability
}

/**
 * The `/spots/[slug]` card. It takes one `PublicLocation` — previously it took a
 * `SlugLocation` row *and* a `DirectorySpot`, because the row came from the old
 * `spot_status` table and carried none of the directory's facts. With the
 * `locations` table those are one record, so the merge that used to happen in
 * every field expression (`spot?.corridor || location.highway || 'Slug line'`)
 * happens once, in `lib/public-directory.ts`, where it can say which source
 * answered.
 */
export default function SpotDetailLayout({ location, counts, availability }: SpotDetailLayoutProps) {
  // Four legacy-only spots publish no coordinates (Docs/DECISIONS.md D-31); a
  // maps link built from `null,null` would land in the Gulf of Guinea, so those
  // fall back to a name search.
  const mapsUrl =
    location.latitude !== null && location.longitude !== null
      ? `https://google.com/maps/?q=${location.latitude},${location.longitude}`
      : `https://google.com/maps/?q=${encodeURIComponent(`${location.name} ${location.county} VA`)}`
  const lines = location.linesTo.length > 0 ? location.linesTo : location.linesFrom
  const communityUrl = getPrimaryFacebookUrlForSpot(location.routeSlug) || location.communityUrl

  return (
    <div className="bg-[#FAFAF8]">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10">
        <Link
          href="/spots"
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700 hover:text-[#2E7D46]"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Slug pickup locations
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="rounded-lg border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{location.corridor}</Badge>
                  <Badge>{location.direction} line</Badge>
                  <Badge>{location.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>

              <div className="p-5">
                <h1 className="h-display max-w-3xl text-4xl text-[#17202A] md:text-5xl">{location.name}</h1>
                <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">{location.description}</p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#2E7D46] px-4 py-3 text-sm font-bold text-white hover:bg-[#245F37]"
                  >
                    <Navigation aria-hidden className="h-4 w-4" />
                    Open in Maps
                  </a>
                  {communityUrl && (
                    <a
                      href={communityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-[#17202A] hover:border-[#2E7D46] hover:text-[#2E7D46]"
                    >
                      <Users aria-hidden className="h-4 w-4" />
                      Community Group
                    </a>
                  )}
                </div>
              </div>
            </section>

            <SpotQuickFacts location={location} />

            <CommunityLinksCard spotSlug={location.routeSlug} fallbackUrl={location.communityUrl} />

            <section className="rounded-lg border border-stone-200 bg-white p-5">
              <h2 className="h-display text-xl text-[#17202A]">Location details</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <InfoBlock title="Line direction" value={`${location.direction} route`} />
                <InfoBlock title="Corridor" value={location.corridor} />
                <InfoBlock title="Current status" value={location.isActive ? 'Active listing' : 'Currently inactive'} />
                <InfoBlock
                  title="Map coordinates"
                  value={
                    location.latitude !== null && location.longitude !== null
                      ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                      : 'Not published for this spot'
                  }
                />
              </div>

              {lines.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wide text-slate-600">Known destinations</h3>
                  <div className="flex flex-wrap gap-2">
                    {lines.map((line) => (
                      <span key={line} className="rounded-full border border-stone-200 bg-[#FAFAF8] px-3 py-1 text-sm font-semibold text-slate-700">
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {location.externalLinks && location.externalLinks.length > 0 && (
                <div className="mt-5 rounded-lg border border-stone-200 bg-[#FAFAF8] p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-slate-600">
                    <ExternalLink aria-hidden className="h-4 w-4" />
                    External links
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {location.externalLinks
                      .filter((link) => isSafeExternalLinkUrl(link.url))
                      .map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2E7D46] underline hover:text-[#245F37]"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {location.notes && (
                <div className="mt-5 rounded-lg border border-stone-200 bg-[#FAFAF8] p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-slate-600">
                    <MapPinned aria-hidden className="h-4 w-4" />
                    Notes
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-700">{location.notes}</p>
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-4">
            <SpotPhoto image={location.image} spotName={location.name} />
            <SpotLiveCounts
              spotName={location.name}
              counts={counts}
              availability={availability}
              isActive={location.isActive}
              peakHours={location.peakHours}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-stone-200 bg-[#FAFAF8] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide text-slate-700">
      {children}
    </span>
  )
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-[#FAFAF8] p-4">
      <div className="font-mono text-xs font-bold uppercase tracking-wide text-slate-600">{title}</div>
      <div className="mt-1 font-semibold text-[#17202A]">{value}</div>
    </div>
  )
}

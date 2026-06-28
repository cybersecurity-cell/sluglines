import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, MapPinned, Navigation, Users } from 'lucide-react'
import SpotLiveModule from '@/components/SpotLiveModule'
import SpotQuickFacts from '@/components/SpotQuickFacts'
import type { SlugLocation } from '@/lib/location-fallbacks'
import type { DirectorySpot } from '@/lib/spot-directory'

interface SpotDetailLayoutProps {
  location: SlugLocation
  spot?: DirectorySpot | null
}

export default function SpotDetailLayout({ location, spot }: SpotDetailLayoutProps) {
  const mapsUrl =
    typeof location.latitude === 'number' && typeof location.longitude === 'number'
      ? `https://google.com/maps/?q=${location.latitude},${location.longitude}`
      : `https://google.com/maps/?q=${encodeURIComponent(location.location || location.spot_name)}`
  const isFallback = location.id.startsWith('fallback-')
  const lines = spot?.linesTo || spot?.linesFrom || []

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10">
        <Link href="/spots" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-800">
          <ArrowLeft className="h-4 w-4" />
          Slug pickup locations
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{spot?.corridor || location.highway || 'Slug line'}</Badge>
                  <Badge>{spot?.direction || 'Live'} line</Badge>
                  <Badge>{location.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>

              <div className="p-5">
                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{location.spot_name}</h1>
                <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">
                  {spot?.description || `${location.spot_name} serves commuters headed toward ${location.destination}.`}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800"
                  >
                    <Navigation className="h-4 w-4" />
                    Open in Maps
                  </a>
                  {spot?.fbUrl && (
                    <a
                      href={spot.fbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:border-sky-300 hover:text-sky-800"
                    >
                      <Users className="h-4 w-4" />
                      Community Group
                    </a>
                  )}
                </div>
              </div>
            </section>

            <SpotQuickFacts location={location} spot={spot} />

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold text-slate-950">Location details</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <InfoBlock title="Line direction" value={`${spot?.direction || 'Active'} route`} />
                <InfoBlock title="Corridor" value={spot?.corridor || location.highway || 'Northern Virginia'} />
                <InfoBlock title="Current status" value={location.is_active ? 'Active listing' : 'Currently inactive'} />
                <InfoBlock title="Map coordinates" value={`${location.latitude?.toFixed(4) || 'Unknown'}, ${location.longitude?.toFixed(4) || 'Unknown'}`} />
              </div>

              {lines.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Known destinations</h3>
                  <div className="flex flex-wrap gap-2">
                    {lines.map((line) => (
                      <span key={line} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {spot?.notes && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                    <MapPinned className="h-4 w-4" />
                    Notes
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-700">{spot.notes}</p>
                </div>
              )}
            </section>
          </main>

          <SpotLiveModule location={location} isFallback={isFallback} />
        </div>
      </div>
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
      {children}
    </span>
  )
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  )
}

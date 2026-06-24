import Link from 'next/link'
import { ArrowLeft, Car, Clock, MapPin, Navigation, ParkingCircle, Users } from 'lucide-react'
import { notFound } from 'next/navigation'
import ActivityFeed from '@/components/ActivityFeed'
import AlertBanner from '@/components/AlertBanner'
import LocationCard from '@/components/LocationCard'
import {
  SlugLocation,
  enrichLocation,
  findFallbackLocationBySlug,
  toLocationSlug,
} from '@/lib/location-fallbacks'
import { findSpotBySlug } from '@/lib/spot-directory'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const location = await getLocationBySlug(params.slug)

  if (!location) {
    return { title: 'Location Not Found - Sluglines' }
  }

  return {
    title: `${location.spot_name} - Sluglines`,
    description: `Live rider and driver counts for ${location.spot_name}, headed toward ${location.destination}.`,
  }
}

export default async function SpotPage({ params }: { params: { slug: string } }) {
  const location = await getLocationBySlug(params.slug)
  const directorySpot = findSpotBySlug(params.slug)

  if (!location) {
    notFound()
  }

  const mapsUrl =
    typeof location.latitude === 'number' && typeof location.longitude === 'number'
      ? `https://google.com/maps/?q=${location.latitude},${location.longitude}`
      : `https://google.com/maps/?q=${encodeURIComponent(location.location || location.spot_name)}`
  const isFallback = location.id.startsWith('fallback-')
  const lines = directorySpot?.linesTo || directorySpot?.linesFrom || []

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/spots" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to all spots
      </Link>

      <section className="mb-8 overflow-hidden rounded-2xl border border-sky-400/15 bg-slate-900/80">
        <div className="border-b border-sky-400/10 bg-slate-950/45 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-bold text-sky-200">
              {directorySpot?.corridor || location.highway || 'Slug line'}
            </span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
              {directorySpot?.direction || 'Live'} line
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
              {location.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl">{location.spot_name}</h1>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-300">
              {directorySpot?.description || `${location.spot_name} serves commuters headed toward ${location.destination}.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-300"
              >
                <Navigation className="h-4 w-4" />
                Open in Maps
              </a>
              {directorySpot?.fbUrl && (
                <a
                  href={directorySpot.fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-bold text-sky-200 transition-colors hover:bg-sky-300/15"
                >
                  <Users className="h-4 w-4" />
                  Community Group
                </a>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">Quick facts</h2>
            <dl className="space-y-3 text-sm">
              <Fact icon={<MapPin className="h-4 w-4" />} label="Area" value={directorySpot?.county || location.location || 'Northern Virginia'} />
              <Fact icon={<Car className="h-4 w-4" />} label="Destination" value={location.destination} />
              <Fact icon={<Clock className="h-4 w-4" />} label="Peak hours" value={directorySpot?.peakHours || 'Peak commute windows'} />
              {directorySpot?.parking && <Fact icon={<ParkingCircle className="h-4 w-4" />} label="Parking" value={directorySpot.parking} />}
            </dl>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.65fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-sky-400/15 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold text-white">Slug line details</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoBlock title="Line direction" value={`${directorySpot?.direction || 'Active'} route`} />
              <InfoBlock title="Corridor" value={directorySpot?.corridor || location.highway || 'Northern Virginia'} />
              <InfoBlock title="Current status" value={location.is_active ? 'Active listing' : 'Currently inactive'} />
              <InfoBlock title="Map coordinates" value={`${location.latitude?.toFixed(4) || 'Unknown'}, ${location.longitude?.toFixed(4) || 'Unknown'}`} />
            </div>
            {lines.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Known destinations</h3>
                <div className="flex flex-wrap gap-2">
                  {lines.map((line) => (
                    <span key={line} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {!isFallback && <AlertBanner locationId={location.id} />}
          {!isFallback && <ActivityFeed locationId={location.id} />}
        </div>

        <aside className="space-y-5">
          <LocationCard location={location} />
          {isFallback && (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">
              Live check-ins will activate here once this spot is linked to the Supabase live board.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-sky-300">{icon}</span>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-slate-200">{value}</dd>
      </div>
    </div>
  )
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 font-semibold text-slate-100">{value}</div>
    </div>
  )
}

async function getLocationBySlug(slug: string): Promise<SlugLocation | null> {
  const supabase = createClient()
  const { data: newSchemaLocation } = await supabase
    .from('spot_status')
    .select('id,spot_name,slug,location,destination,highway,last_updated,latitude,longitude,is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (newSchemaLocation) {
    return {
      ...newSchemaLocation,
      slug: newSchemaLocation.slug || toLocationSlug(newSchemaLocation.spot_name),
    } as SlugLocation
  }

  const { data: legacyLocations } = await supabase
    .from('spot_status')
    .select('id,spot_name,location,destination,highway,last_updated,is_active')

  const matchedLegacy = legacyLocations
    ?.map(enrichLocation)
    .find((location) => location.slug === slug || toLocationSlug(location.spot_name) === slug)

  return matchedLegacy || findFallbackLocationBySlug(slug) || null
}

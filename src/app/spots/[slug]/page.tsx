import Link from 'next/link'
import { ArrowLeft, MapPin, Navigation } from 'lucide-react'
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

  if (!location) {
    notFound()
  }

  const mapsUrl =
    typeof location.latitude === 'number' && typeof location.longitude === 'number'
      ? `https://google.com/maps/?q=${location.latitude},${location.longitude}`
      : `https://google.com/maps/?q=${encodeURIComponent(location.location || location.spot_name)}`

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/spots" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to all spots
      </Link>

      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs font-bold text-sky-200">
              {location.highway}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-400">
              {location.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-white md:text-5xl">{location.spot_name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-400">{location.spot_name} → {location.destination}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            {location.location}
          </p>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-300"
        >
          <Navigation className="h-4 w-4" />
          Open in Maps
        </a>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <LocationCard location={location} />
          {!location.id.startsWith('fallback-') && <AlertBanner locationId={location.id} />}
        </div>
        {!location.id.startsWith('fallback-') && <ActivityFeed locationId={location.id} />}
      </div>
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

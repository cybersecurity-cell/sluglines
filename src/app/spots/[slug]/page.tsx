import { notFound } from 'next/navigation'
import SpotDetailLayout from '@/components/SpotDetailLayout'
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

  return <SpotDetailLayout location={location} spot={directorySpot} />
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

import { createClient } from '@/lib/supabase/server'

import { createAdvisoryRepository, createSupabaseAdvisorySource } from './advisories'
import { createLocationRepository, type LocationFilters } from './locations'
import { createSupabaseLocationSource } from './supabase-locations'

export async function listPublicLocations(filters?: LocationFilters) {
  const client = await createClient()
  return createLocationRepository(createSupabaseLocationSource(client)).list(filters)
}

export async function getPublicLocation(slug: string) {
  const client = await createClient()
  return createLocationRepository(createSupabaseLocationSource(client)).getBySlug(slug)
}

export async function listPublicAdvisories(locationId?: string) {
  const client = await createClient()
  return createAdvisoryRepository(createSupabaseAdvisorySource(client)).list(locationId)
}

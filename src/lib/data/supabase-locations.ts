import type { SupabaseClient } from '@supabase/supabase-js'

import type { LocationRow } from '../domain/location.ts'
import type { LocationDataSource } from './locations.ts'

const locationSelection = `
  id,
  slug,
  name,
  corridor,
  direction,
  address,
  municipality,
  parking_details,
  transit_details,
  operating_notes,
  status,
  verification_status,
  last_verified_at,
  published,
  source:sources!locations_source_id_fkey(name,url,source_type),
  routes:location_routes(
    direction,
    verification_status,
    last_verified_at,
    source:sources!location_routes_source_id_fkey(name,url,source_type),
    destination:destinations(slug,name)
  )
`

export function createSupabaseLocationSource(client: SupabaseClient): LocationDataSource {
  return {
    async fetchAll() {
      const { data, error } = await client
        .from('locations')
        .select(locationSelection)
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as unknown as LocationRow[]
    },

    async fetchBySlug(slug) {
      const { data, error } = await client
        .from('locations')
        .select(locationSelection)
        .eq('slug', slug)
        .maybeSingle()

      if (error) throw error
      return data as unknown as LocationRow | null
    },
  }
}

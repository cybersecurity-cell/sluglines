import type { SupabaseClient } from '@supabase/supabase-js'

import { activeAdvisories, type AdvisoryRow, type AdvisorySummary } from '../domain/advisory.ts'
import { DataAccessError } from './locations.ts'

export interface AdvisoryDataSource {
  fetchAll(): Promise<AdvisoryRow[]>
}

export interface AdvisoryRepository {
  list(locationId?: string): Promise<AdvisorySummary[]>
}

export function createAdvisoryRepository(source: AdvisoryDataSource, now = new Date()): AdvisoryRepository {
  return {
    async list(locationId) {
      try {
        const rows = await source.fetchAll()
        return activeAdvisories(
          locationId ? rows.filter((row) => row.location_id === locationId) : rows,
          now,
        )
      } catch (error) {
        throw new DataAccessError('Advisories are temporarily unavailable.', error)
      }
    },
  }
}

const advisorySelection = `
  id,
  location_id,
  title,
  message,
  severity,
  status,
  starts_at,
  ends_at,
  published_at,
  verification_status,
  last_verified_at,
  source:sources!advisories_source_id_fkey(name,url,source_type),
  location:locations(slug,name)
`

export function createSupabaseAdvisorySource(client: SupabaseClient): AdvisoryDataSource {
  return {
    async fetchAll() {
      const { data, error } = await client
        .from('advisories')
        .select(advisorySelection)
        .order('published_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as AdvisoryRow[]
    },
  }
}

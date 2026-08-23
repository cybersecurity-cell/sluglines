/**
 * Server-side reads for the M1 public surface: the `locations` table and the
 * §8 M1 public count functions, bound to the request's Supabase client.
 *
 * This is the layer `lib/domain` is not allowed to be. `createClient()` reaches
 * `next/headers`, which the §8 dependency rule keeps out of the domain, so the
 * domain modules define the shapes and the mappings and this one does the IO.
 *
 * WHAT IS ACTUALLY READABLE TODAY
 * ---------------------------------------------------------------------------
 * `0004_spot_locations_directory.sql` seeds `locations` and then:
 *
 *     revoke all on table public.locations from anon;
 *     grant select on table public.locations to authenticated;
 *     create policy locations_select_active ... to authenticated using (is_active);
 *
 * So an anonymous visitor — the entire audience of these pages — reads nothing
 * from `locations` today, and even a signed-in member cannot see an inactive
 * spot. The anonymous read policy is §11 Phase 2 work. Until it lands, the
 * render source is the committed directory in `lib/domain/locations.ts`, which
 * is the same data the migration was generated from; the row is used when it is
 * there. `PublicLocation.source` records which one answered, so a page is never
 * guessing and neither is anyone reading a bug report about it.
 *
 * Nothing here throws. The public front door is the §9 acquisition wedge; a
 * missing environment variable or an unreachable database degrades it to its
 * static content, it does not 500 it.
 */

import { canonicalSlug, findSpotLocation } from '@/lib/domain/locations'
import type { PublicCountsSnapshot } from '@/lib/domain/public-counts'
import { UNAVAILABLE_SNAPSHOT, fetchPublicSpotCounts } from '@/lib/domain/public-counts'
import type { LocationRow, PublicLocation } from '@/lib/domain/public-location'
import {
  LOCATION_COLUMNS,
  publicLocationFromDirectory,
  publicLocationFromRow,
} from '@/lib/domain/public-location'
import { createClient } from '@/lib/supabase/server'

export type { PublicLocation } from '@/lib/domain/public-location'

/**
 * The spot behind `/spots/<slug>`, database first, committed directory second.
 * `null` only when the slug is in neither — i.e. a genuine 404.
 */
export async function getPublicLocation(slug: string): Promise<PublicLocation | null> {
  const row = await readLocationRow(slug)

  if (row) return publicLocationFromRow(row)

  const directoryLocation = findSpotLocation(slug)

  return directoryLocation ? publicLocationFromDirectory(directoryLocation) : null
}

/**
 * Through `get_public_location`, not a select on `locations`.
 *
 * The table is RLS-on with a single read policy scoped `to authenticated`, so a
 * select here returned nothing for anonymous visitors and every public spot page
 * silently fell through to the committed directory (#72). Admitting `anon` in a
 * policy is refused by sql-lint R5, so the read goes through the same
 * `security definer` mechanism 0005 established for the M1 aggregates. `anon`
 * touches no table directly.
 *
 * The function returns exactly `LOCATION_COLUMNS` and carries the policy's own
 * `is_active` predicate, so an inactive spot still resolves from the directory.
 */
async function readLocationRow(slug: string): Promise<LocationRow | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .rpc('get_public_location', { p_slug: canonicalSlug(slug) })
      .maybeSingle()

    if (error || !data) return null

    return data as unknown as LocationRow
  } catch {
    // No env, no network, or a database without 0010 applied.
    return null
  }
}

/**
 * The aggregates for the homepage strip and the spot pages. Resolves to
 * `unavailable` rather than throwing — see `lib/domain/public-counts.ts`.
 */
export async function getPublicSpotCounts(): Promise<PublicCountsSnapshot> {
  try {
    return await fetchPublicSpotCounts(createClient())
  } catch {
    return { ...UNAVAILABLE_SNAPSHOT, reason: 'supabase client unavailable' }
  }
}

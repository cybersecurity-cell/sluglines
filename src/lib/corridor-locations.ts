/**
 * The IO half of `lib/domain/corridor.ts`: resolve the pilot corridor's two
 * `locations` ids on the database serving this request. Issue #132, D-82.
 *
 * Reads through the caller's own client — the cookie-bound one for a route or
 * a page — so the read is scoped by `locations_select_active` (`0004`) exactly
 * as every other member read is. That policy is `using (is_active)`; both
 * pilot rows are seeded active by `0004`, and a row later marked inactive
 * would be as unresolvable here as a missing one, which is the right outcome
 * for a corridor whose line is believed not to be running.
 *
 * A miss is reported by slug, never swallowed into an empty board or a
 * retryable failure. Either slug missing means `0004` is not on this database
 * (or the row was deactivated) — a deployment fact the operator has to act on,
 * and the message says which row.
 */

import { PILOT_CORRIDOR_SLUGS, resolvePilotCorridor } from '@/lib/domain/corridor.ts'
import type { LocationIdRow, ResolvedPilotCorridor } from '@/lib/domain/corridor.ts'
import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type PilotCorridorRead =
  | { readonly ok: true; readonly corridor: ResolvedPilotCorridor }
  | { readonly ok: false; readonly reason: string }

export const CORRIDOR_LOCATION_COLUMNS = 'id,slug'

export async function readPilotCorridor(supabase: ServerClient): Promise<PilotCorridorRead> {
  const { data, error } = await supabase
    .from('locations')
    .select(CORRIDOR_LOCATION_COLUMNS)
    .in('slug', [...PILOT_CORRIDOR_SLUGS])

  if (error) {
    return { ok: false, reason: `locations read failed (${error.code ?? 'unknown'})` }
  }

  const resolved = resolvePilotCorridor((data ?? []) as unknown as LocationIdRow[])
  if (!resolved.ok) {
    return {
      ok: false,
      reason: `corridor location(s) not in the directory on this database: ${resolved.missing.join(', ')}`,
    }
  }

  return { ok: true, corridor: resolved.corridor }
}

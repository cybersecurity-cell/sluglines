/**
 * Server-side reads for the M3 dashboard: the caller's presence row, and the
 * spot it points at.
 *
 * This is the IO half of `lib/domain/fast-board.ts`, split for the same reason
 * `public-directory.ts` is split from `public-counts.ts` — `createClient()`
 * binds to `next/headers` cookies, which the §8 dependency rule keeps out of
 * `lib/domain`. The counts half needs no new IO at all: the board reads the same
 * `getPublicSpotCounts()` the public surface reads, re-exported below so the
 * dashboard has one import for its data.
 *
 * WHAT IS ACTUALLY READABLE TODAY
 * ---------------------------------------------------------------------------
 * `presence_checkins` is applied (0001, preview — D-28) and its select policy is
 * `auth.uid() = member_id`, so this returns a row only for a signed-in member
 * and only their own. There is no sign-in surface in this build yet (§8 M2), so
 * the state a real visitor lands in is `signed-out`, which the panel renders as
 * "we cannot see your check-in" rather than as "you are not checked in".
 *
 * `locations` (0004) is **not applied anywhere**, so the id→spot lookup is
 * expected to fail today. That is why an unresolved spot is a first-class
 * outcome in `presenceFromRow` rather than an error: the check-in is still
 * reported and still clearable.
 *
 * Nothing here throws. A missing environment variable or an unreachable
 * database degrades the panel to a stated `unavailable`, it does not 500 the
 * page.
 */

import type { MemberPresence, PresenceCheckinRow } from '@/lib/domain/fast-board'
import {
  NO_PRESENCE,
  PRESENCE_CHECKIN_COLUMNS,
  SIGNED_OUT_PRESENCE,
  presenceFromRow,
} from '@/lib/domain/fast-board'
import { errorCodeOf } from '@/lib/domain/public-counts'
import { createClient } from '@/lib/supabase/server'

export { getPublicSpotCounts } from '@/lib/public-directory'

/** Only what labels the panel. The rest of the directory row is not needed here. */
const PRESENCE_LOCATION_COLUMNS = 'slug,route_slug,name'

interface PresenceLocationRow {
  slug: string
  route_slug: string
  name: string
}

/**
 * The caller's own check-in, or the reason there isn't one to show.
 *
 * Every failure path resolves to a `MemberPresence` — `signed-out` when there is
 * no session, `unavailable` with a logged reason when a call errored, `none`
 * only when the database actually answered "no live row for you". Collapsing
 * those three into `none` would tell a member they are not checked in on the
 * strength of a network error, and the whole point of the panel is that it is
 * the one screen they trust before walking away from a curb.
 */
export async function getMemberPresence(now = new Date()): Promise<MemberPresence> {
  try {
    const supabase = createClient()

    const { data: auth, error: authError } = await supabase.auth.getUser()

    if (authError || !auth?.user) return SIGNED_OUT_PRESENCE

    const { data, error } = await supabase
      .from('presence_checkins')
      .select(PRESENCE_CHECKIN_COLUMNS)
      .eq('member_id', auth.user.id)
      .maybeSingle()

    if (error) {
      return { state: 'unavailable', reason: `presence_checkins read failed (${errorCodeOf(error) ?? 'unknown'})` }
    }

    if (!data) return NO_PRESENCE

    const row = data as unknown as PresenceCheckinRow

    return presenceFromRow(row, await readPresenceLocation(row.location_id), now)
  } catch {
    return { state: 'unavailable', reason: 'supabase client unavailable' }
  }
}

/**
 * `presence_checkins.location_id` is a `uuid`; the committed directory is keyed
 * by slug. Only the `locations` table can bridge the two, and it is unapplied —
 * so `null` here is the expected answer today, not a failure to handle.
 */
async function readPresenceLocation(locationId: string) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('locations')
      .select(PRESENCE_LOCATION_COLUMNS)
      .eq('id', locationId)
      .maybeSingle()

    if (error || !data) return null

    const row = data as unknown as PresenceLocationRow

    return { slug: row.slug, routeSlug: row.route_slug, name: row.name }
  } catch {
    return null
  }
}

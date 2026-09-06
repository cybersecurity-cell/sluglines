'use server'

import { redirect } from 'next/navigation'
import { PRESENCE_CHECKIN_FUNCTION, PRESENCE_CLEAR_FUNCTION } from '@/lib/domain/fast-board'
import type { PresenceDirection } from '@/lib/domain/fast-board'
import { createClient } from '@/lib/supabase/server'

/**
 * Check in at a spot, and check out again, from the spot page — the M4 control
 * that did not exist anywhere (issue #135). Server actions, for the reasons
 * `dashboard/actions.ts` measured: no Supabase client in the browser, the form
 * posts without JavaScript, and a Server Action can persist a refreshed
 * session cookie where a Server Component cannot.
 *
 * WHAT THE ACTION RESOLVES, AND WHAT IT DOES NOT DECIDE
 * ---------------------------------------------------------------------------
 * `presence_checkin(p_location_id uuid, p_direction text, ...)` (`0001`) takes
 * the actor from `auth.uid()` and wants the spot's `locations.id`. The spot page
 * reads its record through `get_public_location` (`0010`), which deliberately
 * returns no `id`, so the action looks the id up by slug through the caller's
 * own client — `locations_select_active` (`0004`) scopes that read, which is
 * why an inactive spot cannot be checked into. The direction is the spot's
 * own (`Morning`/`Afternoon` in the directory, lower-cased for the table); the
 * form carries it as a hidden field and the SQL re-validates it.
 *
 * Nothing here is an authorization decision. The function refuses a missing
 * session with 42501 and a bad direction with 22023 whatever this file sends.
 *
 * OUTCOMES ARE REPORTED IN THE URL, NOT SWALLOWED
 * ---------------------------------------------------------------------------
 * Same rule as checkout on the dashboard: the action redirects back to the
 * spot page with `?checkin=ok|failed|unavailable` (or `?checkout=ok|failed`),
 * and the card renders the outcome. A signed-out submit goes to `/login` with
 * `next` set to the spot page. `redirect()` stays outside the `try`, because
 * it signals by throwing `NEXT_REDIRECT`.
 */

export type CheckInOutcome = 'ok' | 'failed' | 'unavailable'
export type CheckOutOutcome = 'ok' | 'failed'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ROUTE_SLUG = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/

function isPresenceDirection(value: unknown): value is PresenceDirection {
  return value === 'morning' || value === 'afternoon'
}

/** The page to return to. A route slug that is not one falls back to the directory, never to an open redirect. */
function spotPath(routeSlug: unknown): string {
  return typeof routeSlug === 'string' && ROUTE_SLUG.test(routeSlug) ? `/spots/${routeSlug}` : '/spots'
}

export async function checkInAtSpot(formData: FormData) {
  const slug = formData.get('slug')
  const direction = formData.get('direction')
  const back = spotPath(formData.get('route_slug'))

  let outcome: CheckInOutcome | 'signed-out' = 'failed'

  try {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user) {
      outcome = 'signed-out'
    } else if (typeof slug !== 'string' || !SLUG.test(slug) || !isPresenceDirection(direction)) {
      outcome = 'failed'
    } else {
      const { data: row, error } = await supabase.from('locations').select('id').eq('slug', slug).maybeSingle()

      if (error || !row) {
        // The directory row is not readable to this member: unapplied `0004`,
        // or a spot marked inactive since the page rendered. Reported as such,
        // not as a generic failure.
        outcome = 'unavailable'
      } else {
        const { error: rpcError } = await supabase.rpc(PRESENCE_CHECKIN_FUNCTION, {
          p_location_id: (row as { id: string }).id,
          p_direction: direction,
        })
        outcome = rpcError ? 'failed' : 'ok'
      }
    }
  } catch {
    outcome = 'failed'
  }

  if (outcome === 'signed-out') {
    redirect(`/login?next=${encodeURIComponent(back)}`)
  }

  redirect(`${back}?checkin=${outcome}`)
}

export async function checkOutFromSpot(formData: FormData) {
  const back = spotPath(formData.get('route_slug'))
  let failed = false

  try {
    const { error } = await (await createClient()).rpc(PRESENCE_CLEAR_FUNCTION)
    failed = Boolean(error)
  } catch {
    failed = true
  }

  redirect(`${back}?checkout=${failed ? 'failed' : 'ok'}`)
}

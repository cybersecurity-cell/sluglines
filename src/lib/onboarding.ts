/**
 * Server-side reads for `/onboarding` — the IO half `lib/domain` cannot hold
 * (`createClient()` reaches `next/headers`; see `lib/dashboard.ts` for the
 * same split, done for the same reason).
 *
 * Nothing here throws: a signed-in visitor whose profile or spot read fails
 * still reaches the onboarding form, with an empty prefill or an empty spot
 * list, rather than a 500. The form still works — `completeOnboarding()`
 * (`app/onboarding/actions.ts`) is the write path, and reports its own
 * failures.
 */

import { createClient } from '@/lib/supabase/server'

export interface MemberProfile {
  displayName: string
  locationId: string | null
}

/** `null` only when there is no session; every other failure degrades below, not here. */
export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const { data, error } = await createClient().auth.getUser()
    if (error || !data?.user) return null
    return data.user.id
  } catch {
    return null
  }
}

export async function getMemberProfile(memberId: string): Promise<MemberProfile | null> {
  try {
    const { data, error } = await createClient()
      .from('members')
      .select('display_name,location_id')
      .eq('id', memberId)
      .maybeSingle()

    if (error || !data) return null

    const row = data as unknown as { display_name: string; location_id: string | null }
    return { displayName: row.display_name, locationId: row.location_id }
  } catch {
    return null
  }
}

export interface HomeSpotOption {
  id: string
  slug: string
  name: string
  corridor: string
  direction: string
}

const HOME_SPOT_COLUMNS = 'id,slug,name,corridor,direction'

/**
 * rev. 5.3 §8 M3: "the onboarding home-spot picker offers only *active*
 * locations". `locations_select_active` (0004) already scopes every
 * `authenticated` read to `is_active`; the explicit filter here states that
 * requirement in the query itself rather than leaning on the policy alone to
 * be the only place it is true.
 *
 * Resolves to `[]` — not an error — when `locations` (0004) is unapplied, the
 * same "unresolved is a first-class outcome" discipline `lib/dashboard.ts`
 * uses for the same table. The form renders with no spots to choose and the
 * home-spot field is skipped; it is not a required field.
 */
export async function getActiveHomeSpotOptions(): Promise<HomeSpotOption[]> {
  try {
    const { data, error } = await createClient()
      .from('locations')
      .select(HOME_SPOT_COLUMNS)
      .eq('is_active', true)
      .order('corridor', { ascending: true })
      .order('direction', { ascending: true })
      .order('name', { ascending: true })

    if (error || !data) return []

    return data as unknown as HomeSpotOption[]
  } catch {
    return []
  }
}

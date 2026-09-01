'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * The onboarding write, as a Server Action calling the two rev. 5.3 §8 M2
 * writers directly — `set_display_name(text)` (0001) and `set_home_spot(uuid)`
 * (0006). Same shape as `dashboard/actions.ts`'s `clearPresence()`, for the
 * same two reasons: correctness (both writers take the actor from
 * `auth.uid()`; `members` has no insert/update policy for any client role, so
 * there is no direct-write shortcut to take) and weight (a browser-side
 * Supabase call would ship `@supabase/ssr` to the one screen a brand-new
 * member sees before ever reaching the board).
 *
 * The home spot is optional: `location_id` is submitted only when the visitor
 * picked one, so a visitor onboarding while `locations` (0004) is unapplied —
 * or who simply skips it — still completes with just a display name.
 *
 * `redirect()` is deliberately outside the `try`, same as `clearPresence()`:
 * it throws `NEXT_REDIRECT`, and catching that would turn every success into
 * a failure banner.
 */
export async function completeOnboarding(formData: FormData) {
  const displayName = String(formData.get('display_name') ?? '')
  const locationId = formData.get('location_id')

  let failed = false

  try {
    const supabase = await createClient()

    const { error: nameError } = await supabase.rpc('set_display_name', { p_display_name: displayName })
    failed = Boolean(nameError)

    if (!failed && typeof locationId === 'string' && locationId.length > 0) {
      const { error: spotError } = await supabase.rpc('set_home_spot', { p_location_id: locationId })
      failed = Boolean(spotError)
    }
  } catch {
    failed = true
  }

  redirect(failed ? '/onboarding?onboarding=failed' : '/dashboard')
}

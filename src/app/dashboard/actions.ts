'use server'

import { redirect } from 'next/navigation'
import { PRESENCE_CLEAR_FUNCTION } from '@/lib/domain/fast-board'
import { createClient } from '@/lib/supabase/server'

/**
 * One-tap checkout, as a server action rather than a browser call.
 *
 * `presence_clear()` is the 0001 SECURITY DEFINER writer: it takes the actor
 * from `auth.uid()` and deletes only that member's row. `presence_checkins`
 * carries no insert/update/delete policy for any role (§6 default-deny), so the
 * function is not a convenience over a direct delete — the direct delete is
 * refused, which is how the previous dashboard's button "succeeded" at nothing
 * against tables D-13 had already dropped.
 *
 * WHY A SERVER ACTION
 * ---------------------------------------------------------------------------
 * Doing this from the browser meant importing `@supabase/ssr` into the page, and
 * `next build` priced it: **62 kB of route JavaScript, 162 kB first load** — a
 * Supabase client shipped to parse one button press, on the page whose entire
 * audience is someone checking it on a commuter-lot cell signal. Server-side,
 * the same build reports **1.11 kB / 97.1 kB**, nearly all of it the shared
 * framework chunk every route already pays for. The page also keeps working with
 * JavaScript disabled, because a `<form action={...}>` posts either way.
 *
 * A cookie-bound server client is the right caller anyway: a Server Action can
 * write cookies, so a session refreshed during the call is actually persisted —
 * which a Server Component's client cannot do (see `lib/supabase/server.ts`).
 *
 * FAILURE IS REPORTED, NOT SWALLOWED
 * ---------------------------------------------------------------------------
 * A failed checkout redirects to `?checkout=failed`, which the page renders as
 * "you are still checked in". Silently returning would leave a member believing
 * they had cleared a curb they are still standing on in the data.
 *
 * `redirect()` is deliberately outside the `try`: it signals by throwing
 * `NEXT_REDIRECT`, and catching that would turn every success into a failure
 * banner.
 */
export async function clearPresence() {
  let failed = false

  try {
    const { error } = await (await createClient()).rpc(PRESENCE_CLEAR_FUNCTION)
    failed = Boolean(error)
  } catch {
    failed = true
  }

  // The route is `force-dynamic`, so the redirect alone re-reads presence and
  // the board together; it also drops a stale `?checkout=failed` from the URL.
  redirect(failed ? '/dashboard?checkout=failed' : '/dashboard')
}

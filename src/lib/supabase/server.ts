import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * The cookie-bound server client. Every server-side read and every M3 write
 * route gets its session from here, so the adapter below has to match the
 * `CookieMethods` contract of the **installed** `@supabase/ssr`.
 *
 * It previously supplied `getAll`/`setAll`. That is the 0.5+ API; this project is
 * pinned to `^0.3.0`, whose `createServerClient` calls only `get`, `set` and
 * `remove` and ignores anything else it is handed. The mismatch typechecked and
 * built — the options type is an intersection, so the excess-property check does
 * not fire — and failed silently at runtime: no cookie was ever read, so
 * `auth.getUser()` returned no user for a signed-in member and every server
 * client was effectively anonymous.
 *
 * `tests/supabase-server-client.test.mjs` now asserts this adapter implements
 * exactly the method names the installed package's own type declaration lists,
 * so a version bump that renames them fails a gate instead of silently
 * un-authenticating the app again.
 */
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // Server Components cannot write cookies; only Route Handlers and
        // Server Actions can. The throw is expected there and is swallowed —
        // the session is refreshed on the next request that can write.
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {}
        },
      },
    }
  )
}

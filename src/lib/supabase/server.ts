import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * The cookie-bound server client. Every server-side read and every M3 write
 * route gets its session from here, so the adapter below has to match the
 * `CookieMethodsServer` contract of the **installed** `@supabase/ssr`.
 *
 * `getAll`/`setAll` is the API the installed 0.12.x package calls; the
 * previous `get`/`set`/`remove` trio it replaced is ignored silently by a
 * client that expects `getAll`/`setAll`, which is exactly the failure mode
 * `tests/supabase-server-client.test.mjs` exists to catch — see that file for
 * how a mismatch here previously typechecked, built, and left every server
 * client anonymous.
 *
 * `cookies()` is async as of Next 15/16 (`next/headers`), so this function is
 * now async too; every caller must `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // Server Components cannot write cookies; only Route Handlers and
        // Server Actions can. The throw is expected there and is swallowed —
        // the session is refreshed on the next request that can write.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    }
  )
}

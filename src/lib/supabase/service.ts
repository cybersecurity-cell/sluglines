import { createClient } from '@supabase/supabase-js'

/**
 * Thrown by `createServiceClient()` when `SUPABASE_SERVICE_ROLE_KEY` is
 * unset — production's actual state as of issue #117. A named class, rather
 * than relying on `@supabase/supabase-js`'s own "supabaseKey is required"
 * message, so a caller (`/api/health`'s `rateLimiter` check) can distinguish
 * "misconfigured" from "reachable but failing" with `instanceof` instead of
 * matching a string an upstream dependency owns and could change.
 */
export class ServiceRoleKeyMissingError extends Error {
  constructor() {
    super('SUPABASE_SERVICE_ROLE_KEY is not set')
    this.name = 'ServiceRoleKeyMissingError'
  }
}

/**
 * The service-role client. Unlike `client.ts` (browser, anon key) and
 * `server.ts` (cookie-bound, anon key, carries the visitor's session), this
 * authenticates as `service_role` and bypasses RLS entirely.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` deliberately has no `NEXT_PUBLIC_` prefix, so
 * Next.js never inlines it into a browser bundle. This client must therefore
 * only ever be constructed in server-only code (a route handler, a server
 * action) — never in anything imported by a Client Component.
 *
 * First use: the durable rate limiter (`durable-rate-limit.ts`, issue #55),
 * whose `rate_limit_hit()` function is granted to `service_role` only —
 * see `0012_durable_rate_limit.sql` for why anon/authenticated must never
 * reach it directly.
 *
 * The key is checked explicitly, before it ever reaches
 * `@supabase/supabase-js`, so a missing key is always this catchable,
 * identifiable error rather than whatever that library happens to throw —
 * every existing caller already wraps this call in `try`/`catch` (see
 * `send-otp-route.ts`), so this only sharpens what lands there.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new ServiceRoleKeyMissingError()
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

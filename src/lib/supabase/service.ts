import { createClient } from '@supabase/supabase-js'

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
 */
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

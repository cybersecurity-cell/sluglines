/**
 * A durable, cross-instance fixed-window rate limiter, backed by the
 * `rate_limit_hit()` Postgres function (`0012_durable_rate_limit.sql`).
 *
 * Closes the gap `rate-limit.ts`'s own header and Docs/DECISIONS.md D-45
 * name: the in-memory limiter resets on every redeploy and does not
 * coordinate across serverless instances. This is now the source of truth
 * for the OTP routes' caps; `rate-limit.ts` stays in front of it as a
 * zero-round-trip pre-check (see the routes), not a replacement for it.
 *
 * Same result shape as `rate-limit.ts` (`RateLimitResult`), so callers that
 * already branch on `{ allowed, retryAfterMs }` change minimally. `consume`
 * is necessarily async here — a Postgres round trip, not a Map lookup — and
 * takes the Supabase client as a parameter rather than constructing one
 * itself, so this module never inlines a secret: the caller decides which
 * client (and which key) to use. In production that must be the service-role
 * client (`lib/supabase/service.ts`), because `rate_limit_hit()` is granted
 * to `service_role` only — see that migration for why anon/authenticated
 * must never reach it directly.
 *
 * `now` is a parameter for the same reason it is one in `rate-limit.ts`: a
 * test drives the window without a real clock.
 */

import { createHash } from 'node:crypto'
import type { RateLimitResult } from './rate-limit.ts'

/**
 * Structural, not `SupabaseClient<...>`: the only capability this module
 * needs is `rpc`, and a narrow type is trivial to satisfy with a plain
 * object in a test, no `@supabase/supabase-js` import required there.
 */
export interface RateLimitRpcClient {
  rpc(
    fn: 'rate_limit_hit',
    args: { p_key: string; p_window_ms: number; p_max: number; p_now: string }
  ): PromiseLike<{ data: { allowed: boolean; retry_after_ms: number }[] | null; error: { message: string } | null }>
}

export interface DurableRateLimiter {
  consume(client: RateLimitRpcClient, key: string, now: number): Promise<RateLimitResult>
}

/**
 * The bucket key crossing into Postgres is never the raw value. Both callers
 * here key on a phone number or an IP address, and rev. 5.3 sec.6 / sec.12
 * constraint 3 forbid either from landing in an application table — Supabase
 * Auth is the sole durable store of phone numbers. Hashing is what lets
 * `rate_limit_windows.bucket_key` carry no PII while still being a stable,
 * collision-resistant key per phone/IP.
 */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * On a database error (network blip, cold branch, etc.) this fails OPEN,
 * deliberately: D-45 records that Supabase Auth's own per-number/IP controls
 * are the actual security boundary for the OTP routes, and this limiter —
 * durable or not — has only ever been defence-in-depth on top of that. A
 * transient outage here should degrade to "no extra limiting this request",
 * not "OTP is down", which is a worse outcome for an SMS-delivery product
 * than the abuse window a brief outage could open.
 */
export function createDurableRateLimiter(options: { max: number; windowMs: number }): DurableRateLimiter {
  const { max, windowMs } = options

  return {
    async consume(client, key, now) {
      const { data, error } = await client.rpc('rate_limit_hit', {
        p_key: hashKey(key),
        p_window_ms: windowMs,
        p_max: max,
        p_now: new Date(now).toISOString(),
      })

      if (error !== null || data === null || data.length === 0) {
        return { allowed: true, retryAfterMs: 0 }
      }

      const row = data[0]!
      return { allowed: row.allowed, retryAfterMs: row.retry_after_ms }
    },
  }
}

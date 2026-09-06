/**
 * A fixed-window rate limiter, in-memory, for the M2 OTP routes.
 *
 * rev. 5.3 §8 M10 / D-8 assign the durable, cross-instance form of this —
 * per-IP OTP-send caps — to edge middleware, built in P2 (the same deferral
 * `0005_public_aggregates.sql`'s own header records for the aggregate
 * functions: "a SQL function cannot see caller IPs"). This is not that: it is
 * a single-process, best-effort defence-in-depth layer that resets on every
 * redeploy and does not coordinate across instances. It exists so a route
 * under active abuse fails fast in-process instead of relying solely on
 * Supabase Auth's own per-number limits, which are the actual security
 * boundary here — the same relationship the M3 routes have with their SQL
 * functions (this module refuses; Supabase Auth is what actually protects the
 * account).
 *
 * Pure enough to test directly: `now` is a parameter, never `Date.now()`
 * read internally, so a test can drive the window without a real clock.
 */

export interface RateLimitResult {
  readonly allowed: boolean
  /** Milliseconds until the oldest hit in the window ages out. 0 when allowed. */
  readonly retryAfterMs: number
}

export interface RateLimiter {
  consume(key: string, now: number): RateLimitResult
  /** Keys currently held. Exposed so the eviction below is testable, not for callers. */
  size(): number
}

export function createFixedWindowLimiter(options: { max: number; windowMs: number }): RateLimiter {
  const { max, windowMs } = options
  const hits = new Map<string, number[]>()
  let lastSweep = Number.NEGATIVE_INFINITY

  // Issue #144: the map never evicted, so every distinct IP or phone number
  // that ever hit a route stayed in memory for the life of the process. Once
  // per window, drop every key whose hits have all aged out. A key that is
  // still inside its window is untouched, so the sweep never loosens a limit.
  function sweep(now: number) {
    if (now - lastSweep < windowMs) return
    lastSweep = now
    hits.forEach((times: number[], key: string) => {
      if (times.every((t: number) => t <= now - windowMs)) hits.delete(key)
    })
  }

  return {
    size: () => hits.size,
    consume(key: string, now: number): RateLimitResult {
      sweep(now)
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs)

      if (recent.length >= max) {
        hits.set(key, recent)
        return { allowed: false, retryAfterMs: recent[0] + windowMs - now }
      }

      recent.push(now)
      hits.set(key, recent)
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}

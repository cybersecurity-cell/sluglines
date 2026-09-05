import { NextResponse } from 'next/server'
import {
  PUBLIC_OPEN_OFFER_COUNTS_FUNCTION,
  PUBLIC_SPOT_COUNTS_FUNCTION,
} from '@/lib/domain/public-counts'
import {
  SCHEDULED_JOB_HEALTH_FUNCTION,
  type ScheduledJobRow,
  summariseScheduledJobs,
} from '@/lib/domain/scheduled-jobs'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient, ServiceRoleKeyMissingError } from '@/lib/supabase/service'

/**
 * `GET /api/health` — the endpoint the external uptime check watches (issue #21).
 *
 * WHAT IT IS ALLOWED TO SAY
 * ---------------------------------------------------------------------------
 * Only things it has just observed. A health endpoint that reports `ok` because
 * it did not look is worse than no health endpoint: it converts an outage into a
 * green dashboard. So every field below is either a measurement taken during
 * this request or an explicit `null` with a reason — the same discipline as
 * `unavailable` counts never rendering as zero (D-33) and null coordinates never
 * being guessed (D-31).
 *
 * It carries no member data and cannot: the only database call it makes is the
 * anonymous M1 aggregate, which returns counts and nothing else, and it reports
 * a row count rather than any row.
 *
 * STATUS CODES, chosen so a dumb external monitor is enough
 * ---------------------------------------------------------------------------
 *   200  every check passed
 *   503  at least one check the product cannot work without has failed
 *
 * An uptime check that only reads the status line is therefore correct without
 * parsing the body, which is what makes a one-minute external check useful.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Check {
  ok: boolean
  detail: string
  latencyMs?: number
}

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, Check> = {}

  // --- the database, through the same anonymous path a visitor uses ----------
  const dbStartedAt = Date.now()
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(PUBLIC_SPOT_COUNTS_FUNCTION)

    if (error) {
      checks.database = {
        ok: false,
        detail: `${PUBLIC_SPOT_COUNTS_FUNCTION} failed: ${error.code ?? 'no sqlstate'}`,
        latencyMs: Date.now() - dbStartedAt,
      }
    } else {
      const rows = Array.isArray(data) ? data.length : 0
      checks.database = {
        // Zero rows means the directory is not seeded, which is an outage of the
        // public surface even though the query succeeded.
        ok: rows > 0,
        detail: `${PUBLIC_SPOT_COUNTS_FUNCTION} returned ${rows} active spot rows`,
        latencyMs: Date.now() - dbStartedAt,
      }
    }
  } catch (error) {
    checks.database = {
      ok: false,
      detail: `supabase client unavailable: ${error instanceof Error ? error.message : 'unknown'}`,
      latencyMs: Date.now() - dbStartedAt,
    }
  }

  // --- the second aggregate, because the board needs both -------------------
  const offersStartedAt = Date.now()
  try {
    const { error } = await (await createClient()).rpc(PUBLIC_OPEN_OFFER_COUNTS_FUNCTION)
    checks.offerCounts = {
      ok: !error,
      detail: error ? `${PUBLIC_OPEN_OFFER_COUNTS_FUNCTION} failed: ${error.code ?? 'no sqlstate'}` : 'ok',
      latencyMs: Date.now() - offersStartedAt,
    }
  } catch (error) {
    checks.offerCounts = {
      ok: false,
      detail: `unreachable: ${error instanceof Error ? error.message : 'unknown'}`,
      latencyMs: Date.now() - offersStartedAt,
    }
  }

  // --- the durable OTP rate limiter, through the service-role path issue #117
  // found missing in production -----------------------------------------------
  //
  // Every check above uses the anonymous client a visitor uses. This is the
  // only one that constructs the service-role client (`lib/supabase/service.ts`),
  // because that is the one thing worth proving: `durable-rate-limit.ts` calls
  // `rate_limit_hit()` through exactly this path, and if
  // `SUPABASE_SERVICE_ROLE_KEY` is unset — production's actual state as of #117
  // — that limiter's own RPC error is swallowed and it fails OPEN
  // (`durable-rate-limit.ts`'s header explains why that default is right for a
  // *transient* failure). A permanent misconfiguration is a different thing and
  // deserves to move the status line, which is why this check, unlike
  // `scheduledJobs` below, is one of `checks`.
  //
  // The bucket key is a fixed, human-readable literal, never hashed: real
  // buckets (`ip:...`, `phone:...`) are always 64-hex-char SHA-256 digests
  // (`durable-rate-limit.ts`'s `hashKey`), so this key cannot collide with one
  // by construction. `p_max` is large enough that no plausible health-check
  // cadence — even once a second, far more often than issue #21's monitor runs
  // — could exhaust it inside the window, so this probe can never trip its own
  // limit or spend a real caller's budget.
  const rateLimiterStartedAt = Date.now()
  const HEALTH_PROBE_BUCKET_KEY = 'health-check:service-role-probe'
  const HEALTH_PROBE_WINDOW_MS = 24 * 60 * 60 * 1000
  const HEALTH_PROBE_MAX = 1_000_000
  try {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.rpc('rate_limit_hit', {
      p_key: HEALTH_PROBE_BUCKET_KEY,
      p_window_ms: HEALTH_PROBE_WINDOW_MS,
      p_max: HEALTH_PROBE_MAX,
      p_now: new Date(rateLimiterStartedAt).toISOString(),
    })

    checks.rateLimiter = {
      ok: !error,
      detail: error
        ? `rate_limit_hit failed: ${error.code ?? 'no sqlstate'}`
        : 'rate_limit_hit reachable via the service-role client',
      latencyMs: Date.now() - rateLimiterStartedAt,
    }
  } catch (error) {
    checks.rateLimiter =
      error instanceof ServiceRoleKeyMissingError
        ? {
            ok: false,
            detail: 'SUPABASE_SERVICE_ROLE_KEY is unset: the durable OTP rate limiter cannot run (#117)',
            latencyMs: Date.now() - rateLimiterStartedAt,
          }
        : {
            ok: false,
            // The error's class, never its message or the key: a thrown
            // network/auth error's message is not something this public,
            // unauthenticated endpoint should echo back.
            detail: `service client threw: ${error instanceof Error ? error.constructor.name : 'unknown'}`,
            latencyMs: Date.now() - rateLimiterStartedAt,
          }
  }

  // --- the sweeps, which nothing else in the product can observe -------------
  //
  // Deliberately NOT one of `checks`, so it cannot move the status code. A
  // stopped scheduler is a real incident, but it is a slow one: the public
  // surface stays correct for presence (read paths filter on `expires_at`) and
  // degrades gradually for offers. Wiring it to 503 would also mean every
  // preview branch and every local run — none of which have pg_cron — reported
  // themselves as an outage forever, which is how a monitor gets ignored.
  // It is reported in full instead, so a body-reading monitor can alert on
  // `scheduledJobs.healthy` while the status line stays about reachability.
  let scheduledJobs
  try {
    const { data, error } = await (await createClient()).rpc(SCHEDULED_JOB_HEALTH_FUNCTION)
    scheduledJobs = summariseScheduledJobs((data as ScheduledJobRow[] | null) ?? null, {
      error: error ? `${error.code ?? 'no sqlstate'} ${error.message ?? ''}`.trim() : null,
    })
  } catch (error) {
    scheduledJobs = summariseScheduledJobs(null, {
      error: error instanceof Error ? error.message : 'unknown',
    })
  }

  const ok = Object.values(checks).every((check) => check.ok)

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      checkedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      // Which build answered. Without this a green check proves a deployment is
      // up, not that *this* deployment is up.
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        environment: process.env.VERCEL_ENV ?? 'local',
        region: process.env.VERCEL_REGION ?? null,
      },
      checks,
      /**
       * The sweeps rev. 5.3 §6 specifies — `sweep_expired_presence()` and
       * `offer_expire_sweep()`. Until 2026-08-22 this block was a hardcoded
       * `supported: false`, because `pg_cron` was not installed and neither had
       * ever run (issue #46). Both are scheduled now, so this reports what
       * `get_scheduled_job_health()` just returned: a real `lastRunAt`, or
       * `null` carrying the reason there is none. It is never synthesised from
       * the clock, and the field is never omitted — an absent field reads as
       * "fine", which is the failure D-33 is about.
       */
      scheduledJobs,
    },
    {
      status: ok ? 200 : 503,
      headers: { 'cache-control': 'no-store, max-age=0' },
    }
  )
}

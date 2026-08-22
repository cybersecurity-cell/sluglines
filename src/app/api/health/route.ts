import { NextResponse } from 'next/server'
import {
  PUBLIC_OPEN_OFFER_COUNTS_FUNCTION,
  PUBLIC_SPOT_COUNTS_FUNCTION,
} from '@/lib/domain/public-counts'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = createClient()
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
    const { error } = await createClient().rpc(PUBLIC_OPEN_OFFER_COUNTS_FUNCTION)
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
       * `offer_expire_sweep()` — exist in production but **nothing runs them**:
       * `pg_cron` is not installed (verified 2026-08-22). There is therefore no
       * last-run timestamp to report, and this says so rather than omitting the
       * field and letting its absence read as "fine". Tracked as issue #46.
       */
      scheduledJobs: {
        supported: false,
        detail: 'pg_cron is not installed; sweep_expired_presence and offer_expire_sweep have never run',
        lastRunAt: null,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: { 'cache-control': 'no-store, max-age=0' },
    }
  )
}

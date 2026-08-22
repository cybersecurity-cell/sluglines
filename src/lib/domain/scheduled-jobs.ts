/**
 * `lib/domain/scheduled-jobs.ts` — reading the state of the two sweeps that
 * rev. 5.3 §6 specifies, for `/api/health` (issues #21 and #46).
 *
 * `0001` created `sweep_expired_presence()` and `0002` created
 * `offer_expire_sweep()`, and both files said, correctly, that scheduling them
 * was not a migration's job. Nothing then scheduled them, so until 2026-08-22
 * neither had ever run — and because neither is granted to any client role, the
 * absence was invisible from the application. `0008` adds the reader this module
 * calls; `supabase/operations/2026-08-22-schedule-sweeps.sql` adds the schedule.
 *
 * WHAT THIS MODULE IS FOR
 * ---------------------------------------------------------------------------
 * Turning the reader's rows into something a monitor can act on, as a pure
 * function, so the interesting cases — never scheduled, scheduled but never run,
 * ran but failed, ran too long ago — are unit-testable with no database and no
 * request. `/api/health` supplies the rows and renders the result.
 *
 * The discipline is the endpoint's: report only what was measured. A missing
 * last-run time is `null` with a reason, never `new Date()`, and never omitted
 * so that its absence can be read as "fine" (D-33).
 *
 * BOUNDARY (rev. 5.3 §8): no React, no Next, no `lib/ai`, no imports at all.
 */

/** The `0008` reader. The name is the contract with that migration. */
export const SCHEDULED_JOB_HEALTH_FUNCTION = 'get_scheduled_job_health'

/**
 * The jobs that are supposed to exist. Named here rather than inferred from
 * whatever the database happens to return, so that a sweep silently
 * *disappearing* from the schedule is detectable — an inferred list would just
 * get shorter and still look healthy.
 */
export const EXPECTED_SWEEP_JOBS = ['offer_expire_sweep', 'sweep_expired_presence'] as const

/**
 * How long after its last run a sweep is called stale.
 *
 * The schedules are 1 minute (`offer_expire_sweep`) and 5 minutes
 * (`sweep_expired_presence`), so 15 minutes is several missed runs of the slower
 * one rather than a single blip — this flag should mean "the scheduler has
 * stopped", not "a run was skipped while the database was busy". Parsing the
 * cron expression to derive a per-job threshold was considered and rejected: a
 * cron parser is a lot of surface for a monitor, and the failure it would catch
 * sooner is one this flag still catches.
 */
export const SWEEP_STALE_AFTER_MS = 15 * 60 * 1000

/** One row of `public.get_scheduled_job_health()`. */
export interface ScheduledJobRow {
  job_name: string
  schedule: string
  active: boolean
  last_run_at: string | null
  last_status: string | null
}

export type ScheduledJobState = 'ok' | 'never-run' | 'stale' | 'failing' | 'inactive'

export interface ScheduledJobSummaryEntry {
  name: string
  schedule: string
  active: boolean
  lastRunAt: string | null
  lastStatus: string | null
  state: ScheduledJobState
}

export interface ScheduledJobsSummary {
  /** Did we find a scheduler with the expected jobs on it? */
  supported: boolean
  /** Plain sentence naming what was observed, including why a null is null. */
  detail: string
  /** Most recent run across all sweeps, or `null` — never synthesised. */
  lastRunAt: string | null
  /** True when every expected job is present, active, and neither stale nor failing. */
  healthy: boolean
  jobs: ScheduledJobSummaryEntry[]
}

/** pg_cron writes 'succeeded' on success; anything else is a failure worth showing. */
function classify(row: ScheduledJobRow, nowMs: number): ScheduledJobState {
  if (!row.active) return 'inactive'
  if (row.last_run_at === null) return 'never-run'

  const ranAtMs = Date.parse(row.last_run_at)
  // An unparseable timestamp is not evidence of a recent run. Treat it as the
  // absence of one rather than letting NaN comparisons quietly read as healthy.
  if (Number.isNaN(ranAtMs)) return 'never-run'

  if (row.last_status !== null && row.last_status !== 'succeeded') return 'failing'
  if (nowMs - ranAtMs > SWEEP_STALE_AFTER_MS) return 'stale'
  return 'ok'
}

/**
 * Fold the reader's rows into the `scheduledJobs` block of `/api/health`.
 *
 * @param rows  what `get_scheduled_job_health()` returned, or `null` if the call
 *              itself failed.
 * @param error a reason the call failed, if it did. Reported verbatim, because
 *              "the reader is missing" (0008 not applied) and "the database is
 *              unreachable" are different incidents and the monitor should be
 *              able to tell them apart.
 */
export function summariseScheduledJobs(
  rows: ScheduledJobRow[] | null,
  { error = null, now = new Date() }: { error?: string | null; now?: Date } = {}
): ScheduledJobsSummary {
  if (error !== null) {
    return {
      supported: false,
      detail: `${SCHEDULED_JOB_HEALTH_FUNCTION} could not be read: ${error}`,
      lastRunAt: null,
      healthy: false,
      jobs: [],
    }
  }

  if (rows === null || rows.length === 0) {
    return {
      supported: false,
      // The overwhelmingly likely cause, stated as the likely cause rather than
      // as a certainty: the reader returns zero rows precisely when pg_cron is
      // absent, and also when it is present with no sweep scheduled on it.
      detail:
        'no sweep is scheduled: pg_cron is not installed, or both jobs have been removed. ' +
        'sweep_expired_presence and offer_expire_sweep are therefore not running',
      lastRunAt: null,
      healthy: false,
      jobs: [],
    }
  }

  const nowMs = now.getTime()
  const jobs = rows
    .map((row) => ({
      name: row.job_name,
      schedule: row.schedule,
      active: row.active,
      lastRunAt: row.last_run_at,
      lastStatus: row.last_status,
      state: classify(row, nowMs),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const missing = EXPECTED_SWEEP_JOBS.filter((name) => !jobs.some((job) => job.name === name))

  const ranMs = jobs
    .map((job) => (job.lastRunAt === null ? NaN : Date.parse(job.lastRunAt)))
    .filter((ms) => !Number.isNaN(ms))
  const lastRunAt = ranMs.length > 0 ? new Date(Math.max(...ranMs)).toISOString() : null

  const unhealthy = jobs.filter((job) => job.state !== 'ok')
  const healthy = missing.length === 0 && unhealthy.length === 0

  const parts: string[] = [`${jobs.length} sweep job(s) scheduled`]
  if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`)
  for (const job of unhealthy) parts.push(`${job.name} is ${job.state}`)
  if (healthy) parts.push('all sweeps ran within the freshness window')

  return {
    supported: true,
    detail: parts.join('; '),
    lastRunAt,
    healthy,
    jobs,
  }
}

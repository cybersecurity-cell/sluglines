// The sweep-health summary behind `/api/health`'s `scheduledJobs` block
// (issues #21 and #46).
//
// Until 2026-08-22 that block was a hardcoded `supported: false`, which was
// honest — pg_cron was not installed and neither sweep had ever run — but
// unfalsifiable: it would have gone on saying the same thing after the sweeps
// started running. Now it is derived from a reader, and these are the cases that
// derivation has to get right.
//
// The case that matters most is the quiet one. A sweep that is *scheduled* but
// has stopped running still returns a row, still says `active`, and still
// carries a plausible-looking timestamp — from whenever it last worked. If that
// reads as healthy, the monitor is decorative. Everything runs on fixed dates
// with no database and no clock dependency.

import { strict as assert } from 'node:assert'
import {
  EXPECTED_SWEEP_JOBS,
  SCHEDULED_JOB_HEALTH_FUNCTION,
  SWEEP_STALE_AFTER_MS,
  summariseScheduledJobs,
} from '../src/lib/domain/scheduled-jobs.ts'

const NOW = new Date('2026-08-22T18:00:00.000Z')
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString()

const row = (over = {}) => ({
  job_name: 'offer_expire_sweep',
  schedule: '* * * * *',
  active: true,
  last_run_at: ago(30_000),
  last_status: 'succeeded',
  ...over,
})

// --- the contract with 0008 --------------------------------------------------
assert.equal(SCHEDULED_JOB_HEALTH_FUNCTION, 'get_scheduled_job_health')
assert.deepEqual([...EXPECTED_SWEEP_JOBS].sort(), ['offer_expire_sweep', 'sweep_expired_presence'])

// --- nothing scheduled: the state production was in until 2026-08-22 ---------
for (const empty of [null, []]) {
  const summary = summariseScheduledJobs(empty, { now: NOW })
  assert.equal(summary.supported, false, 'no rows means no scheduler to report on')
  assert.equal(summary.lastRunAt, null, 'and therefore no last-run time')
  assert.equal(summary.healthy, false)
  assert.deepEqual(summary.jobs, [])
  assert.match(summary.detail, /pg_cron/, 'the reason is named, not left blank')
}

// --- the reader itself failed ------------------------------------------------
// Distinct from "nothing is scheduled": 0008 not being applied and the database
// being unreachable are different incidents and must not collapse together.
const failed = summariseScheduledJobs(null, { error: '42883 function does not exist', now: NOW })
assert.equal(failed.supported, false)
assert.equal(failed.lastRunAt, null)
assert.match(failed.detail, /42883/, 'the sqlstate survives into the report')
assert.match(failed.detail, /could not be read/)

// --- both sweeps healthy -----------------------------------------------------
const healthy = summariseScheduledJobs(
  [row(), row({ job_name: 'sweep_expired_presence', schedule: '*/5 * * * *', last_run_at: ago(120_000) })],
  { now: NOW }
)
assert.equal(healthy.supported, true)
assert.equal(healthy.healthy, true)
assert.equal(healthy.jobs.length, 2)
assert.equal(healthy.jobs[0].name, 'offer_expire_sweep', 'jobs are sorted by name, not by arrival')
assert.equal(healthy.jobs[0].state, 'ok')
assert.equal(healthy.lastRunAt, ago(30_000), 'lastRunAt is the most recent run across sweeps')

// --- a timestamp is never invented -------------------------------------------
const neverRan = summariseScheduledJobs([row({ last_run_at: null, last_status: null })], { now: NOW })
assert.equal(neverRan.jobs[0].state, 'never-run', 'scheduled but not yet run is its own state')
assert.equal(neverRan.lastRunAt, null, 'a job that never ran contributes no timestamp')
assert.equal(neverRan.healthy, false)

// An unparseable timestamp is the absence of a run, not a recent one. Left to
// Date.parse + a NaN comparison this would have silently read as `ok`.
const garbled = summariseScheduledJobs([row({ last_run_at: 'not-a-date' })], { now: NOW })
assert.equal(garbled.jobs[0].state, 'never-run')
assert.equal(garbled.lastRunAt, null)

// --- the quiet failure: still scheduled, stopped running ---------------------
const stale = summariseScheduledJobs([row({ last_run_at: ago(SWEEP_STALE_AFTER_MS + 60_000) })], { now: NOW })
assert.equal(stale.jobs[0].state, 'stale', 'a long-silent sweep must not read as healthy')
assert.equal(stale.healthy, false)
assert.match(stale.detail, /stale/)
// Its timestamp is still reported — the monitor needs to see how long ago.
assert.equal(stale.lastRunAt, ago(SWEEP_STALE_AFTER_MS + 60_000))

const fresh = summariseScheduledJobs([row({ last_run_at: ago(SWEEP_STALE_AFTER_MS - 60_000) })], { now: NOW })
assert.equal(fresh.jobs[0].state, 'ok', 'inside the window is not stale')

// --- ran, but failed ---------------------------------------------------------
const failing = summariseScheduledJobs([row({ last_status: 'failed' })], { now: NOW })
assert.equal(failing.jobs[0].state, 'failing', 'a recent run that errored is not a healthy sweep')
assert.equal(failing.healthy, false)

// --- unscheduled without being deleted ---------------------------------------
const inactive = summariseScheduledJobs([row({ active: false })], { now: NOW })
assert.equal(inactive.jobs[0].state, 'inactive')
assert.equal(inactive.healthy, false)

// --- a sweep that vanished from the schedule ---------------------------------
// The reason EXPECTED_SWEEP_JOBS is a literal: inferring the list from the rows
// would make this case look like a complete, healthy set of one.
const partial = summariseScheduledJobs([row()], { now: NOW })
assert.equal(partial.supported, true, 'a scheduler is present')
assert.equal(partial.healthy, false, 'but the set is incomplete')
assert.match(partial.detail, /missing: sweep_expired_presence/)

console.log('scheduled jobs: stale, failing, never-run, inactive and missing sweeps all read as unhealthy')

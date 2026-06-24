import { strict as assert } from 'node:assert'
import {
  CHECK_IN_STALE_AFTER_MS,
  formatRelativeTime,
  isCheckInStale,
  normalizeSeatCount,
} from '../src/lib/checkins.ts'

const now = new Date('2026-06-23T12:00:00.000Z')

assert.equal(
  isCheckInStale(new Date(now.getTime() - CHECK_IN_STALE_AFTER_MS - 1).toISOString(), now),
  true
)

assert.equal(
  isCheckInStale(new Date(now.getTime() - CHECK_IN_STALE_AFTER_MS + 1).toISOString(), now),
  false
)

assert.equal(formatRelativeTime(new Date(now.getTime() - 2 * 60 * 1000).toISOString(), now), '2 mins ago')
assert.equal(formatRelativeTime(new Date(now.getTime() - 60 * 1000).toISOString(), now), '1 min ago')
assert.equal(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), now), '3 hrs ago')

assert.equal(normalizeSeatCount('0'), 1)
assert.equal(normalizeSeatCount('2'), 2)
assert.equal(normalizeSeatCount('9'), 3)

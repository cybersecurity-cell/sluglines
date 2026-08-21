// The M1 public aggregates — rev. 5.3 §8 M1 "Public data functions".
//
// The two SECURITY DEFINER functions are Phase 2 objects and do not exist in
// this repo's migrations, so the case these assertions care most about is the
// one production is in today: the functions are absent and the public pages
// still have to render. `unavailable` must not collapse into "0", because the
// homepage renders those two states with different copy, and a fabricated zero
// on the front door is a measurement claim nobody made.
//
// Everything runs against a fake client. No database, no environment, no writes.

import { strict as assert } from 'node:assert'
import {
  PUBLIC_COUNT_FUNCTIONS,
  PUBLIC_OPEN_OFFER_COUNTS_FUNCTION,
  PUBLIC_SPOT_COUNTS_FUNCTION,
  ZERO_SPOT_COUNTS,
  corridorStatus,
  countsForSlug,
  errorCodeOf,
  fetchPublicSpotCounts,
  indexCountRows,
  isExpectedAbsence,
  normalizeCountRows,
  totalCounts,
} from '../src/lib/domain/public-counts.ts'
import { SPOT_LOCATIONS } from '../src/lib/domain/locations.ts'

// --- the contract with the Phase 2 migration --------------------------------

assert.deepEqual(PUBLIC_COUNT_FUNCTIONS, [
  'get_public_spot_counts',
  'get_public_open_offer_counts',
])
assert.equal(PUBLIC_SPOT_COUNTS_FUNCTION, 'get_public_spot_counts')
assert.equal(PUBLIC_OPEN_OFFER_COUNTS_FUNCTION, 'get_public_open_offer_counts')

// --- row normalisation ------------------------------------------------------

// PostgREST returns bigint/numeric aggregates as strings. `"3" + 1 === "31"` is
// the bug this coercion exists to prevent, so it is asserted, not assumed.
const normalized = normalizeCountRows([
  {
    spot_slug: 'Horner-Rd',
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    waiting_count: '3',
    driver_offer_count: 2,
    rider_request_count: null,
  },
  { spot_slug: '', waiting_count: 9 },
  null,
  'not a row',
  { spot_slug: 'rosslyn', waiting_count: -4, driver_offer_count: 1.7, rider_request_count: 'x' },
])

assert.equal(normalized.length, 2)
assert.equal(normalized[0].spot_slug, 'horner-rd', 'slugs are canonicalised to the database key')
assert.equal(normalized[0].waiting_count, 3)
assert.equal(normalized[0].rider_request_count, 0)
assert.equal(normalized[1].waiting_count, 0, 'negative counts are not rendered')
assert.equal(normalized[1].driver_offer_count, 1, 'fractional counts are floored')
assert.equal(normalized[1].rider_request_count, 0)
assert.deepEqual(normalizeCountRows(undefined), [])

// Rows from the two functions sum per spot rather than overwriting.
const indexed = indexCountRows([
  { spot_slug: 'horner-rd', corridor: '', direction: '', waiting_count: 3, driver_offer_count: 0, rider_request_count: 0 },
  { spot_slug: 'horner-rd', corridor: '', direction: '', waiting_count: 0, driver_offer_count: 2, rider_request_count: 1 },
])
assert.deepEqual(indexed['horner-rd'], { waiting: 3, driverOffers: 2, riderRequests: 1 })

// --- error classification ---------------------------------------------------

assert.equal(isExpectedAbsence({ code: '42883' }), true, 'undefined_function: Phase 2 not applied')
assert.equal(isExpectedAbsence({ code: 'PGRST202' }), true, 'not in the PostgREST schema cache')
assert.equal(isExpectedAbsence({ code: '42501' }), true, 'anon grant is Phase 2')
assert.equal(isExpectedAbsence({ code: '57014' }), false, 'a statement timeout is not an absence')
assert.equal(isExpectedAbsence(new Error('boom')), false)
assert.equal(errorCodeOf(null), undefined)
assert.equal(errorCodeOf({ code: 7 }), undefined)

// --- fetch: the three outcomes ---------------------------------------------

function clientReturning(byFunction) {
  const calls = []
  return {
    calls,
    rpc(name) {
      calls.push(name)
      const result = byFunction[name]
      if (typeof result === 'function') return result()
      return Promise.resolve(result ?? { data: [], error: null })
    },
  }
}

const absent = clientReturning({
  get_public_spot_counts: { data: null, error: { code: '42883', message: 'function does not exist' } },
  get_public_open_offer_counts: { data: null, error: { code: '42883', message: 'function does not exist' } },
})
const absentSnapshot = await fetchPublicSpotCounts(absent)

assert.equal(absentSnapshot.availability, 'unavailable')
assert.deepEqual(absentSnapshot.bySlug, {})
assert.match(absentSnapshot.reason, /not deployed/)
assert.deepEqual(absent.calls.sort(), [...PUBLIC_COUNT_FUNCTIONS].sort())
// The whole point: absence renders as absence, never as a measured zero.
assert.deepEqual(countsForSlug(absentSnapshot, 'horner-rd'), ZERO_SPOT_COUNTS)
assert.equal(corridorStatus(absentSnapshot).every((status) => status.spotsWithActivity === 0), true)

const live = clientReturning({
  get_public_spot_counts: {
    data: [
      { spot_slug: 'horner-rd', corridor: 'I-395 / I-95', direction: 'Morning', waiting_count: 4, driver_offer_count: 0, rider_request_count: 0 },
      { spot_slug: 'stone-ridge', corridor: 'I-66', direction: 'Morning', waiting_count: 1, driver_offer_count: 0, rider_request_count: 0 },
    ],
    error: null,
  },
  get_public_open_offer_counts: {
    data: [
      { spot_slug: 'horner-rd', corridor: 'I-395 / I-95', direction: 'Morning', waiting_count: 0, driver_offer_count: 2, rider_request_count: 1 },
    ],
    error: null,
  },
})
const liveSnapshot = await fetchPublicSpotCounts(live)

assert.equal(liveSnapshot.availability, 'live')
assert.deepEqual(countsForSlug(liveSnapshot, 'Horner-Rd'), { waiting: 4, driverOffers: 2, riderRequests: 1 })
assert.deepEqual(totalCounts(liveSnapshot), { waiting: 5, driverOffers: 2, riderRequests: 1 })

// A half-deployed environment reports the half it measured rather than nothing.
const partial = clientReturning({
  get_public_spot_counts: { data: null, error: { code: 'PGRST202' } },
  get_public_open_offer_counts: {
    data: [{ spot_slug: 'rosslyn', corridor: 'I-395 / I-95', direction: 'Afternoon', waiting_count: 0, driver_offer_count: 3, rider_request_count: 0 }],
    error: null,
  },
})
const partialSnapshot = await fetchPublicSpotCounts(partial)
assert.equal(partialSnapshot.availability, 'live')
assert.deepEqual(countsForSlug(partialSnapshot, 'rosslyn'), { waiting: 0, driverOffers: 3, riderRequests: 0 })

// A throwing client is the network-failure path. The public front door must not
// 500 because Supabase is unreachable, so this resolves rather than rejects.
const throwing = {
  rpc() {
    throw new Error('fetch failed')
  },
}
const throwingSnapshot = await fetchPublicSpotCounts(throwing)
assert.equal(throwingSnapshot.availability, 'unavailable')
assert.match(throwingSnapshot.reason, /failed/)

// --- corridor roll-up -------------------------------------------------------

const status = corridorStatus(liveSnapshot)
assert.deepEqual(status.map((entry) => entry.corridor), ['I-395 / I-95', 'I-66'])

const activeByCorridor = (corridor) =>
  SPOT_LOCATIONS.filter((location) => location.corridor === corridor && location.active).length

assert.equal(status[0].activeSpots, activeByCorridor('I-395 / I-95'))
assert.equal(status[1].activeSpots, activeByCorridor('I-66'))

// Only active spots contribute: "0 waiting" at a spot with no line is not a
// quiet line, and the strip must not read as one.
assert.equal(status[0].counts.waiting, 4)
assert.equal(status[0].counts.driverOffers, 2)
assert.equal(status[1].counts.waiting, 1)
assert.equal(status[0].spotsWithActivity, 1)
assert.equal(status[1].spotsWithActivity, 1)
assert.deepEqual(
  status[0].directions.map((direction) => direction.direction),
  ['Morning', 'Afternoon']
)

const inactiveOnly = corridorStatus(liveSnapshot, SPOT_LOCATIONS.filter((location) => !location.active))
assert.deepEqual(inactiveOnly, [], 'a corridor with no active spot is not a corridor to report on')

console.log('public-counts: ok')

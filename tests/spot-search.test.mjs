import { strict as assert } from 'node:assert'
import { SPOT_DIRECTORY } from '../src/lib/spot-directory.ts'
import { filterSpots } from '../src/lib/spot-search.ts'
import { resolveSpotQuery, searchSpotLocations } from '../src/lib/domain/spot-search.ts'

// A free-text query matches name, county, destination, corridor and slug. This
// assertion used to read `results.length === 1`, which was a fact about the
// dataset rather than about the filter: the 0004 directory slice added State
// Department, whose destination is literally "Horner Rd and Telegraph Rd", so
// "Horner" now legitimately matches two spots. The property worth asserting is
// that every match contains the needle and that the spot searched for is among
// them — a count is only evidence while the inventory stands still.
// See Docs/DECISIONS.md D-31.
const results = filterSpots(SPOT_DIRECTORY, {
  query: 'Horner',
  corridor: 'all',
  direction: 'all',
  status: 'all',
})

assert.ok(results.length >= 1)
assert.equal(
  results.every((spot) =>
    [spot.name, spot.county, spot.destination, spot.corridor, spot.slug].some((value) =>
      value.toLowerCase().includes('horner')
    )
  ),
  true,
  'every match must actually contain the query'
)
assert.equal(
  results.some((spot) => spot.slug === 'Horner-Rd'),
  true
)
assert.deepEqual(
  results.map((spot) => spot.slug).sort(),
  ['Horner-Rd', 'state-department'],
  'the two spots whose searchable text contains "horner"'
)

// Exact-slug resolution is the disambiguating path, and it is case-insensitive
// in both directions: the legacy URL slug and the route slug both resolve.
assert.equal(resolveSpotQuery('Horner-Rd')?.slug, 'horner-rd')
assert.equal(resolveSpotQuery('horner-rd')?.slug, 'horner-rd')
assert.equal(resolveSpotQuery('Horner')?.slug, undefined)

const afternoonResults = filterSpots(SPOT_DIRECTORY, {
  query: 'Crystal',
  corridor: 'I-395 / I-95',
  direction: 'Afternoon',
  status: 'active',
})

assert.equal(afternoonResults.some((spot) => spot.slug === 'Crystal-City-23rd-St'), true)

// Status narrows to the flag, not to a name pattern. Every legacy-only spot is
// inactive, so an "active" search can never return one.
const activeOnly = searchSpotLocations({ query: '', corridor: 'all', direction: 'all', status: 'active' })
assert.equal(activeOnly.some((location) => location.slug === 'landmark-mall'), false)
assert.equal(activeOnly.every((location) => location.active), true)

const inactiveOnly = searchSpotLocations({ query: '', corridor: 'all', direction: 'all', status: 'inactive' })
assert.equal(inactiveOnly.some((location) => location.slug === 'landmark-mall'), true)
assert.equal(activeOnly.length + inactiveOnly.length, SPOT_DIRECTORY.length)

// The county filter is the one the domain adds over the component's filter set.
const dcAfternoon = searchSpotLocations({
  query: '',
  corridor: 'all',
  direction: 'Afternoon',
  status: 'all',
  county: 'Washington DC',
})
assert.equal(dcAfternoon.every((location) => location.county === 'Washington DC'), true)
assert.equal(dcAfternoon.some((location) => location.slug === 'lenfant-plaza'), true)

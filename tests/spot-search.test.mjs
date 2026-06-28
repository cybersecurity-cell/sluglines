import { strict as assert } from 'node:assert'
import { SPOT_DIRECTORY } from '../src/lib/spot-directory.ts'
import { filterSpots } from '../src/lib/spot-search.ts'

const results = filterSpots(SPOT_DIRECTORY, {
  query: 'Horner',
  corridor: 'all',
  direction: 'all',
  status: 'all',
})

assert.equal(results.length, 1)
assert.equal(results[0].slug, 'Horner-Rd')

const afternoonResults = filterSpots(SPOT_DIRECTORY, {
  query: 'Crystal',
  corridor: 'I-395 / I-95',
  direction: 'Afternoon',
  status: 'active',
})

assert.equal(afternoonResults.some((spot) => spot.slug === 'Crystal-City-23rd-St'), true)

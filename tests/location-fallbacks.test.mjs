import { strict as assert } from 'node:assert'
import { enrichLocation, findFallbackLocationBySlug, getActiveFallbackLocations, toLocationSlug } from '../src/lib/location-fallbacks.ts'

assert.equal(toLocationSlug('Horner Road'), 'horner-road')
assert.equal(toLocationSlug("L'Enfant Plaza"), 'lenfant-plaza')

const enriched = enrichLocation({
  id: '1',
  spot_name: 'Horner Road',
  location: 'Horner Rd & US-1, Woodbridge, VA',
  destination: 'Pentagon / Crystal City',
  last_updated: '2026-06-23T12:00:00.000Z',
})

assert.equal(enriched.slug, 'horner-road')
assert.equal(enriched.latitude, 38.6586)

assert.equal(getActiveFallbackLocations().length > 0, true)
assert.equal(findFallbackLocationBySlug('horner-road')?.spot_name, 'Horner Road')

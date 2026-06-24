import { strict as assert } from 'node:assert'
import { findSpotBySlug, getActiveSpotLocations } from '../src/lib/spot-directory.ts'

const bobs = findSpotBySlug('Bobs-Old-Keene-Mill-Rd')

assert.equal(bobs?.name, "Bob's - Old Keene Mill Rd")
assert.equal(bobs?.active, true)
assert.equal(bobs?.county, 'Fairfax')
assert.equal(bobs?.direction, 'Morning')

assert.equal(findSpotBySlug('bobs-old-keene-mill-rd')?.slug, 'Bobs-Old-Keene-Mill-Rd')
assert.equal(getActiveSpotLocations().some((spot) => spot.slug === 'Horner-Rd'), true)

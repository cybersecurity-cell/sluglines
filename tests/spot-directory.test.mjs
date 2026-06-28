import { strict as assert } from 'node:assert'
import {
  findSpotBySlug,
  getActiveSpotLocations,
  groupSpotsByCorridor,
} from '../src/lib/spot-directory.ts'

const bobs = findSpotBySlug('Bobs-Old-Keene-Mill-Rd')

assert.equal(bobs?.name, "Bob's - Old Keene Mill Rd")
assert.equal(bobs?.active, true)
assert.equal(bobs?.county, 'Fairfax')
assert.equal(bobs?.direction, 'Morning')

assert.equal(findSpotBySlug('bobs-old-keene-mill-rd')?.slug, 'Bobs-Old-Keene-Mill-Rd')
assert.equal(findSpotBySlug('Horner-Rd')?.county, 'Prince William')
assert.equal(findSpotBySlug('LEnfant-Plaza')?.direction, 'Afternoon')
assert.equal(findSpotBySlug('Crystal-City-23rd-St')?.direction, 'Afternoon')

const active = getActiveSpotLocations()
assert.equal(active.some((spot) => spot.active === false), false)
assert.equal(getActiveSpotLocations().some((spot) => spot.slug === 'Horner-Rd'), true)

const grouped = groupSpotsByCorridor(active)
assert.equal(grouped.some((group) => group.corridor === 'I-395 / I-95'), true)
assert.equal(grouped.some((group) => group.corridor === 'I-66'), true)

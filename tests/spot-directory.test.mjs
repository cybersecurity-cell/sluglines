import { strict as assert } from 'node:assert'
import {
  findSpotBySlug,
  getActiveSpotLocations,
  getSpotDetailHref,
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

// Inactive spots link to /spots too, not to the legacy /slug_pickup/ page:
// that path is now a 301 into this one (Docs/DECISIONS.md D-32), and rev. 5.3
// §9 makes all 43 legacy spot URLs live landing pages.
assert.equal(getSpotDetailHref(findSpotBySlug('Franconia-Springfield')), '/spots/Franconia-Springfield')
assert.equal(getSpotDetailHref(findSpotBySlug('Lorton')), '/spots/Lorton')
assert.equal(getSpotDetailHref(findSpotBySlug('Saratoga')), '/spots/Saratoga')
assert.equal(getSpotDetailHref(findSpotBySlug('Horner-Rd')), '/spots/Horner-Rd')
assert.equal(getSpotDetailHref(null), '/spots')

const active = getActiveSpotLocations()
assert.equal(active.some((spot) => spot.active === false), false)
assert.equal(getActiveSpotLocations().some((spot) => spot.slug === 'Horner-Rd'), true)

const grouped = groupSpotsByCorridor(active)
assert.equal(grouped.some((group) => group.corridor === 'I-395 / I-95'), true)
assert.equal(grouped.some((group) => group.corridor === 'I-66'), true)

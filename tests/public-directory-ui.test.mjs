// M1 public surface wiring — rev. 5.3 §8 M1 route table.
//
// These are structural assertions on the route files. They cannot prove a
// rendered pixel, and they are not pretending to: what they do prove is the
// wiring that a refactor silently undoes — that the public pages read the new
// `locations` table and the public count functions, that they no longer read
// the tables the rebuild dropped, and that the routes §8 names exist.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { publicLocationFromDirectory } from '../src/lib/domain/public-location.ts'
import { SPOT_LOCATIONS, findSpotLocation } from '../src/lib/domain/locations.ts'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

// --- the §8 M1 route table --------------------------------------------------

for (const routeFile of [
  'src/app/page.tsx',
  'src/app/spots/page.tsx',
  'src/app/spots/[slug]/page.tsx',
  'src/app/lostfound/page.tsx',
  'src/app/[...legacyPath]/page.tsx',
  'src/app/gone/route.ts',
]) {
  assert.equal(fs.existsSync(path.join(root, routeFile)), true, `missing M1 route ${routeFile}`)
}

// --- homepage: hero + live corridor status strip ----------------------------

const homePage = read('src/app/page.tsx')
assert.match(homePage, /SiteHero/)
assert.match(homePage, /CorridorStatusStrip/, '§8 M1: the homepage carries the live corridor status strip')
assert.match(homePage, /getPublicSpotCounts/)
assert.match(homePage, /corridorStatus/)

const hero = read('src/components/SiteHero.tsx')
assert.match(hero, /href="\/spots"/, 'the hero CTA points at the canonical directory route')
assert.equal(/href="\/slug_pickup"/.test(hero), false, 'not at the legacy path')

// --- spot page: the new schema, not the dropped one -------------------------

const spotPage = read('src/app/spots/[slug]/page.tsx')
assert.match(spotPage, /getPublicLocation/)
assert.match(spotPage, /countsForSlug/)
// `spot_status`, `riders`, `drivers` and `alerts` are the counter model D-13
// dropped. A public page reading them renders zeros that look like a quiet line.
for (const droppedTable of ['spot_status', "from('riders')", "from('drivers')", "from('alerts')"]) {
  assert.equal(
    spotPage.includes(droppedTable),
    false,
    `the public spot page must not read ${droppedTable} (dropped by D-13)`
  )
}

// The spot page reads `locations` through `get_public_location`, not with a
// select. The table is RLS-on and its only read policy is `to authenticated`, so
// a direct select returned nothing for anonymous visitors and every public page
// fell through to the committed directory (#72, D-60). Admitting `anon` in a
// policy is refused by sql-lint R5, so the read goes through the same
// `security definer` mechanism 0005 established for the M1 aggregates.
const publicDirectory = read('src/lib/public-directory.ts')
assert.match(publicDirectory, /\.rpc\('get_public_location'/, 'the spot page reads through 0010')
assert.equal(
  /from\('locations'\)/.test(publicDirectory),
  false,
  'a direct select on locations is invisible to anon: it returns zero rows, not an error'
)

const detailLayout = read('src/components/SpotDetailLayout.tsx')
assert.match(detailLayout, /SpotLiveCounts/)
assert.equal(fs.existsSync(path.join(root, 'src/components/SpotLiveModule.tsx')), false,
  'the dropped-schema live module is gone, not merely unused')

// --- the database→directory fallback is a real merge, not a guess -----------

const horner = findSpotLocation('Horner-Rd')
const fallback = publicLocationFromDirectory(horner)

assert.equal(fallback.source, 'directory')
assert.equal(fallback.routeSlug, 'Horner-Rd')
assert.equal(fallback.slug, 'horner-rd')
assert.equal(fallback.isActive, true)
assert.equal(fallback.county, 'Prince William')
// Rewritten from the legacy page in D-59. The old values were a three-item
// paraphrase and an empty `linesTo`; the legacy page names ten destinations.
assert.deepEqual(fallback.linesFrom, [
  '14th Street',
  '18th Street',
  'Crystal City',
  'L’Enfant Plaza and Navy Yard',
  'Mark Center',
  'Rosslyn',
  'The Pentagon',
])
assert.equal(fallback.linesTo.length, 10, 'the legacy page names ten afternoon destinations')
assert.equal(fallback.linesTo[0], 'L’Enfant Plaza')

// The four legacy-only spots publish no coordinates (D-31). The page must carry
// the null through rather than substitute a plausible-looking one.
const springfield = publicLocationFromDirectory(findSpotLocation('springfield-town-center'))
assert.equal(springfield.latitude, null)
assert.equal(springfield.longitude, null)
assert.equal(springfield.isActive, false)
assert.match(detailLayout, /Not published for this spot/)

// Every spot in the directory can be rendered: no field the layout requires is
// missing for any of the 50.
for (const location of SPOT_LOCATIONS) {
  const publicLocation = publicLocationFromDirectory(location)
  assert.equal(typeof publicLocation.name, 'string')
  assert.equal(publicLocation.name.length > 0, true)
  assert.equal(typeof publicLocation.description, 'string')
  assert.equal(Array.isArray(publicLocation.linesFrom), true)
  assert.equal(Array.isArray(publicLocation.linesTo), true)
  assert.equal((publicLocation.latitude === null) === (publicLocation.longitude === null), true,
    `${location.slug}: half a coordinate is a pin off the coast of Africa`)
}

// --- accessibility: colour is never the only carrier (§10, WCAG 1.4.1) ------

for (const componentFile of ['src/components/CorridorStatusStrip.tsx', 'src/components/SpotLiveCounts.tsx']) {
  const component = read(componentFile)
  assert.match(component, /Riders waiting/, `${componentFile}: the rider count is labelled in text`)
  assert.match(component, /Driver offers/, `${componentFile}: the driver count is labelled in text`)
  assert.match(component, /<dl/, `${componentFile}: counts are a description list, not loose digits`)
  assert.equal(/aria-hidden/.test(component), true, `${componentFile}: decorative icons are hidden from AT`)
}

// The §10 screen-state matrix requires an empty state that proposes the next
// action, and it must be distinguishable from "counts are not switched on yet".
const strip = read('src/components/CorridorStatusStrip.tsx')
assert.match(strip, /Quiet right now/)
assert.match(strip, /not switched on yet/)

console.log('public-directory-ui: ok')

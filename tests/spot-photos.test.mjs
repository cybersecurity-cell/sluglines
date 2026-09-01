// Issue #18 — per-location media, and the area that renders when there is none.
//
// 8 spots carry a **transit diagram**. None carries a photograph, and the
// difference is the point. Docs/asset-register.md classifies all 27 legacy
// assets: 12 Google Maps aerials, 8 third-party transit or parking schematics,
// 6 dated route-change notices, 1 promotional flyer, zero photographs. D-39
// declined all of them; D-58 migrated only the 8 schematics and held the other
// 19 out — Google's imagery carries Google's terms, the notices are 2018-2019
// and would render as current, and the flyer has a contact address on it.
//
// So the assertions here have two jobs. The ones over SPOT_LOCATIONS hold the
// line as data: an image may only have come from the one permitted prefix and
// must actually be on disk. The ones over SpotPhoto hold it as copy: the
// populated branch must say what the file is, and must not crop it.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import { LEGACY_IMAGE_PREFIX, SPOT_LOCATIONS, spotImage } from '../src/lib/domain/locations.ts'
import { publicLocationFromDirectory, publicLocationFromRow } from '../src/lib/domain/public-location.ts'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

// -----------------------------------------------------------------------------
// Every image the directory carries, whenever one exists
// -----------------------------------------------------------------------------
const withImage = SPOT_LOCATIONS.filter((location) => location.image)

for (const location of withImage) {
  const { image } = location
  const where = `${location.slug}:`

  assert.ok(
    image.sourceUrl.startsWith(LEGACY_IMAGE_PREFIX),
    `${where} migrated from ${image.sourceUrl} — only ${LEGACY_IMAGE_PREFIX} is permitted. ` +
      'Some legacy pages also carry an lh5.googleusercontent.com avatar, which is a commenter, not a spot.'
  )

  // Self-hosted, always. A hotlink to sluglines.com dies with WordPress.
  assert.ok(image.src.startsWith('/'), `${where} src must be a path under public/, not a URL`)
  assert.equal(/^https?:/i.test(image.src), false, `${where} src must not be remote`)
  assert.ok(
    fs.existsSync(path.join(root, 'public', image.src.replace(/^\//, ''))),
    `${where} ${image.src} is referenced but not present in public/`
  )

  // next/image needs both, or the box is not reserved and the Lighthouse CLS
  // budget goes with it.
  assert.ok(Number.isInteger(image.width) && image.width > 0, `${where} width`)
  assert.ok(Number.isInteger(image.height) && image.height > 0, `${where} height`)
  assert.ok(image.alt.trim().length > 0, `${where} alt text describes the spot`)
  assert.match(image.fetchedAt, /^\d{4}-\d{2}-\d{2}$/, `${where} fetchedAt is an ISO date`)
}

// The finding, pinned as data. If this ever fails it means a photograph landed,
// which is #26's job — update the count here in the same change.
assert.equal(
  withImage.length,
  8,
  `${withImage.length} spots carry a diagram; 8 did after the D-58 migration, which took ` +
    'only the 8 agency schematics of the 27 legacy assets. Changing the inventory changes ' +
    'this number — update it in the change that did so.'
)

// Case-insensitive lookup, and it now returns something.
const bobs = spotImage('bobs-old-keene-mill-rd')
assert.ok(bobs, "Bob's carries a diagram")
assert.deepEqual(spotImage('Bobs-Old-Keene-Mill-Rd'), bobs, 'lookup is case-insensitive')
assert.equal(spotImage('no-such-spot'), undefined)

// Horner Rd's only legacy asset was a Google Maps aerial, so it deliberately has
// none. Pinned because it is the spot most likely to be "fixed" by someone who
// notices the gap without reading why (D-58).
assert.equal(spotImage('Horner-Rd'), undefined, 'Horner Rd had only a Google aerial; not migrated')

// Crystal City 12th and 23rd publish the same file under two legacy names. One
// copy on disk, claimed twice, is correct — the orphan check below counts
// basenames for exactly this reason.
const sharing = withImage.filter((l) => l.image.src === '/spots/Crystal_City_12th_St.jpg')
assert.equal(sharing.length, 2, 'the two Crystal City spots share one diagram file')

// -----------------------------------------------------------------------------
// The field is NOT a database column — 0004 must apply untouched
// -----------------------------------------------------------------------------
const seedScript = read('scripts/seed-locations.mjs')
const seedColumns = /const SEED_COLUMNS = \[([\s\S]*?)\]/.exec(seedScript)

assert.ok(seedColumns, 'seed-locations.mjs must declare SEED_COLUMNS')
assert.equal(
  /['"]image['"]/.test(seedColumns[1]),
  false,
  'image must stay out of SEED_COLUMNS: 0004 is generated from this module and guarded byte-for-byte'
)

const migration = read('supabase/migrations/0004_spot_locations_directory.sql')
assert.equal(/\bimage\b/.test(migration), false, '0004 must carry no image column')

// `locations` has no image column, so LOCATION_COLUMNS must not ask for one.
const publicLocation = read('src/lib/domain/public-location.ts')
assert.equal(
  /LOCATION_COLUMNS[\s\S]{0,400}?image/.test(publicLocation),
  false,
  'the select list must not name a column the table does not have'
)

// -----------------------------------------------------------------------------
// Both mappings resolve the image identically — the file's own stated invariant
// -----------------------------------------------------------------------------
const sample = SPOT_LOCATIONS[0]

const fromDirectory = publicLocationFromDirectory(sample)
const fromRow = publicLocationFromRow({
  slug: sample.slug,
  route_slug: sample.routeSlug,
  name: sample.name,
  corridor: sample.corridor,
  direction: sample.direction,
  county: sample.county,
  destination: sample.destination,
  description: sample.description,
  latitude: sample.latitude,
  longitude: sample.longitude,
  is_active: sample.active,
  peak_hours: sample.peakHours ?? null,
  parking: sample.parking ?? null,
  lines_from: sample.linesFrom ?? null,
  lines_to: sample.linesTo ?? null,
  community_url: sample.fbUrl ?? null,
  notes: sample.notes ?? null,
})

assert.deepEqual(
  fromRow.image,
  fromDirectory.image,
  'the row mapping resolves the image from the directory, so both produce the same record'
)

// Exercise the populated branch with a fixture, so the mapping that will run when
// #26 supplies a photograph is not shipped never having carried one.
const FIXTURE_IMAGE = {
  src: '/spots/example.jpg',
  width: 1200,
  height: 900,
  alt: 'Example spot',
  sourceUrl: `${LEGACY_IMAGE_PREFIX}Example.jpg`,
  fetchedAt: '2026-08-22',
}

const withFixture = publicLocationFromDirectory({ ...sample, image: FIXTURE_IMAGE })
assert.deepEqual(withFixture.image, FIXTURE_IMAGE, 'a directory image survives the mapping intact')
assert.ok(withFixture.image.sourceUrl.startsWith(LEGACY_IMAGE_PREFIX))
assert.equal(publicLocationFromDirectory({ ...sample, image: undefined }).image, undefined)

// -----------------------------------------------------------------------------
// The media area: both branches, structurally
// -----------------------------------------------------------------------------
const photo = read('src/components/SpotPhoto.tsx')

// The header explains the posture by naming the shapes it rejects — `<img>` among
// them — so the negative assertion has to read the code and not the prose about it.
// Same reason dashboard-fast-board.test.mjs strips comments before its bans.
const photoCode = photo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

assert.match(photo, /from 'next\/image'/, 'the populated branch uses next/image, not a bare <img>')
assert.equal(/<img[\s>]/.test(photoCode), false, 'no raw <img>: it would ship an unsized asset')
assert.match(photo, /width=\{image\.width\}/, 'explicit width')
assert.match(photo, /height=\{image\.height\}/, 'explicit height')
assert.match(photo, /sizes=/, 'responsive sizes, so a 360px slot does not fetch a 2600px file')

// The 4:3 box is reserved in BOTH branches. That is the asset register's rule,
// and it is what stops the page reflowing the day a photograph is added.
assert.equal(
  (photo.match(/aspect-4\/3/g) ?? []).length,
  2,
  'both the photograph and the no-photograph state reserve the same 4:3 area'
)

// The no-image state says what it is rather than implying a missing file. It no
// longer claims we refuse satellite views: several migrated diagrams are
// annotated aerials, and a page cannot claim a discipline its neighbour breaks.
assert.match(photo, /No diagram for this spot yet/)
// Read the code, not the prose about it — the header explains *why* the refusal
// was dropped and therefore says the words. Same reason the `<img>` ban above
// strips comments first.
assert.equal(
  /satellite view/.test(photoCode),
  false,
  'the old copy refused satellite views; 27 spots now show annotated aerials'
)
assert.match(photo, /aria-hidden/, 'the drawn graphic is decorative and hidden from screen readers')

// The populated branch must not crop a map, and must say what the file is.
assert.match(photoCode, /object-contain/, 'a cropped map loses its legend and scale bar')
assert.equal(/object-cover/.test(photoCode), false, 'object-cover would crop the diagram')
assert.match(photo, /Transit diagram, not a photograph/, 'the caption states what it is')
assert.match(photoCode, /\{image\.fetchedAt\}/, 'the caption dates the migration')

const layout = read('src/components/SpotDetailLayout.tsx')
assert.match(layout, /<SpotPhoto image=\{location\.image\} spotName=\{location\.name\} \/>/)

// -----------------------------------------------------------------------------
// public/ holds no image that no spot claims
// -----------------------------------------------------------------------------
const spotsDir = path.join(root, 'public', 'spots')
const onDisk = fs.existsSync(spotsDir) ? fs.readdirSync(spotsDir) : []
const claimed = new Set(withImage.map((location) => path.basename(location.image.src)))

assert.deepEqual(
  onDisk.filter((name) => !claimed.has(name)),
  [],
  'public/spots holds a file no spot references — an orphan nobody will notice going stale'
)

console.log(
  `spot media: ${withImage.length}/${SPOT_LOCATIONS.length} spots carry a transit diagram; ` +
    `${SPOT_LOCATIONS.length - withImage.length} render the reserved no-diagram state; ` +
    `${new Set(withImage.map((l) => l.image.src)).size} files on disk`
)

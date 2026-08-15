// TEMPORARY generator — emits the data block of src/lib/domain/locations.ts from
// the existing SPOT_DIRECTORY plus the four legacy-only spots. Deleted after use.
import fs from 'node:fs'

const existing = JSON.parse(fs.readFileSync('/tmp/dir.json', 'utf8'))

const legacyOnly = [
  {
    name: 'Springfield Town Center',
    slug: 'springfield-town-center',
    lat: null,
    lng: null,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: "L'Enfant Plaza, 14th at Commerce Dept., and 18th Street",
    description:
      'Frontier Garage commuter parking leased by Fairfax County. The legacy page records "there are no sluglines at this time" — commuters park here and walk to Franconia-Springfield Metro.',
    parking: '800 commuter spaces at the Frontier Garage on levels 2, 4 and 6.',
    linesFrom: ["L'Enfant Plaza", '14th at Commerce Dept.', '18th Street'],
    linesTo: ["L'Enfant Plaza", '14th at Commerce Dept.', '14th & Madison Dr', '19th & F Street'],
    fbUrl: 'https://www.facebook.com/groups/STCSluglines/',
    notes:
      'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. No coordinates on the legacy page.',
  },
  {
    name: 'Van Dorn St',
    slug: 'van-dorn-st',
    lat: null,
    lng: null,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax / Alexandria',
    destination: "L'Enfant Plaza, 14th Street, and 18th Street",
    description:
      'Van Dorn Metro park-and-ride. The legacy page title carries an explicit [Inactive] marker.',
    peakHours: '7:00 AM - 8:00 AM',
    parking: '361 spaces at the Van Dorn Metro park-and-ride.',
    linesFrom: ["L'Enfant Plaza", '14th Street', '18th Street'],
    linesTo: ["L'Enfant Plaza", '14th & Madison Ave', '19th & F Street'],
    notes:
      'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. Marked [Inactive] on the legacy page. No coordinates on the legacy page.',
  },
  {
    name: 'Landmark Mall',
    slug: 'landmark-mall',
    lat: null,
    lng: null,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax / Alexandria',
    destination: "L'Enfant Plaza, 14th Street, and 18th Street",
    description:
      'Bus stop #4000576 on the Landmark Mall roadway. The legacy page title carries an explicit [Inactive] marker.',
    peakHours: '7:00 AM - 8:00 AM',
    parking:
      'Lower level of the Landmark Mall garage, rows K-O, next to bus stop #4000576. An Alexandria permit was required.',
    linesFrom: ["L'Enfant Plaza", '14th Street', '18th Street'],
    fbUrl: 'https://www.facebook.com/groups/dcsluglines/',
    notes:
      'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. Marked [Inactive] on the legacy page. No coordinates on the legacy page.',
  },
  {
    name: 'State Department',
    slug: 'state-department',
    lat: null,
    lng: null,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Afternoon',
    county: 'Washington DC',
    destination: 'Horner Rd and Telegraph Rd',
    description:
      'A proposed pickup point the legacy page describes as "a new pickup location ... still explored". Its own comment thread records that the line never formed.',
    linesFrom: ['Horner Rd', 'Telegraph Rd'],
    linesTo: ['Horner Rd', 'Telegraph Rd'],
    fbUrl: 'https://www.facebook.com/groups/dcsluglines/',
    notes:
      'Legacy-only: present in the /slug_pickup/ inventory, absent from the curated live directory. Never operated. No coordinates on the legacy page.',
  },
]

// Insert each legacy-only spot next to the group it belongs to, so the file
// still reads corridor -> direction -> county in order.
const all = [...existing]
const insertAfter = (slug, entry) => {
  const at = all.findIndex((s) => s.slug === slug)
  all.splice(at + 1, 0, entry)
}
insertAfter('Sydenstricker-Rd', legacyOnly[0]) // Springfield Town Center, Fairfax morning
insertAfter('springfield-town-center', legacyOnly[1]) // Van Dorn St
insertAfter('van-dorn-st', legacyOnly[2]) // Landmark Mall
insertAfter('Navy-Yard', legacyOnly[3]) // State Department, DC afternoon

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const arr = (a) => `[${a.map(q).join(', ')}]`

const ORDER = [
  'slug',
  'routeSlug',
  'name',
  'corridor',
  'direction',
  'county',
  'destination',
  'description',
  'latitude',
  'longitude',
  'active',
  'peakHours',
  'parking',
  'linesFrom',
  'linesTo',
  'fbUrl',
  'notes',
]

function render(spot) {
  const row = {
    slug: q(spot.slug.toLowerCase()),
    routeSlug: q(spot.slug),
    name: q(spot.name),
    corridor: q(spot.corridor),
    direction: q(spot.direction),
    county: q(spot.county),
    destination: q(spot.destination),
    description: q(spot.description),
    latitude: spot.lat === null || spot.lat === undefined ? 'null' : String(spot.lat),
    longitude: spot.lng === null || spot.lng === undefined ? 'null' : String(spot.lng),
    active: String(spot.active),
    peakHours: spot.peakHours ? q(spot.peakHours) : null,
    parking: spot.parking ? q(spot.parking) : null,
    linesFrom: spot.linesFrom ? arr(spot.linesFrom) : null,
    linesTo: spot.linesTo ? arr(spot.linesTo) : null,
    fbUrl: spot.fbUrl ? q(spot.fbUrl) : null,
    notes: spot.notes ? q(spot.notes) : null,
  }

  const lines = ORDER.filter((key) => row[key] !== null).map((key) => `    ${key}: ${row[key]},`)
  return `  {\n${lines.join('\n')}\n  },`
}

fs.writeFileSync('/tmp/locations-data.txt', all.map(render).join('\n') + '\n')
console.log('entries:', all.length)
console.log('unique slugs:', new Set(all.map((s) => s.slug.toLowerCase())).size)

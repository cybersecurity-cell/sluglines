// `/board` — PR 5 "thin coordination loop", one corridor pair. Pure-function
// tests for `lib/domain/corridor.ts` and `lib/domain/board.ts`; the IO half
// (`lib/corridor-board.ts`) is exercised end to end only where there is a
// database to exercise it against, which this environment does not have (no
// Supabase credentials) — see the PR description for what that leaves
// unverified locally.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  HORNER_RD,
  LENFANT_PLAZA,
  HORNER_RD_SLUG,
  LENFANT_PLAZA_SLUG,
  PILOT_CORRIDOR_SLUGS,
  CORRIDOR_DIRECTIONS,
  isCorridorDirection,
  corridorLocationsForDirection,
  corridorDirectionOptions,
  resolvePilotCorridor,
  corridorLocationIdsForDirection,
  isPilotCorridorPair,
  corridorDirectionLabel,
  BOARD_VISIBLE_STATES,
  CORRIDOR_OFFER_COLUMNS,
  seatsRemaining,
  buildCorridorBoard,
} from '../src/lib/domain/index.ts'
import { SPOT_LOCATIONS } from '../src/lib/domain/locations.ts'

const root = process.cwd()

// -----------------------------------------------------------------------------
// corridor.ts — the one pair, named by slug, both directions (issue #132)
// -----------------------------------------------------------------------------

assert.notEqual(HORNER_RD_SLUG, LENFANT_PLAZA_SLUG)
assert.deepEqual(PILOT_CORRIDOR_SLUGS, [HORNER_RD_SLUG, LENFANT_PLAZA_SLUG])
assert.equal(HORNER_RD.slug, HORNER_RD_SLUG)
assert.equal(LENFANT_PLAZA.slug, LENFANT_PLAZA_SLUG)
assert.equal(CORRIDOR_DIRECTIONS.length, 2)

// The module names no id at all: `locations.id` is gen_random_uuid() per
// database (0004's own header), so a committed uuid can only ever raise 23503
// against the enforced FK. This is the regression #132 is about.
const corridorSource = fs.readFileSync(path.join(root, 'src/lib/domain/corridor.ts'), 'utf8')
assert.equal(
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(corridorSource),
  false,
  'corridor.ts must not carry a literal location uuid — ids are resolved by slug per database'
)

// Both slugs are rows of the committed directory, and active — 0004 is
// generated from this module and is APPLIED: production, so the lookup has a
// row to find on every database that has run the sequence. (Issue #132 and the
// first corridor.ts both said L'Enfant Plaza had no row; the module says
// otherwise, and the module is what 0004 was generated from.)
for (const slug of PILOT_CORRIDOR_SLUGS) {
  const entry = SPOT_LOCATIONS.find((location) => location.slug === slug)
  assert.ok(entry, `${slug} must be a row of the committed directory (0004)`)
  assert.equal(entry.active, true, `${slug} must be active, or locations_select_active hides it from the lookup`)
}
const seed0004 = fs.readFileSync(path.join(root, 'supabase/migrations/0004_spot_locations_directory.sql'), 'utf8')
for (const slug of PILOT_CORRIDOR_SLUGS) {
  assert.match(seed0004, new RegExp(`\\('${slug}', `), `0004 must seed ${slug}`)
}

for (const direction of CORRIDOR_DIRECTIONS) {
  assert.equal(isCorridorDirection(direction), true)
}
for (const bad of ['sideways', '', null, undefined, 42]) {
  assert.equal(isCorridorDirection(bad), false, `expected ${JSON.stringify(bad)} to be rejected`)
}

{
  const forward = corridorLocationsForDirection('horner-to-lenfant')
  assert.equal(forward.origin.slug, HORNER_RD_SLUG)
  assert.equal(forward.destination.slug, LENFANT_PLAZA_SLUG)

  const reverse = corridorLocationsForDirection('lenfant-to-horner')
  assert.equal(reverse.origin.slug, LENFANT_PLAZA_SLUG)
  assert.equal(reverse.destination.slug, HORNER_RD_SLUG)
}

{
  const options = corridorDirectionOptions()
  assert.equal(options.length, 2)
  assert.deepEqual(options.map((o) => o.value).sort(), [...CORRIDOR_DIRECTIONS].sort())
  for (const option of options) {
    assert.equal(typeof option.label, 'string')
    assert.ok(option.label.includes('Horner'))
    assert.ok(option.label.includes("L'Enfant") || option.label.includes('L’Enfant'))
  }
}

// Resolution is pure and total over whatever rows the caller fetched.
const HORNER_ID = 'a2b6c4f0-0000-4000-8000-00000000aaaa'
const LENFANT_ID = 'a2b6c4f0-0000-4000-8000-00000000bbbb'
const bothRows = [
  { id: LENFANT_ID, slug: LENFANT_PLAZA_SLUG },
  { id: HORNER_ID, slug: HORNER_RD_SLUG },
]

const resolved = resolvePilotCorridor(bothRows)
assert.equal(resolved.ok, true)
assert.deepEqual(resolved.corridor, { hornerRdId: HORNER_ID, lenfantPlazaId: LENFANT_ID }, 'order of the fetched rows must not matter')

{
  const missingLenfant = resolvePilotCorridor([{ id: HORNER_ID, slug: HORNER_RD_SLUG }])
  assert.equal(missingLenfant.ok, false)
  assert.deepEqual(missingLenfant.missing, [LENFANT_PLAZA_SLUG], 'a miss is reported by slug, so the failure can name the row')

  const missingBoth = resolvePilotCorridor([])
  assert.equal(missingBoth.ok, false)
  assert.deepEqual(missingBoth.missing, [HORNER_RD_SLUG, LENFANT_PLAZA_SLUG])

  const strangers = resolvePilotCorridor([{ id: 'x', slug: 'rolling-valley' }])
  assert.equal(strangers.ok, false, 'a row for some other spot resolves nothing')
}

const corridor = resolved.corridor

{
  const forward = corridorLocationIdsForDirection(corridor, 'horner-to-lenfant')
  assert.deepEqual(forward, { originId: HORNER_ID, destinationId: LENFANT_ID })
  const reverse = corridorLocationIdsForDirection(corridor, 'lenfant-to-horner')
  assert.deepEqual(reverse, { originId: LENFANT_ID, destinationId: HORNER_ID })
}

assert.equal(isPilotCorridorPair(corridor, HORNER_ID, LENFANT_ID), true)
assert.equal(isPilotCorridorPair(corridor, LENFANT_ID, HORNER_ID), true, 'either direction is the one pair')
assert.equal(isPilotCorridorPair(corridor, HORNER_ID, HORNER_ID), false, 'an offer needs two distinct locations')
assert.equal(isPilotCorridorPair(corridor, 'not-a-real-id', LENFANT_ID), false)

assert.equal(corridorDirectionLabel(corridor, HORNER_ID, LENFANT_ID), "Horner Rd -> L'Enfant Plaza")
assert.equal(corridorDirectionLabel(corridor, LENFANT_ID, HORNER_ID), "L'Enfant Plaza -> Horner Rd")
assert.equal(
  corridorDirectionLabel(corridor, 'not-a-real-id', LENFANT_ID),
  undefined,
  'an id outside the one pair gets no invented label'
)

// -----------------------------------------------------------------------------
// board.ts — seat math and the view model, over rows nobody fetched
// -----------------------------------------------------------------------------

assert.deepEqual([...BOARD_VISIBLE_STATES].sort(), ['OPEN', 'PARTIALLY_RESERVED'])
assert.equal(CORRIDOR_OFFER_COLUMNS.includes('*'), false, "select('*') would ship whatever a later migration adds")
assert.deepEqual(CORRIDOR_OFFER_COLUMNS.split(','), [
  'id',
  'poster_id',
  'poster_role',
  'origin_location_id',
  'destination_location_id',
  'window_start',
  'window_end',
  'seats_total',
  'seats_taken',
  'state',
  'revision',
])

assert.equal(seatsRemaining({ seats_total: 4, seats_taken: 1 }), 3)
assert.equal(seatsRemaining({ seats_total: 4, seats_taken: 4 }), 0)
assert.equal(seatsRemaining({ seats_total: 4, seats_taken: 5 }), 0, 'never negative, even against a stale read')

const VIEWER = 'viewer-1'
const OTHER = 'poster-2'

function row(overrides = {}) {
  return {
    id: 'offer-1',
    poster_id: OTHER,
    poster_role: 'driver',
    origin_location_id: HORNER_ID,
    destination_location_id: LENFANT_ID,
    window_start: '2026-09-08T09:00:00.000Z',
    window_end: '2026-09-08T09:30:00.000Z',
    seats_total: 3,
    seats_taken: 1,
    state: 'OPEN',
    revision: 1,
    ...overrides,
  }
}

{
  const empty = buildCorridorBoard([], { viewerId: VIEWER, corridor })
  assert.equal(empty.empty, true)
  assert.deepEqual(empty.offers, [])
}

{
  const board = buildCorridorBoard([row()], { viewerId: VIEWER, corridor })
  assert.equal(board.empty, false)
  assert.equal(board.offers.length, 1)

  const offer = board.offers[0]
  assert.equal(offer.id, 'offer-1')
  assert.equal(offer.posterRole, 'driver')
  assert.equal(offer.directionLabel, "Horner Rd -> L'Enfant Plaza")
  assert.equal(offer.seatsRemaining, 2)
  assert.equal(offer.state, 'OPEN')
  assert.equal(offer.revision, 1)
  assert.equal(offer.isMine, false)
}

{
  const board = buildCorridorBoard([row({ poster_id: VIEWER })], { viewerId: VIEWER, corridor })
  assert.equal(board.offers[0].isMine, true, "the caller's own post is flagged, so the UI can grey the reserve button")
}

{
  // A row outside the one pair still builds — this module never throws on
  // data it did not fetch — but gets the honest fallback label rather than a
  // guess.
  const board = buildCorridorBoard(
    [row({ origin_location_id: 'some-other-spot', destination_location_id: 'yet-another-spot' })],
    { viewerId: VIEWER, corridor }
  )
  assert.equal(board.offers[0].directionLabel, 'Unknown corridor')
}

// -----------------------------------------------------------------------------
// The IO half reads exactly the columns and states the domain module names,
// and never touches Supabase for a signed-out caller.
// -----------------------------------------------------------------------------
const corridorBoardIo = fs.readFileSync(path.join(root, 'src/lib/corridor-board.ts'), 'utf8')
assert.match(corridorBoardIo, /CORRIDOR_OFFER_COLUMNS/, "the read must use the domain module's column list")
assert.match(corridorBoardIo, /BOARD_VISIBLE_STATES/, "the read must use the domain module's visible-state list")
assert.match(corridorBoardIo, /auth\.getUser\(\)/, 'the read must check the session before querying offers')
assert.ok(
  corridorBoardIo.indexOf('auth.getUser()') < corridorBoardIo.indexOf(".from('offers')"),
  'the session check must run before the offers query'
)
// ...and resolves the pair on this database before filtering by it. Before
// #132 the filter used two committed literals, so the board rendered empty
// whatever the table held.
assert.match(corridorBoardIo, /readPilotCorridor\(/, 'the board must resolve the corridor ids by slug, not import literals')
assert.ok(
  corridorBoardIo.indexOf('readPilotCorridor(') < corridorBoardIo.indexOf(".from('offers')"),
  'the corridor must be resolved before the offers query that filters by it'
)
assert.equal(/LOCATION_ID\b/.test(corridorBoardIo), false, 'no literal location-id constant may reach the board read')

// The lookup itself reads the two columns the pure resolver needs, through the
// caller's client (so locations_select_active scopes it), and reports a miss by
// slug rather than as an empty result.
const corridorLookup = fs.readFileSync(path.join(root, 'src/lib/corridor-locations.ts'), 'utf8')
assert.match(corridorLookup, /\.from\('locations'\)/)
assert.match(corridorLookup, /\.in\('slug'/, 'the lookup is keyed by slug — the cross-environment key 0004 names')
assert.match(corridorLookup, /resolvePilotCorridor\(/, 'the IO half defers the pairing to the pure domain function')
assert.match(corridorLookup, /missing\.join/, 'a miss names the slug(s) so the operator knows which migration to apply')

// -----------------------------------------------------------------------------
// /board itself: the signed-out/unavailable/empty states are all handled
// explicitly, never collapsed into one generic render.
// -----------------------------------------------------------------------------
const boardPage = fs.readFileSync(path.join(root, 'src/app/board/page.tsx'), 'utf8')
assert.match(boardPage, /'signed-out'/)
assert.match(boardPage, /'unavailable'/)
assert.match(boardPage, /board\.empty/)
assert.match(boardPage, /force-dynamic/, 'a cached board is a wrong board')
assert.equal(
  /@supabase|createClient\(/.test(boardPage),
  false,
  '/board must read through lib/corridor-board.ts, not open its own Supabase client'
)

// -----------------------------------------------------------------------------
// Issue #140 — the "mine" view, the undo controls, the 6am form, the live list.
// -----------------------------------------------------------------------------
{
  // The view model splits the viewer's own offers and seats from everyone else's.
  const mineRow = row({ id: 'offer-mine', poster_id: VIEWER })
  const seatRow = row({ id: 'offer-seat', poster_id: OTHER })
  const otherRow = row({ id: 'offer-other', poster_id: OTHER })
  const board = buildCorridorBoard([mineRow, seatRow, otherRow], {
    viewerId: VIEWER,
    corridor,
    reservations: [{ offer_id: 'offer-seat', state: 'ACTIVE', seats: 2 }],
  })
  assert.deepEqual(board.yours.map((o) => o.id), ['offer-mine', 'offer-seat'], 'yours = posted by me or a seat I hold')
  assert.deepEqual(board.others.map((o) => o.id), ['offer-other'], 'others = the rest, in the order fetched')
  assert.equal(board.offers.length, 3, 'the full list is still available')
  assert.deepEqual(board.yours[1].mySeat, { state: 'ACTIVE', seats: 2 }, 'my seat carries its state and seat count')
  assert.equal(board.yours[0].mySeat, undefined, 'my own offer carries no seat of mine')
  assert.equal(board.others[0].mySeat, undefined)
  // Without reservations the split still works and nothing is fabricated.
  const bare = buildCorridorBoard([otherRow], { viewerId: VIEWER, corridor })
  assert.deepEqual(bare.yours, [])
  assert.equal(bare.others.length, 1)
}

// Page order: the open list before the post form (riders are the majority
// user), a live region on the list, the poll component, the "Yours" section
// with both undo forms, outcome banners.
assert.ok(
  boardPage.indexOf('id="open-offers-heading"') < boardPage.indexOf('id="post-seat-form"'),
  'the open offers come before the post form'
)
assert.ok(boardPage.indexOf('id="yours-heading"') < boardPage.indexOf('id="open-offers-heading"'), '"Yours" sits above the open list')
assert.match(boardPage, /aria-live="polite"/, 'the list is a live region')
assert.match(boardPage, /<LiveUpdated renderedLabel=\{renderedLabel\} \/>/, 'the board shows when it was rendered and polls')
assert.match(boardPage, /const renderedLabel = new Date\(\)\.toLocaleTimeString\('en-US', \{\s*timeZone: BOARD_TIME_ZONE,/, 'the render time is formatted server-side in the board zone')
assert.match(boardPage, /action=\{cancelOwnOffer\}/, 'a poster can cancel their own offer')
assert.match(boardPage, /action=\{releaseOwnSeat\}/, 'a rider can release their own seat')
assert.match(boardPage, /name="expected_revision" value=\{offer\.revision\}/, 'both undo forms carry the revision the member saw')
assert.match(boardPage, /offer\.mySeat\?\.state === 'ACTIVE' \?/, 'release is offered for an ACTIVE seat only (a CONFIRMED seat has no rider path yet, #148)')
assert.match(boardPage, /searchParams\?: Promise<\{ done\?: string; error\?: string \}>/, 'outcomes come back in the URL')
assert.match(boardPage, /href="#post-seat-form"/, 'the empty state still anchors to the form')

// The actions: server-only, both writers by name, deterministic keys derived
// from (offer, revision) so a double tap replays rather than repeats, parsed
// through the same validator the fetch routes use, no actor parameter.
const boardActions = fs.readFileSync(path.join(root, 'src/app/board/actions.ts'), 'utf8')
assert.match(boardActions, /'use server'/)
assert.match(boardActions, /'offer_cancel'/)
assert.match(boardActions, /'offer_release_seat'/)
assert.match(boardActions, /parseTransitionInput\(/, 'the same validation the routes apply')
assert.match(boardActions, /idempotency_key: `board-\$\{operation\}:\$\{String\(offerId\)\}:\$\{String\(expectedRevision\)\}`/, 'the key is derived from what is being asked, so a double tap replays')
assert.equal(/p_actor|p_member_id|p_user_id|p_rider_id|p_poster_id/.test(boardActions), false, 'no actor parameter; auth.uid() decides')
assert.equal(/\.update\(|\.delete\(\)|\.insert\(/.test(boardActions), false, 'no direct table write')
assert.match(boardActions, /transitionFailure\(error\)\.body\.error\.kind/, 'failures are classified by the published mapping, not guessed')

// The seat read is its own module, degrades to [] and scopes to the viewer.
const seatRead = fs.readFileSync(path.join(root, 'src/lib/board-reservations.ts'), 'utf8')
assert.match(seatRead, /\.from\('reservations'\)/)
assert.match(seatRead, /\.eq\('rider_id', viewerId\)/, 'scoped to the viewer in the query, not only by policy')
assert.match(seatRead, /\.in\('state', \['ACTIVE', 'CONFIRMED'\]\)/, 'live seats only')
assert.match(seatRead, /if \(offerIds\.length === 0\) return \[\]/, 'no query for an empty board')

// The 6am form: presets, defaults, a fixed window, end-after-start checked
// before the round trip, seats default to a car.
const postForm = fs.readFileSync(path.join(root, 'src/components/PostSeatForm.tsx'), 'utf8')
assert.match(postForm, /LEAVING_IN_PRESETS_MINUTES = \[10, 20, 30, 45\]/, '"leaving in" presets')
assert.match(postForm, /WINDOW_MINUTES = 30/, 'a fixed pickup window')
assert.match(postForm, /DEFAULT_SEATS = 3/, 'seats default to a car, not one')
assert.match(postForm, /useState\(initialWindow\.start\)/, 'the start is pre-filled')
assert.match(postForm, /aria-pressed=\{leavingIn === minutes\}/, 'the chosen preset is announced')
assert.match(postForm, /const windowInvalid =/, 'end-after-start is checked client-side')
assert.match(postForm, /disabled=\{pending \|\| windowInvalid\}/, 'and blocks the submit')
assert.match(postForm, /min=\{toLocalInputValue\(new Date\(\)\)\}/, 'the start cannot be in the past')

// After "Reserved." the rider is told what happens next.
const reserveButton = fs.readFileSync(path.join(root, 'src/components/ReserveSeatButton.tsx'), 'utf8')
assert.match(reserveButton, /Reserved\. The driver confirms before the window/, 'the rider learns what happens next')

// The poll is bounded, visibility-aware, and says when the board was rendered.
const liveUpdated = fs.readFileSync(path.join(root, 'src/components/LiveUpdated.tsx'), 'utf8')
assert.match(liveUpdated, /intervalMs = 30_000/, 'a 30s poll, not a firehose')
assert.match(liveUpdated, /document\.visibilityState === 'visible'/, 'a hidden tab does not poll')
assert.match(liveUpdated, /router\.refresh\(\)/, 'it re-renders the server board rather than fetching a second source of truth')
assert.equal(/useState\(/.test(liveUpdated), false, 'no client state to hydrate; the label arrives formatted')

// Issue #134: every branch renders inside the light shell `/login` uses, the
// window label is pinned to Eastern time, and the default 404 no longer falls
// through to the dark shell.
assert.match(boardPage, /bg-white text-slate-950/, '/board must paint its own light ground; the :root shell is still dark')
assert.equal(
  (boardPage.match(/<BoardShell>/g) ?? []).length,
  3,
  'all three branches (signed-out, unavailable, board) must render inside the light shell'
)
assert.match(boardPage, /BOARD_TIME_ZONE = 'America\/New_York'/, 'the board zone is Eastern, pinned')
assert.match(boardPage, /timeZone: BOARD_TIME_ZONE/, 'windowLabel must format in the pinned zone, never the server\'s')
assert.match(boardPage, /timeZoneName: 'short'/, 'the label must name the zone so a reader knows whose clock it is')

const notFoundPage = fs.readFileSync(path.join(root, 'src/app/not-found.tsx'), 'utf8')
assert.match(notFoundPage, /GONE_TOKENS/, 'the 404 must use the 410\'s AA-tested tokens, not a new palette')
assert.match(notFoundPage, /href="\/spots"/, 'the 404 links to /spots (§8 M1 dead-end links)')
assert.match(notFoundPage, /href="\/lostfound"/, 'the 404 links to /lostfound (§8 M1 dead-end links)')
assert.match(notFoundPage, /robots: \{ index: false/, 'a 404 is not indexed')

const axeSpec = fs.readFileSync(path.join(root, 'tests/e2e/accessibility.spec.ts'), 'utf8')
for (const route of ['/board', '/this-page-does-not-exist']) {
  assert.ok(axeSpec.includes(`'${route}'`), `${route} must be an axe-gated route (issue #134)`)
}
// `/app` is deliberately not gated (its migrated body has no alt text; see the
// spec's own comment and #141), and the spec must keep saying why.
assert.match(axeSpec, /`\/app` is NOT in this list/, 'the axe spec must record why /app is not gated')

console.log('corridor-board: ok')

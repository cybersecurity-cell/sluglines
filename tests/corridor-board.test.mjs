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
  HORNER_RD_LOCATION_ID,
  LENFANT_PLAZA_LOCATION_ID,
  PILOT_CORRIDOR_PAIR_LOCATION_IDS,
  CORRIDOR_DIRECTIONS,
  isCorridorDirection,
  corridorLocationsForDirection,
  corridorDirectionOptions,
  isPilotCorridorPair,
  corridorDirectionLabel,
  BOARD_VISIBLE_STATES,
  CORRIDOR_OFFER_COLUMNS,
  seatsRemaining,
  buildCorridorBoard,
} from '../src/lib/domain/index.ts'

const root = process.cwd()

// -----------------------------------------------------------------------------
// corridor.ts — the one pair, both directions
// -----------------------------------------------------------------------------

assert.notEqual(HORNER_RD_LOCATION_ID, LENFANT_PLAZA_LOCATION_ID)
assert.deepEqual(PILOT_CORRIDOR_PAIR_LOCATION_IDS, [HORNER_RD_LOCATION_ID, LENFANT_PLAZA_LOCATION_ID])
assert.equal(CORRIDOR_DIRECTIONS.length, 2)

for (const direction of CORRIDOR_DIRECTIONS) {
  assert.equal(isCorridorDirection(direction), true)
}
for (const bad of ['sideways', '', null, undefined, 42]) {
  assert.equal(isCorridorDirection(bad), false, `expected ${JSON.stringify(bad)} to be rejected`)
}

{
  const forward = corridorLocationsForDirection('horner-to-lenfant')
  assert.equal(forward.origin.id, HORNER_RD_LOCATION_ID)
  assert.equal(forward.destination.id, LENFANT_PLAZA_LOCATION_ID)

  const reverse = corridorLocationsForDirection('lenfant-to-horner')
  assert.equal(reverse.origin.id, LENFANT_PLAZA_LOCATION_ID)
  assert.equal(reverse.destination.id, HORNER_RD_LOCATION_ID)
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

assert.equal(isPilotCorridorPair(HORNER_RD_LOCATION_ID, LENFANT_PLAZA_LOCATION_ID), true)
assert.equal(isPilotCorridorPair(LENFANT_PLAZA_LOCATION_ID, HORNER_RD_LOCATION_ID), true, 'either direction is the one pair')
assert.equal(isPilotCorridorPair(HORNER_RD_LOCATION_ID, HORNER_RD_LOCATION_ID), false, 'an offer needs two distinct locations')
assert.equal(isPilotCorridorPair('not-a-real-id', LENFANT_PLAZA_LOCATION_ID), false)

assert.equal(corridorDirectionLabel(HORNER_RD_LOCATION_ID, LENFANT_PLAZA_LOCATION_ID), "Horner Rd -> L'Enfant Plaza")
assert.equal(corridorDirectionLabel(LENFANT_PLAZA_LOCATION_ID, HORNER_RD_LOCATION_ID), "L'Enfant Plaza -> Horner Rd")
assert.equal(
  corridorDirectionLabel('not-a-real-id', LENFANT_PLAZA_LOCATION_ID),
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
    origin_location_id: HORNER_RD_LOCATION_ID,
    destination_location_id: LENFANT_PLAZA_LOCATION_ID,
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
  const empty = buildCorridorBoard([], { viewerId: VIEWER })
  assert.equal(empty.empty, true)
  assert.deepEqual(empty.offers, [])
}

{
  const board = buildCorridorBoard([row()], { viewerId: VIEWER })
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
  const board = buildCorridorBoard([row({ poster_id: VIEWER })], { viewerId: VIEWER })
  assert.equal(board.offers[0].isMine, true, "the caller's own post is flagged, so the UI can grey the reserve button")
}

{
  // A row outside the one pair still builds — this module never throws on
  // data it did not fetch — but gets the honest fallback label rather than a
  // guess.
  const board = buildCorridorBoard(
    [row({ origin_location_id: 'some-other-spot', destination_location_id: 'yet-another-spot' })],
    { viewerId: VIEWER }
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
    reservations: [{ offer_id: 'offer-seat', state: 'ACTIVE', seats: 2 }],
  })
  assert.deepEqual(board.yours.map((o) => o.id), ['offer-mine', 'offer-seat'], 'yours = posted by me or a seat I hold')
  assert.deepEqual(board.others.map((o) => o.id), ['offer-other'], 'others = the rest, in the order fetched')
  assert.equal(board.offers.length, 3, 'the full list is still available')
  assert.deepEqual(board.yours[1].mySeat, { state: 'ACTIVE', seats: 2 }, 'my seat carries its state and seat count')
  assert.equal(board.yours[0].mySeat, undefined, 'my own offer carries no seat of mine')
  assert.equal(board.others[0].mySeat, undefined)
  // Without reservations the split still works and nothing is fabricated.
  const bare = buildCorridorBoard([otherRow], { viewerId: VIEWER })
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

console.log('corridor-board: ok')

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

console.log('corridor-board: ok')

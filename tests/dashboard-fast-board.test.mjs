// The M3 dashboard / power-user view — rev. 5.3 §8 M3, §8 M4 presence.
//
// Two kinds of assertion, kept apart on purpose:
//
//   1. domain behaviour — `buildFastBoard` and the presence mapping, run as pure
//      functions against fixtures. No database, no environment, no writes.
//   2. structural wiring — that the route file actually reads the aggregates and
//      the presence row, and that it no longer reads the tables D-13 dropped.
//      These cannot prove a rendered pixel and are not pretending to; they prove
//      the wiring a refactor silently undoes, which is what happened to this
//      page once already.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  NO_PRESENCE,
  PRESENCE_CHECKIN_COLUMNS,
  PRESENCE_CLEAR_FUNCTION,
  SIGNED_OUT_PRESENCE,
  activeFastBoardRows,
  buildFastBoard,
  isPresenceLive,
  minutesRemaining,
  presenceDirectionLabel,
  presenceFromRow,
} from '../src/lib/domain/fast-board.ts'
import { SPOT_LOCATIONS, activeSpotLocations, findSpotLocation } from '../src/lib/domain/locations.ts'
import { UNAVAILABLE_SNAPSHOT } from '../src/lib/domain/public-counts.ts'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

// These files document the calls they must *not* make, so an assertion that a
// call is absent has to read the code and not the prose about it.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const NOW = new Date('2026-08-15T11:00:00.000Z')

// --- presence: the four states are four states ------------------------------

assert.equal(SIGNED_OUT_PRESENCE.state, 'signed-out')
assert.equal(NO_PRESENCE.state, 'none')
// Signed out is not "not checked in". A member who is checked in and signed out
// must not be told they are clear.
assert.notEqual(SIGNED_OUT_PRESENCE.state, NO_PRESENCE.state)

const liveRow = {
  member_id: '00000000-0000-4000-8000-00000000beef',
  location_id: '00000000-0000-4000-8000-0000000000aa',
  direction: 'morning',
  checked_in_at: '2026-08-15T10:52:00.000Z',
  expires_at: '2026-08-15T11:12:00.000Z',
}

assert.equal(isPresenceLive(liveRow, NOW), true)
assert.equal(isPresenceLive({ expires_at: '2026-08-15T10:59:59.000Z' }, NOW), false)
// An unparseable expiry is treated as expired: the alternative pins a member to
// a spot no elapsed time can clear.
assert.equal(isPresenceLive({ expires_at: 'not a timestamp' }, NOW), false)

assert.equal(minutesRemaining(liveRow.expires_at, NOW), 12)
assert.equal(minutesRemaining('2026-08-15T10:00:00.000Z', NOW), 0, 'never negative')
assert.equal(minutesRemaining('nonsense', NOW), 0)

const horner = findSpotLocation('Horner-Rd')
const resolved = presenceFromRow(liveRow, horner, NOW)

assert.equal(resolved.state, 'checked-in')
assert.equal(resolved.spotSlug, 'horner-rd')
assert.equal(resolved.routeSlug, 'Horner-Rd', 'the panel links at the case-preserved route slug')
assert.equal(resolved.spotName, horner.name)
assert.equal(resolved.direction, 'morning')
assert.equal(resolved.minutesRemaining, 12)
assert.equal(presenceDirectionLabel(resolved.direction), 'Morning')
assert.equal(presenceDirectionLabel(undefined), undefined)

// `locations` (0004) is applied nowhere, so the uuid → spot lookup is expected
// to fail today. The check-in must still be reported and still be clearable: an
// unnameable row is exactly the row a member most needs the button for.
const unresolved = presenceFromRow(liveRow, null, NOW)
assert.equal(unresolved.state, 'checked-in')
assert.equal(unresolved.spotName, undefined)
assert.equal(unresolved.spotSlug, undefined)
assert.equal(unresolved.minutesRemaining, 12)

// An expired row is readable until the sweep runs. It is not a check-in.
assert.deepEqual(
  presenceFromRow({ ...liveRow, expires_at: '2026-08-15T10:30:00.000Z' }, horner, NOW),
  NO_PRESENCE
)

// A direction outside the table's own check constraint is dropped rather than
// rendered: the badge says "Morning" or "Afternoon" or nothing.
assert.equal(presenceFromRow({ ...liveRow, direction: 'evening' }, horner, NOW).direction, undefined)

// --- the board: unavailable is not zero -------------------------------------

const dark = buildFastBoard(UNAVAILABLE_SNAPSHOT)

assert.equal(dark.availability, 'unavailable')
assert.equal(dark.rows.length, activeSpotLocations().length, 'every active line is listed')
assert.equal(dark.rows.length > 0, true)
assert.equal(
  dark.rows.every((row) => SPOT_LOCATIONS.some((location) => location.slug === row.slug)),
  true
)
assert.equal(dark.totals.spotsWithActivity, 0)
// The rows carry zeros because there is nothing to carry — but `availability`
// says so, and `activeFastBoardRows` refuses to claim any line is moving.
assert.deepEqual(activeFastBoardRows(dark), [])

// With nothing to rank by, the fallback order is the grouping a commuter already
// knows — corridor, then direction, then name — not an arbitrary one that reads
// like a ranking.
for (let index = 1; index < dark.rows.length; index += 1) {
  const previous = dark.rows[index - 1]
  const current = dark.rows[index]
  const key = (row) => [row.corridor, row.direction, row.name].join(" ")
  assert.equal(key(previous) <= key(current), true, `unavailable order broke at ${current.slug}`)
}

// --- the board: live counts, busiest first ----------------------------------

const [first, second, third, fourth] = activeSpotLocations()

const liveSnapshot = {
  availability: 'live',
  bySlug: {
    [second.slug]: { waiting: 1, driverOffers: 6, riderRequests: 0 },
    [third.slug]: { waiting: 4, driverOffers: 0, riderRequests: 3 },
    [fourth.slug]: { waiting: 0, driverOffers: 0, riderRequests: 0 },
  },
}

const board = buildFastBoard(liveSnapshot)

assert.equal(board.availability, 'live')
assert.equal(board.rows.length, activeSpotLocations().length)

// `third` is 7 (4 waiting + 3 requests), `second` is 7 (1 + 6) — the tie breaks
// on riders waiting, because a line with people in it is more decidable than one
// with only offers.
assert.equal(board.rows[0].slug, third.slug)
assert.equal(board.rows[0].waiting, 7, 'presence waiting and open rider requests are one queue')
assert.equal(board.rows[0].activity, 7)
assert.equal(board.rows[1].slug, second.slug)
assert.equal(board.rows[1].driverOffers, 6)

assert.equal(board.totals.waiting, 8)
assert.equal(board.totals.driverOffers, 6)
assert.equal(board.totals.spotsWithActivity, 2, 'a measured zero is not activity')
assert.equal(board.totals.spots, board.rows.length)
assert.deepEqual(
  activeFastBoardRows(board).map((row) => row.slug),
  [third.slug, second.slug]
)

// Ordering is stable across two identical builds — the name tiebreak exists so
// a page reload does not reshuffle rows a commuter is scanning by position.
assert.deepEqual(
  buildFastBoard(liveSnapshot).rows.map((row) => row.slug),
  board.rows.map((row) => row.slug)
)

// --- the caller's own spot is pinned, in both availabilities ----------------

for (const [label, snapshot] of [['live', liveSnapshot], ['unavailable', UNAVAILABLE_SNAPSHOT]]) {
  // `first` has no counts at all, so only the pin can put it on top.
  const pinned = buildFastBoard(snapshot, { checkedInSlug: first.slug.toUpperCase() })
  assert.equal(pinned.rows[0].slug, first.slug, `${label}: the caller's check-in leads the board`)
  assert.equal(pinned.rows[0].isCheckedIn, true)
  assert.equal(
    pinned.rows.filter((row) => row.isCheckedIn).length,
    1,
    `${label}: presence_checkins is keyed by member_id — exactly one row can be flagged`
  )
}

// An unresolved check-in pins nothing and flags nothing; it must not silently
// mark row zero.
assert.equal(buildFastBoard(liveSnapshot, { checkedInSlug: null }).rows[0].isCheckedIn, false)

// --- wiring: the route reads the aggregates, not the dropped tables ---------

const dashboardPage = read('src/app/dashboard/page.tsx')

assert.match(dashboardPage, /getPublicSpotCounts/, '§8 M1 aggregates are the count source')
assert.match(dashboardPage, /buildFastBoard/)
assert.match(dashboardPage, /getMemberPresence/)
assert.match(dashboardPage, /CheckInStatusPanel/)
assert.match(dashboardPage, /FastBoard/)
assert.match(dashboardPage, /force-dynamic/, 'a cached count on this page is a wrong count')

// `spot_status`, `riders`, `drivers` and `alerts` are the counter model D-13
// dropped. Reading them renders zeros that look like a quiet line.
for (const droppedTable of ['spot_status', "from('riders')", "from('drivers')", "from('alerts')"]) {
  assert.equal(
    dashboardPage.includes(droppedTable),
    false,
    `the dashboard must not read ${droppedTable} (dropped by D-13)`
  )
}

assert.equal(
  fs.existsSync(path.join(root, 'src/components/DashboardClient.tsx')),
  false,
  'the dropped-schema dashboard client is gone, not merely unused'
)

// The other four of the same defect class, named as owed in D-33 and deleted by
// issue #17, plus the fifth that only they reached. All read riders/drivers/
// spot_status, dropped by D-13.
for (const dead of [
  'src/components/HomeLocationGrid.tsx',
  'src/components/LiveBoardPreview.tsx',
  'src/components/RealTimeBoard.tsx',
  'src/components/CheckIn.tsx',
  'src/components/LocationCard.tsx',
]) {
  assert.equal(fs.existsSync(path.join(root, dead)), false, `${dead} is gone, not merely unreachable`)
}

// The point of deleting them, stated as the property rather than the file list:
// nothing in src/ imports the browser Supabase client any more. D-33 removed it
// from /dashboard on measured grounds -- 62 kB/162 kB of route JavaScript down to
// 1.11 kB/97.1 kB -- and every remaining importer was one of the files above.
// This assertion is what stops one coming back by accident.
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

const BROWSER_CLIENT_IMPORT = /(?:from|import\()\s*['"](?:@\/lib\/supabase\/client|(?:\.{1,2}\/)+supabase\/client)['"]/

const browserClientImporters = sourceFiles(path.join(root, 'src'))
  .filter((file) => BROWSER_CLIENT_IMPORT.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(root, file).replace(/\\/g, '/'))

assert.deepEqual(
  browserClientImporters,
  [],
  `the browser Supabase client is imported by: ${browserClientImporters.join(', ')}`
)

const dashboardIo = read('src/lib/dashboard.ts')
assert.match(dashboardIo, /from\('presence_checkins'\)/, 'presence comes from the 0001 table')
assert.match(dashboardIo, /auth\.getUser\(\)/, 'the row is scoped to the caller, not to a device id')
assert.equal(
  dashboardIo.includes('device_id'),
  false,
  'the device-id presence model went with the tables that held it'
)

// --- wiring: checkout goes through the SECURITY DEFINER writer --------------

const panel = read('src/components/CheckInStatusPanel.tsx')
const action = read('src/app/dashboard/actions.ts')

assert.equal(PRESENCE_CLEAR_FUNCTION, 'presence_clear')
assert.match(action, /'use server'/, 'checkout runs on the server, not through a browser Supabase client')
assert.match(action, /PRESENCE_CLEAR_FUNCTION/, 'checkout calls the 0001 writer by its published name')
assert.match(action, /\.rpc\(/)
assert.match(panel, /action=\{clearPresence\}/, 'the button is a form submit, so it works without JS')
// `presence_checkins` has no delete policy for any role (§6 default-deny), so a
// direct delete from a client is refused — silently, which is how the previous
// button "worked".
for (const [label, source] of [['action', action], ['panel', panel]]) {
  assert.equal(/\.delete\(\)/.test(stripComments(source)), false, `${label}: no direct table write`)
}

// The Supabase browser client is 62 kB of the dashboard's first load, shipped to
// parse one button press. It stays off this page.
for (const serverFile of [
  'src/app/dashboard/page.tsx',
  'src/components/CheckInStatusPanel.tsx',
  'src/components/FastBoard.tsx',
  'src/components/CheckOutButton.tsx',
]) {
  const source = read(serverFile)
  assert.equal(
    /@\/lib\/supabase\/client/.test(source),
    false,
    `${serverFile}: the dashboard must not ship the Supabase browser client`
  )
}

const board_ = read('src/components/FastBoard.tsx')
assert.equal(/'use client'/.test(board_), false, 'the board is server-rendered: the counts are in the HTML')
assert.equal(/'use client'/.test(panel), false, 'the panel is server-rendered too')
assert.match(
  read('src/components/CheckOutButton.tsx'),
  /'use client'/,
  'the pending-state button is the only client component on this page'
)

// The presence select is column-explicit, for the same reason `LOCATION_COLUMNS`
// is: `select('*')` on this table ships whatever a later migration adds to a row
// that holds one member's location.
assert.equal(PRESENCE_CHECKIN_COLUMNS.includes('*'), false)
assert.deepEqual(PRESENCE_CHECKIN_COLUMNS.split(','), [
  'member_id',
  'location_id',
  'direction',
  'checked_in_at',
  'expires_at',
])

// --- accessibility: colour is never the only carrier (§10, WCAG 1.4.1) ------

for (const componentFile of ['src/components/FastBoard.tsx', 'src/components/CheckInStatusPanel.tsx']) {
  const component = read(componentFile)
  assert.equal(/aria-hidden/.test(component), true, `${componentFile}: decorative icons are hidden from AT`)
}

assert.match(board_, /Riders waiting/, 'the rider count is labelled in text')
assert.match(board_, /Driver offers/, 'the driver count is labelled in text')
assert.match(board_, /scope="col"/, 'the count columns are headed, not loose digits')
assert.match(board_, /You are here/, 'the pinned row is marked in text, not only by a highlight')
assert.match(board_, /Quiet right now/, '§10 empty state: a measured zero says so')
assert.match(board_, /not switched on yet/, '§10: and is distinguishable from an unmeasured one')
assert.match(panel, /aria-labelledby="check-in-status-heading"/)

console.log('dashboard-fast-board: ok')

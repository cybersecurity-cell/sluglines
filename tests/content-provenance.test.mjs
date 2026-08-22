// Content provenance for location facts — issue #36.
//
// `src/lib/domain/locations.ts` publishes peakHours, parking, linesFrom/linesTo
// and description for 50 spots, all of it sourced from a WordPress site whose own
// content is years stale, and the app rendered every claim with identical
// authority. A commuter reading "peak hours 5:30–9:00" could not tell whether
// that was confirmed last month or scraped from a 2018 post.
//
// That is the same class of problem this repo already solves elsewhere — null
// coordinates are never guessed (D-31), counts render `unavailable` rather than a
// fabricated zero (D-33) — and directory facts were the last surface with no
// honesty mechanism.
//
// What these assertions defend is the honest DEFAULT. The failure mode worth a
// gate is not a missing field; it is someone marking records `verified` in bulk
// to clear the badge off the pages, which would restore the exact problem while
// looking like progress.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  SPOT_LOCATIONS,
  needsFreshnessQualifier,
} from '../src/lib/domain/locations.ts'
import { publicLocationFromDirectory } from '../src/lib/domain/public-location.ts'

const STATES = ['verified', 'community-reported', 'needs-review', 'historical']

// --- every record declares one, and it is a real state ----------------------
// Required rather than optional on purpose: an unstated provenance renders as
// confidence the record has not earned.
for (const spot of SPOT_LOCATIONS) {
  assert.ok(spot.provenance, `${spot.slug}: must declare provenance`)
  assert.ok(
    STATES.includes(spot.provenance.state),
    `${spot.slug}: provenance.state must be one of ${STATES.join(', ')}`
  )
  assert.ok(
    typeof spot.provenance.source === 'string' && spot.provenance.source.length > 0,
    `${spot.slug}: provenance must name a source`
  )
}

// --- nothing claims `verified` without a check date -------------------------
// `verified` is the only state that suppresses the qualifier on the page, so it
// is the only one worth guarding. A verified fact with no date of verification is
// the claim this model exists to stop.
for (const spot of SPOT_LOCATIONS) {
  if (spot.provenance.state === 'verified') {
    assert.ok(
      spot.provenance.checkedAt,
      `${spot.slug}: 'verified' requires checkedAt — a confirmation with no date is not one`
    )
    assert.match(
      spot.provenance.checkedAt,
      /^\d{4}-\d{2}-\d{2}$/,
      `${spot.slug}: checkedAt must be an ISO date`
    )
  }
}

// --- no record is back-dated to look attended to ----------------------------
// An import is not a check. Any record carrying `checkedAt` must have earned it,
// so a bulk back-fill with the migration date fails here.
const MIGRATION_DATE = '2026-08-22'
for (const spot of SPOT_LOCATIONS) {
  if (spot.provenance.checkedAt === MIGRATION_DATE && spot.provenance.state === 'needs-review') {
    assert.fail(
      `${spot.slug}: checkedAt is the import date on an unreviewed record. ` +
        'An import is not a check; leave checkedAt absent until someone looks.'
    )
  }
}

// --- the current, honest state of the directory -----------------------------
// Every spot is unreviewed today, and that is the true answer rather than a gap:
// nothing here has been checked against a primary source. If this ever changes,
// this assertion should be updated by the change that did the verifying — which
// is the point of failing here.
const unreviewed = SPOT_LOCATIONS.filter((s) => s.provenance.state === 'needs-review')
assert.equal(
  unreviewed.length,
  SPOT_LOCATIONS.length,
  'all 50 spots are needs-review today; update this with the change that verifies some'
)

// --- the qualifier renders for exactly the states that need it --------------
assert.equal(needsFreshnessQualifier({ provenance: { state: 'verified', source: 'x' } }), false)
for (const state of ['needs-review', 'community-reported', 'historical']) {
  assert.equal(
    needsFreshnessQualifier({ provenance: { state, source: 'x' } }),
    true,
    `${state} must carry a qualifier`
  )
}

// --- both mappings agree, as they must for image (D-39's precedent) ---------
// Provenance is deliberately not a `locations` column, so a database row resolves
// it from the committed directory. The two mappings must not disagree.
const sample = SPOT_LOCATIONS[0]
assert.deepEqual(
  publicLocationFromDirectory(sample).provenance,
  sample.provenance,
  'the directory mapping passes provenance through unchanged'
)

// --- the UI qualifies the facts, and only where it should -------------------
const quickFacts = fs.readFileSync(
  path.join(process.cwd(), 'src/components/SpotQuickFacts.tsx'),
  'utf8'
)
assert.match(quickFacts, /FreshnessNote/, 'the quick-facts card renders the qualifier')
assert.match(
  quickFacts,
  /state === 'verified'\) return null/,
  'a verified record renders no badge — silence is what makes the badge mean something'
)

console.log(
  `content provenance: ${SPOT_LOCATIONS.length} spots, ${unreviewed.length} needs-review, ` +
    '0 verified without a check date'
)

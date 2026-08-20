import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { directionLabel, formatFreshness, projectLocation } from '../src/lib/domain/location.ts'

const now = new Date('2026-06-21T12:00:00.000Z')

describe('location domain', () => {
  it('formats verified and stale review states', () => {
    assert.deepEqual(formatFreshness('2026-06-01T12:00:00.000Z', 'verified', now), { label: 'Verified', tone: 'verified', detail: 'Reviewed 20 days ago' })
    assert.deepEqual(formatFreshness('2026-01-01T12:00:00.000Z', 'verified', now), { label: 'Review recommended', tone: 'review', detail: 'Last reviewed January 1, 2026' })
  })

  it('preserves non-verified provenance labels', () => {
    assert.equal(formatFreshness('2026-06-20T12:00:00.000Z', 'community_reported', now).label, 'Community reported')
    assert.equal(formatFreshness('2026-06-20T12:00:00.000Z', 'historical', now).label, 'Historical reference')
    assert.deepEqual(formatFreshness(null, 'review_needed', now), { label: 'Needs review', tone: 'review', detail: 'No current verification date' })
  })

  it('uses commuter-friendly direction labels without encoding defects', () => {
    assert.equal(directionLabel('inbound'), 'Morning · toward DC and Arlington')
    assert.equal(directionLabel('outbound'), 'Afternoon · toward Northern Virginia')
    assert.equal(directionLabel('both'), 'Morning and afternoon')
  })

  it('projects safe public fields and sorted unique destinations', () => {
    const result = projectLocation({
      id: 'location-id', slug: 'horner-road', name: 'Horner Road', corridor: 'I-95/I-395', direction: 'inbound',
      address: 'Horner Road and Telegraph Road area', municipality: 'Woodbridge', parking_details: 'Use designated commuter parking.',
      transit_details: 'Check current operator schedules.', operating_notes: 'Confirm the active queue.', status: 'review_needed',
      verification_status: 'review_needed', last_verified_at: null, published: true,
      source: { name: 'Community archive', url: 'https://example.test/source', source_type: 'historical' },
      routes: [
        { direction: 'inbound', destination: { slug: 'rosslyn', name: 'Rosslyn' }, verification_status: 'historical', last_verified_at: null, source: { name: 'Archive', url: 'https://example.test/archive', source_type: 'historical' } },
        { direction: 'inbound', destination: { slug: 'pentagon', name: 'Pentagon' }, verification_status: 'review_needed', last_verified_at: null, source: { name: 'Archive', url: 'https://example.test/archive', source_type: 'historical' } },
        { direction: 'inbound', destination: { slug: 'pentagon', name: 'Pentagon' }, verification_status: 'review_needed', last_verified_at: null, source: { name: 'Archive', url: 'https://example.test/archive', source_type: 'historical' } },
      ],
    }, now)

    assert.deepEqual(result.destinationNames, ['Pentagon', 'Rosslyn'])
    assert.deepEqual(result.routes.map((route) => ({ destination: route.destinationName, status: route.freshness.label })), [
      { destination: 'Pentagon', status: 'Needs review' },
      { destination: 'Rosslyn', status: 'Historical reference' },
    ])
    assert.equal(result.directionLabel, 'Morning · toward DC and Arlington')
    assert.equal(result.freshness.label, 'Needs review')
    assert.equal(Object.hasOwn(result, 'published'), false)
  })
})

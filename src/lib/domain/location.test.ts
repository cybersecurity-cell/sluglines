import { describe, expect, it } from 'vitest'

import {
  directionLabel,
  formatFreshness,
  projectLocation,
  type LocationRow,
} from './location'

const now = new Date('2026-06-21T12:00:00.000Z')

describe('formatFreshness', () => {
  it('labels a recently verified record as verified', () => {
    expect(formatFreshness('2026-06-01T12:00:00.000Z', 'verified', now)).toEqual({
      label: 'Verified',
      tone: 'verified',
      detail: 'Reviewed 20 days ago',
    })
  })

  it('recommends review when verification is older than 90 days', () => {
    expect(formatFreshness('2026-01-01T12:00:00.000Z', 'verified', now)).toEqual({
      label: 'Review recommended',
      tone: 'review',
      detail: 'Last reviewed January 1, 2026',
    })
  })

  it('never upgrades community or historical material to verified', () => {
    expect(formatFreshness('2026-06-20T12:00:00.000Z', 'community_reported', now).label).toBe(
      'Community reported',
    )
    expect(formatFreshness('2026-06-20T12:00:00.000Z', 'historical', now).label).toBe(
      'Historical reference',
    )
  })

  it('labels records without a review date as needing review', () => {
    expect(formatFreshness(null, 'review_needed', now)).toEqual({
      label: 'Needs review',
      tone: 'review',
      detail: 'No current verification date',
    })
  })
})

describe('location presentation', () => {
  it('uses commuter-friendly direction labels', () => {
    expect(directionLabel('inbound')).toBe('Morning · toward DC and Arlington')
    expect(directionLabel('outbound')).toBe('Afternoon · toward Northern Virginia')
    expect(directionLabel('both')).toBe('Morning and afternoon')
  })

  it('projects only public location fields', () => {
    const row: LocationRow = {
      id: 'location-id',
      slug: 'horner-road',
      name: 'Horner Road',
      corridor: 'I-95/I-395',
      direction: 'inbound',
      address: 'Horner Road and Telegraph Road area',
      municipality: 'Woodbridge',
      parking_details: 'Use designated commuter parking.',
      transit_details: 'Check current operator schedules.',
      operating_notes: 'Confirm the active queue.',
      status: 'review_needed',
      verification_status: 'review_needed',
      last_verified_at: null,
      published: true,
      source: {
        name: 'Community archive',
        url: 'https://example.test/source',
        source_type: 'historical',
      },
      routes: [
        {
          direction: 'inbound',
          verification_status: 'review_needed',
          last_verified_at: null,
          source: {
            name: 'Community archive',
            url: 'https://example.test/source',
            source_type: 'historical',
          },
          destination: { slug: 'pentagon', name: 'Pentagon' },
        },
      ],
    }

    expect(projectLocation(row, now)).toMatchObject({
      slug: 'horner-road',
      name: 'Horner Road',
      directionLabel: 'Morning · toward DC and Arlington',
      destinationNames: ['Pentagon'],
      routes: [{ destinationName: 'Pentagon', freshness: { label: 'Needs review' } }],
      freshness: { label: 'Needs review' },
      source: { name: 'Community archive', url: 'https://example.test/source' },
    })
    expect(projectLocation(row, now)).not.toHaveProperty('published')
  })
})

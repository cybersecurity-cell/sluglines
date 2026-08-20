import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createLocationRepository, DataAccessError } from '../src/lib/data/locations.ts'

const rows = [
  {
    id: '1', slug: 'rosslyn', name: 'Rosslyn', corridor: 'I-66', direction: 'outbound',
    address: null, municipality: 'Arlington', parking_details: null, transit_details: null,
    operating_notes: null, status: 'review_needed', verification_status: 'historical',
    last_verified_at: null, published: true,
    source: { name: 'Archive', url: 'https://example.test/archive', source_type: 'historical' },
    routes: [{ direction: 'outbound', destination: { slug: 'horner-road', name: 'Horner Road' } }],
  },
  {
    id: '2', slug: 'horner-road', name: 'Horner Road', corridor: 'I-95/I-395', direction: 'inbound',
    address: 'Telegraph Road', municipality: 'Woodbridge', parking_details: null,
    transit_details: null, operating_notes: null, status: 'active',
    verification_status: 'verified', last_verified_at: '2026-06-01T12:00:00.000Z', published: true,
    source: { name: 'VDOT', url: 'https://example.test/vdot', source_type: 'official' },
    routes: [
      { direction: 'inbound', destination: { slug: 'pentagon', name: 'Pentagon' } },
      { direction: 'inbound', destination: { slug: 'crystal-city', name: 'Crystal City' } },
    ],
  },
]

const now = new Date('2026-06-21T12:00:00.000Z')

describe('location repository', () => {
  it('filters by corridor, direction, destination, and free text', async () => {
    const repository = createLocationRepository({
      fetchAll: async () => rows,
      fetchBySlug: async () => null,
    }, now)

    assert.deepEqual((await repository.list({ corridor: 'I-95/I-395' })).map((item) => item.slug), ['horner-road'])
    assert.deepEqual((await repository.list({ direction: 'outbound' })).map((item) => item.slug), ['rosslyn'])
    assert.deepEqual((await repository.list({ destination: 'pentagon' })).map((item) => item.slug), ['horner-road'])
    assert.deepEqual((await repository.list({ query: 'woodbridge' })).map((item) => item.slug), ['horner-road'])
  })

  it('sorts active and verified locations before review-needed locations', async () => {
    const repository = createLocationRepository({
      fetchAll: async () => rows,
      fetchBySlug: async () => null,
    }, now)
    assert.deepEqual((await repository.list()).map((item) => item.slug), ['horner-road', 'rosslyn'])
  })

  it('returns null for an unknown slug', async () => {
    const repository = createLocationRepository({
      fetchAll: async () => rows,
      fetchBySlug: async () => null,
    }, now)
    assert.equal(await repository.getBySlug('missing'), null)
  })

  it('normalizes source failures without leaking provider details', async () => {
    const repository = createLocationRepository({
      fetchAll: async () => { throw new Error('postgres connection string') },
      fetchBySlug: async () => null,
    }, now)

    await assert.rejects(repository.list(), (error) => {
      assert.ok(error instanceof DataAccessError)
      assert.equal(error.message, 'Location information is temporarily unavailable.')
      assert.equal(error.cause instanceof Error, true)
      return true
    })
  })
})

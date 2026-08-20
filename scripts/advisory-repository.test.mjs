import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAdvisoryRepository } from '../src/lib/data/advisories.ts'
import { DataAccessError } from '../src/lib/data/locations.ts'

const now = new Date('2026-06-21T12:00:00.000Z')
const base = {
  location_id: 'location-1',
  status: 'published',
  starts_at: null,
  ends_at: null,
  verification_status: 'verified',
  last_verified_at: '2026-06-20T12:00:00.000Z',
  source: { name: 'Operator', url: 'https://example.test', source_type: 'operator' },
  location: { slug: 'horner-road', name: 'Horner Road' },
}

describe('advisory repository', () => {
  it('returns active advisories ordered by severity', async () => {
    const repository = createAdvisoryRepository({ fetchAll: async () => [
      { ...base, id: 'info', title: 'Information', message: 'Note', severity: 'info', published_at: '2026-06-21T10:00:00.000Z' },
      { ...base, id: 'urgent', title: 'Closure', message: 'Avoid area', severity: 'urgent', published_at: '2026-06-21T09:00:00.000Z' },
    ] }, now)

    assert.deepEqual((await repository.list()).map((item) => item.id), ['urgent', 'info'])
  })

  it('can narrow advisories to one location', async () => {
    const repository = createAdvisoryRepository({ fetchAll: async () => [
      { ...base, id: 'one', title: 'One', message: 'Note', severity: 'info', published_at: null },
      { ...base, id: 'two', location_id: 'location-2', title: 'Two', message: 'Note', severity: 'warning', published_at: null },
    ] }, now)

    assert.deepEqual((await repository.list('location-1')).map((item) => item.id), ['one'])
  })

  it('normalizes provider failures', async () => {
    const repository = createAdvisoryRepository({ fetchAll: async () => { throw new Error('private provider detail') } }, now)
    await assert.rejects(repository.list(), (error) => error instanceof DataAccessError && error.message === 'Advisories are temporarily unavailable.')
  })
})

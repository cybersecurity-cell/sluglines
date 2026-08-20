import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { activeAdvisories, projectAdvisory } from '../src/lib/domain/advisory.ts'

const now = new Date('2026-06-21T12:00:00.000Z')

const base = {
  id: '1', location_id: null, title: 'Service notice', message: 'Check posted signs before travelling.',
  severity: 'info', status: 'published', starts_at: null, ends_at: null,
  published_at: '2026-06-20T12:00:00.000Z', verification_status: 'verified',
  last_verified_at: '2026-06-20T12:00:00.000Z',
  source: { name: 'Operator', url: 'https://example.test/notice', source_type: 'operator' },
  location: null,
}

describe('advisories', () => {
  it('excludes draft, future, and expired records', () => {
    const records = [
      base,
      { ...base, id: 'draft', status: 'draft' },
      { ...base, id: 'future', starts_at: '2026-06-22T12:00:00.000Z' },
      { ...base, id: 'expired', ends_at: '2026-06-21T11:59:59.000Z' },
    ]
    assert.deepEqual(activeAdvisories(records, now).map((item) => item.id), ['1'])
  })

  it('orders urgent and warning notices before information', () => {
    const records = [
      base,
      { ...base, id: 'urgent', severity: 'urgent' },
      { ...base, id: 'warning', severity: 'warning' },
    ]
    assert.deepEqual(activeAdvisories(records, now).map((item) => item.id), ['urgent', 'warning', '1'])
  })

  it('projects source and location without publication internals', () => {
    const result = projectAdvisory({
      ...base,
      location: { slug: 'horner-road', name: 'Horner Road' },
    }, now)
    assert.deepEqual(result.location, { slug: 'horner-road', name: 'Horner Road' })
    assert.deepEqual(result.source, { name: 'Operator', url: 'https://example.test/notice' })
    assert.equal(result.freshness.label, 'Verified')
    assert.equal(Object.hasOwn(result, 'status'), false)
  })

  it('drops source links that are not secure HTTPS URLs', () => {
    const result = projectAdvisory({ ...base, source: { ...base.source, url: 'javascript:alert(1)' } }, now)
    assert.equal(result.source, null)
  })
})

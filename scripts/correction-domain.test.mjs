import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCorrectionReport } from '../src/lib/domain/correction-report.ts'

describe('validateCorrectionReport', () => {
  it('normalizes a valid report', () => {
    assert.deepEqual(
      validateCorrectionReport({
        category: 'schedule',
        summary: '  Morning line starts farther east ',
        details: '  The temporary signs direct riders to the next marked curb area. ',
        sourceUrl: ' https://example.test/current-notice ',
        locationId: '30000000-0000-4000-8000-000000000001',
        website: '',
      }),
      {
        ok: true,
        value: {
          category: 'schedule',
          summary: 'Morning line starts farther east',
          details: 'The temporary signs direct riders to the next marked curb area.',
          sourceUrl: 'https://example.test/current-notice',
          locationId: '30000000-0000-4000-8000-000000000001',
        },
      },
    )
  })

  it('rejects bots through the honeypot', () => {
    const result = validateCorrectionReport({
      category: 'other', summary: 'A long enough summary', details: 'A detailed report with enough useful context.',
      website: 'spam.example',
    })
    assert.deepEqual(result, { ok: false, errors: { form: 'Unable to submit this report.' } })
  })

  it('rejects invalid categories, lengths, identifiers, and non-HTTPS sources', () => {
    const result = validateCorrectionReport({
      category: 'admin', summary: 'short', details: 'too short', sourceUrl: 'http://example.test',
      locationId: 'not-a-uuid', website: '',
    })
    assert.equal(result.ok, false)
    assert.deepEqual(result.errors, {
      category: 'Choose a report category.',
      summary: 'Use between 10 and 160 characters.',
      details: 'Use between 20 and 3000 characters.',
      sourceUrl: 'Use a secure HTTPS link.',
      locationId: 'Choose a valid location.',
    })
  })
})

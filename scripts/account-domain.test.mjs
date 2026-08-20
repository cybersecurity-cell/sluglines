import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCommutePreferences, validateProfile } from '../src/lib/account/validation.ts'

describe('account validation', () => {
  it('normalizes a profile update', () => {
    assert.deepEqual(validateProfile({ displayName: '  Alex Rider ' }), {
      ok: true,
      value: { displayName: 'Alex Rider' },
    })
  })

  it('rejects an invalid display name', () => {
    assert.deepEqual(validateProfile({ displayName: 'x' }), {
      ok: false,
      errors: { displayName: 'Use between 2 and 80 characters.' },
    })
  })

  it('normalizes commute preferences', () => {
    assert.deepEqual(validateCommutePreferences({
      homeLocationId: '30000000-0000-4000-8000-000000000001',
      destinationId: '20000000-0000-4000-8000-000000000001',
      preferredDirection: 'inbound',
      emailAdvisories: 'on',
    }), {
      ok: true,
      value: {
        homeLocationId: '30000000-0000-4000-8000-000000000001',
        destinationId: '20000000-0000-4000-8000-000000000001',
        preferredDirection: 'inbound',
        emailAdvisories: true,
      },
    })
  })

  it('rejects invalid preference identifiers and direction', () => {
    assert.deepEqual(validateCommutePreferences({
      homeLocationId: 'bad', destinationId: 'bad', preferredDirection: 'sideways', emailAdvisories: false,
    }), {
      ok: false,
      errors: {
        homeLocationId: 'Choose a valid home location.',
        destinationId: 'Choose a valid destination.',
        preferredDirection: 'Choose a commute direction.',
      },
    })
  })
})

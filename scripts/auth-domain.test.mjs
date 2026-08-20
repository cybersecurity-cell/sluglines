import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { safeRedirectPath, validateSignUp } from '../src/lib/auth/validation.ts'

describe('safeRedirectPath', () => {
  it('keeps same-origin application paths', () => {
    assert.equal(safeRedirectPath('/account?tab=saved#top'), '/account?tab=saved#top')
  })

  it('rejects absolute, protocol-relative, and backslash redirects', () => {
    for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '\\evil.test', 'javascript:alert(1)']) {
      assert.equal(safeRedirectPath(value), '/account')
    }
  })

  it('uses a caller-provided fallback for missing values', () => {
    assert.equal(safeRedirectPath(null, '/locations'), '/locations')
  })
})

describe('validateSignUp', () => {
  it('normalizes a valid registration', () => {
    assert.deepEqual(
      validateSignUp({
        email: '  COMMUTER@Example.COM ',
        password: 'correct horse battery staple',
        displayName: '  Pat Commuter ',
      }),
      {
        ok: true,
        value: {
          email: 'commuter@example.com',
          password: 'correct horse battery staple',
          displayName: 'Pat Commuter',
        },
      },
    )
  })

  it('rejects invalid fields without echoing a password', () => {
    const result = validateSignUp({ email: 'bad', password: 'short', displayName: 'x' })
    assert.equal(result.ok, false)
    assert.deepEqual(result.errors, {
      email: 'Enter a valid email address.',
      password: 'Use at least 12 characters.',
      displayName: 'Use between 2 and 80 characters.',
    })
    assert.equal(JSON.stringify(result).includes('short'), false)
  })
})

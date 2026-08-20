import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAuthService } from '../src/lib/auth/service.ts'

function gateway(overrides = {}) {
  return {
    signUp: async () => ({ error: null }),
    signInWithPassword: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    updatePassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    ...overrides,
  }
}

describe('auth service', () => {
  it('registers with a verified callback and normalized profile metadata', async () => {
    let request
    const service = createAuthService(gateway({ signUp: async (value) => { request = value; return { error: null } } }))
    const result = await service.register({
      email: ' COMMUTER@example.com ', password: 'correct horse battery staple', displayName: ' Pat ',
    }, 'https://sluglines.example')

    assert.deepEqual(result, {
      ok: true,
      message: 'Check your email to verify your account.',
    })
    assert.deepEqual(request, {
      email: 'commuter@example.com',
      password: 'correct horse battery staple',
      displayName: 'Pat',
      emailRedirectTo: 'https://sluglines.example/auth/callback?next=%2Faccount',
    })
  })

  it('returns generic credentials errors without leaking provider details', async () => {
    const service = createAuthService(gateway({
      signInWithPassword: async () => ({ error: new Error('user does not exist') }),
    }))
    assert.deepEqual(await service.signIn('person@example.com', 'incorrect password', '/account'), {
      ok: false,
      message: 'Email or password is incorrect.',
    })
  })

  it('sanitizes the post-login redirect', async () => {
    const service = createAuthService(gateway())
    assert.deepEqual(await service.signIn('person@example.com', 'valid password', '//evil.test'), {
      ok: true,
      redirectTo: '/account',
    })
  })

  it('uses a non-enumerating response for password reset requests', async () => {
    const service = createAuthService(gateway({
      resetPasswordForEmail: async () => ({ error: new Error('unknown account') }),
    }))
    assert.deepEqual(await service.requestPasswordReset('unknown@example.com', 'https://sluglines.example'), {
      ok: true,
      message: 'If that address has an account, a reset link is on its way.',
    })
  })
})

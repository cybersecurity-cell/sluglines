import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AuthForm } from '../src/components/auth/AuthForm.tsx'

describe('authentication forms', () => {
  it('renders accessible sign-up fields with password-manager hints', () => {
    const html = renderToStaticMarkup(<AuthForm action="/auth" mode="sign-up" />)
    assert.match(html, /for="display-name"/)
    assert.match(html, /auto[Cc]omplete="name"/)
    assert.match(html, /auto[Cc]omplete="email"/)
    assert.match(html, /auto[Cc]omplete="new-password"/)
    assert.match(html, /Create account/)
  })

  it('renders generic errors without echoing credentials', () => {
    const html = renderToStaticMarkup(<AuthForm action="/auth" message="Email or password is incorrect." mode="sign-in" />)
    assert.match(html, /role="alert"/)
    assert.match(html, /Email or password is incorrect/)
    assert.match(html, /Forgot your password/)
  })
})

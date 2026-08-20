import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import HowItWorksPage from '../src/app/how-it-works/page.tsx'
import SafetyPage from '../src/app/slugging-rules/page.tsx'

describe('guidance pages', () => {
  it('explains slugging without unsupported schedules or safety claims', () => {
    const html = renderToStaticMarkup(<HowItWorksPage />)
    assert.match(html, /Confirm the destination/)
    assert.doesNotMatch(html, /excellent safety record/i)
    assert.doesNotMatch(html, /6-9 AM/)
  })

  it('makes personal choice and emergency boundaries explicit', () => {
    const html = renderToStaticMarkup(<SafetyPage />)
    assert.match(html, /You can decline any ride/)
    assert.match(html, /call 911/)
    assert.match(html, /not emergency services/)
  })
})

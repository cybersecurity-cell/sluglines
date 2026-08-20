import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { CorrectionReportForm } from '../src/components/CorrectionReportForm.tsx'

describe('correction report form', () => {
  it('labels required evidence fields and includes a hidden bot trap', () => {
    const html = renderToStaticMarkup(<CorrectionReportForm action="/report" locations={[{ id: 'l1', name: 'Horner Road' }]} />)
    assert.match(html, /for="report-category"/)
    assert.match(html, /for="report-summary"/)
    assert.match(html, /for="report-details"/)
    assert.match(html, /name="website"/)
    assert.match(html, /Report a correction/)
  })
})

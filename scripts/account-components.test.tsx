import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { PreferencesForm } from '../src/components/account/PreferencesForm.tsx'
import { ProfileForm } from '../src/components/account/ProfileForm.tsx'
import { SavedLocations } from '../src/components/account/SavedLocations.tsx'

const action = '/account'

describe('account components', () => {
  it('labels the profile and commute-preference controls', () => {
    const profile = renderToStaticMarkup(<ProfileForm action={action} displayName="Pat" />)
    assert.match(profile, /for="profile-display-name"/)
    assert.match(profile, /Save profile/)

    const preferences = renderToStaticMarkup(<PreferencesForm action={action} destinations={[{ id: 'd1', name: 'Pentagon' }]} locations={[{ id: 'l1', name: 'Horner Road' }]} value={{ destinationId: null, emailAdvisories: false, homeLocationId: null, preferredDirection: null }} />)
    assert.match(preferences, /for="home-location"/)
    assert.match(preferences, /for="preferred-destination"/)
    assert.match(preferences, /Email me about published advisories/)
  })

  it('renders saved locations and a useful empty state', () => {
    assert.match(renderToStaticMarkup(<SavedLocations action={action} locations={[]} />), /No saved locations yet/)
    const html = renderToStaticMarkup(<SavedLocations action={action} locations={[{ id: 'l1', name: 'Horner Road', slug: 'horner-road' }]} />)
    assert.match(html, /href="\/locations\/horner-road"/)
    assert.match(html, /Remove/)
  })
})

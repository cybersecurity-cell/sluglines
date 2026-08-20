import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import HomePage from '../src/app/page.tsx'
import RootLayout, { metadata } from '../src/app/layout.tsx'
import { AdvisoryCard } from '../src/components/AdvisoryCard.tsx'
import { AdvisoryList } from '../src/components/AdvisoryList.tsx'
import { LocationCard } from '../src/components/LocationCard.tsx'
import { LocationGrid } from '../src/components/LocationGrid.tsx'
import { LocationSearch } from '../src/components/LocationSearch.tsx'
import Navbar from '../src/components/Navbar.tsx'
import { RouteHero } from '../src/components/RouteHero.tsx'
import { SiteFooter } from '../src/components/SiteFooter.tsx'
import { VerificationBadge } from '../src/components/VerificationBadge.tsx'

const location = {
  id: '1',
  slug: 'horner-road',
  name: 'Horner Road',
  corridor: 'I-95/I-395' as const,
  direction: 'inbound' as const,
  directionLabel: 'Morning - toward DC and Arlington',
  address: 'Horner Road area',
  municipality: 'Woodbridge',
  parkingDetails: 'Use designated commuter parking.',
  transitDetails: null,
  operatingNotes: 'Confirm the active queue.',
  status: 'review_needed' as const,
  destinationNames: ['Pentagon'],
  routes: [{ destinationSlug: 'pentagon', destinationName: 'Pentagon', direction: 'inbound' as const, freshness: { label: 'Needs review', tone: 'review' as const, detail: 'No current verification date' }, source: { name: 'Community archive', url: 'https://example.test/source' } }],
  freshness: { label: 'Needs review', tone: 'review' as const, detail: 'No current verification date' },
  source: { name: 'Community archive', url: 'https://example.test/source' },
}

describe('public information components', () => {
  it('renders verification status as meaningful text', () => {
    const html = renderToStaticMarkup(<VerificationBadge freshness={location.freshness} />)
    assert.match(html, /Needs review/)
    assert.match(html, /No current verification date/)
  })

  it('renders a location as an accessible article with source context', () => {
    const html = renderToStaticMarkup(<LocationCard location={location} />)
    assert.match(html, /<article/)
    assert.match(html, /Horner Road/)
    assert.match(html, /Pentagon/)
    assert.match(html, /href="\/locations\/horner-road"/)
    assert.match(html, /Community archive/)
    assert.match(html, /Route source: Community archive/)
  })

  it('renders advisory severity, location, and source without relying on color alone', () => {
    const html = renderToStaticMarkup(<AdvisoryCard advisory={{
      id: 'a1',
      title: 'Queue moved',
      message: 'Follow current signs.',
      severity: 'warning',
      startsAt: null,
      endsAt: null,
      publishedAt: '2026-06-20T12:00:00.000Z',
      freshness: { label: 'Verified', tone: 'verified', detail: 'Reviewed 1 day ago' },
      source: { name: 'Operator', url: 'https://example.test/notice' },
      location: { slug: 'horner-road', name: 'Horner Road' },
    }} />)
    assert.match(html, />Warning</)
    assert.match(html, /Horner Road/)
    assert.match(html, /Operator/)
  })

  it('offers a keyboard-usable location search with labelled filters', () => {
    const html = renderToStaticMarkup(<LocationSearch />)
    assert.match(html, /<form/)
    assert.match(html, /for="location-query"/)
    assert.match(html, /name="query"/)
    assert.match(html, /name="corridor"/)
    assert.match(html, /Find locations/)
  })

  it('explains the information-first service without unsupported live claims', () => {
    const html = renderToStaticMarkup(<RouteHero />)
    assert.match(html, /Plan your slugging commute/)
    assert.match(html, /Find a line/)
    assert.doesNotMatch(html, /live rider/i)
  })

  it('renders complete footer navigation and correction access', () => {
    const html = renderToStaticMarkup(<SiteFooter />)
    assert.match(html, /href="\/report"/)
    assert.match(html, /href="\/community"/)
    assert.match(html, /Information changes/)
  })

  it('keeps the homepage information-first and avoids unsupported product promises', () => {
    const html = renderToStaticMarkup(<HomePage />)
    assert.match(html, /Plan your slugging commute/)
    assert.match(html, /Browse locations/)
    assert.doesNotMatch(html, /live board/i)
    assert.doesNotMatch(html, /mobile app/i)
    assert.doesNotMatch(html, /2,000\+/)
  })

  it('renders primary navigation with account access and a labelled mobile disclosure', () => {
    const html = renderToStaticMarkup(<Navbar />)
    assert.match(html, /aria-label="Primary"/)
    assert.match(html, /href="\/locations"/)
    assert.match(html, /href="\/auth\/sign-in"/)
    assert.match(html, /<summary[^>]*>Menu</)
  })

  it('provides a skip link, site footer, and accurate metadata', () => {
    const html = renderToStaticMarkup(<RootLayout><p>Page</p></RootLayout>)
    assert.match(html, /href="#main-content"/)
    assert.match(html, /Information changes/)
    assert.equal(metadata.title, 'Sluglines | Northern Virginia carpool information')
    assert.doesNotMatch(String(metadata.description), /real-time/i)
  })

  it('renders honest empty and unavailable location states', () => {
    assert.match(renderToStaticMarkup(<LocationGrid locations={[]} />), /No locations match/)
    assert.match(renderToStaticMarkup(<LocationGrid error="Location information is temporarily unavailable." locations={[]} />), /temporarily unavailable/)
  })

  it('distinguishes no advisories from an unavailable advisory service', () => {
    assert.match(renderToStaticMarkup(<AdvisoryList advisories={[]} />), /No active advisories/)
    assert.match(renderToStaticMarkup(<AdvisoryList advisories={[]} unavailable />), /temporarily unavailable/)
  })
})

import { strict as assert } from 'node:assert'
import {
  LEGACY_SITE_INVENTORY,
  getLegacyPageByPath,
  getLegacyStaticParams,
  getLegacyRouteForPath,
  isHandledLegacyInternalLink,
  normalizeLegacyPath,
} from '../src/lib/legacy-content.ts'

assert.equal(LEGACY_SITE_INVENTORY.source, 'https://sluglines.com')
assert.ok(LEGACY_SITE_INVENTORY.auditedAt)
assert.ok(LEGACY_SITE_INVENTORY.routes.length >= 160)

const routePaths = LEGACY_SITE_INVENTORY.routes.map((route) => route.path)

for (const expectedPath of [
  '/',
  '/about-slugging/',
  '/about-us/',
  '/app/',
  '/blog/',
  '/news/',
  '/slug_pickup/',
  '/slug_pickup/horner-rd/',
  '/slug_pickup/the-pentagon/',
  '/slugging-rules-and-etiquette/',
  '/new-sluglines-mobile-application-to-connect-commuters/',
]) {
  assert.ok(routePaths.includes(expectedPath), `Missing migrated route ${expectedPath}`)
}

const home = getLegacyPageByPath('/')
assert.ok(home)
assert.equal(home.seo.title, 'Sluglines - Connecting drivers and riders for better commute')
assert.equal(home.seo.description, 'Connecting drivers and riders for better commute')
assert.ok(home.headings.some((heading) => heading.text === 'What is Slugging?'))
assert.ok(home.bodyText.includes('Slugging is a unique form of carpooling'))
assert.ok(home.ctas.some((cta) => cta.text === 'SLUG PICKUP' && cta.href === '/slug_pickup/'))
assert.ok(home.assets.some((asset) => asset.includes('/wp-content/uploads/2014/03/img1-600x400-600x400.jpg')))
assert.ok(LEGACY_SITE_INVENTORY.footer.quickLinks.some((link) => link.text === 'Lost & Found'))
assert.ok(LEGACY_SITE_INVENTORY.footer.aboutLinks.some((link) => link.text === 'BLOG' && link.href === '/blog/'))
assert.ok(LEGACY_SITE_INVENTORY.footer.socialLinks.some((link) => link.text === 'Facebook'))

const aboutSlugging = getLegacyPageByPath('/about-slugging/')
assert.ok(aboutSlugging)
assert.ok(aboutSlugging.bodyText.includes('casual carpool'))
assert.ok(aboutSlugging.links.some((link) => link.text === 'Home' && link.href === '/'))

const petition = getLegacyPageByPath('/petition-form/')
assert.ok(petition)
assert.ok(petition.forms.length >= 1)

assert.ok(getLegacyStaticParams().some((params) => params.legacyPath.join('/') === 'slug_pickup/horner-rd'))

const unresolvedInternalLinks = []

for (const route of LEGACY_SITE_INVENTORY.routes) {
  for (const link of route.links) {
    if (!link.href.startsWith('/')) continue
    if (isHandledLegacyInternalLink(link.href)) continue

    const normalizedPath = normalizeLegacyPath(link.href)
    const linkedRoute = getLegacyRouteForPath(normalizedPath)

    if (!linkedRoute) {
      unresolvedInternalLinks.push(`${route.path} -> ${link.href} (${link.text})`)
    }
  }
}

assert.deepEqual(unresolvedInternalLinks.slice(0, 20), [])

// The §8 M1 legacy URL policy, checked against the committed 165-route
// inventory — rev. 5.3 §12 P1 measurement: "165/165 inventory routes return
// exactly the mapped status and target".
//
// This asserts the *decision*, not the transport: `classifyLegacyPath` is what
// `src/middleware.ts` applies, and it is pure, so every inventory route can be
// classified here without a server. The transport is one `NextResponse` call
// per branch and is asserted structurally at the bottom.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  GONE,
  GONE_PATH,
  LOSTFOUND_PATH,
  MOVED_PERMANENTLY,
  classifyLegacyPath,
  normalizeRedirectPath,
} from '../src/lib/legacy-redirects.ts'
import { GONE_CONTRAST_PAIRS, renderGonePage, sanitizeRequestedPath } from '../src/lib/gone-page.ts'
import { SPOT_LOCATIONS } from '../src/lib/domain/locations.ts'
import { LEGACY_SITE_INVENTORY, getLegacyRouteForPath } from '../src/lib/legacy-content.ts'

const root = process.cwd()

// --- path normalisation -----------------------------------------------------

assert.equal(normalizeRedirectPath('/Forum/Topic'), '/forum/topic/')
assert.equal(normalizeRedirectPath('/forum/?page=2'), '/forum/')
assert.equal(normalizeRedirectPath('forum'), '/forum/')
assert.equal(normalizeRedirectPath('/wp-login.php?redirect_to=/forum/'), '/wp-login.php')
assert.equal(normalizeRedirectPath('/'), '/')

// --- forum: 301 for what survived, 410 for what did not ---------------------

// §3.1: forum topics are not migrated; Lost & Found is the exception and the
// landing target of the traffic.
for (const survives of [
  '/forum/',
  '/FORUM/',
  '/forum/lost-and-found/',
  '/forum/lost-found/lost-keys-at-horner/',
  '/forum/topic/lost-and-found-umbrella/',
  '/forum/forum/lost-items/',
]) {
  const disposition = classifyLegacyPath(survives)
  assert.equal(disposition.kind, 'redirect', `${survives} must redirect`)
  assert.equal(disposition.status, MOVED_PERMANENTLY, `${survives} must be a 301`)
  assert.equal(disposition.target, LOSTFOUND_PATH, `${survives} must land on the board`)
}

for (const gone of [
  '/forum/topic/hov-lane-changes-2016/',
  // "found" in a sentence is not a Lost & Found board. The 301 keys on the
  // board marker, because guessing from topic titles would send "found a new
  // route to the Pentagon" to a lost-property board.
  '/forum/topic/found-a-new-route-to-the-pentagon/',
  '/forum/forum/general-discussion/',
  '/forum/users/someone/',
  '/participant/someone/',
  '/sign-in/',
  '/wp-login.php',
]) {
  const disposition = classifyLegacyPath(gone)
  assert.equal(disposition.kind, 'gone', `${gone} must be gone`)
  assert.equal(disposition.status, GONE, `${gone} must be a 410, not a 404`)
}

// --- the 43 legacy spot pages become 43 live landing pages (§9) -------------

const legacySpotPaths = LEGACY_SITE_INVENTORY.routes
  .map((route) => route.path)
  .filter((routePath) => /^\/slug_pickup\/[^/]+\/$/.test(routePath))

// 42, not 43: the inventory's `slugPickupPages: 43` counts the `/slug_pickup/`
// index alongside the spot pages (tests/spot-locations-directory.test.mjs
// records the same arithmetic).
assert.equal(legacySpotPaths.length, 42, 'the inventory is the source of truth for the spot pages')

const routeSlugBySlug = new Map(SPOT_LOCATIONS.map((location) => [location.slug, location.routeSlug]))

for (const legacyPath of legacySpotPaths) {
  const slug = legacyPath.split('/').filter(Boolean)[1]
  const disposition = classifyLegacyPath(legacyPath)

  assert.equal(disposition.kind, 'redirect', `${legacyPath} must 301, not 410`)
  assert.equal(disposition.status, MOVED_PERMANENTLY)
  assert.equal(
    disposition.target,
    `/spots/${routeSlugBySlug.get(slug)}`,
    `${legacyPath} must land on its own spot page`
  )
}

// The `/slug-pickup/` hyphen alias the legacy links used resolves the same way.
assert.equal(classifyLegacyPath('/slug-pickup/horner-rd/').target, '/spots/Horner-Rd')
// The index is a live search page in this app, not a legacy artefact.
assert.equal(classifyLegacyPath('/slug_pickup/').kind, 'render')
// A spot page for a spot that is not in the directory is dead, not a 404.
assert.equal(classifyLegacyPath('/slug_pickup/a-spot-that-never-existed/').kind, 'gone')

// --- blog/news aliases collapse onto the canonical post path ----------------

assert.deepEqual(classifyLegacyPath('/blog/expansion-of-i-66/'), {
  kind: 'redirect',
  status: MOVED_PERMANENTLY,
  target: '/expansion-of-i-66/',
  reason: 'legacy-post-alias',
})
assert.equal(classifyLegacyPath('/news/extended-slugging-hours/').target, '/extended-slugging-hours/')
// The indexes themselves are real pages here (tests/public-route-files.test.mjs).
assert.equal(classifyLegacyPath('/blog/').kind, 'render')
assert.equal(classifyLegacyPath('/news/').kind, 'render')

// Every alias target must be a path this app actually answers, or the 301 lands
// on a 404 — which is worse than the duplicate content it removes. The test for
// "answers" is the catch-all's own resolver, not the raw inventory: nested
// attachment paths are generated routes, served but not listed.
let checkedAliases = 0

for (const route of LEGACY_SITE_INVENTORY.routes) {
  for (const link of route.links) {
    if (!/^\/(blog|news)\/[^/]/.test(link.href)) continue

    const disposition = classifyLegacyPath(link.href)
    assert.equal(disposition.kind, 'redirect', `${link.href} must redirect`)
    assert.ok(
      getLegacyRouteForPath(disposition.target),
      `${link.href} -> ${disposition.target} is not a route this app serves`
    )
    checkedAliases += 1
  }
}

assert.equal(checkedAliases > 0, true, 'the inventory must contain blog/news aliases to check')

// --- all 165 inventory routes are classified, and only as intended ----------

const byKind = { render: [], redirect: [], gone: [] }

for (const route of LEGACY_SITE_INVENTORY.routes) {
  const disposition = classifyLegacyPath(route.path)
  byKind[disposition.kind].push(route.path)

  if (disposition.kind === 'redirect') {
    assert.equal(disposition.status, MOVED_PERMANENTLY, `${route.path}: only 301s are issued`)
    assert.equal(disposition.target.startsWith('/'), true, `${route.path}: target must be site-relative`)
    assert.notEqual(disposition.target, route.path, `${route.path}: a redirect to itself is a loop`)
  }
}

assert.equal(
  byKind.render.length + byKind.redirect.length + byKind.gone.length,
  165,
  'every inventory route has exactly one disposition'
)

// The forum root is the only inventory route that is redirected off the forum,
// because the topic URLs were never in the inventory — they are the generated
// paths covered above.
assert.deepEqual(byKind.gone, [], 'no page in the inventory is 410ed today')
assert.deepEqual(
  byKind.redirect.filter((routePath) => !routePath.startsWith('/slug_pickup/')),
  ['/forum/']
)
assert.equal(byKind.redirect.length, 43, '42 legacy spot pages + the forum root')

// A redirect must not be issued for a path this app renders as a real page.
for (const appRoute of ['/', '/spots/', '/lostfound/', '/how-it-works/', '/about-us/', '/blog/', '/news/', '/slug_pickup/']) {
  assert.equal(classifyLegacyPath(appRoute).kind, 'render', `${appRoute} is a live page`)
}

// --- the branded 410 document ----------------------------------------------

const gonePage = renderGonePage('/forum/topic/hov-lane-changes-2016/')

assert.match(gonePage, /<a class="primary" href="\/spots">/, '§8: the gone page links to /spots')
assert.match(gonePage, /<a class="secondary" href="\/lostfound">/, '§8: and to /lostfound')
assert.match(gonePage, /<code>\/forum\/topic\/hov-lane-changes-2016\/<\/code>/)
assert.match(gonePage, /name="robots" content="noindex"/)

// The requested path arrives from the URL, so it is untrusted input echoed into
// HTML. Both halves are asserted: what is rejected, and what is escaped.
assert.equal(sanitizeRequestedPath('//evil.example.com/'), undefined, 'protocol-relative is not a path')
assert.equal(sanitizeRequestedPath('https://evil.example.com/'), undefined)
assert.equal(sanitizeRequestedPath('/'), undefined)
assert.equal(sanitizeRequestedPath(null), undefined)
assert.equal(sanitizeRequestedPath(`/${'x'.repeat(400)}`), undefined)
assert.equal(sanitizeRequestedPath('/forum/x/?a=1#b'), '/forum/x/')

const injected = renderGonePage('/forum/<script>alert(1)</script>/')
assert.equal(injected.includes('<script>alert(1)</script>'), false, 'no unescaped markup from the URL')
assert.match(injected, /&lt;script&gt;/)

// AA contrast for every pair the document paints. It is outside the design
// system (a Route Handler cannot reach the Tailwind bundle), so nothing else
// would catch these drifting.
function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left
  )

  return (lighter + 0.05) / (darker + 0.05)
}

// Sanity-check the checker before trusting it: black on white is 21:1.
assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21)

for (const pair of GONE_CONTRAST_PAIRS) {
  const ratio = contrastRatio(pair.foreground, pair.background)
  assert.equal(
    ratio >= 4.5,
    true,
    `gone page ${pair.name}: ${pair.foreground} on ${pair.background} is ${ratio.toFixed(2)}:1, below WCAG 2.1 AA 4.5:1`
  )
}

// --- transport --------------------------------------------------------------

const middleware = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8')

// §8 is explicit that this must not be a `next.config` redirect, and the reason
// is that config redirects cannot emit a 410.
const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8')
assert.equal(/redirects\s*[(:]/.test(nextConfig), false, '§8 M1: no next.config redirects')

assert.match(middleware, /NextResponse\.redirect\(/)
assert.match(middleware, /NextResponse\.rewrite\(/, 'the 410 keeps the requested URL')
assert.match(middleware, /classifyLegacyPath/)
assert.equal(/matcher/.test(middleware), true)

const goneRoute = fs.readFileSync(path.join(root, 'src/app/gone/route.ts'), 'utf8')
assert.match(goneRoute, /status:\s*GONE/)
assert.match(goneRoute, /renderGonePage/)
assert.equal(GONE_PATH, '/gone')
assert.equal(GONE, 410)

// The 301 targets have to exist as routes, or the policy points into a 404.
assert.equal(fs.existsSync(path.join(root, 'src/app/lostfound/page.tsx')), true)
assert.equal(fs.existsSync(path.join(root, 'src/app/spots/[slug]/page.tsx')), true)

console.log('legacy-redirects: ok')

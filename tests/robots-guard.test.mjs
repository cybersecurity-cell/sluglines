// The X-Robots-Tag guard: `sluglines.org` is a temporary testing surface and
// must not accrue SEO or backlink weight while `sluglines.com` still serves
// the old WordPress site (owner directive, 2026-09-05). See
// `src/lib/robots-guard.ts` for the full rationale.
//
// `shouldNoIndex` is pure and is what `src/middleware.ts` calls, so the policy
// is asserted here without a server — the same split `tests/legacy-redirects.test.mjs`
// uses for `classifyLegacyPath`. The transport (that the header is actually
// set on every response kind, redirects and the 410 rewrite included) is
// asserted structurally against the middleware source below, because
// `next/server`'s extensionless import cannot be resolved by plain Node.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { CANONICAL_HOSTS, shouldNoIndex } from '../src/lib/robots-guard.ts'

const root = process.cwd()

// --- the policy --------------------------------------------------------------

for (const canonical of ['sluglines.com', 'www.sluglines.com']) {
  assert.equal(shouldNoIndex(canonical), false, `${canonical} is canonical and must not be told to noindex`)
}

for (const nonCanonical of [
  'sluglines.org',
  'www.sluglines.org',
  'pr7-noindex-nonprimary.vercel.app',
  'sluglines.vercel.app',
  'localhost',
  null,
]) {
  assert.equal(shouldNoIndex(nonCanonical), true, `${nonCanonical} is not canonical and must be told to noindex`)
}

// Membership is exact-match, not a suffix check — `evilsluglines.com` is not
// `sluglines.com`, and a suffix match would wrongly wave it through.
assert.equal(shouldNoIndex('evilsluglines.com'), true)
assert.equal(CANONICAL_HOSTS.has('sluglines.com'), true)
assert.equal(CANONICAL_HOSTS.has('sluglines.org'), false)
assert.equal(CANONICAL_HOSTS.size, 2, 'exactly the apex and www of the production host')

// The `Host` header this actually reads may carry a port (local dev, a
// non-standard front door) and may not be lowercased by every client — both
// must still resolve against the same canonical set.
assert.equal(shouldNoIndex('sluglines.com:3000'), false, 'a port suffix must not defeat the canonical match')
assert.equal(shouldNoIndex('SLUGLINES.COM'), false, 'Host is case-insensitive per RFC 9110 4.2.3')
assert.equal(shouldNoIndex('sluglines.org:3000'), true)

// --- transport --------------------------------------------------------------

const middleware = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8')

assert.match(middleware, /shouldNoIndex/, 'the middleware must apply the robots guard')
assert.match(middleware, /X-Robots-Tag/)
assert.match(middleware, /noindex,\s*nofollow/)

// The guard has to reach all three response kinds this middleware returns —
// a header applied to only the render path would leave the redirect and the
// 410 rewrite indexable on a test host.
const guardCallSites = middleware.match(/return withRobotsGuard\(/g) ?? []
assert.equal(guardCallSites.length, 3, 'the robots guard must wrap the redirect, the gone rewrite, and next()')

console.log('robots-guard: ok')

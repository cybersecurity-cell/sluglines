/**
 * The legacy URL disposition policy — rev. 5.3 §8 M1, "Redirects".
 *
 *   301 for retained slugs, **branded 410** (page with links to `/spots` and
 *   `/lostfound`) for `/forum/**` except the forum root and L&F forum URLs
 *   which 301 → `/lostfound`, and for `/blog/**`, `/news/**`.
 *
 * WHY THIS IS A PURE FUNCTION AND NOT THE HANDLER
 * ---------------------------------------------------------------------------
 * `src/middleware.ts` applies it; `tests/legacy-redirects.test.mjs` runs it over
 * all 165 routes of the committed inventory. Keeping the decision separate from
 * the response is what makes "165/165 routes return exactly the mapped status
 * and target" (rev. 5.3 §12 P1 measurement) checkable without a running server.
 *
 * WHY MIDDLEWARE AND NOT `next.config`, AND NOT THE CATCH-ALL PAGE
 * ---------------------------------------------------------------------------
 * §8 rules out `next.config` redirects, and gives the reason: they cannot emit
 * a 410 or a branded gone-page. The catch-all *page* cannot either — an App
 * Router page has exactly two status codes available to it, 200 and `notFound()`'s
 * 404, and a 404 tells a crawler "try again later" about content that is
 * deliberately, permanently gone. Middleware is the one layer that can answer
 * with the status the spec asks for; it rewrites to `/gone`, a Route Handler
 * that returns 410. See `Docs/DECISIONS.md` D-32.
 *
 * EDGE BUDGET
 * ---------------------------------------------------------------------------
 * Middleware bundles what it imports. `src/data/legacy-site-content.json` is
 * 6.4 MB, so this module must not touch it — the policy is expressed as path
 * patterns plus the 50-entry spot directory, and the *inventory* cross-check
 * lives in the test, where the file is free to be large.
 */

import { SPOT_LOCATIONS, canonicalSlug } from './domain/locations.ts'

export const LOSTFOUND_PATH = '/lostfound'
export const SPOTS_PATH = '/spots'
export const GONE_PATH = '/gone'

export const MOVED_PERMANENTLY = 301
export const GONE = 410

export type LegacyRedirectReason =
  | 'forum-root'
  | 'forum-lost-and-found'
  | 'legacy-spot-page'
  | 'legacy-post-alias'

export type LegacyGoneReason =
  | 'forum-topic'
  | 'forum-account'
  | 'unknown-spot-page'

export type LegacyDisposition =
  | { kind: 'render' }
  | { kind: 'redirect'; status: 301; target: string; reason: LegacyRedirectReason }
  | { kind: 'gone'; status: 410; reason: LegacyGoneReason }

const RENDER: LegacyDisposition = { kind: 'render' }

/** Canonical `/spots/<routeSlug>` for each legacy `/slug_pickup/<slug>/`. */
const SPOT_ROUTE_BY_SLUG: ReadonlyMap<string, string> = new Map(
  SPOT_LOCATIONS.map((location) => [location.slug, location.routeSlug])
)

/**
 * Lost & Found lives on inside the new product (§8 M5) and is the only legacy
 * forum content with live usage — 116 topics, newest two days old (§3.1). Its
 * URLs 301 onto the new board; every other forum URL is gone, per the §3.1
 * decision not to migrate forum content.
 */
const LOST_AND_FOUND_PATTERNS = [
  /(^|[-_/])lost([-_/]?(and|&|n)?[-_/]?)found([-_/]|$)/i,
  /(^|[-_/])lost[-_/]?item/i,
  /(^|[-_/])found[-_/]?item/i,
]

/** WordPress account surfaces for a forum that no longer exists. */
const FORUM_ACCOUNT_PREFIXES = ['/participant/', '/sign-in/', '/wp-login.php', '/bbp-']

/**
 * Trailing-slash-normalised, query- and hash-free, lower-cased. The legacy site
 * served lower-case URLs with trailing slashes; a caller may hold either form,
 * and `/FORUM/Topic` must not be a hole in the policy.
 */
export function normalizeRedirectPath(pathname: string) {
  const [withoutQuery] = (pathname || '/').split(/[?#]/)
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  const lowered = withLeadingSlash.toLowerCase()

  if (lowered === '/') return '/'
  if (lowered.includes('.php')) return lowered

  return lowered.endsWith('/') ? lowered : `${lowered}/`
}

function segmentsOf(path: string) {
  return path.split('/').filter(Boolean)
}

function isLostAndFound(path: string) {
  return LOST_AND_FOUND_PATTERNS.some((pattern) => pattern.test(path))
}

/**
 * The disposition of one legacy URL. `render` means "this app owns the path" —
 * the catch-all page, or a real route, answers it 200.
 */
export function classifyLegacyPath(pathname: string): LegacyDisposition {
  const path = normalizeRedirectPath(pathname)
  const segments = segmentsOf(path)
  const [first, second] = segments

  if (first === 'forum') {
    // The forum root is where the legacy site's own navigation pointed, and
    // §3.1 makes the L&F board the landing target of that traffic.
    if (segments.length === 1 || isLostAndFound(path)) {
      return { kind: 'redirect', status: MOVED_PERMANENTLY, target: LOSTFOUND_PATH, reason:
        segments.length === 1 ? 'forum-root' : 'forum-lost-and-found' }
    }

    return { kind: 'gone', status: GONE, reason: 'forum-topic' }
  }

  if (FORUM_ACCOUNT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return isLostAndFound(path)
      ? { kind: 'redirect', status: MOVED_PERMANENTLY, target: LOSTFOUND_PATH, reason: 'forum-lost-and-found' }
      : { kind: 'gone', status: GONE, reason: 'forum-account' }
  }

  if (first === 'slug_pickup' || first === 'slug-pickup') {
    // The index keeps rendering: it is a live search page in this app, not a
    // legacy artefact. Only the 43 spot pages move.
    if (segments.length === 1) return RENDER

    const routeSlug = SPOT_ROUTE_BY_SLUG.get(canonicalSlug(second ?? ''))

    // rev. 5.3 §9: "The 43 legacy spot URLs become 43 live landing pages."
    return routeSlug
      ? { kind: 'redirect', status: MOVED_PERMANENTLY, target: `${SPOTS_PATH}/${routeSlug}`, reason: 'legacy-spot-page' }
      : { kind: 'gone', status: GONE, reason: 'unknown-spot-page' }
  }

  // `/blog/<post>/` and `/news/<post>/` are aliases: the legacy inventory keeps
  // every post at its own root path, and both prefixes resolved to the same
  // article. Two URLs for one article is the duplicate-content half of what §8
  // wants gone; the article itself is retained, so this is a 301 to the
  // canonical path rather than a 410. The indexes stay — they are real pages in
  // this app. See D-32 for the part of §8's `/blog/**`, `/news/**` rule that is
  // deliberately not applied yet.
  if ((first === 'blog' || first === 'news') && segments.length > 1) {
    return {
      kind: 'redirect',
      status: MOVED_PERMANENTLY,
      target: `/${segments.slice(1).join('/')}/`,
      reason: 'legacy-post-alias',
    }
  }

  return RENDER
}

/** Convenience for the middleware and the tests: does this path leave a 200? */
export function isHandledByRedirectPolicy(pathname: string) {
  return classifyLegacyPath(pathname).kind !== 'render'
}

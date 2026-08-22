/**
 * Browser security headers — issue #33, risk 15 in `Docs/consolidated-architecture.md` §14.
 *
 * `next.config.js` defined no `headers()` at all, so the app shipped with no CSP,
 * no frame denial, no MIME-sniffing protection, no referrer policy and no
 * permissions policy — on a public site that already sets a session cookie and
 * that will carry a confirmed-participants-only pickup-details surface once
 * `0002` reaches production.
 *
 * The `codex/phase-1` snapshot's own `Docs/security-review.md` listed all of this
 * as *shipped*. It was designed once and lost when that branch was abandoned
 * (#11). This module is where it lives now, as data rather than as prose, so
 * `tests/security-headers.test.mjs` can assert it and it cannot be lost a second
 * time.
 *
 * WHY HERE AND NOT IN `src/middleware.ts`
 * ---------------------------------------------------------------------------
 * The middleware matcher deliberately excludes `_next/`, `/api/` and every static
 * asset extension, because middleware on every asset request is a latency tax on
 * the §10 LCP budget. Security headers have to cover exactly those excluded
 * paths, and `next.config.js` `headers()` applies at the edge to all of them
 * without re-introducing that cost.
 *
 * .mjs rather than .ts because `next.config.js` imports it, and Next does not
 * transform its own config's imports.
 */

/**
 * Where the browser may talk to. Read from the environment at build time so the
 * policy names the real project rather than a wildcard: `connect-src https:`
 * would permit exfiltration to any host and is the single most common way a CSP
 * is written to look strict while permitting everything that matters.
 */
function supabaseOrigins() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  // This is read at BUILD time, so a build with the variable unset produces a
  // policy whose `connect-src` is `'self'` alone — which, once the CSP is
  // enforced, blocks every Supabase call the app makes. While it is report-only
  // that failure is merely reported, which is exactly how it would reach
  // enforcement unnoticed. So it is announced in the build log rather than
  // omitted silently. (#41 is the matching gap on Vercel Preview.)
  if (!url) {
    console.warn(
      '[security-headers] NEXT_PUBLIC_SUPABASE_URL is unset at build time; ' +
        "CSP connect-src will be 'self' only. This MUST be resolved before the " +
        'CSP is enforced (#33 bullet 3), or every Supabase request will be blocked.'
    )
    return []
  }

  try {
    const { origin, host } = new URL(url)
    // Realtime uses a WebSocket to the same host; `connect-src` governs both and
    // `wss:` is a separate scheme, so it needs naming explicitly.
    return [origin, `wss://${host}`]
  } catch {
    console.warn(`[security-headers] NEXT_PUBLIC_SUPABASE_URL is not a URL: ${url}`)
    return []
  }
}

/**
 * The Content-Security-Policy, as directive → source list.
 *
 * SHIPPED REPORT-ONLY, DELIBERATELY. #33 sequences it that way and is right to:
 * a CSP is a behavioural change, and an enforced policy that is wrong breaks the
 * page it is protecting. `CSP_REPORT_ONLY` below is what decides the header name.
 *
 * KNOWN WEAKENING, recorded so the eventual enforced policy is not misread as
 * strong: `script-src` carries `'unsafe-inline'`. Next.js injects an inline
 * bootstrap script into every document, and without a nonce or a hash there is
 * no policy that both admits it and forbids other inline script. That is the
 * work the report-only period is meant to size — see #33's third bullet. The
 * rest of the policy is written strictly *now* so the report-only period surfaces
 * real violations (an unexpected external origin) instead of drowning in
 * thousands of Next-bootstrap reports nobody will read.
 */
export function contentSecurityPolicy() {
  const directives = {
    'default-src': ["'self'"],
    // Blocks `<base href>` injection from redirecting every relative URL on the
    // page, which is a same-origin XSS primitive that `default-src` does not cover.
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    // The CSP-native counterpart of X-Frame-Options: DENY, and the one modern
    // browsers actually honour. X-Frame-Options is still sent for old ones.
    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],
    'form-action': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    // Tailwind's runtime and Next both emit inline <style>; there is no nonce
    // path for these today and the risk from inline style is markedly lower than
    // from inline script.
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", ...supabaseOrigins()],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'upgrade-insecure-requests': [],
  }

  return Object.entries(directives)
    .map(([directive, sources]) => (sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive))
    .join('; ')
}

/**
 * Report-only until the inventory in #33's second bullet is done against a real
 * deployment. Flipping this to `false` is the third bullet, and must not happen
 * before `script-src` loses `'unsafe-inline'` — otherwise enforcement buys the
 * breakage without the protection.
 */
export const CSP_REPORT_ONLY = true

/** Where violation reports go. `/api/` is outside the middleware matcher. */
export const CSP_REPORT_PATH = '/api/csp-report'

export function securityHeaders() {
  return [
    {
      key: CSP_REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      value: `${contentSecurityPolicy()}; report-uri ${CSP_REPORT_PATH}; report-to csp-endpoint`,
    },
    // `report-uri` is deprecated and `report-to` is its replacement, but browser
    // support is split across exactly the versions that matter. Both are sent.
    {
      key: 'Reporting-Endpoints',
      value: `csp-endpoint="${CSP_REPORT_PATH}"`,
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    // Sends the origin (not the path) cross-origin, and nothing at all when
    // leaving HTTPS. Spot pages carry physical-safety-relevant locations; the
    // full path should not travel to a third party in a Referer header.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // #33's list. NOTE for whoever ships the §9 voice feature: `microphone=()`
    // denies the Web Speech API outright, so that feature must revisit this line
    // rather than discover it at runtime.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
  ]
}

/**
 * Strict-Transport-Security is deliberately absent. Vercel already sends it for
 * custom domains, and asserting `includeSubDomains` from here before the #25 DNS
 * cutover would make a claim about `sluglines.com` subdomains this project does
 * not yet control. Revisit with #25.
 */
export const HSTS_DEFERRED_TO = 25

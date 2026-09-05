/**
 * The legacy URL handler — rev. 5.3 §8 M1, "Redirects".
 *
 * The policy is in `src/lib/legacy-redirects.ts`; this file is only the
 * transport. It runs before routing, so it also covers paths the app itself
 * would otherwise answer 200 (the legacy catch-all renders anything in the
 * inventory, including forum endpoints).
 *
 * Two responses:
 *   - 301 to a retained target, for the forum root, L&F forum URLs, the 43
 *     legacy spot pages, and `/blog|/news` post aliases.
 *   - a rewrite to `/gone`, which answers **410** with the branded page. A
 *     rewrite rather than a redirect so the dead URL stays in the address bar
 *     and in the crawler's log — a 302-to-a-410 would be two lies in a row.
 *
 * The matcher excludes `_next`, `/api` and static asset extensions: middleware
 * that runs on every asset request is a latency tax on the public LCP budget
 * (§10: <2.0s throttled 4G) for no decision it could make. `.php` is
 * deliberately **not** excluded — `/wp-login.php` is one of the dead WordPress
 * endpoints the policy answers.
 *
 * It also carries the `X-Robots-Tag` guard from `@/lib/robots-guard` — see
 * that file for why. It rides along on every response this middleware
 * produces, redirects and the 410 rewrite included. One hop it cannot reach:
 * a legacy path with WordPress's trailing slash gets Next's own 308
 * slash-canonicalisation first (`trailingSlash: false`, see
 * `scripts/verify-legacy-routes.mjs`), which answers before this middleware
 * runs. The second hop, the one this policy actually targets, still carries
 * the header.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { GONE_PATH, classifyLegacyPath } from '@/lib/legacy-redirects'
import { shouldNoIndex } from '@/lib/robots-guard'

function withRobotsGuard(response: NextResponse, rawHost: string | null) {
  if (shouldNoIndex(rawHost)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export function middleware(request: NextRequest) {
  const rawHost = request.headers.get('host')
  const disposition = classifyLegacyPath(request.nextUrl.pathname)

  if (disposition.kind === 'redirect') {
    return withRobotsGuard(
      NextResponse.redirect(new URL(disposition.target, request.url), disposition.status),
      rawHost
    )
  }

  if (disposition.kind === 'gone') {
    const goneUrl = new URL(GONE_PATH, request.url)
    goneUrl.searchParams.set('from', request.nextUrl.pathname)

    return withRobotsGuard(NextResponse.rewrite(goneUrl), rawHost)
  }

  return withRobotsGuard(NextResponse.next(), rawHost)
}

export const config = {
  matcher: [
    '/((?!_next/|api/|gone|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|woff2?|ttf|eot)$).*)',
  ],
}

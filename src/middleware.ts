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
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { GONE_PATH, classifyLegacyPath } from '@/lib/legacy-redirects'

export function middleware(request: NextRequest) {
  const disposition = classifyLegacyPath(request.nextUrl.pathname)

  if (disposition.kind === 'redirect') {
    return NextResponse.redirect(new URL(disposition.target, request.url), disposition.status)
  }

  if (disposition.kind === 'gone') {
    const goneUrl = new URL(GONE_PATH, request.url)
    goneUrl.searchParams.set('from', request.nextUrl.pathname)

    return NextResponse.rewrite(goneUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/|api/|gone|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|txt|xml|json|pdf|woff2?|ttf|eot)$).*)',
  ],
}

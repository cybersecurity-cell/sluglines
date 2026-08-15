/**
 * The 410 endpoint behind the §8 M1 branded gone-page.
 *
 * `src/middleware.ts` rewrites dead legacy paths here, so the visitor keeps the
 * URL they typed and the response carries the status that URL deserves. A Route
 * Handler is used because it is the only App Router primitive that can set an
 * arbitrary status; see `src/lib/gone-page.ts` for why the document is a string.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { GONE } from '@/lib/legacy-redirects'
import { renderGonePage } from '@/lib/gone-page'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get('from')

  return new NextResponse(renderGonePage(requestedPath ?? undefined), {
    status: GONE,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // 410 is permanent, but a stale cache of it would outlive a decision to
      // bring a path back. Crawlers honour the status; caches should re-ask.
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

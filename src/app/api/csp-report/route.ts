import { NextResponse } from 'next/server'

/**
 * `POST /api/csp-report` — the collector for the report-only CSP (issue #33).
 *
 * WHY THIS EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * #33's second bullet is "CSP in report-only … inventory what it would break".
 * A `Content-Security-Policy-Report-Only` header with nowhere to report is
 * decorative: the violations land in individual visitors' consoles, where nobody
 * doing the inventory will ever see them. This endpoint is what makes the
 * report-only period produce evidence, and therefore what makes the third bullet
 * — enforce it — a decision with data behind it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * No database write. A public unauthenticated endpoint that inserts a row per
 * request is a denial-of-wallet primitive, and a report body is attacker-shaped
 * data by definition — the browser sends whatever URL was blocked, and anyone
 * can POST here directly. Reports go to the platform log, which is bounded,
 * already access-controlled, and where the person doing the inventory is looking.
 *
 * The body is read as text and truncated before logging, so an oversized or
 * malformed report costs a bounded amount of work and cannot throw past the
 * handler.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Generous for a real report, small enough that abuse is uninteresting. */
const MAX_REPORT_BYTES = 8 * 1024

export async function POST(request: Request) {
  let raw = ''
  try {
    raw = (await request.text()).slice(0, MAX_REPORT_BYTES)
  } catch {
    // A body that cannot even be read is not worth a 4xx: the browser is not
    // going to act on the response either way.
    return new NextResponse(null, { status: 204 })
  }

  // Reports arrive in two shapes: the legacy `report-uri` envelope
  // (`{"csp-report": {...}}`) and the `report-to` batch (an array). Both are
  // logged as received rather than normalised, because guessing at a shape is
  // how an inventory ends up missing the reports it did not expect.
  console.warn('[csp-report]', raw)

  // 204 with no body: the browser discards the response, and returning nothing
  // avoids reflecting attacker-supplied content back out of this origin.
  return new NextResponse(null, { status: 204 })
}

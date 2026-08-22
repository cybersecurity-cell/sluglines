import { NextResponse } from 'next/server'
import { createFixedWindowLimiter } from '@/lib/api/rate-limit.ts'
import { clientIp } from '@/lib/api/request.ts'

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
 *
 * TWO THINGS THIS GETS RIGHT THAT THE FIRST VERSION DID NOT
 * ---------------------------------------------------------------------------
 * Both were flagged by CodeQL on the pull request that added this file, and both
 * are real rather than pedantic:
 *
 *   LOG INJECTION. The first version passed the raw body to `console.warn`.
 *   Anyone can POST here, the body is attacker-controlled by construction, and a
 *   body containing newlines forges whole log lines — including lines that look
 *   like they came from another subsystem. That matters more here than in a
 *   typical handler, because this log IS the evidence the report-only period is
 *   collecting (#33's second bullet): poisoning it corrupts the inventory the
 *   decision to enforce will be made from. The payload is JSON-encoded on the way
 *   out, which escapes newlines, quotes and control characters into a single
 *   unambiguous token.
 *
 *   NO RATE LIMIT. An unauthenticated endpoint that does work per request is a
 *   denial-of-wallet primitive on a serverless platform — the same concern this
 *   file already documents for database writes, left open on the compute side.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Generous for a real report, small enough that abuse is uninteresting. */
const MAX_REPORT_BYTES = 8 * 1024

/**
 * Per-IP ceiling. A browser sends at most a handful of reports per page load, so
 * this is far above any legitimate client and still bounds the cost of a flood.
 *
 * In-memory and per-instance, with the same caveat as `rate-limit.ts` documents
 * everywhere else: it resets on redeploy and does not coordinate across
 * instances. That is acceptable here in a way it is not for OTP (D-51) — the
 * downstream cost is a log line, not an SMS, and there is no account to protect.
 */
const reportLimiter = createFixedWindowLimiter({ max: 60, windowMs: 60 * 1000 })

export async function POST(request: Request) {
  // Checked before the body is read, so a flood costs a map lookup rather than
  // an 8 KiB read per request.
  if (!reportLimiter.consume(`csp:${clientIp(request)}`, Date.now()).allowed) {
    return new NextResponse(null, { status: 429 })
  }

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
  // logged as received rather than normalised, because guessing at a shape is how
  // an inventory ends up missing the reports it did not expect.
  //
  // JSON.stringify, NOT the raw string: it escapes newlines, carriage returns,
  // quotes and control characters, so a hostile body becomes one quoted token on
  // one line and cannot forge a log entry. The content is preserved exactly —
  // this changes the encoding, not the evidence.
  console.warn('[csp-report]', JSON.stringify(raw))

  // 204 with no body: the browser discards the response, and returning nothing
  // avoids reflecting attacker-supplied content back out of this origin.
  return new NextResponse(null, { status: 204 })
}

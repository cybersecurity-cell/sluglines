/**
 * The one place a server-side "could not read / could not reach" is written
 * to the log (issue #144). Every `unavailable` state in `src/lib/*.ts` carried
 * a `reason` documented as "for the server log" that nothing ever logged, so
 * the first incident would have been undiagnosable from anything but
 * `/api/health`.
 *
 * WHAT IS LOGGED, AND WHAT IS NOT
 * ---------------------------------------------------------------------------
 * One JSON line per event on stderr, which Vercel's runtime logs collect:
 * a fixed `event`, the `scope` (which read), the `reason` the module already
 * composed, and — from the error, if one is given — its SQLSTATE / status
 * `code` and its `name`. Never `error.message`: PostgREST messages can echo
 * request values, and `src/app/api/csp-report/route.ts` records why a raw
 * string on the log line is a log-injection vector. Never a member id, a
 * phone, or a row.
 *
 * Deliberately `console.error` and not a logging library: nothing else in
 * this repo has one, and the runtime already ships stderr to the log drain.
 */

export interface UnavailableEvent {
  readonly event: 'unavailable'
  readonly scope: string
  readonly reason: string
  readonly code?: string
  readonly name?: string
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { code, status } = error as { code?: unknown; status?: unknown }
  if (typeof code === 'string' && code.length > 0) return code
  if (typeof status === 'number') return String(status)
  return undefined
}

function nameOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { name } = error as { name?: unknown }
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

/** Build the line without writing it — what the tests exercise. */
export function unavailableEvent(scope: string, reason: string, error?: unknown): UnavailableEvent {
  const code = codeOf(error)
  const name = nameOf(error)
  return {
    event: 'unavailable',
    scope,
    reason,
    ...(code ? { code } : {}),
    ...(name ? { name } : {}),
  }
}

/** Write one structured line for an `unavailable` outcome, then return nothing. Never throws. */
export function reportUnavailable(scope: string, reason: string, error?: unknown): void {
  try {
    console.error(JSON.stringify(unavailableEvent(scope, reason, error)))
  } catch {
    // A logger that can throw is a second incident.
  }
}

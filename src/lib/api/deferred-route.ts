/**
 * The POST handler for the seven rev. 5.3 §8 M3 routes whose database objects
 * are §11 Phase 4 work and do not exist yet. See `deferred-endpoints.ts` for why
 * they are shipped at all rather than omitted.
 *
 * The response names the missing objects, so the gap is legible from the wire
 * and not only from this repo.
 */

import { NextResponse } from 'next/server'
import { deferredEndpoint } from './deferred-endpoints.ts'
import { NOT_IMPLEMENTED_STATUS, transitionError } from './transition-http.ts'

export function deferredRoute(route: string) {
  const endpoint = deferredEndpoint(route)
  if (endpoint === undefined) {
    // Import-time, so a route wired to an unregistered path fails the build
    // rather than answering 501 with an empty explanation.
    throw new Error(`${route} is not a registered deferred endpoint`)
  }

  return async function POST(): Promise<NextResponse> {
    return NextResponse.json(
      {
        ...transitionError('not_implemented'),
        deferred: {
          route: endpoint.route,
          operation: endpoint.operation,
          blocked_on: endpoint.blockedOn,
          missing: endpoint.missing,
        },
      },
      { status: NOT_IMPLEMENTED_STATUS }
    )
  }
}

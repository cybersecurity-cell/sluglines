/**
 * POST /api/offers — PR 5 "thin coordination loop": the route that was missing
 * entirely. `offer_create` appeared nowhere in `src/` before this file; nothing
 * in the product could put an offer on the board the other ten M3 routes
 * operate on.
 *
 * COMPOUND, NOT A SINGLE RPC
 * ---------------------------------------------------------------------------
 * Every other M3 write path (`offer-transition-route.ts`,
 * `offer-waitlist-join-route.ts`) is one `supabase.rpc()` call. This one is two,
 * because posting a seat is DRAFT -> OPEN and `0002` splits that into
 * `offer_create()` (creates the row, in DRAFT) and `offer_publish()` (the one
 * `DRAFT -> OPEN` edge `offer-transitions.ts` publishes). A route that skipped
 * the publish call would leave every posted offer sitting in DRAFT, invisible
 * to `offers_select_visible_for_caller` and to `/board` — silently worse than
 * not shipping this route at all.
 *
 * ONE CLIENT KEY, TWO CLAIMED OPERATIONS
 * ---------------------------------------------------------------------------
 * `claim_offer_operation` claims `(actor_id, idempotency_key)` and refuses a
 * key reused for a different `operation` (`0002` sec. IDEMPOTENCY, `22023`) —
 * by design, so a key does not silently change meaning. `offer_create` and
 * `offer_publish` are two operations, so they cannot share one raw key. The
 * client supplies one key for the whole compose action (it only ever means
 * "this post-a-seat attempt"); this route derives two from it with fixed
 * prefixes, so a same-key retry re-derives the same two keys and replays both
 * calls exactly as `0002`'s idempotency design intends. `MAX_CLIENT_KEY_LENGTH`
 * is `0002`'s 200-character bound minus the longer prefix (`publish:`, 8
 * chars), so a derived key can never be truncated into a collision with another.
 *
 * ONE CORRIDOR PAIR, RESOLVED PER REQUEST
 * ---------------------------------------------------------------------------
 * This route does not accept location ids from the client at all. The caller
 * picks a *direction* along the one corridor pair this slice ships, and the
 * route resolves the two ids server-side — by slug, from the `locations` rows
 * on the database serving the request (`lib/corridor-locations.ts`), never from
 * a committed literal. `origin_location_id`/`destination_location_id` carry a
 * real foreign key to `locations` (`0004`, `APPLIED: production`, which seeds
 * both `horner-rd` and `lenfant-plaza`), so a literal uuid can only ever raise
 * 23503; the first version of this route did exactly that on every request
 * (issue #132, D-82). The lookup runs after the session check and before
 * either RPC: an unresolvable corridor is refused as `unknown_location` (422,
 * not retryable) without spending a round trip on an insert that cannot
 * succeed, and a 23503 that reaches the constraint anyway maps to the same
 * status and kind (`transition-http.ts`).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IDEMPOTENCY_KEY_MIN_LENGTH, REVISION_START } from '@/lib/domain/offer-transitions.ts'
import { corridorLocationIdsForDirection, isCorridorDirection } from '@/lib/domain/corridor.ts'
import type { CorridorDirection } from '@/lib/domain/corridor.ts'
import { readPilotCorridor } from '@/lib/corridor-locations.ts'
import {
  UNAUTHENTICATED_STATUS,
  UNKNOWN_LOCATION_STATUS,
  transitionError,
  transitionFailure,
  transitionSuccess,
} from './transition-http.ts'
import type { TransitionErrorBody } from './transition-http.ts'

const POSTER_ROLES = ['driver', 'rider'] as const
type PosterRole = (typeof POSTER_ROLES)[number]

function isPosterRole(value: unknown): value is PosterRole {
  return typeof value === 'string' && (POSTER_ROLES as readonly string[]).includes(value)
}

const MIN_SEATS_TOTAL = 1
const MAX_SEATS_TOTAL = 6

/**
 * `0002`'s idempotency key bound is 8-200 characters. This route derives two
 * keys from the one the client sends (`create:<key>` / `publish:<key>`, 8
 * characters being the longer prefix), so the client-facing bound is narrower:
 * wide enough for a `crypto.randomUUID()` (36 chars) many times over, never
 * wide enough for a derived key to need truncating.
 */
const MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH = 190

function isClientIdempotencyKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length >= IDEMPOTENCY_KEY_MIN_LENGTH && trimmed.length <= MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH
}

interface CreateOfferInput {
  readonly posterRole: PosterRole
  readonly direction: CorridorDirection
  readonly windowStart: string
  readonly windowEnd: string
  readonly seatsTotal: number
  readonly idempotencyKey: string
}

type CreateOfferInputResult =
  | { readonly ok: true; readonly value: CreateOfferInput }
  | { readonly ok: false; readonly status: number; readonly body: TransitionErrorBody }

function invalid(): CreateOfferInputResult {
  return { ok: false, status: 400, body: transitionError('invalid_argument', '22023') }
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

/**
 * Shape only — the same three checks `offer_create()` itself makes (role,
 * window ordering via `Date.parse` comparison, seat bounds) are applied here
 * too, in the same spirit as `parseTransitionInput`: refuse before the round
 * trip, but never as a substitute for the SQL's own checks. Window ordering is
 * left to the SQL entirely (it compares `timestamptz`, this only confirms both
 * fields parse), since a route re-deriving that comparison from two ISO strings
 * is exactly the kind of duplicated authority rev. 5.3 §12 constraint 6 warns
 * against.
 */
function parseCreateOfferInput(raw: unknown, headerKey: string | null): CreateOfferInputResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return invalid()

  const body = raw as Record<string, unknown>
  const idempotencyKey = body.idempotency_key ?? headerKey ?? undefined

  if (!isClientIdempotencyKey(idempotencyKey)) return invalid()
  if (!isPosterRole(body.poster_role)) return invalid()
  if (!isCorridorDirection(body.direction)) return invalid()
  if (!isIsoDateString(body.window_start)) return invalid()
  if (!isIsoDateString(body.window_end)) return invalid()

  const seatsTotal = body.seats_total
  if (!Number.isInteger(seatsTotal) || (seatsTotal as number) < MIN_SEATS_TOTAL || (seatsTotal as number) > MAX_SEATS_TOTAL) {
    return invalid()
  }

  return {
    ok: true,
    value: {
      posterRole: body.poster_role,
      direction: body.direction,
      windowStart: body.window_start,
      windowEnd: body.window_end,
      seatsTotal: seatsTotal as number,
      idempotencyKey: (idempotencyKey as string).trim(),
    },
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function offerCreateRoute() {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient()

    const { data, error: sessionError } = await supabase.auth.getUser()
    if (sessionError !== null || data.user === null) {
      return NextResponse.json(transitionError('unauthenticated'), { status: UNAUTHENTICATED_STATUS })
    }

    const parsed = parseCreateOfferInput(await readJson(request), request.headers.get('idempotency-key'))
    if (!parsed.ok) {
      return NextResponse.json(parsed.body, { status: parsed.status })
    }

    // Resolved through the caller's own client, so the read is scoped by
    // `locations_select_active` like every other member read. A miss names the
    // slug in the server log (it is a deployment fact, not a user error) and
    // refuses the request as permanent — no Retry button for a row a retry
    // cannot create.
    const corridor = await readPilotCorridor(supabase)
    if (!corridor.ok) {
      console.error(`POST /api/offers: ${corridor.reason}`)
      return NextResponse.json(transitionError('unknown_location'), { status: UNKNOWN_LOCATION_STATUS })
    }

    const { originId, destinationId } = corridorLocationIdsForDirection(corridor.corridor, parsed.value.direction)

    // The actor is not passed: offer_create() and offer_publish() both read
    // auth.uid() themselves, same as every other M3 entry point.
    const { data: offerId, error: createError } = await supabase.rpc('offer_create', {
      p_poster_role: parsed.value.posterRole,
      p_origin_location_id: originId,
      p_destination_location_id: destinationId,
      p_window_start: parsed.value.windowStart,
      p_window_end: parsed.value.windowEnd,
      p_seats_total: parsed.value.seatsTotal,
      p_idempotency_key: `create:${parsed.value.idempotencyKey}`,
    })

    if (createError !== null) {
      const failure = transitionFailure(createError)
      return NextResponse.json(failure.body, { status: failure.status })
    }

    const { data: revision, error: publishError } = await supabase.rpc('offer_publish', {
      p_offer_id: offerId,
      p_expected_revision: REVISION_START,
      p_idempotency_key: `publish:${parsed.value.idempotencyKey}`,
    })

    if (publishError !== null) {
      const failure = transitionFailure(publishError)
      return NextResponse.json(failure.body, { status: failure.status })
    }

    return NextResponse.json(transitionSuccess(offerId, revision), { status: 200 })
  }
}

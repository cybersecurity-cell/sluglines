// M3 API write path — asserted against rev. 5.3 §8 M3 and Docs/DECISIONS.md D-30.
//
// Two kinds of check live here, and the split matters:
//
//   1. *Executed* checks of `src/lib/api/transition-http.ts`. That module is pure
//      on purpose, so the SQLSTATE -> HTTP mapping and the argument validation are
//      run here, not read. A mapping that drops a code fails, rather than a
//      regex that happened to still match.
//
//   2. *Static* checks of `src/app/api/**/route.ts`. Those files import
//      `next/server` and the `@/` alias, so they cannot be imported by bare node;
//      what is asserted instead is the property that makes them safe — every one
//      is a single `export const POST = <factory>(...)`, so none can hold logic
//      that skips the session check or the error translation.
//
// The wiring proof is check 3: the function name each route passes to the factory
// must be a `clientCallable` operation in `lib/domain`, and must carry an
// `execute` grant to `authenticated` in `supabase/migrations/**`. A route wired
// to a function that does not exist, or exists but is not granted, fails here.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  OFFER_TRANSITION_OPERATIONS,
  TRANSITION_ERRCODES,
  isConflictError,
  isRetryableError,
} from '../src/lib/domain/index.ts'
import {
  NOT_IMPLEMENTED_STATUS,
  TRANSITION_ERROR_KINDS,
  TRANSITION_ERROR_KIND_BY_ERRCODE,
  TRANSITION_HTTP_STATUS,
  TRANSPORT_FAILURE_STATUS,
  UNAUTHENTICATED_STATUS,
  isUuid,
  parseTransitionInput,
  transitionError,
  transitionFailure,
  transitionSuccess,
} from '../src/lib/api/transition-http.ts'
import { DEFERRED_M3_ENDPOINTS, deferredEndpoint } from '../src/lib/api/deferred-endpoints.ts'

const root = process.cwd()
const apiDir = path.join(root, 'src/app/api')

// -----------------------------------------------------------------------------
// 1. The route surface is exactly the one rev. 5.3 §8 M3 names
//
//   POST /api/offers/{advance,cancel,confirm,eta,waitlist}
//   POST /api/reservations{,/confirm,/no-show}      -- the bare path is not this slice
//   POST /api/recurring-offers/{cancel,pause,resume,skip}
// -----------------------------------------------------------------------------

/** Routes with a writer in `0002`/`0003`, and the SQL function each must call. */
const BACKED_ROUTES = {
  'offers/advance': 'offer_advance',
  'offers/cancel': 'offer_cancel',
  'offers/confirm': 'offer_confirm',
  // The same edge as /api/offers/confirm: the machine has one confirm writer and
  // reservations move to CONFIRMED inside it. See the route file's own comment.
  'reservations/confirm': 'offer_confirm',
}

const DEFERRED_ROUTES = [
  'offers/eta',
  'offers/waitlist',
  'reservations/no-show',
  'recurring-offers/cancel',
  'recurring-offers/pause',
  'recurring-offers/resume',
  'recurring-offers/skip',
]

const ALL_ROUTES = [...Object.keys(BACKED_ROUTES), ...DEFERRED_ROUTES]

assert.equal(ALL_ROUTES.length, 11, 'rev. 5.3 §8 M3 names eleven POST routes in this slice')

function routeSource(route) {
  const file = path.join(apiDir, route, 'route.ts')
  assert.equal(fs.existsSync(file), true, `missing route handler: src/app/api/${route}/route.ts`)
  return fs.readFileSync(file, 'utf8')
}

// Read-only routes, which are a different category from the eleven above and
// are listed rather than lumped in with them: they take no body, perform no
// transition, and are exempt from the write-path assertions below.
//
//   health  GET /api/health — the issue #21 monitoring endpoint. Its own
//           properties are pinned in tests/health-endpoint.test.mjs.
const READ_ONLY_ROUTES = ['health']

// A third category, and a deliberately narrow one: routes that accept a POST but
// are not write paths, because they touch no database at all.
//
//   csp-report  POST /api/csp-report — the collector for the report-only CSP
//               (issue #33, D-48). The browser POSTs violation reports here; the
//               handler truncates the body, logs it, and answers 204. It writes
//               nothing, which is what keeps it out of the M3 inventory above.
//
// The assertions below are what stop this from becoming a hole: a route listed
// here that ever reaches Supabase fails, and so does one that answers with a
// body. Adding a name to this list is a review decision, exactly as with
// ANON_CALLABLE_FUNCTIONS in scripts/sql-lint.mjs.
const WRITE_FREE_ROUTES = ['csp-report']

// Every route file on disk must be one of the eleven, or a named read-only
// route — a stray route handler under src/app/api is an unreviewed write path.
// `auth/` is excluded: it is the rev. 5.3 §8 M2 identity surface, a sibling
// scope with its own exact inventory check in `auth-otp-routes.test.mjs`.
function collectRoutes(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && prefix === '' && entry.name === 'auth') return []
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectRoutes(full, prefix ? `${prefix}/${entry.name}` : entry.name)
    return entry.name === 'route.ts' ? [prefix] : []
  })
}

const onDisk = collectRoutes(apiDir).sort()
assert.deepEqual(
  onDisk,
  [...ALL_ROUTES, ...READ_ONLY_ROUTES, ...WRITE_FREE_ROUTES].sort(),
  'src/app/api holds exactly the eleven §8 M3 routes, the named read-only routes and the named ' +
    'write-free routes, plus auth/**'
)

// A read-only route must not export POST: that is what keeps this category a
// category rather than a hole in the inventory above.
for (const route of READ_ONLY_ROUTES) {
  const source = fs.readFileSync(path.join(apiDir, route, 'route.ts'), 'utf8')
  assert.match(source, /export async function GET\(/, `${route} must be a GET`)
  assert.equal(/export async function POST\(/.test(source), false, `${route} is read-only and must not export POST`)
}

// A write-free route earns its exemption from the M3 inventory by touching no
// database. If one ever does, it is a write path that skipped review.
for (const route of WRITE_FREE_ROUTES) {
  const source = routeSource(route)
  assert.equal(
    /@supabase|createClient|\.rpc\(|\.from\(/.test(source),
    false,
    `${route}: is exempt from the M3 inventory only because it touches no database`
  )
  // It must also not hand anything back. A public unauthenticated endpoint that
  // echoes its request body reflects attacker-supplied content out of this
  // origin; 204-with-no-body is what makes that impossible rather than unlikely.
  assert.match(source, /status: 204/, `${route}: must answer 204`)
  assert.match(source, /new NextResponse\(null/, `${route}: must answer with no body`)

  // Anything logged from a public unauthenticated endpoint is attacker-shaped by
  // construction, and a body with newlines forges whole log lines — including
  // ones that look like they came from another subsystem. For the CSP collector
  // that log IS the evidence #33's report-only period is gathering, so poisoning
  // it corrupts the inventory the decision to enforce gets made from.
  // JSON encoding escapes newlines and control characters into one token.
  const logged = [...source.matchAll(/console\.(?:log|warn|error)\(([^)]*)\)/g)]
  for (const [call, args] of logged) {
    assert.equal(
      /\braw\b/.test(args) && !/JSON\.stringify/.test(args),
      false,
      `${route}: logs the request body unencoded — ${call.trim()}. Wrap it in JSON.stringify.`
    )
  }

  // An unauthenticated endpoint doing per-request work is a denial-of-wallet
  // primitive on a serverless platform.
  assert.match(
    source,
    /createFixedWindowLimiter|rate-limit/,
    `${route}: a public unauthenticated endpoint must be rate limited`
  )
}

for (const route of ALL_ROUTES) {
  const source = routeSource(route)
  assert.match(source, /^export const POST = /m, `${route}: must export POST`)
  assert.equal(/export const (GET|PUT|PATCH|DELETE|HEAD)/.test(source), false, `${route}: POST only`)

  // No route may reach the database itself: the two factories are the only
  // places a Supabase client is constructed, so the session check and the D-30
  // translation cannot be bypassed by a route that "just needed one query".
  assert.equal(
    /@supabase|createClient|\.rpc\(|\.from\(/.test(source),
    false,
    `${route}: must not touch Supabase directly; go through the route factory`
  )
}

// -----------------------------------------------------------------------------
// 2. Wiring: each backed route calls the SQL function it claims to
// -----------------------------------------------------------------------------

const migrations = fs
  .readdirSync(path.join(root, 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'))
  .join('\n')

assert.ok(migrations.length > 0, 'expected migrations to read')

for (const [route, fn] of Object.entries(BACKED_ROUTES)) {
  const source = routeSource(route)

  assert.match(
    source,
    new RegExp(`export const POST = offerTransitionRoute\\('${fn}'\\)`),
    `${route}: must be wired to ${fn}`
  )
  assert.match(source, /from '@\/lib\/api\/offer-transition-route\.ts'/, `${route}: wrong factory import`)

  // The name must be a published, client-callable operation...
  const operation = OFFER_TRANSITION_OPERATIONS.find((candidate) => candidate.fn === fn)
  assert.notEqual(operation, undefined, `${route}: ${fn} is not a published transition operation`)
  assert.equal(operation.clientCallable, true, `${route}: ${fn} is not client-callable`)

  // ...and it must actually be granted to `authenticated` by the SQL, with the
  // three-argument signature the factory calls.
  assert.match(
    migrations,
    new RegExp(`grant execute on function public\\.${fn}\\(uuid, integer, text\\) to authenticated;`),
    `${route}: ${fn}(uuid, integer, text) is not granted to authenticated`
  )
  assert.match(
    migrations,
    new RegExp(`revoke all on function public\\.${fn}\\(uuid, integer, text\\) from public;`),
    `${route}: ${fn} must be revoked from PUBLIC (rev. 5.3 §12 constraint 6)`
  )
}

// The factory calls exactly the three SQL parameters, and never names the actor.
// rev. 5.3 §14 risk 1: a client entry point that lets a caller say who they are
// is the whole vulnerability class. `auth.uid()` decides, inside the function.
const factory = fs.readFileSync(path.join(root, 'src/lib/api/offer-transition-route.ts'), 'utf8')
assert.match(factory, /p_offer_id: parsed\.value\.offerId/)
assert.match(factory, /p_expected_revision: parsed\.value\.expectedRevision/)
assert.match(factory, /p_idempotency_key: parsed\.value\.idempotencyKey/)
assert.equal(
  /p_actor|p_member|p_user|p_rider_id|p_poster/.test(factory),
  false,
  'no route may pass an actor id; the SQL reads auth.uid()'
)
assert.match(factory, /supabase\.auth\.getUser\(\)/, 'the factory must make a session check')
assert.match(factory, /createClient\(\)/, 'the factory must use the cookie-bound server client')

// The session check must precede the RPC, so an unauthenticated caller is
// refused before any database work is attempted.
assert.ok(
  factory.indexOf('supabase.auth.getUser()') < factory.indexOf('supabase.rpc('),
  'the session check must run before the RPC'
)

// -----------------------------------------------------------------------------
// 3. The D-30 mapping, executed
// -----------------------------------------------------------------------------

// No published SQLSTATE may be unmapped: a code with no status would fall to the
// transport branch and be reported as "unavailable, retryable" — which for a
// conflict is exactly the D-29 failure in a new place.
for (const errcode of Object.values(TRANSITION_ERRCODES)) {
  assert.equal(typeof TRANSITION_HTTP_STATUS[errcode], 'number', `${errcode} has no HTTP status`)
  assert.ok(
    TRANSITION_ERROR_KINDS.includes(TRANSITION_ERROR_KIND_BY_ERRCODE[errcode]),
    `${errcode} has no error kind`
  )
}

const conflict = transitionFailure({ code: TRANSITION_ERRCODES.CONFLICT })
assert.equal(conflict.status, 409, 'PT409 must arrive as 409 — the rev. 5.3 §10 "seat just taken" case')
assert.equal(conflict.body.error.kind, 'conflict')
assert.equal(conflict.body.error.errcode, TRANSITION_ERRCODES.CONFLICT)
assert.equal(conflict.body.error.retryable, false, 'a revision conflict is permanent (D-29)')
assert.equal(isConflictError({ code: conflict.body.error.errcode }), true, 'the body carries the code callers catch')

// 409 must mean *only* the conflict, so a client reading nothing but the status
// line still gets the §10 distinction right.
const nineOhNine = Object.entries(TRANSITION_HTTP_STATUS).filter(([, status]) => status === 409)
assert.deepEqual(nineOhNine.map(([code]) => code), [TRANSITION_ERRCODES.CONFLICT])

const inFlight = transitionFailure({ code: TRANSITION_ERRCODES.IN_FLIGHT })
assert.equal(inFlight.status, 425, 'PT425 keeps PostgREST\'s 425 Too Early')
assert.equal(inFlight.body.error.kind, 'in_flight')
assert.equal(inFlight.body.error.retryable, true, 'the same key may be retried; it replays')
assert.equal(isRetryableError({ code: inFlight.body.error.errcode }), true)

assert.equal(transitionFailure({ code: TRANSITION_ERRCODES.ILLEGAL_STATE }).status, 422)
assert.equal(transitionFailure({ code: TRANSITION_ERRCODES.INVALID_ARGUMENT }).status, 400)
assert.equal(transitionFailure({ code: TRANSITION_ERRCODES.FORBIDDEN }).status, 403)
assert.equal(transitionFailure({ code: TRANSITION_ERRCODES.NOT_FOUND }).status, 404)

// A refusal with no SQLSTATE is a transport failure, never a decision. This is
// the D-29 shape: it must not be reported as a conflict.
for (const codeless of [{}, { code: '40001' }, { message: 'upstream request timeout' }, null, 'boom']) {
  const failure = transitionFailure(codeless)
  assert.equal(failure.status, TRANSPORT_FAILURE_STATUS, 'a codeless refusal is 502, not 500 and not 409')
  assert.equal(failure.body.error.kind, 'unavailable')
  assert.equal(failure.body.error.errcode, null)
  assert.equal(failure.body.error.retryable, true, 'safe only because the call carries an idempotency key')
}

assert.equal(transitionError('unauthenticated').error.retryable, false)
assert.equal(UNAUTHENTICATED_STATUS, 401)
assert.equal(NOT_IMPLEMENTED_STATUS, 501)
assert.deepEqual(transitionSuccess('a', 7), { ok: true, offer_id: 'a', revision: 7 })

// -----------------------------------------------------------------------------
// 4. Request validation, executed
// -----------------------------------------------------------------------------

const OFFER = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
const KEY = 'idem-key-0001'

const good = parseTransitionInput({ offer_id: OFFER, expected_revision: 3, idempotency_key: KEY })
assert.equal(good.ok, true)
assert.deepEqual(good.value, { offerId: OFFER, expectedRevision: 3, idempotencyKey: KEY })

for (const bad of [
  null,
  'string',
  [],
  {},
  { offer_id: OFFER, expected_revision: 1 },
  { offer_id: OFFER, expected_revision: 1, idempotency_key: 'short' },
  { offer_id: OFFER, expected_revision: 1, idempotency_key: 'x'.repeat(201) },
  { offer_id: 'not-a-uuid', expected_revision: 1, idempotency_key: KEY },
  { offer_id: OFFER, expected_revision: '1', idempotency_key: KEY },
  { offer_id: OFFER, expected_revision: 1.5, idempotency_key: KEY },
  // Below REVISION_START: revisions start at 1 and step by one, so 0 is not a
  // stale revision, it is a malformed one.
  { offer_id: OFFER, expected_revision: 0, idempotency_key: KEY },
]) {
  const parsed = parseTransitionInput(bad)
  assert.equal(parsed.ok, false, `expected refusal for ${JSON.stringify(bad)}`)
  assert.equal(parsed.status, 400)
  assert.equal(parsed.body.error.kind, 'invalid_argument')
  assert.equal(parsed.body.error.retryable, false)
}

// The Idempotency-Key header is a fallback, not an override.
const fromHeader = parseTransitionInput({ offer_id: OFFER, expected_revision: 1 }, KEY)
assert.equal(fromHeader.ok, true)
assert.equal(fromHeader.value.idempotencyKey, KEY)

const bodyWins = parseTransitionInput(
  { offer_id: OFFER, expected_revision: 1, idempotency_key: KEY },
  'header-key-9999'
)
assert.equal(bodyWins.value.idempotencyKey, KEY)

assert.equal(isUuid(OFFER), true)
assert.equal(isUuid(OFFER.toUpperCase()), true)
assert.equal(isUuid(`${OFFER}x`), false)
assert.equal(isUuid(42), false)

// -----------------------------------------------------------------------------
// 5. The deferred seven: registered, honest, and self-invalidating
// -----------------------------------------------------------------------------

assert.equal(DEFERRED_M3_ENDPOINTS.length, DEFERRED_ROUTES.length)

for (const route of DEFERRED_ROUTES) {
  const source = routeSource(route)
  const requestPath = `/api/${route}`

  // Exact substring rather than a constructed RegExp. The escaping here was
  // partial — it escaped "/" but not "\\" — and an exact match is what this
  // assertion actually means.
  const expectedWiring = `export const POST = deferredRoute('${requestPath}')`
  assert.ok(
    source.includes(expectedWiring),
    `${route}: must be wired to the deferred-route factory — expected ${expectedWiring}`
  )

  const endpoint = deferredEndpoint(requestPath)
  assert.notEqual(endpoint, undefined, `${requestPath} is not in DEFERRED_M3_ENDPOINTS`)
  assert.ok(endpoint.missing.length > 0, `${requestPath} must name what it is waiting for`)
  assert.match(endpoint.blockedOn, /Phase 4/, `${requestPath} must name the phase that owns it`)

  // The self-invalidating half: if a listed object ever appears in a migration,
  // the dependency is met and this route is due. Failing here is the reminder.
  for (const missing of endpoint.missing) {
    assert.equal(
      new RegExp(`\\b${missing}\\b`).test(migrations),
      false,
      `${missing} now exists in supabase/migrations — implement ${requestPath} instead of answering 501`
    )
  }
}

// A backed route must never be in the deferred registry, and vice versa.
for (const route of Object.keys(BACKED_ROUTES)) {
  assert.equal(deferredEndpoint(`/api/${route}`), undefined, `${route} has a writer; it must not be deferred`)
}

const deferredFactory = fs.readFileSync(path.join(root, 'src/lib/api/deferred-route.ts'), 'utf8')
assert.match(deferredFactory, /NOT_IMPLEMENTED_STATUS/, 'the deferred factory must answer 501')
assert.equal(
  /\.rpc\(|createClient/.test(deferredFactory),
  false,
  'a deferred route has nothing to call; it must not open a database connection'
)

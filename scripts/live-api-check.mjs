// Live end-to-end check of the M3 write path — Docs/DECISIONS.md D-31.
//
// tests/live-rls.test.mjs proves the database half: real JWTs over PostgREST are
// refused or accepted as rev. 5.3 §12 requires. It says nothing about the HTTP
// routes, because it does not go through them.
//
// This script does. It signs a member in, mints the session cookie the way
// @supabase/ssr does, and drives the real Next server over HTTP — so what it
// proves is the whole chain:
//
//   fetch -> route.ts -> offerTransitionRoute -> auth.getUser() (cookie)
//         -> supabase.rpc(offer_*) -> SECURITY DEFINER function -> SQLSTATE
//         -> transitionFailure() -> status line
//
// It is NOT part of `npm run test`: it needs a running server built against the
// preview branch, which a checkout does not have. It is run by hand and its
// output is the evidence recorded in D-31.
//
// Usage:
//   1. eval "$(sed 's/^/export /' .env.preview.local)"          # preview creds
//   2. NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
//      NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY npx next build
//   3. ... npx next start -p 3111
//   4. node scripts/live-api-check.mjs http://127.0.0.1:3111
//
// SAFETY: same guard as live-rls.test.mjs — it refuses to run against the
// production project ref, and it deletes the users it creates.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { TRANSITION_ERRCODES } from '../src/lib/domain/index.ts'

const PRODUCTION_REF = 'bwpguotjzczmieeepczf'
const BASE = process.argv[2] ?? 'http://127.0.0.1:3111'

function loadEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  return out
}

const fileEnv = loadEnvFile(path.join(process.cwd(), '.env.preview.local'))
const env = (key) => process.env[key] ?? fileEnv[key]

const SUPABASE_URL = env('SUPABASE_URL')
const ANON_KEY = env('SUPABASE_ANON_KEY')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.log('live-api: SKIPPED — no preview credentials in .env.preview.local')
  process.exit(0)
}


// The URL and keys come from a gitignored local file. Pin the URL's shape before
// the service-role key is ever sent to it: without this, editing .env.preview.local
// is enough to point an admin-privileged request — carrying that key — at an
// arbitrary host. The production-ref check below stops the right-host/wrong-project
// mistake; this stops the wrong-host one.
const supabaseUrl = new URL(SUPABASE_URL)
assert.equal(supabaseUrl.protocol, 'https:', `SUPABASE_URL must be https, got ${supabaseUrl.protocol}`)
assert.match(
  supabaseUrl.hostname,
  /^[a-z0-9]{20}\.supabase\.co$/,
  `SUPABASE_URL must be a supabase.co project host, got ${supabaseUrl.hostname}`
)

const projectRef = supabaseUrl.hostname.split('.')[0]
assert.notEqual(projectRef, PRODUCTION_REF, `refusing to run against production (${PRODUCTION_REF})`)
console.log(`live-api: target preview project ${projectRef} via ${BASE}\n`)

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// randomUUID rather than Math.random: this seeds the password of a real (if
// short-lived) Supabase account, and Math.random is predictable from prior
// outputs. The cost of using a CSPRNG for a throwaway credential is nil.
const stamp = `${Date.now().toString(36)}${randomUUID().replace(/-/g, '').slice(0, 12)}`
const createdUserIds = []
let checks = 0
let failed = false

function record(label, observed) {
  checks += 1
  console.log(`  ok  ${label}\n        ${observed}`)
}

async function createUser(tag) {
  const email = `live-api-${tag}-${stamp}@sluglines.test`
  const password = `Pw-${stamp}-${tag}!`
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const body = await res.json()
  assert.equal(res.status, 200, `admin create user ${tag}: ${JSON.stringify(body)}`)
  createdUserIds.push(body.id)
  return { id: body.id, email, password }
}

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } }

async function signIn(user) {
  const client = createClient(SUPABASE_URL, ANON_KEY, clientOpts)
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  assert.equal(error, null, `sign-in failed: ${error && error.message}`)
  return { client, session: data.session }
}

/**
 * Mint the request Cookie header the way the app's own server client will read
 * it — by handing the session to `@supabase/ssr` itself and capturing what it
 * writes. Hand-rolling the cookie name and encoding would be a guess about a
 * package internal; this is the package's own answer, so if the format changes
 * this script follows it automatically.
 */
async function sessionCookieHeader(session) {
  const jar = new Map()
  const writer = createServerClient(SUPABASE_URL, ANON_KEY, {
    // `persistSession` must stay on: it is what makes setSession() write to the
    // cookie store below, which is the artefact this function exists to capture.
    auth: { persistSession: true, autoRefreshToken: false },
    cookies: {
      get: (name) => jar.get(name),
      set: (name, value) => { jar.set(name, value) },
      remove: (name) => { jar.delete(name) },
    },
  })
  await writer.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  assert.ok(jar.size > 0, '@supabase/ssr wrote no session cookie')
  // Sent raw, not percent-encoded: Next's `cookies()` hands the route the value
  // as it arrived, so an encoded value would reach `@supabase/ssr` as a string
  // that is not JSON. The session payload is base64url and ASCII punctuation
  // with no `%` in it, so raw is unambiguous either way.
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function post(route, body, cookie) {
  const res = await fetch(`${BASE}${route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text }
}

try {
  const posterUser = await createUser('poster')
  const outsiderUser = await createUser('outsider')
  const poster = await signIn(posterUser)
  const outsider = await signIn(outsiderUser)

  const posterCookie = await sessionCookieHeader(poster.session)
  const outsiderCookie = await sessionCookieHeader(outsider.session)

  // ---------------------------------------------------------------------------
  // Fixture, built through the database exactly as live-rls.test.mjs does. The
  // routes under test are the *transition* routes; creating and publishing an
  // offer are not among the eleven this slice ships.
  // ---------------------------------------------------------------------------
  const key = (op) => `live-api-${op}-${stamp}`
  const { data: offerId, error: createError } = await poster.client.rpc('offer_create', {
    p_poster_role: 'driver',
    p_origin_location_id: crypto.randomUUID(),
    p_destination_location_id: crypto.randomUUID(),
    p_window_start: new Date(Date.now() + 3600e3).toISOString(),
    p_window_end: new Date(Date.now() + 7200e3).toISOString(),
    p_seats_total: 1,
    p_idempotency_key: key('create'),
  })
  assert.equal(createError, null, `offer_create: ${createError && createError.message}`)

  const { data: published, error: publishError } = await poster.client.rpc('offer_publish', {
    p_offer_id: offerId,
    p_expected_revision: 1,
    p_idempotency_key: key('publish'),
  })
  assert.equal(publishError, null, `offer_publish: ${publishError && publishError.message}`)
  console.log(`fixture: offer ${offerId} is OPEN at revision ${published}\n`)

  const readOffer = async () => {
    const { data } = await poster.client.from('offers').select('state, revision').eq('id', offerId).single()
    return data
  }

  // ---------------------------------------------------------------------------
  // 1. No session — refused before any database work
  // ---------------------------------------------------------------------------
  console.log('session')
  const anon = await post('/api/offers/cancel', { offer_id: offerId, expected_revision: published, idempotency_key: key('anon') })
  assert.equal(anon.status, 401)
  assert.equal(anon.json.error.kind, 'unauthenticated')
  record('POST /api/offers/cancel with no cookie is 401', `${anon.status} ${anon.json.error.kind}`)

  const untouched = await readOffer()
  assert.equal(untouched.revision, published, 'the refused call must have applied nothing')
  record('the 401 applied nothing', `state=${untouched.state} revision=${untouched.revision}`)

  // ---------------------------------------------------------------------------
  // 2. Session present, body malformed — 400 before the RPC
  // ---------------------------------------------------------------------------
  console.log('\nvalidation')
  for (const [label, body] of [
    ['missing idempotency_key', { offer_id: offerId, expected_revision: published }],
    ['idempotency_key too short', { offer_id: offerId, expected_revision: published, idempotency_key: 'short' }],
    ['offer_id not a uuid', { offer_id: 'nope', expected_revision: published, idempotency_key: key('bad') }],
    ['expected_revision not an integer', { offer_id: offerId, expected_revision: '2', idempotency_key: key('bad') }],
  ]) {
    const res = await post('/api/offers/cancel', body, posterCookie)
    assert.equal(res.status, 400, `${label}: expected 400, got ${res.status} ${res.text}`)
    assert.equal(res.json.error.kind, 'invalid_argument')
    record(`${label} is 400 invalid_argument`, `${res.status} ${res.json.error.kind}`)
  }

  // ---------------------------------------------------------------------------
  // 3. Authorisation is still the database's, not the route's
  // ---------------------------------------------------------------------------
  console.log('\nauthorisation (enforced inside the SECURITY DEFINER function)')
  const stranger = await post(
    '/api/offers/cancel',
    { offer_id: offerId, expected_revision: published, idempotency_key: key('outsider') },
    outsiderCookie
  )
  assert.equal(stranger.status, 403, `expected 403, got ${stranger.status} ${stranger.text}`)
  assert.equal(stranger.json.error.errcode, TRANSITION_ERRCODES.FORBIDDEN)
  record('a non-participant with a valid session is 403', `${stranger.status} ${stranger.json.error.errcode}`)

  // ---------------------------------------------------------------------------
  // 4. The D-30 conflict path, end to end through HTTP
  // ---------------------------------------------------------------------------
  console.log('\nconflict (Docs/DECISIONS.md D-29 / D-30)')
  const startedAt = Date.now()
  const stale = await post(
    '/api/offers/cancel',
    { offer_id: offerId, expected_revision: published - 1, idempotency_key: key('stale') },
    posterCookie
  )
  const elapsed = Date.now() - startedAt
  assert.equal(stale.status, 409, `expected 409, got ${stale.status} ${stale.text}`)
  assert.equal(stale.json.error.errcode, TRANSITION_ERRCODES.CONFLICT)
  assert.equal(stale.json.error.kind, 'conflict')
  assert.equal(stale.json.error.retryable, false)
  assert.ok(elapsed < 15000, `a conflict must be refused promptly; took ${elapsed} ms`)
  record('a stale revision is 409 PT409, promptly', `${stale.status} ${stale.json.error.errcode} in ${elapsed} ms`)

  const afterConflict = await readOffer()
  assert.equal(afterConflict.revision, published)
  record('the 409 applied nothing', `state=${afterConflict.state} revision=${afterConflict.revision}`)

  // ---------------------------------------------------------------------------
  // 5. The happy path, and idempotency through the route
  // ---------------------------------------------------------------------------
  console.log('\ntransition')
  const cancelKey = key('cancel')
  const ok = await post(
    '/api/offers/cancel',
    { offer_id: offerId, expected_revision: published, idempotency_key: cancelKey },
    posterCookie
  )
  assert.equal(ok.status, 200, `expected 200, got ${ok.status} ${ok.text}`)
  assert.equal(ok.json.ok, true)
  assert.equal(ok.json.revision, published + 1)
  record('OPEN -> CANCELLED is 200 with the new revision', `${ok.status} revision=${ok.json.revision}`)

  const cancelled = await readOffer()
  assert.equal(cancelled.state, 'CANCELLED')
  record('the offer really moved', `state=${cancelled.state} revision=${cancelled.revision}`)

  const replay = await post(
    '/api/offers/cancel',
    { offer_id: offerId, expected_revision: published, idempotency_key: cancelKey },
    posterCookie
  )
  assert.equal(replay.status, 200)
  assert.equal(replay.json.revision, ok.json.revision, 'a replayed key must return the first result')
  const afterReplay = await readOffer()
  assert.equal(afterReplay.revision, cancelled.revision, 'a replayed key must apply nothing twice')
  record('the same idempotency key replays', `${replay.status} revision=${replay.json.revision}, offer unmoved`)

  // The Idempotency-Key header is accepted in place of the body field.
  const headerRes = await fetch(`${BASE}/api/offers/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: posterCookie, 'idempotency-key': cancelKey },
    body: JSON.stringify({ offer_id: offerId, expected_revision: published }),
  })
  const headerJson = await headerRes.json()
  assert.equal(headerRes.status, 200)
  assert.equal(headerJson.revision, ok.json.revision)
  record('the Idempotency-Key header is accepted', `${headerRes.status} revision=${headerJson.revision}`)

  // ---------------------------------------------------------------------------
  // 6. Illegal state is 422, not 409 — the §10 distinction the status line carries
  // ---------------------------------------------------------------------------
  console.log('\nillegal state')
  const advance = await post(
    '/api/offers/advance',
    { offer_id: offerId, expected_revision: cancelled.revision, idempotency_key: key('advance') },
    posterCookie
  )
  assert.equal(advance.status, 422, `expected 422, got ${advance.status} ${advance.text}`)
  assert.equal(advance.json.error.errcode, TRANSITION_ERRCODES.ILLEGAL_STATE)
  assert.notEqual(advance.status, 409, 'only a revision conflict may be 409')
  record('advancing a CANCELLED offer is 422 illegal_state', `${advance.status} ${advance.json.error.errcode}`)

  // ---------------------------------------------------------------------------
  // 7. The deferred seven answer 501 even with a valid session
  // ---------------------------------------------------------------------------
  console.log('\ndeferred (rev. 5.3 §11 Phase 4)')
  for (const route of [
    '/api/offers/eta',
    '/api/offers/waitlist',
    '/api/reservations/no-show',
    '/api/recurring-offers/cancel',
    '/api/recurring-offers/pause',
    '/api/recurring-offers/resume',
    '/api/recurring-offers/skip',
  ]) {
    const res = await post(route, {}, posterCookie)
    assert.equal(res.status, 501, `${route}: expected 501, got ${res.status}`)
    assert.deepEqual(res.json.deferred.route, route)
    record(`POST ${route} is 501`, `missing: ${res.json.deferred.missing.join(', ')}`)
  }

  // /api/reservations/confirm shares offer_confirm; assert it is reachable and
  // reports the same illegal-state refusal on a CANCELLED offer.
  const reservationConfirm = await post(
    '/api/reservations/confirm',
    { offer_id: offerId, expected_revision: cancelled.revision, idempotency_key: key('rconfirm') },
    posterCookie
  )
  assert.equal(reservationConfirm.status, 422, `expected 422, got ${reservationConfirm.status} ${reservationConfirm.text}`)
  record('POST /api/reservations/confirm reaches offer_confirm', `${reservationConfirm.status} ${reservationConfirm.json.error.errcode}`)
} catch (error) {
  failed = true
  console.error(`\nlive-api: FAILED — ${error && error.message}`)
} finally {
  for (const id of createdUserIds) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders })
  }
  console.log(`\nlive-api: cleaned up ${createdUserIds.length} test user(s)`)
}

if (failed) process.exit(1)
console.log(`live-api: ${checks} checks passed against ${projectRef}`)

// A7: sign-in must show three honest, distinct states — a 4xx the visitor can
// fix, a 5xx that plainly says the fault is ours and does not invite an
// immediate retry, and an explicit "sign-in unavailable" state rendered
// before the form when phone auth is off. Also covers A11's fail-open/closed
// service-client decision for the two OTP routes.
//
// `otp-http.ts` and `phone-auth-availability.ts` are plain modules with no
// `next/server` import, so they run directly under bare Node; the route/page
// files import `next/headers` transitively (via `lib/supabase/server.ts`) and
// cannot, so those are asserted on source text — same split `auth-otp-
// routes.test.mjs` already draws for this codebase.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { classifySendError, classifyVerifyError, otpError, otpStatus } from '../src/lib/api/otp-http.ts'
import { isPhoneAuthEnabled } from '../src/lib/api/phone-auth-availability.ts'

const root = process.cwd()

function read(relPath) {
  const full = path.join(root, relPath)
  assert.equal(fs.existsSync(full), true, `missing file: ${relPath}`)
  return fs.readFileSync(full, 'utf8')
}

// -----------------------------------------------------------------------------
// 1. The 5xx state: plainly our fault, no immediate-retry invitation, and a
// distinct status from the two 4xx kinds.
// -----------------------------------------------------------------------------
{
  const body = otpError('unavailable')
  assert.match(body.error.message, /our end|our side/i, 'unavailable message must say the fault is ours')
  assert.equal(/try again(?!\s+later)/i.test(body.error.message), false, 'must not invite an immediate retry')
  assert.equal(otpStatus('unavailable'), 503)
}

// The two 4xx-the-user-can-fix messages are unchanged by this PR.
assert.equal(otpError('invalid_argument').error.message, 'Enter a valid phone number.')
assert.equal(otpStatus('invalid_argument'), 400)
assert.equal(otpStatus('invalid_code'), 400)
assert.equal(otpStatus('rate_limited'), 429)

// -----------------------------------------------------------------------------
// 2. classifySendError / classifyVerifyError: a provider-disabled 4xx must not
// misclassify as the user's fault (the actual production defect: #52's phone
// auth being off makes GoTrue answer 400 phone_provider_disabled, which the
// old numeric-range-only classifier would have called invalid_argument).
// -----------------------------------------------------------------------------
{
  const kind = classifySendError({ status: 400, code: 'phone_provider_disabled' })
  assert.equal(kind, 'unavailable', 'a disabled provider must never read as "you gave a bad phone number"')
}
{
  const kind = classifyVerifyError({ status: 400, code: 'phone_provider_disabled' })
  assert.equal(kind, 'unavailable')
}

// Ordinary 4xx (no known "not your fault" code) still classifies as the
// user-fixable kind — this fix must not swallow real invalid input.
assert.equal(classifySendError({ status: 400 }), 'invalid_argument')
assert.equal(classifyVerifyError({ status: 400 }), 'invalid_code')

// 429 and "anything else" behaviour is unchanged.
assert.equal(classifySendError({ status: 429 }), 'rate_limited')
assert.equal(classifySendError({ status: 500 }), 'unavailable')
assert.equal(classifySendError(null), 'unavailable')
assert.equal(classifySendError(undefined), 'unavailable')

// -----------------------------------------------------------------------------
// 3. isPhoneAuthEnabled: reads GoTrue's public settings endpoint, fails OPEN
// on any network/parse failure, and never needs the service-role key (A11's
// dependency is orthogonal to A7's).
// -----------------------------------------------------------------------------
const OLD_ENV = { ...process.env }
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

function fakeFetch(handler) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init)
  }
  fn.calls = calls
  return fn
}

{
  const fetchImpl = fakeFetch(async () => ({ ok: true, json: async () => ({ external: { phone: true } }) }))
  const enabled = await isPhoneAuthEnabled(fetchImpl)
  assert.equal(enabled, true)
  assert.equal(fetchImpl.calls.length, 1)
  assert.equal(fetchImpl.calls[0].url, 'https://example.supabase.co/auth/v1/settings')
  assert.equal(fetchImpl.calls[0].init.headers.apikey, 'test-anon-key', 'must authenticate with the anon key, not the service-role key')
}
{
  // The actual production fact this whole state exists for: external.phone: false.
  const fetchImpl = fakeFetch(async () => ({ ok: true, json: async () => ({ external: { phone: false } }) }))
  assert.equal(await isPhoneAuthEnabled(fetchImpl), false)
}
{
  // Fail OPEN on a non-2xx response — a health-check hiccup must not hide the
  // whole sign-in surface.
  const fetchImpl = fakeFetch(async () => ({ ok: false, json: async () => ({}) }))
  assert.equal(await isPhoneAuthEnabled(fetchImpl), true)
}
{
  // Fail OPEN on a thrown network error.
  const fetchImpl = fakeFetch(async () => {
    throw new Error('fetch failed')
  })
  assert.equal(await isPhoneAuthEnabled(fetchImpl), true)
}
{
  // Fail OPEN on a body that doesn't carry the expected shape at all.
  const fetchImpl = fakeFetch(async () => ({ ok: true, json: async () => ({}) }))
  assert.equal(await isPhoneAuthEnabled(fetchImpl), true)
}
Object.assign(process.env, OLD_ENV)

// -----------------------------------------------------------------------------
// 4. The service-client fault handling in the two OTP routes cannot be
// exercised directly (they import next/headers transitively) — asserted on
// source text instead, same convention auth-otp-routes.test.mjs uses.
// -----------------------------------------------------------------------------
const sendHandler = read('src/lib/api/send-otp-route.ts')
const verifyHandler = read('src/lib/api/verify-otp-route.ts')

// send-otp: A11's fail-CLOSED decision. A service-client construction failure
// (SUPABASE_SERVICE_ROLE_KEY unset — production's current state) must return
// the honest `unavailable` response, not let the throw escape uncaught (the
// exact shape of the reproduced production 500).
{
  const tryIndex = sendHandler.indexOf('try {')
  const catchIndex = sendHandler.indexOf('createServiceClient()')
  assert.ok(tryIndex >= 0 && catchIndex > tryIndex, 'send-otp: createServiceClient() must be called inside a try block')
  const afterCreate = sendHandler.slice(catchIndex, catchIndex + 1200)
  assert.match(afterCreate, /catch\s*\{/, 'send-otp: the service-client construction must be caught')
  assert.match(
    afterCreate,
    /otpError\('unavailable'\)/,
    'send-otp: a service-client construction failure must answer the unavailable kind'
  )
}

// verify-otp: A11's fail-OPEN decision, the opposite of send. A construction
// failure must not block a verify — it must proceed as if the durable check
// were "allowed", the same shape durable-rate-limit.ts itself fails open with.
{
  assert.match(verifyHandler, /rateLimitClient\s*=\s*null/, 'verify-otp: a construction failure must null out the client, not throw')
  assert.match(
    verifyHandler,
    /allowed:\s*true,\s*retryAfterMs:\s*0/,
    'verify-otp: the no-client fallback must be the same shape as a fail-open durable-limiter result'
  )
  assert.equal(
    /return NextResponse\.json\(otpError\('unavailable'\)/.test(verifyHandler.slice(0, verifyHandler.indexOf('rateLimitClient'))),
    false,
    'verify-otp must not fail closed before the durable check the way send-otp does'
  )
}

// -----------------------------------------------------------------------------
// 5. The proactive "sign-in unavailable" state: gates the form server-side,
// before either client component ever mounts.
// -----------------------------------------------------------------------------
const loginPage = read('src/app/login/page.tsx')
const verifyPage = read('src/app/verify/page.tsx')
const signInUnavailable = read('src/components/SignInUnavailable.tsx')

for (const [name, source] of [
  ['login page', loginPage],
  ['verify page', verifyPage],
]) {
  assert.match(source, /isPhoneAuthEnabled\(\)/, `${name}: must call isPhoneAuthEnabled() to gate the form`)
  assert.match(source, /SignInUnavailable/, `${name}: must be able to render the unavailable state`)
  assert.equal(/^['"]use client['"]/m.test(source), false, `${name}: the gate must run server-side, not client-side`)
}

assert.equal(/^['"]use client['"]/m.test(signInUnavailable), false, 'SignInUnavailable must be a server component (static, no state)')

// -----------------------------------------------------------------------------
// 6. Both client forms fall back to the shared, honest `unavailable` copy —
// not an independent hardcoded "something went wrong" string that could drift
// from otp-http.ts's wording.
// -----------------------------------------------------------------------------
const loginForm = read('src/components/LoginForm.tsx')
const verifyForm = read('src/components/VerifyForm.tsx')

for (const [name, source] of [
  ['LoginForm', loginForm],
  ['VerifyForm', verifyForm],
]) {
  assert.equal(/Something went wrong/.test(source), false, `${name}: must not hardcode the old misleading fallback copy`)
  assert.match(source, /from '@\/lib\/api\/otp-http\.ts'/, `${name}: must source its fallback copy from otp-http.ts`)
}

console.log('signin-error-states: ok')

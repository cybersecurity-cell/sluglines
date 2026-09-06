// Structural tests for rev. 5.3 §8 M2 identity wiring: the two OTP API
// routes, the SQL writer they and `/onboarding` depend on, and the three
// pages of the flow. Route/page files import `next/server` or `next/headers`
// and cannot be executed under bare Node — see `api-routes.test.mjs`'s own
// header for why this repo asserts on their source text instead.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_SIGNED_IN_PATH,
  OTP_PHONE_COOKIE,
  isPlaceholderDisplayName,
  safeNextPath,
  signedInDestination,
  withNext,
} from '../src/lib/domain/auth-return.ts'

const root = process.cwd()
const authApiDir = path.join(root, 'src/app/api/auth')

function read(relPath) {
  const full = path.join(root, relPath)
  assert.equal(fs.existsSync(full), true, `missing file: ${relPath}`)
  return fs.readFileSync(full, 'utf8')
}

// -----------------------------------------------------------------------------
// 1. The route surface is exactly the two rev. 5.3 §8 M2 routes
// -----------------------------------------------------------------------------
function collectRoutes(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectRoutes(full, prefix ? `${prefix}/${entry.name}` : entry.name)
    return entry.name === 'route.ts' ? [prefix] : []
  })
}

const onDisk = collectRoutes(authApiDir).sort()
assert.deepEqual(onDisk, ['send-otp', 'verify-otp'], 'src/app/api/auth holds exactly the two M2 routes')

const sendRoute = read('src/app/api/auth/send-otp/route.ts')
const verifyRoute = read('src/app/api/auth/verify-otp/route.ts')

for (const [name, source, handler] of [
  ['send-otp', sendRoute, 'sendOtpHandler'],
  ['verify-otp', verifyRoute, 'verifyOtpHandler'],
]) {
  assert.match(source, new RegExp(`^export const POST = ${handler}$`, 'm'), `${name}: must export POST = ${handler}`)
  assert.equal(/export const (GET|PUT|PATCH|DELETE|HEAD)/.test(source), false, `${name}: POST only`)

  // The route file itself never touches Supabase — all logic lives in the
  // lib/api handler, same discipline `offer-transition-route.ts` enforces for
  // the M3 routes.
  assert.equal(
    /@supabase|createClient|\.rpc\(|\.from\(/.test(source),
    false,
    `${name}: route.ts must not touch Supabase directly; logic belongs in the lib/api handler`
  )
}

// -----------------------------------------------------------------------------
// 2. The handlers: no application table ever sees a phone number
//
// rev. 5.3 §6 identity invariant — Supabase Auth is the sole durable store of
// phone numbers. Neither handler may call `.from(...)` at all: their only
// Supabase surface is `supabase.auth.*`.
// -----------------------------------------------------------------------------
const sendHandler = read('src/lib/api/send-otp-route.ts')
const verifyHandler = read('src/lib/api/verify-otp-route.ts')

assert.match(sendHandler, /supabase\.auth\.signInWithOtp\(/, 'send-otp handler must call signInWithOtp')
assert.match(verifyHandler, /supabase\.auth\.verifyOtp\(/, 'verify-otp handler must call verifyOtp')
assert.match(verifyHandler, /type:\s*'sms'/, 'verify-otp handler must verify an SMS OTP, not another factor')

for (const [name, source] of [
  ['send-otp handler', sendHandler],
  ['verify-otp handler', verifyHandler],
]) {
  assert.equal(/\.from\(/.test(source), false, `${name}: must not touch any table directly`)
  assert.match(source, /from '@\/lib\/supabase\/server\.ts'/, `${name}: must use the cookie-bound server client`)
}

// Anti-enumeration (D-8, threat T10): a successful send answers the same
// generic body regardless of any internal condition — no branch on whether
// the number "already exists".
assert.match(sendHandler, /NextResponse\.json\(\{\s*ok:\s*true\s*\}\)/, 'send-otp success body must be generic')

// All migration SQL, joined — used by sections 3b, 4 below.
const migrations = fs
  .readdirSync(path.join(root, 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'))
  .join('\n')

// -----------------------------------------------------------------------------
// 3. Abuse controls: both handlers rate-limit before calling Supabase Auth
//
// issue #55: the in-memory limiter is now a zero-round-trip pre-check, not
// the source of truth. The durable, Postgres-backed limiter
// (`durable-rate-limit.ts`) is what actually coordinates the cap across
// serverless instances, and must run — via the service-role client, never
// the cookie-bound one `rate_limit_hit()` is not granted to — before either
// handler calls Supabase Auth.
// -----------------------------------------------------------------------------
for (const [name, source] of [
  ['send-otp handler', sendHandler],
  ['verify-otp handler', verifyHandler],
]) {
  assert.match(source, /createFixedWindowLimiter/, `${name}: must use the in-memory pre-check limiter`)
  assert.match(source, /from '\.\/rate-limit\.ts'/, `${name}: must import the in-memory rate limiter`)
  assert.match(source, /createDurableRateLimiter/, `${name}: must use the durable rate limiter`)
  assert.match(source, /from '\.\/durable-rate-limit\.ts'/, `${name}: must import the durable rate limiter`)
  assert.match(
    source,
    /from '@\/lib\/supabase\/service\.ts'/,
    `${name}: must call the durable limiter through the service-role client`
  )

  const limiterIndex = source.indexOf('Limiter.consume')
  const durableLimiterIndex = source.search(/durable\w*Limiter\.consume/)
  const authCallIndex = source.search(/supabase\.auth\.(signInWithOtp|verifyOtp)\(/)
  assert.ok(
    limiterIndex >= 0 && durableLimiterIndex >= 0 && authCallIndex >= 0,
    `${name}: expected an in-memory check, a durable check, and an auth call`
  )
  assert.ok(limiterIndex < authCallIndex, `${name}: the in-memory rate-limit check must run before the Supabase Auth call`)
  assert.ok(durableLimiterIndex < authCallIndex, `${name}: the durable rate-limit check must run before the Supabase Auth call`)
}

// D-8's own number: verify attempts are capped at 5 per phone per hour, both
// in-memory and in the durable limiter that is now the source of truth.
assert.match(verifyHandler, /max:\s*5,\s*windowMs:\s*HOUR_MS/, 'verify-otp: D-8 caps 5 attempts per number per hour')
assert.match(
  verifyHandler,
  /durablePhoneLimiter\s*=\s*createDurableRateLimiter\(\{\s*max:\s*5,\s*windowMs:\s*HOUR_MS\s*\}\)/,
  'verify-otp: the durable limiter must carry the same D-8 cap as the in-memory pre-check'
)

// -----------------------------------------------------------------------------
// 3b. rate_limit_hit() is locked to service_role — never anon, never
// authenticated. A client that could call it directly could pass an
// arbitrary p_max, or spend another caller's bucket key to lock them out.
// -----------------------------------------------------------------------------
assert.match(
  migrations,
  /grant execute on function public\.rate_limit_hit\([^)]*\) to service_role;/,
  'rate_limit_hit(...) must be granted to service_role'
)
assert.equal(
  /grant execute on function public\.rate_limit_hit\([^)]*\) to (anon|authenticated)/.test(migrations),
  false,
  'rate_limit_hit(...) must never be granted to anon or authenticated'
)
assert.match(
  migrations,
  /revoke all on function public\.rate_limit_hit\([^)]*\) from public;/,
  'rate_limit_hit(...) must be revoked from PUBLIC'
)

// -----------------------------------------------------------------------------
// 4. set_home_spot(uuid): granted, revoked from PUBLIC, and only writes
//    location_id — the same wiring proof api-routes.test.mjs runs for the M3
//    transition functions, applied to the one M2 writer this slice adds.
// -----------------------------------------------------------------------------
assert.match(
  migrations,
  /grant execute on function public\.set_home_spot\(uuid\) to authenticated;/,
  'set_home_spot(uuid) must be granted to authenticated'
)
assert.match(
  migrations,
  /revoke all on function public\.set_home_spot\(uuid\) from public;/,
  'set_home_spot(uuid) must be revoked from PUBLIC'
)
assert.match(migrations, /if not v_active then/, 'set_home_spot must reject an inactive location')

// -----------------------------------------------------------------------------
// 5. /onboarding: requires a session, writes only through the two RPCs, never
//    inserts into members (row creation is trigger-only, 0001) or touches role
// -----------------------------------------------------------------------------
const onboardingPage = read('src/app/onboarding/page.tsx')
const onboardingActions = read('src/app/onboarding/actions.ts')
const onboardingLib = read('src/lib/onboarding.ts')

assert.match(onboardingPage, /redirect\('\/login'\)/, '/onboarding must redirect signed-out visitors to /login')
assert.match(onboardingLib, /is_active/, 'the home-spot query must scope to active locations')

assert.match(onboardingActions, /supabase\.rpc\('set_display_name'/, 'onboarding must call set_display_name')
assert.match(onboardingActions, /supabase\.rpc\('set_home_spot'/, 'onboarding must call set_home_spot')
assert.equal(/\.insert\(/.test(onboardingActions), false, 'onboarding must never insert a members row directly')
assert.equal(/p_role|['"]role['"]\s*:/.test(onboardingActions), false, 'onboarding must never write the role column')

// -----------------------------------------------------------------------------
// 6. /login and /verify: the OTP exchange is client-side (fetch to the JSON
//    routes above); the page shells themselves stay server components.
// -----------------------------------------------------------------------------
const loginPage = read('src/app/login/page.tsx')
const verifyPage = read('src/app/verify/page.tsx')
const loginForm = read('src/components/LoginForm.tsx')
const verifyForm = read('src/components/VerifyForm.tsx')

for (const [name, source] of [
  ['login page', loginPage],
  ['verify page', verifyPage],
]) {
  assert.equal(/^['"]use client['"]/m.test(source), false, `${name}: the page shell must stay a server component`)
}

for (const [name, source] of [
  ['LoginForm', loginForm],
  ['VerifyForm', verifyForm],
]) {
  assert.match(source, /^['"]use client['"]/m, `${name}: must be a client component (interactive OTP exchange)`)
  assert.equal(/@supabase|createClient\(/.test(source), false, `${name}: must not import a Supabase client`)
}

assert.match(loginForm, /fetch\('\/api\/auth\/send-otp'/, 'LoginForm must post to /api/auth/send-otp')
assert.match(verifyForm, /fetch\('\/api\/auth\/verify-otp'/, 'VerifyForm must post to /api/auth/verify-otp')
assert.match(verifyPage, /redirect\('\/login'\)/, '/verify with no phone cookie must send the visitor back')

// -----------------------------------------------------------------------------
// 7. Issue #136 — `next` survives the whole flow, onboarding runs once, the
//    phone stays out of the URL, /dashboard does not 500 without env, and an
//    error boundary exists.
// -----------------------------------------------------------------------------

// The return path is a same-origin absolute path or nothing. An open redirect
// through the sign-in flow is the classic phishing hop.
for (const good of ['/board', '/spots/Horner-Rd', '/dashboard?checkout=failed', '/a/b/c']) {
  assert.equal(safeNextPath(good), good, `${good} is a safe next`)
}
for (const bad of [
  '//evil.example',
  '\\\\evil.example',
  '/\\evil.example',
  'https://evil.example/',
  'javascript:alert(1)',
  'board',
  '',
  '/with space',
  '/ctrl\u0000char',
  `/${'x'.repeat(300)}`,
  null,
  undefined,
  42,
  ['/board'],
]) {
  assert.equal(safeNextPath(bad), undefined, `${JSON.stringify(bad)} must be rejected as a next path`)
}
assert.equal(withNext('/verify', '/board'), '/verify?next=%2Fboard')
assert.equal(withNext('/onboarding?onboarding=failed', '/board'), '/onboarding?onboarding=failed&next=%2Fboard')
assert.equal(withNext('/verify', undefined), '/verify')
assert.equal(signedInDestination('/board'), '/board')
assert.equal(signedInDestination('//evil.example'), DEFAULT_SIGNED_IN_PATH, 'a bad next falls back to the dashboard, never through')
assert.equal(signedInDestination(undefined), '/dashboard')

// The placeholder is exactly what handle_new_member() (0001) writes.
const foundation136 = read('supabase/migrations/0001_rebuild_foundation.sql')
assert.match(foundation136, /'member-' \|\| substr\(new\.id::text, 1, 8\)/, "the trigger's placeholder shape is what the skip keys on")
assert.equal(isPlaceholderDisplayName('member-0a1b2c3d'), true)
assert.equal(isPlaceholderDisplayName('member-0A1B2C3D'), false, 'uuid text is lower-case hex')
assert.equal(isPlaceholderDisplayName('member-0a1b2c3'), false)
assert.equal(isPlaceholderDisplayName('Kalai'), false)
assert.equal(isPlaceholderDisplayName(''), false)
assert.equal(isPlaceholderDisplayName(null), false)

// `next` is carried: login page -> LoginForm -> /verify -> VerifyForm -> /onboarding -> action.
assert.match(loginPage, /safeNextPath\(resolvedSearchParams\?\.next\)/, '/login reads and sanitises ?next=')
assert.match(loginPage, /<LoginForm next=\{next\}/, 'and hands it to the form')
assert.match(loginForm, /router\.push\(withNext\('\/verify', next\)\)/, 'LoginForm carries next to /verify')
assert.match(verifyPage, /safeNextPath\(resolvedSearchParams\?\.next\)/, '/verify reads and sanitises ?next=')
assert.match(verifyForm, /router\.push\(withNext\('\/onboarding', next\)\)/, 'VerifyForm carries next to /onboarding')
assert.match(onboardingPage, /safeNextPath\(resolvedSearchParams\?\.next\)/, '/onboarding reads and sanitises ?next=')
assert.match(onboardingPage, /redirect\(signedInDestination\(next\)\)/, 'a returning member skips straight to next')
assert.match(onboardingPage, /!isPlaceholderDisplayName\(profile\.displayName\)/, 'the skip keys on the placeholder name, not on "has a row"')
assert.match(onboardingActions, /safeNextPath\(formData\.get\('next'\)\)/, 'the action re-sanitises the hidden next field')
assert.match(onboardingActions, /signedInDestination\(next\)/, 'and honours it on success')
const onboardingForm136 = read('src/components/OnboardingForm.tsx')
assert.match(onboardingForm136, /name="next" value=\{next\}/, 'the form carries next through the post')

// The phone number stays out of the URL: cookie set on send, read on /verify,
// cleared on verify.
const sendOtpSource136 = read('src/lib/api/send-otp-route.ts')
const verifyOtpSource136 = read('src/lib/api/verify-otp-route.ts')
assert.equal(OTP_PHONE_COOKIE, 'sl_otp_phone')
assert.equal(/verify\?phone=/.test(loginForm), false, 'LoginForm must not put the phone in the query string')
assert.match(sendOtpSource136, /response\.cookies\.set\(OTP_PHONE_COOKIE, phone, \{/, 'send-otp sets the phone cookie on success')
assert.match(sendOtpSource136, /httpOnly: true/, 'the phone cookie is httpOnly')
assert.match(sendOtpSource136, /maxAge: OTP_PHONE_COOKIE_MAX_AGE_SECONDS/, 'and short-lived')
assert.match(verifyOtpSource136, /response\.cookies\.set\(OTP_PHONE_COOKIE, '', \{[^}]*maxAge: 0/, 'verify-otp clears it on success')
assert.match(verifyPage, /cookieStore\.get\(OTP_PHONE_COOKIE\)\?\.value/, '/verify reads the phone from the cookie')
assert.equal(/searchParams\)\?\.phone|phone\?: string/.test(verifyPage), false, '/verify no longer reads the phone from the URL')

// The resend cooldown is visible and the button cannot be double-tapped; a
// rate-limited verify is a terminal state; start over is always offered.
assert.match(verifyForm, /OTP_RESEND_COOLDOWN_SECONDS/, 'the cooldown is the published D-8 figure')
assert.match(verifyForm, /Resend code in \$\{cooldown\}s/, 'the cooldown is shown as a countdown')
assert.match(verifyForm, /disabled=\{resendDisabled\}/, 'resend is disabled during the cooldown and while in flight')
assert.match(verifyForm, /if \(resending \|\| cooldown > 0\) return/, 'a second tap during either is a no-op')
assert.match(verifyForm, /kind === 'rate_limited'\) setLockedOut\(true\)/, 'a rate-limited verify locks the field')
assert.match(verifyForm, /Start over/, 'a way back to /login is always offered')

// /dashboard: a client that cannot be constructed is not "signed out", and it
// is not a 500 either.
const dashboardPage136 = read('src/app/dashboard/page.tsx')
assert.match(dashboardPage136, /try \{\s*const \{ data: auth \} = await \(await createClient\(\)\)\.auth\.getUser\(\)/, 'the session read is inside a try')
assert.match(dashboardPage136, /redirect\('\/login\?next=\/dashboard'\)/, 'a signed-out visitor comes back here after sign-in')
assert.ok(
  dashboardPage136.indexOf('} catch {') < dashboardPage136.indexOf("redirect('/login?next=/dashboard')"),
  'the redirect decision is made after the try/catch, so a thrown client never becomes a redirect'
)

// The error boundary exists, is a client component (Next requires it), keeps
// the fault ours, and never prints error.message.
const errorBoundary136 = read('src/app/error.tsx')
assert.match(errorBoundary136, /^['"]use client['"]/m, 'error.tsx must be a client component')
assert.match(errorBoundary136, /reset: \(\) => void/, 'it must accept reset()')
assert.match(errorBoundary136, /onClick=\{reset\}/, 'and offer it')
assert.match(errorBoundary136, /on our end/, 'the fault is ours, said plainly')
assert.equal(/\{error\.message\}/.test(errorBoundary136), false, 'error.message is operator text and is never rendered')
assert.equal(/Something went wrong/.test(errorBoundary136), false, 'no generic copy')

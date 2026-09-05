// Pure-function tests for rev. 5.3 §8 M2 identity: phone/OTP shape validation
// (`lib/domain/phone.ts`), the OTP HTTP translation (`lib/api/otp-http.ts`),
// and the in-memory rate limiter (`lib/api/rate-limit.ts`). All three are
// IO-free, so — like `transition-http.ts` — they are executed directly rather
// than asserted on as source text.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { isE164Phone, isOtpCode, normalizePhone } from '../src/lib/domain/phone.ts'
import {
  OTP_ERROR_KINDS,
  classifySendError,
  classifyVerifyError,
  otpError,
  otpStatus,
} from '../src/lib/api/otp-http.ts'
import { createFixedWindowLimiter } from '../src/lib/api/rate-limit.ts'

// -----------------------------------------------------------------------------
// isE164Phone
// -----------------------------------------------------------------------------
assert.equal(isE164Phone('+15555550100'), true)
assert.equal(isE164Phone('+447911123456'), true)
for (const bad of ['5555550100', '+0555550100', '+1', 555550100, null, undefined, '', '+1abc5550100']) {
  assert.equal(isE164Phone(bad), false, `expected ${JSON.stringify(bad)} to be rejected`)
}

// -----------------------------------------------------------------------------
// normalizePhone — the common cases this pilot's audience actually types
// -----------------------------------------------------------------------------
assert.equal(normalizePhone('+15555550100'), '+15555550100', 'already-E.164 input passes through unchanged')
assert.equal(normalizePhone('5555550100'), '+15555550100', 'bare 10-digit US number gets +1')
assert.equal(normalizePhone('15555550100'), '+15555550100', 'leading-1 11-digit US number gets +')
assert.equal(normalizePhone('(555) 555-0100'), '+15555550100', 'keypad punctuation is stripped')
assert.equal(normalizePhone(' 555.555.0100 '), '+15555550100', 'dots and surrounding whitespace are stripped')

for (const bad of [null, undefined, 42, '123', '555555010012345678', '+44 not a number']) {
  assert.equal(normalizePhone(bad), null, `expected ${JSON.stringify(bad)} to fail to normalize`)
}

// -----------------------------------------------------------------------------
// isOtpCode
// -----------------------------------------------------------------------------
assert.equal(isOtpCode('123456'), true)
for (const bad of ['12345', '1234567', 'abcdef', '12345a', 123456, null, undefined, '']) {
  assert.equal(isOtpCode(bad), false, `expected ${JSON.stringify(bad)} to be rejected`)
}

// -----------------------------------------------------------------------------
// otp-http.ts — every kind has a message and a status, no kind unmapped
// -----------------------------------------------------------------------------
for (const kind of OTP_ERROR_KINDS) {
  const body = otpError(kind)
  assert.equal(body.error.kind, kind)
  assert.equal(typeof body.error.message, 'string')
  assert.ok(body.error.message.length > 0, `${kind} must carry a message`)
  assert.equal(typeof otpStatus(kind), 'number')
}

assert.equal(otpStatus('invalid_argument'), 400)
assert.equal(otpStatus('invalid_code'), 400)
assert.equal(otpStatus('rate_limited'), 429)
// 503, not 502, as of A7: this kind also covers GoTrue reporting the phone
// provider disabled, not only an upstream failure — see signin-error-states.test.mjs.
assert.equal(otpStatus('unavailable'), 503)

// classifySendError / classifyVerifyError diverge only on the plain-4xx case —
// a bad phone number is `invalid_argument`, a bad code is `invalid_code` — so
// the same provider response means something different on each route.
assert.equal(classifySendError({ status: 429 }), 'rate_limited')
assert.equal(classifySendError({ status: 400 }), 'invalid_argument')
assert.equal(classifySendError({ status: 500 }), 'unavailable')
assert.equal(classifySendError(null), 'unavailable')
assert.equal(classifySendError(undefined), 'unavailable')

assert.equal(classifyVerifyError({ status: 429 }), 'rate_limited')
assert.equal(classifyVerifyError({ status: 401 }), 'invalid_code')
assert.equal(classifyVerifyError({ status: 400 }), 'invalid_code')
assert.equal(classifyVerifyError({ status: 500 }), 'unavailable')
assert.equal(classifyVerifyError(null), 'unavailable')

// -----------------------------------------------------------------------------
// rate-limit.ts — driven entirely by an injected `now`, never a real clock
// -----------------------------------------------------------------------------
{
  const limiter = createFixedWindowLimiter({ max: 3, windowMs: 1000 })
  const key = 'k'

  assert.equal(limiter.consume(key, 0).allowed, true)
  assert.equal(limiter.consume(key, 100).allowed, true)
  assert.equal(limiter.consume(key, 200).allowed, true)

  const fourth = limiter.consume(key, 300)
  assert.equal(fourth.allowed, false, 'a fourth hit inside the window is refused')
  assert.ok(fourth.retryAfterMs > 0, 'a refusal reports how long until it ages out')

  // The window slides: the first hit (t=0) ages out at t=1000, freeing a slot.
  assert.equal(limiter.consume(key, 1001).allowed, true, 'a hit past the window is allowed again')

  // A different key has its own independent bucket.
  assert.equal(limiter.consume('other-key', 300).allowed, true, 'buckets are isolated per key')
}

// -----------------------------------------------------------------------------
// The per-IP send budget is D-8's, and is a DAY (#52)
//
// send-otp-route.ts previously used a 10-per-hour window whose own comment called
// it a stand-in for D-8's "≤10 OTP sends per IP per day". It was not one, and it
// erred generously: ten per rolling hour is 240 sends a day from one address,
// against a budget of ten. This pins the window so that regression is loud.
// -----------------------------------------------------------------------------
{
  const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/api/send-otp-route.ts'), 'utf8')

  assert.match(source, /const DAY_MS = 24 \* HOUR_MS/, 'the daily window is defined in terms of the hour')
  assert.match(
    source,
    /createFixedWindowLimiter\(\{ max: 10, windowMs: DAY_MS \}\)/,
    "the per-IP budget must be D-8's 10 per DAY, not 10 per hour"
  )
  assert.equal(
    /ipLimiter = createFixedWindowLimiter\(\{ max: 10, windowMs: HOUR_MS \}\)/.test(source),
    false,
    'the per-IP limiter must not be back on an hourly window'
  )

  // The in-memory limiter is explicitly not the durable, cross-instance cap;
  // the comment saying so is load-bearing, because the next reader deciding
  // whether phone auth can be switched on depends on it. issue #55 gave the
  // durable form a real backing store (a Supabase Postgres table) rather than
  // leaving it as an owed edge-middleware deferral.
  assert.match(source, /durable/i, 'the file must reference the durable, cross-instance limiter')
  assert.match(source, /#55/, 'and name the issue that implements it')
}

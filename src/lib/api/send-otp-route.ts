/**
 * POST /api/auth/send-otp — rev. 5.3 §8 M2.
 *
 * Requests an SMS OTP from Supabase Auth, the sole durable store of phone
 * numbers (§6 identity invariant). `signInWithOtp` creates the `auth.users`
 * row transparently if the number has never signed in before — phone auth has
 * no separate "sign up" step — so there is no "does this number exist" branch
 * to leak. The success response is the same `{ ok: true }` regardless, which
 * is the whole of this route's anti-enumeration posture (D-8, threat T10).
 *
 * Abuse controls, and what actually enforces each:
 *   - Resend cooldown (60s, D-8) and CAPTCHA are Supabase Auth dashboard
 *     config — this route surfaces whatever GoTrue answers, never invents its
 *     own cooldown clock.
 *   - The in-memory limiters are a zero-round-trip pre-check, not the source
 *     of truth — see `rate-limit.ts`.
 *   - The durable limiters (issue #55, `durable-rate-limit.ts`) ARE the source
 *     of truth: a Postgres-backed fixed window that coordinates across every
 *     serverless instance and survives a redeploy, closing the gap
 *     Docs/DECISIONS.md D-45 recorded against the in-memory-only version.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { normalizePhone } from '@/lib/domain/phone.ts'
import { OTP_PHONE_COOKIE, OTP_PHONE_COOKIE_MAX_AGE_SECONDS } from '@/lib/domain/auth-return.ts'
import { createClient } from '@/lib/supabase/server.ts'
import { createServiceClient } from '@/lib/supabase/service.ts'
import { createDurableRateLimiter } from './durable-rate-limit.ts'
import { classifySendError, otpError, otpStatus } from './otp-http.ts'
import { createFixedWindowLimiter } from './rate-limit.ts'
import { clientIp, readJson } from './request.ts'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * D-8's per-IP budget is "≤10 OTP sends per IP per **day**".
 *
 * This was a 10-per-*hour* window described in its own comment as a stand-in for
 * that daily cap. It is not one, and it erred in the direction that matters: ten
 * per rolling hour permits **240 sends a day** from one address against a budget
 * of ten. The window is now the day, and the figure is D-8's.
 *
 * A second, shorter burst window was considered and left out deliberately: with
 * the daily maximum also at ten, any burst that would trip an hourly cap has
 * already exhausted the day, so the extra limiter could never bind first. Per-
 * number bursts are covered by `phoneLimiter` below.
 *
 * In-memory pre-check only now — see `durableIpDailyLimiter` below for the
 * cross-instance control this repo's own D-45/D-51 record as owed.
 */
const ipDailyLimiter = createFixedWindowLimiter({ max: 10, windowMs: DAY_MS })
/** In-memory pre-check backing up Supabase Auth's own 60s resend cooldown. */
const phoneLimiter = createFixedWindowLimiter({ max: 5, windowMs: HOUR_MS })

/** Durable, cross-instance form of the two limiters above — issue #55. */
const durableIpDailyLimiter = createDurableRateLimiter({ max: 10, windowMs: DAY_MS })
const durablePhoneLimiter = createDurableRateLimiter({ max: 5, windowMs: HOUR_MS })

function parsePhoneInput(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>
  return normalizePhone(body.phone)
}

export async function sendOtpHandler(request: NextRequest): Promise<NextResponse> {
  const phone = parsePhoneInput(await readJson(request))
  if (phone === null) {
    return NextResponse.json(otpError('invalid_argument'), { status: otpStatus('invalid_argument') })
  }

  const now = Date.now()
  const ip = clientIp(request)

  if (!ipDailyLimiter.consume(`ip:${ip}`, now).allowed || !phoneLimiter.consume(`phone:${phone}`, now).allowed) {
    return NextResponse.json(otpError('rate_limited'), { status: otpStatus('rate_limited') })
  }

  let rateLimitClient: ReturnType<typeof createServiceClient>
  try {
    rateLimitClient = createServiceClient()
  } catch {
    // `SUPABASE_SERVICE_ROLE_KEY` unset (production's current state, A11):
    // `createServiceClient()` throws synchronously, which previously escaped
    // this handler uncaught and surfaced as a raw framework 500 with no JSON
    // body. Unlike a transient `rate_limit_hit()` RPC error — which
    // `durable-rate-limit.ts` fails OPEN on deliberately, because Supabase
    // Auth's own per-number/IP controls are the real boundary (D-45) — this is
    // a permanent misconfiguration: the durable, cross-instance limiter cannot
    // run at all, not just on this one request. Sending a billable SMS with
    // zero durable abuse control until someone notices the missing variable is
    // the wrong default, so OTP send fails CLOSED here specifically. (A11)
    return NextResponse.json(otpError('unavailable'), { status: otpStatus('unavailable') })
  }

  const [ipDaily, phoneHourly] = await Promise.all([
    durableIpDailyLimiter.consume(rateLimitClient, `ip:${ip}`, now),
    durablePhoneLimiter.consume(rateLimitClient, `phone:${phone}`, now),
  ])
  if (!ipDaily.allowed || !phoneHourly.allowed) {
    return NextResponse.json(otpError('rate_limited'), { status: otpStatus('rate_limited') })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })

  if (error !== null) {
    const kind = classifySendError(error)
    return NextResponse.json(otpError(kind), { status: otpStatus(kind) })
  }

  // The phone rides to `/verify` in a short-lived httpOnly cookie, not the
  // query string (issue #136): out of browser history, referrers and request
  // logs. Cleared by verify-otp-route.ts on success; expires on its own
  // otherwise. `secure` follows the environment so local http still works.
  const response = NextResponse.json({ ok: true })
  response.cookies.set(OTP_PHONE_COOKIE, phone, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OTP_PHONE_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}

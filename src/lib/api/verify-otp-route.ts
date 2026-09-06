/**
 * POST /api/auth/verify-otp — rev. 5.3 §8 M2.
 *
 * Verifies the SMS code against Supabase Auth. `createClient()` is the
 * cookie-bound server client (see `lib/supabase/server.ts`), so a successful
 * `verifyOtp` writes the session cookie through the same adapter every M3
 * write route relies on for its `getUser()` check — `/onboarding` reads that
 * session on the very next request. There is no separate "log the member in"
 * step here; verifying the code *is* signing in.
 *
 * `members` row creation is automatic (`handle_new_member()`, 0001) — it fires
 * on the `auth.users` insert `signInWithOtp` performs, not here. This route
 * never touches `public.members` directly.
 *
 * Abuse control: D-8's "≤5 verify attempts per number per hour". The
 * in-memory limiters are a zero-round-trip pre-check; the durable limiters
 * (issue #55, `durable-rate-limit.ts`) are the source of truth, coordinating
 * across every serverless instance rather than resetting on redeploy — see
 * `rate-limit.ts` and Docs/DECISIONS.md D-45 for the gap this closes. A wider
 * per-IP cap backs both up against an attacker spreading guesses across many
 * numbers from one address.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isOtpCode, normalizePhone } from '@/lib/domain/phone.ts'
import { OTP_PHONE_COOKIE } from '@/lib/domain/auth-return.ts'
import { createClient } from '@/lib/supabase/server.ts'
import { createServiceClient } from '@/lib/supabase/service.ts'
import { createDurableRateLimiter } from './durable-rate-limit.ts'
import { classifyVerifyError, otpError, otpStatus } from './otp-http.ts'
import { createFixedWindowLimiter } from './rate-limit.ts'
import { clientIp, readJson } from './request.ts'

const HOUR_MS = 60 * 60 * 1000

/** D-8: "≤5 verify attempts per number per hour." In-memory pre-check only. */
const phoneLimiter = createFixedWindowLimiter({ max: 5, windowMs: HOUR_MS })
/** Defence-in-depth against guesses spread across many numbers from one IP. */
const ipLimiter = createFixedWindowLimiter({ max: 20, windowMs: HOUR_MS })

/** Durable, cross-instance form of the two limiters above — issue #55. */
const durablePhoneLimiter = createDurableRateLimiter({ max: 5, windowMs: HOUR_MS })
const durableIpLimiter = createDurableRateLimiter({ max: 20, windowMs: HOUR_MS })

interface VerifyInput {
  readonly phone: string
  readonly token: string
}

function parseVerifyInput(raw: unknown): VerifyInput | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>

  const phone = normalizePhone(body.phone)
  if (phone === null) return null
  if (!isOtpCode(body.token)) return null

  return { phone, token: body.token }
}

export async function verifyOtpHandler(request: NextRequest): Promise<NextResponse> {
  const input = parseVerifyInput(await readJson(request))
  if (input === null) {
    return NextResponse.json(otpError('invalid_argument'), { status: otpStatus('invalid_argument') })
  }

  const now = Date.now()
  const ip = clientIp(request)

  if (!ipLimiter.consume(`ip:${ip}`, now).allowed || !phoneLimiter.consume(`phone:${input.phone}`, now).allowed) {
    return NextResponse.json(otpError('rate_limited'), { status: otpStatus('rate_limited') })
  }

  // Unlike send-otp-route.ts (A11), this stays fail OPEN if the service client
  // cannot even be constructed (`SUPABASE_SERVICE_ROLE_KEY` unset): a verify
  // does not send a billable SMS, and blocking someone who already received a
  // valid code because of an unrelated config fault is a worse outcome than
  // the durable limiter sitting out one request. Supabase Auth's own
  // per-number rate limits remain the real boundary either way (D-45).
  let rateLimitClient: ReturnType<typeof createServiceClient> | null
  try {
    rateLimitClient = createServiceClient()
  } catch {
    rateLimitClient = null
  }

  const [ipHourly, phoneHourly] = rateLimitClient
    ? await Promise.all([
        durableIpLimiter.consume(rateLimitClient, `ip:${ip}`, now),
        durablePhoneLimiter.consume(rateLimitClient, `phone:${input.phone}`, now),
      ])
    : [
        { allowed: true, retryAfterMs: 0 },
        { allowed: true, retryAfterMs: 0 },
      ]
  if (!ipHourly.allowed || !phoneHourly.allowed) {
    return NextResponse.json(otpError('rate_limited'), { status: otpStatus('rate_limited') })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    phone: input.phone,
    token: input.token,
    type: 'sms',
  })

  if (error !== null) {
    const kind = classifyVerifyError(error)
    return NextResponse.json(otpError(kind), { status: otpStatus(kind) })
  }

  // The attempt is over; the phone cookie send-otp-route.ts set has nothing
  // left to carry (issue #136).
  const response = NextResponse.json({ ok: true, member_id: data.user?.id ?? null })
  response.cookies.set(OTP_PHONE_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}

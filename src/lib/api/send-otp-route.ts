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
 *   - The in-memory limiters below are defence-in-depth on top of that, not a
 *     replacement for it — see `rate-limit.ts` for why they are best-effort.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { normalizePhone } from '@/lib/domain/phone.ts'
import { createClient } from '@/lib/supabase/server.ts'
import { classifySendError, otpError, otpStatus } from './otp-http.ts'
import { createFixedWindowLimiter } from './rate-limit.ts'
import { clientIp, readJson } from './request.ts'

const HOUR_MS = 60 * 60 * 1000

/** Best-effort stand-in for D-8's "≤10 OTP sends per IP per day" — see rate-limit.ts. */
const ipLimiter = createFixedWindowLimiter({ max: 10, windowMs: HOUR_MS })
/** Backs up Supabase Auth's own 60s resend cooldown with a coarser per-number cap. */
const phoneLimiter = createFixedWindowLimiter({ max: 5, windowMs: HOUR_MS })

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

  if (!ipLimiter.consume(`ip:${ip}`, now).allowed || !phoneLimiter.consume(`phone:${phone}`, now).allowed) {
    return NextResponse.json(otpError('rate_limited'), { status: otpStatus('rate_limited') })
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })

  if (error !== null) {
    const kind = classifySendError(error)
    return NextResponse.json(otpError(kind), { status: otpStatus(kind) })
  }

  return NextResponse.json({ ok: true })
}

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
 * Abuse control: D-8's "≤5 verify attempts per number per hour", enforced
 * in-process (see `rate-limit.ts` for the P2 durable-limiting caveat). A wider
 * per-IP cap backs it up against an attacker spreading guesses across many
 * numbers from one address.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isOtpCode, normalizePhone } from '@/lib/domain/phone.ts'
import { createClient } from '@/lib/supabase/server.ts'
import { classifyVerifyError, otpError, otpStatus } from './otp-http.ts'
import { createFixedWindowLimiter } from './rate-limit.ts'
import { clientIp, readJson } from './request.ts'

const HOUR_MS = 60 * 60 * 1000

/** D-8: "≤5 verify attempts per number per hour." */
const phoneLimiter = createFixedWindowLimiter({ max: 5, windowMs: HOUR_MS })
/** Defence-in-depth against guesses spread across many numbers from one IP. */
const ipLimiter = createFixedWindowLimiter({ max: 20, windowMs: HOUR_MS })

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

  const supabase = createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    phone: input.phone,
    token: input.token,
    type: 'sms',
  })

  if (error !== null) {
    const kind = classifyVerifyError(error)
    return NextResponse.json(otpError(kind), { status: otpStatus(kind) })
  }

  return NextResponse.json({ ok: true, member_id: data.user?.id ?? null })
}

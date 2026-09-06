'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { otpError } from '@/lib/api/otp-http.ts'
import { OTP_RESEND_COOLDOWN_SECONDS, withNext } from '@/lib/domain/auth-return.ts'

interface VerifyFormProps {
  phone: string
  /** The safe return path `/login` carried; honoured after onboarding. */
  next?: string
}

/** A7: same fallback copy as `LoginForm`, same reason — see there. */
const FALLBACK_MESSAGE = otpError('unavailable').error.message

/**
 * `/verify` — the code entry step of rev. 5.3 §8 M2's OTP flow.
 *
 * Calls `POST /api/auth/verify-otp`. On success the route has already set the
 * session cookie (the cookie-bound server client `verify-otp-route.ts` uses),
 * so this component only navigates — it never handles a session token
 * itself. `router.refresh()` before the navigation drops any cached
 * server-rendered shell of `/onboarding` from a previous signed-out visit, so
 * the next render reads the cookie that was just set rather than a stale one.
 *
 * "Resend" re-posts to `/api/auth/send-otp`. The 60s cooldown (D-8) is
 * Supabase Auth's own; it is now VISIBLE here as a countdown on a disabled
 * button (issue #136) rather than discovered as a `rate_limited` refusal on
 * the second tap, and a resend in flight cannot be tapped again. Two terminal
 * states exist: `rate_limited` on verify locks the code field (Supabase Auth
 * has stopped accepting guesses for this number for a while), and "Start
 * over" is always offered, back to `/login` with `next` intact.
 */
export default function VerifyForm({ phone, next }: VerifyFormProps) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const [lockedOut, setLockedOut] = useState(false)
  // Seconds left before "Resend code" is offered again. Starts at the full
  // cooldown: the code was sent the moment `/login` handed off to this page.
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error?.message ?? FALLBACK_MESSAGE)
        // Supabase Auth has stopped accepting guesses for this number; a fresh
        // code from `/login` is the only way on, so the field says so.
        if (body?.error?.kind === 'rate_limited') setLockedOut(true)
        setPending(false)
        return
      }

      router.refresh()
      router.push(withNext('/onboarding', next))
    } catch {
      setError(FALLBACK_MESSAGE)
      setPending(false)
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return
    setResending(true)
    setError(null)
    setResent(false)
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (response.ok) {
        setResent(true)
        setLockedOut(false)
        setToken('')
        setCooldown(OTP_RESEND_COOLDOWN_SECONDS)
      } else {
        const body = await response.json().catch(() => null)
        setError(body?.error?.message ?? FALLBACK_MESSAGE)
      }
    } catch {
      setError(FALLBACK_MESSAGE)
    } finally {
      setResending(false)
    }
  }

  const resendDisabled = resending || cooldown > 0
  const resendLabel = resending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="token" className="block text-sm font-bold text-slate-950">
          6-digit code
        </label>
        <p className="mt-1 text-sm text-slate-700">Sent to {phone || 'your phone'}.</p>
        <input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          pattern="\d{6}"
          disabled={lockedOut}
          aria-describedby={lockedOut ? 'verify-locked' : undefined}
          value={token}
          onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl tracking-[0.5em] text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          {error}
        </p>
      )}

      {lockedOut && (
        <p id="verify-locked" className="text-sm text-slate-700">
          Too many attempts for this number. Wait for the resend timer, or start over with a new code.
        </p>
      )}

      {resent && !error && (
        <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">
          Code resent. Enter the newest one.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || lockedOut || token.length !== 6}
        className="w-full rounded-lg bg-sky-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? 'Verifying…' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resendDisabled}
        aria-live="polite"
        className="w-full text-center text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
      >
        {resendLabel}
      </button>

      <p className="text-center text-sm text-slate-700">
        Wrong number?{' '}
        <Link href={withNext('/login', next)} className="font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline">
          Start over
        </Link>
      </p>
    </form>
  )
}

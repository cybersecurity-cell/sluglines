'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface VerifyFormProps {
  phone: string
}

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
 * "Resend" re-posts to `/api/auth/send-otp`; the 60s cooldown (D-8) is
 * Supabase Auth's own, surfaced here as the same generic `rate_limited`
 * message every other refusal on this screen uses.
 */
export default function VerifyForm({ phone }: VerifyFormProps) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

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
        setError(body?.error?.message ?? 'Something went wrong. Try again.')
        setPending(false)
        return
      }

      router.refresh()
      router.push('/onboarding')
    } catch {
      setError('Something went wrong. Try again.')
      setPending(false)
    }
  }

  async function handleResend() {
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
      } else {
        const body = await response.json().catch(() => null)
        setError(body?.error?.message ?? 'Something went wrong. Try again.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    }
  }

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

      {resent && !error && (
        <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">
          Code resent.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || token.length !== 6}
        className="w-full rounded-lg bg-sky-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? 'Verifying…' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={handleResend}
        className="w-full text-center text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
      >
        Resend code
      </button>
    </form>
  )
}

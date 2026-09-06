'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { otpError } from '@/lib/api/otp-http.ts'
import { withNext } from '@/lib/domain/auth-return.ts'

/** A7: the client's own last-resort copy when a response carries no parseable
 * JSON body at all (a raw framework error page, or the fetch itself failing) —
 * reuses the server's `unavailable` wording rather than a second, independently
 * drifting "something went wrong" string. */
const FALLBACK_MESSAGE = otpError('unavailable').error.message

/**
 * `/login` — the phone entry step of rev. 5.3 §8 M2's OTP flow.
 *
 * A client component, unlike the rest of this app's forms (`CheckOutButton`,
 * `dashboard/actions.ts`): a Server Action can't hand this page a code to
 * type on the *next* screen without a redirect round trip, and the two-step
 * send/verify exchange is inherently interactive (inline error text, no full
 * navigation on a typo). It calls `POST /api/auth/send-otp` — the JSON
 * contract `send-otp-route.ts` defines — rather than importing a Supabase
 * client into the browser.
 *
 * The success and failure messages are both generic (`otp-http.ts`'s
 * `invalid_argument` / `rate_limited` / `unavailable` kinds): rev. 5.3 §8 M2's
 * anti-enumeration requirement means this screen must read the same whether
 * or not the number has ever signed in before — phone auth has no separate
 * "sign up" branch for it to leak.
 *
 * The phone number no longer travels to `/verify` in the query string (issue
 * #136): `POST /api/auth/send-otp` sets a short-lived httpOnly cookie on
 * success and `/verify` reads it server-side, so the number stays out of
 * browser history, referrers and request logs. Only `next` is carried in the
 * URL, and it is a path, not a person.
 */
export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error?.message ?? FALLBACK_MESSAGE)
        setPending(false)
        return
      }

      router.push(withNext('/verify', next))
    } catch {
      setError(FALLBACK_MESSAGE)
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-bold text-slate-950">
          Phone number
        </label>
        <p className="mt-1 text-sm text-slate-700">We&apos;ll text you a 6-digit code. Standard rates apply.</p>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          placeholder="(555) 555-0100"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-500 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send code'}
      </button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { corridorDirectionOptions } from '@/lib/domain/corridor'
import type { CorridorDirection } from '@/lib/domain/corridor'

/**
 * The post-a-seat form — PR 5 slice 4, wired to `POST /api/offers`
 * (`lib/api/offer-create-route.ts`).
 *
 * A CLIENT COMPONENT, UNLIKE `OnboardingForm`/`CheckInStatusPanel`
 * ---------------------------------------------------------------------------
 * Every other member-write surface in this app is a `<form action={...}>`
 * Server Action, specifically to avoid shipping a Supabase client to the
 * browser (see `dashboard/actions.ts`'s own measured argument for that). This
 * form breaks that pattern because `/api/offers` needs two things a plain
 * form submit cannot give it: a client-generated idempotency key that survives
 * a *user-initiated* retry unchanged (a fresh key on retry would create a
 * second offer instead of replaying the first), and the parsed JSON error body
 * to tell a validation failure from "try again" — the same `kind`/`retryable`
 * contract `reservation-create-route.ts` documents. No Supabase client ships
 * here either way: this component only ever talks to this app's own route.
 */
export default function PostSeatForm() {
  const router = useRouter()
  const directions = corridorDirectionOptions()

  const [posterRole, setPosterRole] = useState<'driver' | 'rider'>('driver')
  const [direction, setDirection] = useState<CorridorDirection>(directions[0].value)
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const [seatsTotal, setSeatsTotal] = useState(1)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null)
  const [posted, setPosted] = useState(false)

  async function submit(key: string) {
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          poster_role: posterRole,
          direction,
          window_start: new Date(windowStart).toISOString(),
          window_end: new Date(windowEnd).toISOString(),
          seats_total: seatsTotal,
          idempotency_key: key,
        }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error?.message ?? 'That did not go through.'
        setError({ message, retryable: Boolean(body?.error?.retryable) })
        return
      }

      setPosted(true)
      setIdempotencyKey(null)
      router.refresh()
    } catch {
      setError({ message: 'The network dropped the request.', retryable: true })
    } finally {
      setPending(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // A fresh key per new attempt; the *same* key on an explicit retry of a
    // retryable failure, generated below instead of here.
    const key = crypto.randomUUID()
    setIdempotencyKey(key)
    void submit(key)
  }

  function handleRetry() {
    if (idempotencyKey) void submit(idempotencyKey)
  }

  if (posted) {
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
        Posted. Your seat is now on the board below.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          {error.message}
          {error.retryable && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={pending}
              className="ml-3 font-bold underline underline-offset-2"
            >
              Retry
            </button>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="poster_role" className="block text-sm font-bold text-slate-950">
            I am
          </label>
          <select
            id="poster_role"
            value={posterRole}
            onChange={(event) => setPosterRole(event.target.value as 'driver' | 'rider')}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option value="driver">Driving — offering seats</option>
            <option value="rider">Riding — requesting a seat</option>
          </select>
        </div>

        <div>
          <label htmlFor="direction" className="block text-sm font-bold text-slate-950">
            Direction
          </label>
          <select
            id="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as CorridorDirection)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            {directions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="window_start" className="block text-sm font-bold text-slate-950">
            Window start
          </label>
          <input
            id="window_start"
            type="datetime-local"
            required
            value={windowStart}
            onChange={(event) => setWindowStart(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <div>
          <label htmlFor="window_end" className="block text-sm font-bold text-slate-950">
            Window end
          </label>
          <input
            id="window_end"
            type="datetime-local"
            required
            value={windowEnd}
            onChange={(event) => setWindowEnd(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <div>
          <label htmlFor="seats_total" className="block text-sm font-bold text-slate-950">
            Seats
          </label>
          <input
            id="seats_total"
            type="number"
            min={1}
            max={6}
            required
            value={seatsTotal}
            onChange={(event) => setSeatsTotal(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Posting...' : 'Post'}
      </button>
    </form>
  )
}

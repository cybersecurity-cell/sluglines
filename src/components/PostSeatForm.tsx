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
 *
 * THE 6 AM FORM (issue #140)
 * ---------------------------------------------------------------------------
 * Two raw `datetime-local` pickers with no defaults were the hardest control
 * on the site, one-handed in a car. The window is now chosen as "leaving in
 * N minutes" with a fixed pickup window (`WINDOW_MINUTES`), the pickers are
 * pre-filled from that and kept only to adjust, the end must follow the start
 * (checked here before the round trip; the SQL checks it again), and the
 * seats default to three — a car. Times are the browser's local clock, which
 * for the one corridor this board serves is Eastern.
 */
export const LEAVING_IN_PRESETS_MINUTES = [10, 20, 30, 45] as const
/** How long a pickup window stays open once it starts. */
export const WINDOW_MINUTES = 30
const DEFAULT_LEAVING_IN_MINUTES = 20
const DEFAULT_SEATS = 3

/** `datetime-local` wants a local wall-clock string with no zone. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function windowFromNow(minutesFromNow: number): { start: string; end: string } {
  const start = new Date(Date.now() + minutesFromNow * 60_000)
  start.setSeconds(0, 0)
  const end = new Date(start.getTime() + WINDOW_MINUTES * 60_000)
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) }
}

export default function PostSeatForm() {
  const router = useRouter()
  const directions = corridorDirectionOptions()
  const [initialWindow] = useState(() => windowFromNow(DEFAULT_LEAVING_IN_MINUTES))

  const [posterRole, setPosterRole] = useState<'driver' | 'rider'>('driver')
  const [direction, setDirection] = useState<CorridorDirection>(directions[0].value)
  const [windowStart, setWindowStart] = useState(initialWindow.start)
  const [windowEnd, setWindowEnd] = useState(initialWindow.end)
  const [leavingIn, setLeavingIn] = useState<number | null>(DEFAULT_LEAVING_IN_MINUTES)
  const [seatsTotal, setSeatsTotal] = useState(DEFAULT_SEATS)
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

  function choosePreset(minutes: number) {
    const next = windowFromNow(minutes)
    setLeavingIn(minutes)
    setWindowStart(next.start)
    setWindowEnd(next.end)
  }

  const windowInvalid =
    windowStart.length > 0 && windowEnd.length > 0 && new Date(windowEnd).getTime() <= new Date(windowStart).getTime()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (windowInvalid) {
      setError({ message: 'The window has to end after it starts.', retryable: false })
      return
    }
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

      <fieldset>
        <legend className="block text-sm font-bold text-slate-950">Leaving in</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEAVING_IN_PRESETS_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => choosePreset(minutes)}
              aria-pressed={leavingIn === minutes}
              className={`min-h-[44px] rounded-lg border px-4 text-sm font-bold transition-colors ${
                leavingIn === minutes
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-300 bg-white text-slate-950 hover:bg-slate-50'
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-700">
          A {WINDOW_MINUTES}-minute pickup window from then. Adjust the exact times below if you need to.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="poster_role" className="block text-sm font-bold text-slate-950">
            I am
          </label>
          <select
            id="poster_role"
            value={posterRole}
            onChange={(event) => setPosterRole(event.target.value as 'driver' | 'rider')}
            className="mt-2 w-full rounded-lg border border-slate-500 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
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
            className="mt-2 w-full rounded-lg border border-slate-500 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
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
            min={toLocalInputValue(new Date())}
            value={windowStart}
            onChange={(event) => {
              setLeavingIn(null)
              setWindowStart(event.target.value)
            }}
            className="mt-2 w-full rounded-lg border border-slate-500 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
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
            min={windowStart || undefined}
            aria-invalid={windowInvalid || undefined}
            aria-describedby={windowInvalid ? 'window_end_error' : undefined}
            value={windowEnd}
            onChange={(event) => {
              setLeavingIn(null)
              setWindowEnd(event.target.value)
            }}
            className="mt-2 w-full rounded-lg border border-slate-500 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
          {windowInvalid && (
            <p id="window_end_error" className="mt-1 text-sm font-semibold text-red-900">
              The window has to end after it starts.
            </p>
          )}
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
            className="mt-2 w-full rounded-lg border border-slate-500 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || windowInvalid}
        className="w-full rounded-lg bg-sky-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Posting...' : 'Post'}
      </button>
    </form>
  )
}

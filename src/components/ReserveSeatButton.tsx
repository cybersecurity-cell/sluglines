'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ReserveSeatButtonProps {
  offerId: string
  expectedRevision: number
  /** True for the offer's own poster: `offer_reserve_seat` refuses this itself (42501). */
  disabled?: boolean
}

/**
 * The reserve button — PR 5 slice 4, wired to `POST /api/reservations`
 * (`lib/api/reservation-create-route.ts`).
 *
 * IMPLEMENTS THE §10 DISTINCTION DIRECTLY FROM THE ROUTE'S RESPONSE
 * ---------------------------------------------------------------------------
 * `reservation-create-route.ts` already classifies every refusal into a
 * `kind` and a `retryable` flag (D-30). This component adds no parallel
 * classification of its own:
 *
 *   - `conflict` / `illegal_state` — "seat just taken" (a stale revision, or
 *     seats that moved under the caller). Never retried; instead
 *     `router.refresh()` re-renders `/board` from the server, which is what
 *     "the offer's live view refreshes" means for a server-rendered board.
 *   - `retryable` (`in_flight` / `unavailable`) — a transient or transport
 *     failure. Offered a retry button that resends the *same* idempotency
 *     key, so a click during a slow response cannot double-reserve.
 *   - anything else (`forbidden`, `invalid_argument`, `not_found`) — shown
 *     plainly, not retried.
 */
export default function ReserveSeatButton({ offerId, expectedRevision, disabled }: ReserveSeatButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ text: string; retryable: boolean } | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)

  async function reserve(key: string) {
    setPending(true)
    setMessage(null)

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          offer_id: offerId,
          expected_revision: expectedRevision,
          idempotency_key: key,
          seats: 1,
        }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const kind = body?.error?.kind

        if (kind === 'conflict' || kind === 'illegal_state') {
          setMessage({ text: 'This offer changed — the board is refreshing.', retryable: false })
          setIdempotencyKey(null)
          router.refresh()
          return
        }

        setMessage({ text: body?.error?.message ?? 'That did not go through.', retryable: Boolean(body?.error?.retryable) })
        return
      }

      // What happens next, in one line (issue #140): the driver confirms the
      // ride before the window; the seat now shows under "Yours" above, with
      // a release control if plans change.
      setMessage({ text: 'Reserved. The driver confirms before the window; your seat is listed under Yours.', retryable: false })
      setIdempotencyKey(null)
      router.refresh()
    } catch {
      setMessage({ text: 'The network dropped the request.', retryable: true })
    } finally {
      setPending(false)
    }
  }

  function handleClick() {
    const key = crypto.randomUUID()
    setIdempotencyKey(key)
    void reserve(key)
  }

  function handleRetry() {
    if (idempotencyKey) void reserve(idempotencyKey)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        title={disabled ? 'You cannot reserve a seat on your own offer' : undefined}
        className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Reserving...' : disabled ? 'Your offer' : 'Reserve'}
      </button>

      {message && (
        <p
          role={message.retryable ? 'alert' : 'status'}
          className="max-w-[16rem] text-right text-xs font-semibold text-slate-700"
        >
          {message.text}
          {message.retryable && (
            <button type="button" onClick={handleRetry} className="ml-2 underline underline-offset-2">
              Retry
            </button>
          )}
        </p>
      )}
    </div>
  )
}

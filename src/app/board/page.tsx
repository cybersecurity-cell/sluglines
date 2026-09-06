import Link from 'next/link'
import BoardActionButton from '@/components/BoardActionButton'
import LiveUpdated from '@/components/LiveUpdated'
import PostSeatForm from '@/components/PostSeatForm'
import ReserveSeatButton from '@/components/ReserveSeatButton'
import { cancelOwnOffer, releaseOwnSeat } from '@/app/board/actions'
import { getCorridorBoardOffers } from '@/lib/corridor-board.ts'
import { readViewerReservations } from '@/lib/board-reservations.ts'
import { buildCorridorBoard } from '@/lib/domain/board.ts'
import type { CorridorBoardOffer } from '@/lib/domain/board.ts'

/**
 * `/board` — PR 5 "thin coordination loop", one corridor pair.
 *
 * rev. 5.3 §8 M3 names `/board` and §10's nav table lists the Board zone as
 * "not visible (auth surface)" signed-out — unlike `/spots`, whose aggregates
 * stay public. This page's signed-out branch renders 200 with no offer data
 * and a sign-in link, rather than a redirect: a redirect changes the address
 * bar mid-navigation for no benefit here, and this project already renders an
 * explicit "signed out" state in place elsewhere (`CheckInStatusPanel`) rather
 * than bouncing away. Either choice satisfies "not visible"; this is the one
 * this PR made, noted here and in the PR body per the brief's own request to
 * state it.
 *
 * `getCorridorBoardOffers()` never queries `offers` for a signed-out caller —
 * the table has no `anon` grant at all (`0002`), so there is nothing to try.
 *
 * Server-rendered, same reasoning as `/dashboard`: the offers are in the HTML,
 * and a degraded read reports `unavailable` rather than a fabricated empty
 * board.
 *
 * THE ORDER OF THE PAGE (issue #140)
 * ---------------------------------------------------------------------------
 * Riders are the majority user and they come here to find a seat, so the open
 * offers come first, with a live region and a bounded poll; the viewer's own
 * offers and seats sit above them under "Yours", each with its undo (cancel
 * an offer, release a seat — `app/board/actions.ts`); the post form, the
 * driver's control, is last and reachable from the empty state's anchor.
 * `?done=` / `?error=` carry an action's outcome back through the redirect.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Board - Sluglines',
  description: "Post a seat or reserve one on the Horner Rd <-> L'Enfant Plaza corridor.",
}

/** The one zone every corridor spot is in. A server component has no viewer clock to read. */
export const BOARD_TIME_ZONE = 'America/New_York'

const DONE_COPY: Record<string, string> = {
  cancelled: 'Your offer is cancelled. Anyone holding a seat on it has been released.',
  released: 'Your seat is released. The driver sees one more seat open.',
}

const ERROR_COPY: Record<string, string> = {
  conflict: 'This offer changed while you were deciding. The board below is current — try again from it.',
  illegal_state: 'That offer is no longer in a state that allows that. The board below is current.',
  forbidden: 'You are not allowed to do that on this offer.',
  not_found: 'That offer no longer exists.',
  invalid_argument: 'That request was malformed. Reload and try again.',
  unavailable: 'The coordinator is unreachable. Nothing changed; try again in a moment.',
}

function windowLabel(windowStart: string, windowEnd: string): string {
  const start = new Date(windowStart)
  const end = new Date(windowEnd)
  const format = (value: Date, options: Intl.DateTimeFormatOptions) =>
    Number.isNaN(value.getTime()) ? 'unknown time' : value.toLocaleString('en-US', { timeZone: BOARD_TIME_ZONE, ...options })
  const startLabel = format(start, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const endLabel = format(end, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return `${startLabel} - ${endLabel}`
}

function OfferMeta({ offer }: { offer: CorridorBoardOffer }) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 font-bold text-slate-950">
        {offer.directionLabel}
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">
          {offer.posterRole}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">
          {offer.state === 'OPEN' ? 'Open' : 'Partially reserved'}
        </span>
      </p>
      <p className="mt-1 text-sm text-slate-700">{windowLabel(offer.windowStart, offer.windowEnd)}</p>
      <p className="mt-1 text-sm text-slate-700">
        {offer.seatsRemaining} {offer.seatsRemaining === 1 ? 'seat' : 'seats'} remaining
      </p>
    </div>
  )
}

export default async function BoardPage({ searchParams }: { searchParams?: Promise<{ done?: string; error?: string }> }) {
  const [read, resolvedSearchParams] = await Promise.all([getCorridorBoardOffers(), searchParams])

  if (read.state === 'signed-out') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-slate-950">Sign in to see the board</h1>
        <p className="mt-4 text-slate-700">
          The board is for signed-in members only — other sluggers&apos; offers are never shown to a
          signed-out visitor.
        </p>
        <Link
          href="/login?next=/board"
          className="mt-6 inline-block rounded-lg bg-sky-700 px-5 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (read.state === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-slate-950">Board unavailable</h1>
        <p className="mt-4 text-slate-700">
          The board could not be read just now. Reload in a moment — nothing you posted or reserved was
          lost.
        </p>
      </div>
    )
  }

  // The viewer's own live seats on these offers, for the "Yours" section. A
  // failed read here degrades to no seats known, never to an unavailable board.
  const reservations = await readViewerReservations(
    read.viewerId,
    read.rows.map((row) => row.id)
  )
  const board = buildCorridorBoard(read.rows, { viewerId: read.viewerId, reservations })
  // Formatted here, server-side, in the board's zone: the same clock every
  // window label uses, and nothing for the client to re-derive.
  const renderedLabel = new Date().toLocaleTimeString('en-US', {
    timeZone: BOARD_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  const done = resolvedSearchParams?.done ? DONE_COPY[resolvedSearchParams.done] : undefined
  const failed = resolvedSearchParams?.error ? (ERROR_COPY[resolvedSearchParams.error] ?? ERROR_COPY.unavailable) : undefined

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Horner Rd <span aria-hidden>&harr;</span> L&apos;Enfant Plaza
        </h1>
        <p className="mt-2 text-slate-700">The one corridor this board covers today.</p>
      </div>

      {done && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {done}
        </p>
      )}
      {failed && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          {failed}
        </p>
      )}

      {board.yours.length > 0 && (
        <section aria-labelledby="yours-heading">
          <h2 id="yours-heading" className="text-sm font-bold uppercase tracking-wide text-sky-700">
            Yours
          </h2>
          <ul className="mt-4 space-y-4">
            {board.yours.map((offer) => (
              <li key={offer.id} className="rounded-lg border border-sky-200 bg-sky-50/40 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <OfferMeta offer={offer} />
                    {offer.isMine ? (
                      <p className="mt-2 text-sm text-slate-700">
                        Your offer. Riders who reserve show up here; confirm the ride from the reservation before the
                        window, or cancel it if plans change.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-700">
                        Your seat{offer.mySeat && offer.mySeat.seats > 1 ? `s (${offer.mySeat.seats})` : ''}
                        {offer.mySeat?.state === 'CONFIRMED'
                          ? ' — confirmed. Be at the line at the window start; the driver has your seat.'
                          : ' — reserved. The driver confirms before the window; release it if you cannot make it.'}
                      </p>
                    )}
                  </div>
                  {offer.isMine ? (
                    <form action={cancelOwnOffer}>
                      <input type="hidden" name="offer_id" value={offer.id} />
                      <input type="hidden" name="expected_revision" value={offer.revision} />
                      <BoardActionButton label="Cancel offer" pendingLabel="Cancelling…" tone="danger" />
                    </form>
                  ) : offer.mySeat?.state === 'ACTIVE' ? (
                    <form action={releaseOwnSeat}>
                      <input type="hidden" name="offer_id" value={offer.id} />
                      <input type="hidden" name="expected_revision" value={offer.revision} />
                      <BoardActionButton label="Release seat" pendingLabel="Releasing…" />
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="open-offers-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="open-offers-heading" className="text-sm font-bold uppercase tracking-wide text-sky-700">
            Open offers
          </h2>
          <LiveUpdated renderedLabel={renderedLabel} />
        </div>

        {board.others.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center" aria-live="polite">
            <p className="font-semibold text-slate-950">
              {board.empty ? 'No offers for this window yet.' : 'No other offers for this window yet.'}
            </p>
            <p className="mt-2 text-slate-700">
              <Link href="/dashboard" className="font-bold text-sky-700 underline-offset-2 hover:underline">
                Check in
              </Link>{' '}
              so drivers can see you, or{' '}
              <a href="#post-seat-form" className="font-bold text-sky-700 underline-offset-2 hover:underline">
                post a request
              </a>{' '}
              below.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4" aria-live="polite">
            {board.others.map((offer) => (
              <li key={offer.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <OfferMeta offer={offer} />
                  <ReserveSeatButton offerId={offer.id} expectedRevision={offer.revision} disabled={offer.isMine} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="post-seat-heading" id="post-seat-form" className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 id="post-seat-heading" className="text-sm font-bold uppercase tracking-wide text-sky-700">
          Post a seat
        </h2>
        <div className="mt-4">
          <PostSeatForm />
        </div>
      </section>
    </div>
  )
}

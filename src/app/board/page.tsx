import Link from 'next/link'
import PostSeatForm from '@/components/PostSeatForm'
import ReserveSeatButton from '@/components/ReserveSeatButton'
import { getCorridorBoardOffers } from '@/lib/corridor-board.ts'
import { buildCorridorBoard } from '@/lib/domain/board.ts'

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
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Board - Sluglines',
  description: "Post a seat or reserve one on the Horner Rd <-> L'Enfant Plaza corridor.",
}

function windowLabel(windowStart: string, windowEnd: string): string {
  const start = new Date(windowStart)
  const end = new Date(windowEnd)
  const format = (value: Date) =>
    Number.isNaN(value.getTime())
      ? 'unknown time'
      : value.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return `${format(start)} - ${format(end)}`
}

export default async function BoardPage() {
  const read = await getCorridorBoardOffers()

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

  const board = buildCorridorBoard(read.rows, { viewerId: read.viewerId, corridor: read.corridor })

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Horner Rd <span aria-hidden>&harr;</span> L&apos;Enfant Plaza
        </h1>
        <p className="mt-2 text-slate-700">The one corridor this board covers today.</p>
      </div>

      <section aria-labelledby="post-seat-heading" id="post-seat-form" className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 id="post-seat-heading" className="text-sm font-bold uppercase tracking-wide text-sky-700">
          Post a seat
        </h2>
        <div className="mt-4">
          <PostSeatForm />
        </div>
      </section>

      <section aria-labelledby="open-offers-heading">
        <h2 id="open-offers-heading" className="text-sm font-bold uppercase tracking-wide text-sky-700">
          Open offers
        </h2>

        {board.empty ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="font-semibold text-slate-950">No offers for this window yet.</p>
            <p className="mt-2 text-slate-700">
              <Link href="/dashboard" className="font-bold text-sky-700 underline-offset-2 hover:underline">
                Check in
              </Link>{' '}
              so drivers can see you, or{' '}
              <a href="#post-seat-form" className="font-bold text-sky-700 underline-offset-2 hover:underline">
                post a request
              </a>{' '}
              above.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {board.offers.map((offer) => (
              <li key={offer.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

                  <ReserveSeatButton offerId={offer.id} expectedRevision={offer.revision} disabled={offer.isMine} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

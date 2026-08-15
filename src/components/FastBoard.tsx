import Link from 'next/link'
import { Car, MapPin, Users } from 'lucide-react'
import type { FastBoard as FastBoardData } from '@/lib/domain/fast-board'

interface FastBoardProps {
  board: FastBoardData
}

/**
 * The M3 dashboard board: all 43 active lines, one screen, no interaction
 * required to read it.
 *
 * Server-rendered on purpose. The previous dashboard shipped a client component
 * that opened a realtime channel and issued two selects per mount before it
 * could show anything; the user this page exists for is looking at it for a few
 * seconds on a phone, on a commuter lot's cell signal, and the counts are
 * already in the server render. `force-dynamic` on the route keeps them fresh
 * without a round trip after paint.
 *
 * A table rather than a card grid, also on purpose: 43 cards is a scroll, 43
 * rows is a scan, and the column positions stay put between loads even as the
 * activity ordering moves rows around.
 *
 * Accessibility (§10): each count is a number under a text column header, so the
 * rider/driver distinction survives with colour ignored (WCAG 1.4.1), and the
 * checked-in row is marked with a text badge rather than only a highlight.
 */
export default function FastBoard({ board }: FastBoardProps) {
  const isLive = board.availability === 'live'

  return (
    <section aria-labelledby="fast-board-heading" className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 id="fast-board-heading" className="text-lg font-bold text-slate-950">
          All active lines
        </h2>
        <p className="text-sm font-semibold text-slate-700">
          {isLive
            ? `${board.totals.spotsWithActivity} of ${board.totals.spots} spots showing activity`
            : `${board.totals.spots} active spots · live counts are not switched on yet`}
        </p>
      </div>

      {isLive ? (
        <>
          <dl className="grid grid-cols-3 gap-2 border-b border-slate-200 p-4">
            <TotalCell label="Riders waiting" value={board.totals.waiting} icon={<Users aria-hidden className="h-4 w-4" />} tone="rider" />
            <TotalCell label="Driver offers" value={board.totals.driverOffers} icon={<Car aria-hidden className="h-4 w-4" />} tone="driver" />
            <TotalCell label="Spots with activity" value={board.totals.spotsWithActivity} icon={<MapPin aria-hidden className="h-4 w-4" />} tone="neutral" />
          </dl>

          {board.totals.spotsWithActivity === 0 && (
            <p className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
              Quiet right now — every active line is reporting zero. Morning peak is 5:30–9:30.
            </p>
          )}
        </>
      ) : (
        <p className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          Live rider and driver counts are not switched on yet, so this board is showing the directory
          rather than measurements: which lines run, in which direction, on which corridor. Numbers
          appear here the moment the public aggregates go live — a zero on this page will always mean a
          count somebody took.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Active slug lines with rider and driver counts, busiest first
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-2">Spot</th>
              <th scope="col" className="px-4 py-2">Corridor</th>
              <th scope="col" className="px-4 py-2 text-right">Riders waiting</th>
              <th scope="col" className="px-4 py-2 text-right">Driver offers</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr
                key={row.slug}
                className={`border-b border-slate-100 last:border-b-0 ${row.isCheckedIn ? 'bg-sky-50' : ''}`}
              >
                <th scope="row" className="px-4 py-2 font-semibold">
                  <Link
                    href={`/spots/${row.routeSlug}`}
                    className="font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.isCheckedIn && (
                    <span className="ml-2 rounded-full border border-sky-300 bg-white px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-800">
                      You are here
                    </span>
                  )}
                  <span className="block text-xs font-normal text-slate-600">{row.county}</span>
                </th>
                <td className="px-4 py-2 text-slate-700">
                  {row.corridor}
                  <span className="block text-xs text-slate-600">{row.direction}</span>
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-amber-900">
                  {isLive ? row.waiting : '—'}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-sky-900">
                  {isLive ? row.driverOffers : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-3 text-sm text-slate-600">
        Counts are aggregates. Sluglines never shows who is at a spot, and never publishes a phone number.
      </p>
    </section>
  )
}

function TotalCell({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'rider' | 'driver' | 'neutral'
}) {
  const toneClass =
    tone === 'rider'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'driver'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <div className={`rounded-lg border p-3 text-center ${toneClass}`}>
      <dt className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="mt-1 text-3xl font-extrabold leading-none tabular-nums">{value}</dd>
    </div>
  )
}

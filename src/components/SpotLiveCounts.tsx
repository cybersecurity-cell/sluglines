import Link from 'next/link'
import type { ReactNode } from 'react'
import { Car, Users } from 'lucide-react'
import type { PublicCountsAvailability, PublicSpotCounts } from '@/lib/domain/public-counts'

interface SpotLiveCountsProps {
  spotName: string
  counts: PublicSpotCounts
  availability: PublicCountsAvailability
  isActive: boolean
  peakHours?: string
}

/**
 * Per-spot live aggregates for `/spots/[slug]` (rev. 5.3 §8 M1: "per-spot live
 * aggregates"). Server-rendered from `get_public_spot_counts()` /
 * `get_public_open_offer_counts()` — counts only, no identities, readable
 * signed-out, which is the §9 public wedge.
 *
 * It replaces the old client-side `LocationCard` on this page, which counted
 * rows in `riders` and `drivers`: tables the rebuild dropped (D-13). Those
 * queries could only ever return zero against the current schema, and a zero
 * from a table that does not exist is indistinguishable on screen from a quiet
 * line — the exact failure this component's `unavailable` state exists to avoid.
 *
 * The three §10 screen states this surface can be in are all here: quiet
 * (measured zero, with the peak-hours nudge), busy (numbers), and not-yet-live.
 */
export default function SpotLiveCounts({
  spotName,
  counts,
  availability,
  isActive,
  peakHours,
}: SpotLiveCountsProps) {
  const isLive = availability === 'live'
  const waiting = counts.waiting + counts.riderRequests
  const isQuiet = isLive && waiting === 0 && counts.driverOffers === 0

  return (
    <section
      aria-labelledby="spot-live-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="spot-live-heading" className="text-lg font-bold text-slate-950">
          Right now
        </h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">
          {isLive ? 'Live counts' : 'Counts pending'}
        </span>
      </div>

      {isLive ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <CountPanel
              label="Riders waiting"
              value={waiting}
              icon={<Users aria-hidden className="h-4 w-4" />}
              tone="rider"
            />
            <CountPanel
              label="Driver offers"
              value={counts.driverOffers}
              icon={<Car aria-hidden className="h-4 w-4" />}
              tone="driver"
            />
          </dl>

          {isQuiet && (
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              Quiet right now — morning peak is {peakHours || '5:30–9:30'}.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {isActive
            ? `${spotName} is a running line, but live rider and driver counts are not switched on yet. Everything below is the directory record for this spot.`
            : `No line is believed to be running at ${spotName} today. The directory record below is kept so the spot, and the reason it is listed, stay findable.`}
        </p>
      )}

      <p className="mt-4 text-sm text-slate-600">
        Counts are aggregates. Sluglines never shows who is at a spot, and never publishes a phone number.
      </p>

      <Link
        href="/how-it-works"
        className="mt-3 inline-block text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
      >
        New to slugging? Read the etiquette first
      </Link>
    </section>
  )
}

function CountPanel({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: ReactNode
  tone: 'rider' | 'driver'
}) {
  const toneClass =
    tone === 'rider'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-sky-200 bg-sky-50 text-sky-900'

  return (
    <div className={`rounded-lg border p-4 text-center ${toneClass}`}>
      <dt className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="mt-1 text-4xl font-extrabold leading-none">{value}</dd>
    </div>
  )
}

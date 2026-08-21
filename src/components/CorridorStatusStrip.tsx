import Link from 'next/link'
import type { ReactNode } from 'react'
import { Car, MapPin, Users } from 'lucide-react'
import type { CorridorStatus, PublicCountsAvailability } from '@/lib/domain/public-counts'

interface CorridorStatusStripProps {
  statuses: CorridorStatus[]
  availability: PublicCountsAvailability
}

/**
 * The homepage live corridor status strip (rev. 5.3 §8 M1: "Hero + live
 * corridor status strip (aggregate)").
 *
 * Two renders, and the difference is load-bearing:
 *
 *   `live`        — the public count functions answered. Zeros are measured
 *                   zeros and get the §10 empty-state copy ("Quiet right
 *                   now …"), which proposes what to do next.
 *   `unavailable` — the functions are not deployed yet (§11 Phase 2). The strip
 *                   shows what this build *does* know — how many active lines
 *                   each corridor has — and says plainly that live counts are
 *                   not switched on. Printing "0 waiting" here would be a
 *                   measurement claim nobody made.
 *
 * Accessibility (§10): every count pairs its colour with a text label, so the
 * driver/rider distinction survives with colour ignored (WCAG 1.4.1). The
 * numbers are in a `dl`, so a screen reader reads "Riders waiting, 4" rather
 * than a bare digit.
 */
export default function CorridorStatusStrip({ statuses, availability }: CorridorStatusStripProps) {
  const isLive = availability === 'live'
  const totalActiveSpots = statuses.reduce((total, status) => total + status.activeSpots, 0)

  return (
    <section aria-labelledby="corridor-status-heading" className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-sky-700">Corridor status</p>
            <h2 id="corridor-status-heading" className="text-2xl font-bold tracking-tight text-slate-950">
              {totalActiveSpots} active slug lines across two corridors
            </h2>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {isLive ? 'Counts refresh with every page load.' : 'Live counts are not switched on yet.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {statuses.map((status) => (
            <article key={status.corridor} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-950">{status.corridor}</h3>
                <p className="text-sm font-semibold text-slate-700">
                  <MapPin aria-hidden className="mr-1 inline h-4 w-4 align-text-bottom" />
                  {status.activeSpots} active {status.activeSpots === 1 ? 'spot' : 'spots'}
                </p>
              </div>

              <p className="mt-1 text-sm text-slate-600">
                {status.directions
                  .filter((direction) => direction.activeSpots > 0)
                  .map((direction) => `${direction.activeSpots} ${direction.direction.toLowerCase()}`)
                  .join(' · ')}
              </p>

              {isLive ? (
                <>
                  <dl className="mt-4 grid grid-cols-3 gap-2">
                    <CountCell
                      label="Riders waiting"
                      value={status.counts.waiting + status.counts.riderRequests}
                      icon={<Users aria-hidden className="h-4 w-4" />}
                      tone="rider"
                    />
                    <CountCell
                      label="Driver offers"
                      value={status.counts.driverOffers}
                      icon={<Car aria-hidden className="h-4 w-4" />}
                      tone="driver"
                    />
                    <CountCell
                      label="Spots with activity"
                      value={status.spotsWithActivity}
                      icon={<MapPin aria-hidden className="h-4 w-4" />}
                      tone="neutral"
                    />
                  </dl>
                  {status.spotsWithActivity === 0 && (
                    <p className="mt-3 text-sm text-slate-600">
                      Quiet right now — morning peak is 5:30–9:30.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                  Live rider and driver counts arrive with the public board. Until then this page shows the
                  directory: which lines run, where they form, and where they go.
                </p>
              )}

              <Link
                href="/spots"
                className="mt-4 inline-block text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
              >
                Browse {status.corridor} spots
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function CountCell({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: ReactNode
  tone: 'rider' | 'driver' | 'neutral'
}) {
  // Colour carries no meaning on its own here: the label under each number says
  // which count it is (§10, WCAG 1.4.1).
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
      <dd className="mt-1 text-3xl font-extrabold leading-none">{value}</dd>
    </div>
  )
}

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
    <section aria-labelledby="corridor-status-heading" className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">
              Corridor status
            </p>
            <h2 id="corridor-status-heading" className="h-display text-2xl text-[#17202A] sm:text-3xl">
              {totalActiveSpots} active slug lines across two corridors
            </h2>
          </div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span aria-hidden className={`h-2 w-2 rounded-full ${isLive ? 'bg-[#2E7D46]' : 'bg-stone-300'}`} />
            {isLive ? 'Counts refresh with every page load.' : 'Live counts are not switched on yet.'}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-stone-200">
          {statuses.map((status, index) => (
            <article
              key={status.corridor}
              className={`px-5 py-5 sm:px-6 ${index > 0 ? 'border-t border-dashed border-stone-200' : ''}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h3 className="h-display text-lg text-[#17202A]">{status.corridor}</h3>
                <p className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin aria-hidden className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                  {status.activeSpots} active {status.activeSpots === 1 ? 'spot' : 'spots'}
                  {' · '}
                  {status.directions
                    .filter((direction) => direction.activeSpots > 0)
                    .map((direction) => `${direction.activeSpots} ${direction.direction.toLowerCase()}`)
                    .join(' · ')}
                </p>
              </div>

              {isLive ? (
                <>
                  <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
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
                    <p className="mt-3 text-sm text-slate-600">Quiet right now — morning peak is 5:30–9:30.</p>
                  )}
                </>
              ) : (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                  This is the directory: which lines run, where they form, and where they go. Rider and driver counts
                  join it once the public board is switched on.
                </p>
              )}

              <Link
                href="/spots"
                className="mt-4 inline-block text-sm font-bold text-[#2E7D46] underline-offset-2 hover:text-[#1f5c33] hover:underline"
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
  // §10's semantic pair: `--rider` amber, `--driver` blue. Colour carries no
  // meaning on its own here — the label beside each number says which count it
  // is, so the distinction survives with colour ignored (WCAG 1.4.1).
  //
  // blue-800 rather than the old sky-700: sky is the retired brand chrome this
  // redesign removes, and reusing it for the driver role would have kept the
  // palette alive under a new name. Both tones are pinned in
  // scripts/contrast-check.mjs.
  const toneClass = tone === 'rider' ? 'text-amber-800' : tone === 'driver' ? 'text-blue-800' : 'text-slate-600'

  return (
    <div className="flex items-center gap-2.5">
      <dt className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${toneClass}`}>
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="font-mono text-xl font-extrabold leading-none text-[#17202A]">{value}</dd>
    </div>
  )
}

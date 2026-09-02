import type { ReactNode } from 'react'
import { Bus, Car, Clock, Info, MapPin, ParkingCircle } from 'lucide-react'
import type { SpotFactState } from '@/lib/domain/locations'
import type { PublicLocation } from '@/lib/public-directory'

interface SpotQuickFactsProps {
  location: PublicLocation
}

export default function SpotQuickFacts({ location }: SpotQuickFactsProps) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#2E7D46]">Quick facts</h2>
      <dl className="space-y-3 text-sm">
        <Fact icon={<MapPin aria-hidden className="h-4 w-4" />} label="Area" value={location.county} />
        <Fact icon={<Car aria-hidden className="h-4 w-4" />} label="Destination" value={location.destination} />
        <Fact
          icon={<Clock aria-hidden className="h-4 w-4" />}
          label="Peak hours"
          value={location.peakHours || 'Peak commute windows'}
        />
        {location.parking && (
          <Fact icon={<ParkingCircle aria-hidden className="h-4 w-4" />} label="Parking" value={location.parking} />
        )}
        {location.publicTransportation && (
          <Fact
            icon={<Bus aria-hidden className="h-4 w-4" />}
            label="Public transportation"
            value={location.publicTransportation.join(', ')}
          />
        )}
      </dl>
      <FreshnessNote location={location} />
    </section>
  )
}

/**
 * The freshness qualifier for the facts above (issue #36).
 *
 * WHY IT SITS INSIDE THIS CARD rather than at the top of the page: it qualifies
 * these specific claims — peak hours, parking, destination — and not the spot's
 * existence, its map link, or the live counts, which are measured rather than
 * inherited. A page-level banner would have implied all of it was doubtful.
 *
 * WHY `verified` RENDERS NOTHING: a badge on every state is decoration, and a
 * reader learns to skip it. Silence is the signal that a fact was confirmed,
 * which is the same reason `unavailable` and a measured zero render differently
 * (D-33).
 *
 * Today every spot is `needs-review`, so this shows on all 50 pages. That is not
 * a bug to soften — nothing in the directory has been checked against a primary
 * source, and the note says exactly that until someone does the checking.
 */
const FRESHNESS_COPY: Record<Exclude<SpotFactState, 'verified'>, string> = {
  'needs-review':
    'These details came from the legacy Sluglines site and have not been confirmed against a current source. Treat them as orientation, not instructions.',
  'community-reported':
    'Recently reported by the community and not yet corroborated by an official source.',
  historical:
    'Kept for context only. This describes how the spot used to operate and may no longer be current.',
}

function FreshnessNote({ location }: { location: PublicLocation }) {
  const { state, checkedAt } = location.provenance
  if (state === 'verified') return null

  return (
    <p className="mt-3 flex gap-2 border-t border-stone-200 pt-3 text-xs text-slate-600">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {FRESHNESS_COPY[state]}
        {/* Only ever a real check date. Never back-filled with the import date —
            that would make an untouched record look attended to. */}
        {checkedAt ? ` Last checked ${checkedAt}.` : null}
      </span>
    </p>
  )
}

// A `dl` may wrap each pair in ONE `div`; this used to use two, which put the
// `dt` and `dd` out of the list as far as a screen reader is concerned. Lighthouse
// scored it `definition-list` + `dlitem`, both failing. The icon moved inside the
// `dt` rather than sitting in a sibling span, which is also where it belongs: it
// labels the term, not the pair.
function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-slate-600">
        <span className="text-[#2E7D46]">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 pl-6 text-[#17202A]">{value}</dd>
    </div>
  )
}

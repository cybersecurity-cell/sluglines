import type { ReactNode } from 'react'
import { Car, Clock, MapPin, ParkingCircle } from 'lucide-react'
import type { PublicLocation } from '@/lib/public-directory'

interface SpotQuickFactsProps {
  location: PublicLocation
}

export default function SpotQuickFacts({ location }: SpotQuickFactsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Quick facts</h2>
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
      </dl>
    </section>
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
      <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        <span className="text-sky-700">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 pl-6 text-slate-800">{value}</dd>
    </div>
  )
}

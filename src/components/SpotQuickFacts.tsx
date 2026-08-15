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

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-sky-700">{icon}</span>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</dt>
        <dd className="mt-0.5 text-slate-800">{value}</dd>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Car, Clock, MapPin, ParkingCircle } from 'lucide-react'
import type { SlugLocation } from '@/lib/location-fallbacks'
import type { DirectorySpot } from '@/lib/spot-directory'

interface SpotQuickFactsProps {
  location: SlugLocation
  spot?: DirectorySpot | null
}

export default function SpotQuickFacts({ location, spot }: SpotQuickFactsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Quick facts</h2>
      <dl className="space-y-3 text-sm">
        <Fact icon={<MapPin className="h-4 w-4" />} label="Area" value={spot?.county || location.location || 'Northern Virginia'} />
        <Fact icon={<Car className="h-4 w-4" />} label="Destination" value={location.destination} />
        <Fact icon={<Clock className="h-4 w-4" />} label="Peak hours" value={spot?.peakHours || 'Peak commute windows'} />
        {spot?.parking && <Fact icon={<ParkingCircle className="h-4 w-4" />} label="Parking" value={spot.parking} />}
      </dl>
    </section>
  )
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-sky-700">{icon}</span>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-slate-800">{value}</dd>
      </div>
    </div>
  )
}

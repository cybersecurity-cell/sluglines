import Link from 'next/link'

import type { LocationSummary } from '@/lib/domain/location'

import { LocationCard } from './LocationCard'

export function LocationGrid({ locations, error }: { locations: LocationSummary[]; error?: string }) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <h2 className="font-bold text-red-950">Location information is temporarily unavailable.</h2>
        <p className="mt-2 text-sm leading-6 text-red-800">Please try again shortly. We do not substitute unverified location data when the directory cannot be reached.</p>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
        <h2 className="text-lg font-bold text-slate-950">No locations match these filters.</h2>
        <p className="mt-2 text-sm text-slate-600">Try a broader pickup area, destination, or corridor.</p>
        <Link className="mt-4 inline-flex font-bold text-blue-700 underline-offset-4 hover:underline" href="/locations">Clear filters</Link>
      </div>
    )
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {locations.map((location) => <LocationCard key={location.id} location={location} />)}
    </div>
  )
}

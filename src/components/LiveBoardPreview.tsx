import Link from 'next/link'
import { ArrowRight, Radio } from 'lucide-react'
import LocationCard, { LocationCardLocation } from '@/components/LocationCard'

interface LiveBoardPreviewProps {
  locations: LocationCardLocation[]
}

export default function LiveBoardPreview({ locations }: LiveBoardPreviewProps) {
  const previewLocations = locations.slice(0, 3)

  if (previewLocations.length === 0) {
    return null
  }

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-700">
              <Radio className="h-4 w-4" />
              Live commuter status
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Live board preview</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              The app layer helps active commuters check in and see current rider and driver counts.
            </p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-sky-700 hover:text-sky-900">
            Open full live board
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {previewLocations.map((location) => (
            <LocationCard key={location.id} location={location} compact />
          ))}
        </div>
      </div>
    </section>
  )
}

import SpotSearch from '@/components/SpotSearch'
import { SPOT_DIRECTORY } from '@/lib/spot-directory'

export const metadata = {
  title: 'Slug Pickup Locations - Sluglines',
  description: 'Search all slug line pickup and return spots by corridor, county, direction, and destination.',
}

export default function SpotsPage() {
  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Slug Pickup</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">Pickup and return locations</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Search the established Northern Virginia and DC slug line directory. Locations are organized by corridor,
            morning or afternoon direction, and county or city.
          </p>
        </div>
      </section>

      <SpotSearch spots={SPOT_DIRECTORY} />
    </div>
  )
}

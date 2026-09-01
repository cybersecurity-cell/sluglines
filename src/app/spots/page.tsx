import SpotSearch from '@/components/SpotSearch'
import { SPOT_DIRECTORY } from '@/lib/spot-directory'

export const metadata = {
  title: 'Slug Pickup Locations - Sluglines',
  description: 'Search all slug line pickup and return spots by corridor, county, direction, and destination.',
}

export default function SpotsPage() {
  return (
    <div className="bg-white text-[#17202A]">
      <section className="border-b border-stone-200 bg-[#FAFAF8]">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">Slug pickup</p>
          <h1 className="h-display text-4xl text-[#17202A] md:text-5xl">Pickup and return locations</h1>
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

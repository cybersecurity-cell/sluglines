import Link from 'next/link'
import { Smartphone } from 'lucide-react'
import InfoModuleGrid from '@/components/InfoModuleGrid'
import LiveBoardPreview from '@/components/LiveBoardPreview'
import SiteHero from '@/components/SiteHero'
import SpotDirectorySection from '@/components/SpotDirectorySection'
import { enrichLocation, getActiveFallbackLocations } from '@/lib/location-fallbacks'
import { HOMEPAGE_STATS } from '@/lib/site-content'
import {
  directorySpotToLocationCard,
  getActiveSpotLocations,
} from '@/lib/spot-directory'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const activeSpots = getActiveSpotLocations()
  const liveLocations = await getLiveLocations()

  return (
    <div className="bg-white text-slate-950">
      <SiteHero />

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 px-4 py-5 md:grid-cols-3">
          {HOMEPAGE_STATS.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{stat.label}</div>
              <div className="mt-1 text-base font-bold text-slate-950">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      <SpotDirectorySection
        spots={activeSpots}
        title="Find a pickup or return line"
        description="Start with the established location directory. Browse by corridor, direction, and county, then open a detail page for maps and known destinations."
        limitPerCounty={5}
      />

      <LiveBoardPreview locations={liveLocations} />

      <InfoModuleGrid />

      <section className="bg-sky-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-200">
              <Smartphone className="h-4 w-4" />
              App module
            </p>
            <h2 className="text-3xl font-bold tracking-tight">Use the app when you are on the move.</h2>
            <p className="mt-2 max-w-2xl text-sky-100">
              The website remains the reference guide. The app and live board are for quick commuter check-ins, counts, and alerts.
            </p>
          </div>
          <Link
            href="/app"
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-bold text-sky-950 hover:bg-sky-50"
          >
            View app details
          </Link>
        </div>
      </section>
    </div>
  )
}

async function getLiveLocations() {
  const supabase = createClient()
  const { data: locationRows, error } = await supabase
    .from('spot_status')
    .select('id,spot_name,location,destination,highway,last_updated,is_active')
    .eq('is_active', true)
    .order('spot_name', { ascending: true })

  if (!error && locationRows && locationRows.length > 0) {
    return locationRows.map(enrichLocation).slice(0, 3)
  }

  const fallbackLocations = getActiveFallbackLocations()

  if (fallbackLocations.length > 0) {
    return fallbackLocations.slice(0, 3)
  }

  return getActiveSpotLocations().slice(0, 3).map(directorySpotToLocationCard)
}

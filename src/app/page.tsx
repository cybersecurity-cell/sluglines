import Link from 'next/link'
import { ArrowRight, MapPin, Zap } from 'lucide-react'
import HomeLocationGrid from '@/components/HomeLocationGrid'
import { enrichLocation, getActiveFallbackLocations } from '@/lib/location-fallbacks'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient()
  const { data: locationRows, error } = await supabase
    .from('spot_status')
    .select('id,spot_name,location,destination,highway,last_updated,is_active')
    .eq('is_active', true)
    .order('spot_name', { ascending: true })
  const locations = !error && locationRows && locationRows.length > 0
    ? locationRows.map(enrichLocation)
    : getActiveFallbackLocations()

  return (
    <div>
      <section className="mx-auto flex min-h-[48vh] max-w-6xl items-center px-4 py-16">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
            <span className="live-dot"></span>
            Riders and drivers updating live
          </div>
          <h1 className="mb-7 text-5xl font-extrabold leading-none text-white md:text-7xl">
            Find your slug line before you leave.
          </h1>
          <p className="mb-10 max-w-xl text-xl leading-relaxed text-slate-400">
            Live rider and driver counts for Northern Virginia HOV-3 pickup spots, with your nearest active location pinned first.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/dashboard" className="btn-primary text-base shadow-lg shadow-sky-500/25">
              <Zap className="h-4 w-4" />
              Open Fast Board
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/spots" className="btn-secondary text-base">
              <MapPin className="h-4 w-4" />
              Browse All Spots
            </Link>
          </div>
        </div>
      </section>

      <HomeLocationGrid locations={locations} />
    </div>
  )
}

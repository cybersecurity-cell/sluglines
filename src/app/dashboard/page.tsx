import DashboardClient from '@/components/DashboardClient'
import { enrichLocation, getActiveFallbackLocations } from '@/lib/location-fallbacks'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Fast Board - Sluglines',
  description: 'Compact live rider and driver counts at all active Northern Virginia slug line spots.',
}

export default async function DashboardPage() {
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
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <p className="section-label mb-3">Power user</p>
        <h1 className="mb-4 text-4xl font-extrabold text-white md:text-5xl">Fast Board</h1>
        <p className="max-w-2xl text-lg text-slate-400">
          Compact live counts, your current check-in, and one-tap checkout for regular commuters.
        </p>
      </div>

      <DashboardClient locations={locations} />
    </div>
  )
}

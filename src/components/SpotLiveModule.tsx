import ActivityFeed from '@/components/ActivityFeed'
import AlertBanner from '@/components/AlertBanner'
import LocationCard from '@/components/LocationCard'
import type { SlugLocation } from '@/lib/location-fallbacks'

interface SpotLiveModuleProps {
  location: SlugLocation
  isFallback: boolean
}

export default function SpotLiveModule({ location, isFallback }: SpotLiveModuleProps) {
  return (
    <aside className="space-y-4">
      <LocationCard location={location} compact variant="module" />
      {isFallback ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Live check-ins will activate here once this spot is linked to the Supabase live board.
        </div>
      ) : (
        <>
          <AlertBanner locationId={location.id} />
          <ActivityFeed locationId={location.id} />
        </>
      )}
    </aside>
  )
}

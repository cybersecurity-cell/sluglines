import InfoModuleGrid from '@/components/InfoModuleGrid'
import RecentPostsSection from '@/components/RecentPostsSection'
import SiteHero from '@/components/SiteHero'
import SpotDirectorySection from '@/components/SpotDirectorySection'
import { buildLegacyMetadata, getLegacyPageByPath } from '@/lib/legacy-content'
import { getActiveSpotLocations } from '@/lib/spot-directory'

const homePage = getLegacyPageByPath('/')

export const metadata = homePage
  ? buildLegacyMetadata(homePage)
  : {
      title: 'Sluglines - Connecting drivers and riders for better commute',
      description: 'Connecting drivers and riders for better commute',
    }

export default function HomePage() {
  return (
    <div className="bg-white text-slate-950">
      <SiteHero />
      <SpotDirectorySection
        spots={getActiveSpotLocations()}
        title="Popular slug pickup and return locations"
        description="Start with the active morning and afternoon lines, then open the full directory to search every known Sluglines location."
        limitPerCounty={4}
      />
      <InfoModuleGrid />
      <RecentPostsSection />
    </div>
  )
}

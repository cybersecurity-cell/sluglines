import CorridorStatusStrip from '@/components/CorridorStatusStrip'
import InfoModuleGrid from '@/components/InfoModuleGrid'
import RecentPostsSection from '@/components/RecentPostsSection'
import SiteHero from '@/components/SiteHero'
import SpotDirectorySection from '@/components/SpotDirectorySection'
import { corridorStatus } from '@/lib/domain/public-counts'
import { buildLegacyMetadata, getLegacyPageByPath } from '@/lib/legacy-content'
import { getPublicSpotCounts } from '@/lib/public-directory'
import { getActiveSpotLocations } from '@/lib/spot-directory'

const homePage = getLegacyPageByPath('/')

// The legacy SEO strings ("Connecting drivers and riders for better commute")
// are kept in the data file, which is the record of the old site, but the page
// says what the site is now (issue #142). The canonical and Open Graph shape
// still come from buildLegacyMetadata.
const HOME_TITLE = 'Sluglines - Slug lines and HOV-3 carpools in Northern Virginia'
const HOME_DESCRIPTION =
  'The pickup directory for slug lines on I-95, I-395 and I-66, rider and driver counts at every spot, and how slugging works.'

export const metadata = {
  ...(homePage ? buildLegacyMetadata(homePage) : {}),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  openGraph: {
    ...(homePage ? buildLegacyMetadata(homePage).openGraph : {}),
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
}

/**
 * `/` — hero + live corridor status strip + directory entries (rev. 5.3 §8 M1).
 *
 * Rendered per request because the strip is the "live" half of the §9 public
 * wedge: aggregates readable signed-out. The rest of the page is static data and
 * would cache happily, but a stale count is worse than no count on a page whose
 * whole promise is what is happening at the curb right now.
 */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const snapshot = await getPublicSpotCounts()
  // Computed once and handed to both: the hero panel and the strip print the
  // same corridor totals, so they cannot drift apart.
  const statuses = corridorStatus(snapshot)

  return (
    <div className="bg-white text-[#17202A]">
      <SiteHero statuses={statuses} availability={snapshot.availability} />
      <CorridorStatusStrip statuses={statuses} availability={snapshot.availability} />
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

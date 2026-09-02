import { notFound } from 'next/navigation'
import SpotDetailLayout from '@/components/SpotDetailLayout'
import { countsForSlug } from '@/lib/domain/public-counts'
import { getPublicLocation, getPublicSpotCounts } from '@/lib/public-directory'

/**
 * `/spots/[slug]` — the M1 per-spot public page (rev. 5.3 §8 M1), and the
 * landing target of the 43 legacy `/slug_pickup/<slug>/` URLs (§9; the 301 is in
 * `src/lib/legacy-redirects.ts`).
 *
 * Reads the `locations` table, falling back to the committed directory the
 * table was seeded from — see `src/lib/public-directory.ts` for why that
 * fallback is load-bearing today rather than defensive.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const location = await getPublicLocation(slug)

  if (!location) {
    return { title: 'Location Not Found - Sluglines' }
  }

  return {
    title: `${location.name} - Sluglines`,
    description: `${location.direction} slug line at ${location.name} in ${location.county}, headed toward ${location.destination}.`,
    alternates: { canonical: `https://sluglines.com/spots/${location.routeSlug}` },
  }
}

export default async function SpotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const location = await getPublicLocation(slug)

  if (!location) {
    notFound()
  }

  // One round trip for both public functions, shared by the page. The counts
  // are aggregates, so there is nothing here to scope to a session.
  const snapshot = await getPublicSpotCounts()

  return (
    <SpotDetailLayout
      location={location}
      counts={countsForSlug(snapshot, location.slug)}
      availability={snapshot.availability}
    />
  )
}

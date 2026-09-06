import { notFound } from 'next/navigation'
import SpotDetailLayout from '@/components/SpotDetailLayout'
import type { CheckInOutcome, CheckOutOutcome } from '@/app/spots/actions'
import { getMemberPresence } from '@/lib/dashboard'
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
 *
 * The page stays public; only the check-in card (issue #135) is per-viewer.
 * `getMemberPresence()` resolves to `signed-out` for an anonymous visitor and
 * the card renders a sign-in link, so nothing about the aggregates or the
 * directory record depends on a session. `?checkin=` / `?checkout=` carry the
 * outcome of the last submit back from `app/spots/actions.ts`; anything but
 * the published values is ignored.
 */
export const dynamic = 'force-dynamic'

const CHECK_IN_OUTCOMES: readonly CheckInOutcome[] = ['ok', 'failed', 'unavailable']
const CHECK_OUT_OUTCOMES: readonly CheckOutOutcome[] = ['ok', 'failed']

function checkInOutcome(value: string | undefined): CheckInOutcome | undefined {
  return (CHECK_IN_OUTCOMES as readonly string[]).includes(value ?? '') ? (value as CheckInOutcome) : undefined
}

function checkOutOutcome(value: string | undefined): CheckOutOutcome | undefined {
  return (CHECK_OUT_OUTCOMES as readonly string[]).includes(value ?? '') ? (value as CheckOutOutcome) : undefined
}

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

export default async function SpotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ checkin?: string; checkout?: string }>
}) {
  const { slug } = await params
  const location = await getPublicLocation(slug)

  if (!location) {
    notFound()
  }

  // One round trip for both public functions, shared by the page. The counts
  // are aggregates, so there is nothing here to scope to a session; the
  // viewer's own presence is the one per-session read, for the check-in card.
  const [snapshot, presence, resolvedSearchParams] = await Promise.all([
    getPublicSpotCounts(),
    getMemberPresence(),
    searchParams,
  ])

  return (
    <SpotDetailLayout
      location={location}
      counts={countsForSlug(snapshot, location.slug)}
      availability={snapshot.availability}
      presence={presence}
      checkIn={checkInOutcome(resolvedSearchParams?.checkin)}
      checkOut={checkOutOutcome(resolvedSearchParams?.checkout)}
    />
  )
}

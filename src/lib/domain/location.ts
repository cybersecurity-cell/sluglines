export type VerificationStatus =
  | 'verified'
  | 'community_reported'
  | 'review_needed'
  | 'historical'

export type Direction = 'inbound' | 'outbound' | 'both'
export type Corridor = 'I-95/I-395' | 'I-66' | 'Other'
export type LocationStatus = 'active' | 'inactive' | 'seasonal' | 'review_needed'
export type SourceType = 'official' | 'community' | 'historical' | 'operator'

export interface SourceSummary {
  name: string
  url: string
  source_type: SourceType
}

export interface RouteSummaryRow {
  direction: 'inbound' | 'outbound'
  verification_status: VerificationStatus
  last_verified_at: string | null
  source: SourceSummary | null
  destination: {
    slug: string
    name: string
  }
}

export interface RoutePresentation {
  destinationSlug: string
  destinationName: string
  direction: 'inbound' | 'outbound'
  freshness: FreshnessPresentation
  source: Pick<SourceSummary, 'name' | 'url'> | null
}

export interface LocationRow {
  id: string
  slug: string
  name: string
  corridor: Corridor
  direction: Direction
  address: string | null
  municipality: string | null
  parking_details: string | null
  transit_details: string | null
  operating_notes: string | null
  status: LocationStatus
  verification_status: VerificationStatus
  last_verified_at: string | null
  published: boolean
  source: SourceSummary | null
  routes: RouteSummaryRow[]
}

export interface FreshnessPresentation {
  label: string
  tone: 'verified' | 'community' | 'review' | 'historical'
  detail: string
}

export interface LocationSummary {
  id: string
  slug: string
  name: string
  corridor: Corridor
  direction: Direction
  directionLabel: string
  address: string | null
  municipality: string | null
  parkingDetails: string | null
  transitDetails: string | null
  operatingNotes: string | null
  status: LocationStatus
  destinationNames: string[]
  routes: RoutePresentation[]
  freshness: FreshnessPresentation
  source: Pick<SourceSummary, 'name' | 'url'> | null
}

export function projectSource(source: SourceSummary | null): Pick<SourceSummary, 'name' | 'url'> | null {
  if (!source) return null
  try {
    const url = new URL(source.url)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return { name: source.name, url: url.toString() }
  } catch {
    return null
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function reviewedDateDetail(value: string): string {
  return `Last reviewed ${dateFormatter.format(new Date(value))}`
}

export function directionLabel(direction: Direction): string {
  if (direction === 'inbound') return 'Morning · toward DC and Arlington'
  if (direction === 'outbound') return 'Afternoon · toward Northern Virginia'
  return 'Morning and afternoon'
}

export function formatFreshness(
  lastVerifiedAt: string | null,
  status: VerificationStatus,
  now = new Date(),
): FreshnessPresentation {
  if (status === 'historical') {
    return {
      label: 'Historical reference',
      tone: 'historical',
      detail: lastVerifiedAt ? reviewedDateDetail(lastVerifiedAt) : 'Current operation is not confirmed',
    }
  }

  if (status === 'community_reported') {
    return {
      label: 'Community reported',
      tone: 'community',
      detail: lastVerifiedAt ? reviewedDateDetail(lastVerifiedAt) : 'Awaiting independent verification',
    }
  }

  if (!lastVerifiedAt || status === 'review_needed') {
    return {
      label: 'Needs review',
      tone: 'review',
      detail: lastVerifiedAt ? reviewedDateDetail(lastVerifiedAt) : 'No current verification date',
    }
  }

  const reviewedAt = new Date(lastVerifiedAt)
  if (Number.isNaN(reviewedAt.getTime()) || reviewedAt > now) {
    return {
      label: 'Needs review',
      tone: 'review',
      detail: 'Verification date is invalid',
    }
  }

  const days = Math.floor((now.getTime() - reviewedAt.getTime()) / 86_400_000)
  if (days > 90) {
    return {
      label: 'Review recommended',
      tone: 'review',
      detail: reviewedDateDetail(lastVerifiedAt),
    }
  }

  return {
    label: 'Verified',
    tone: 'verified',
    detail: days === 0 ? 'Reviewed today' : `Reviewed ${days} day${days === 1 ? '' : 's'} ago`,
  }
}

export function projectLocation(row: LocationRow, now = new Date()): LocationSummary {
  const destinationNames = Array.from(new Set(row.routes.map((route) => route.destination.name))).sort(
    (left, right) => left.localeCompare(right),
  )
  const routes = Array.from(
    new Map(row.routes.map((route) => [`${route.direction}:${route.destination.slug}`, route])).values(),
  )
    .map((route) => ({
      destinationSlug: route.destination.slug,
      destinationName: route.destination.name,
      direction: route.direction,
      freshness: formatFreshness(route.last_verified_at, route.verification_status, now),
      source: projectSource(route.source),
    }))
    .sort((left, right) => left.destinationName.localeCompare(right.destinationName) || left.direction.localeCompare(right.direction))

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    corridor: row.corridor,
    direction: row.direction,
    directionLabel: directionLabel(row.direction),
    address: row.address,
    municipality: row.municipality,
    parkingDetails: row.parking_details,
    transitDetails: row.transit_details,
    operatingNotes: row.operating_notes,
    status: row.status,
    destinationNames,
    routes,
    freshness: formatFreshness(row.last_verified_at, row.verification_status, now),
    source: projectSource(row.source),
  }
}

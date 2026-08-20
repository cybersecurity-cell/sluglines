import {
  formatFreshness,
  projectSource,
  type FreshnessPresentation,
  type SourceSummary,
  type VerificationStatus,
} from './location.ts'

export type AdvisorySeverity = 'info' | 'warning' | 'urgent'
export type AdvisoryStatus = 'draft' | 'published' | 'expired'

export interface AdvisoryRow {
  id: string
  location_id: string | null
  title: string
  message: string
  severity: AdvisorySeverity
  status: AdvisoryStatus
  starts_at: string | null
  ends_at: string | null
  published_at: string | null
  verification_status: VerificationStatus
  last_verified_at: string | null
  source: SourceSummary | null
  location: { slug: string; name: string } | null
}

export interface AdvisorySummary {
  id: string
  title: string
  message: string
  severity: AdvisorySeverity
  startsAt: string | null
  endsAt: string | null
  publishedAt: string | null
  freshness: FreshnessPresentation
  source: { name: string; url: string } | null
  location: { slug: string; name: string } | null
}

const severityRank: Record<AdvisorySeverity, number> = { urgent: 0, warning: 1, info: 2 }

function timestamp(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function isActiveAdvisory(row: AdvisoryRow, now = new Date()): boolean {
  if (row.status !== 'published') return false
  const current = now.getTime()
  if (row.starts_at && timestamp(row.starts_at) > current) return false
  if (row.ends_at && timestamp(row.ends_at) <= current) return false
  return true
}

export function projectAdvisory(row: AdvisoryRow, now = new Date()): AdvisorySummary {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    severity: row.severity,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    publishedAt: row.published_at,
    freshness: formatFreshness(row.last_verified_at, row.verification_status, now),
    source: projectSource(row.source),
    location: row.location,
  }
}

export function activeAdvisories(rows: AdvisoryRow[], now = new Date()): AdvisorySummary[] {
  return rows
    .filter((row) => isActiveAdvisory(row, now))
    .sort(
      (left, right) =>
        severityRank[left.severity] - severityRank[right.severity]
        || timestamp(right.published_at) - timestamp(left.published_at),
    )
    .map((row) => projectAdvisory(row, now))
}

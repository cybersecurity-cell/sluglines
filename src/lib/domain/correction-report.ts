export const correctionCategories = [
  'location',
  'route',
  'schedule',
  'parking',
  'transit',
  'safety',
  'other',
] as const

export type CorrectionCategory = (typeof correctionCategories)[number]

export interface CorrectionReportInput {
  category?: unknown
  summary?: unknown
  details?: unknown
  sourceUrl?: unknown
  locationId?: unknown
  website?: unknown
}

export interface CorrectionReportValue {
  category: CorrectionCategory
  summary: string
  details: string
  sourceUrl: string | null
  locationId: string | null
}

export type CorrectionReportValidation =
  | { ok: true; value: CorrectionReportValue }
  | { ok: false; errors: Record<string, string> }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function secureUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function validateCorrectionReport(input: CorrectionReportInput): CorrectionReportValidation {
  if (text(input.website)) return { ok: false, errors: { form: 'Unable to submit this report.' } }

  const category = text(input.category)
  const summary = text(input.summary)
  const details = text(input.details)
  const sourceUrl = text(input.sourceUrl)
  const locationId = text(input.locationId)
  const errors: Record<string, string> = {}

  if (!correctionCategories.includes(category as CorrectionCategory)) {
    errors.category = 'Choose a report category.'
  }
  if (summary.length < 10 || summary.length > 160) {
    errors.summary = 'Use between 10 and 160 characters.'
  }
  if (details.length < 20 || details.length > 3000) {
    errors.details = 'Use between 20 and 3000 characters.'
  }
  if (!secureUrl(sourceUrl)) errors.sourceUrl = 'Use a secure HTTPS link.'
  if (locationId && !uuidPattern.test(locationId)) errors.locationId = 'Choose a valid location.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      category: category as CorrectionCategory,
      summary,
      details,
      sourceUrl: sourceUrl || null,
      locationId: locationId || null,
    },
  }
}

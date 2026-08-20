import type { Direction } from '../domain/location.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export type ProfileValidation =
  | { ok: true; value: { displayName: string } }
  | { ok: false; errors: { displayName: string } }

export function validateProfile(input: { displayName?: unknown }): ProfileValidation {
  const displayName = text(input.displayName)
  if (displayName.length < 2 || displayName.length > 80) {
    return { ok: false, errors: { displayName: 'Use between 2 and 80 characters.' } }
  }
  return { ok: true, value: { displayName } }
}

export interface CommutePreferencesValue {
  homeLocationId: string | null
  destinationId: string | null
  preferredDirection: Direction | null
  emailAdvisories: boolean
}

export type CommutePreferencesValidation =
  | { ok: true; value: CommutePreferencesValue }
  | { ok: false; errors: Record<string, string> }

export function validateCommutePreferences(input: {
  homeLocationId?: unknown
  destinationId?: unknown
  preferredDirection?: unknown
  emailAdvisories?: unknown
}): CommutePreferencesValidation {
  const homeLocationId = text(input.homeLocationId)
  const destinationId = text(input.destinationId)
  const preferredDirection = text(input.preferredDirection)
  const errors: Record<string, string> = {}

  if (homeLocationId && !uuidPattern.test(homeLocationId)) {
    errors.homeLocationId = 'Choose a valid home location.'
  }
  if (destinationId && !uuidPattern.test(destinationId)) {
    errors.destinationId = 'Choose a valid destination.'
  }
  if (preferredDirection && !['inbound', 'outbound', 'both'].includes(preferredDirection)) {
    errors.preferredDirection = 'Choose a commute direction.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      homeLocationId: homeLocationId || null,
      destinationId: destinationId || null,
      preferredDirection: (preferredDirection || null) as Direction | null,
      emailAdvisories: input.emailAdvisories === true || input.emailAdvisories === 'on',
    },
  }
}

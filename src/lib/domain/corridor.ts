/**
 * `lib/domain/corridor.ts` — the one corridor pair this slice serves: Horner Rd
 * <-> L'Enfant Plaza.
 *
 * WHY TWO HARD-CODED LOCATION IDS
 * ---------------------------------------------------------------------------
 * `public.offers.origin_location_id`/`destination_location_id` are `uuid not
 * null` with **no foreign key** — `0002`'s own header says the P1 `locations`
 * directory migration (`0004`) that would add one "does not exist yet", and
 * `src/lib/dashboard.ts` confirms it still isn't applied anywhere. There is
 * therefore no row to look an id up against, in this repo or on production.
 *
 * Rather than invent a locations table this PR was told not to build (no
 * migration in this slice), the two ids below are committed placeholders,
 * exactly as `origin_location_id`'s own column comment anticipates: "the FK is
 * added by that migration rather than guessed here." When `0004` lands, these
 * two constants are replaced by real directory rows and this file's exports
 * become a thin lookup over `locations` instead of literals — nothing that
 * reads `PILOT_CORRIDOR_PAIR` needs to change shape for that to happen.
 *
 * `hornerRd` matches `SPOT_LOCATIONS`'s `horner-rd` entry (`locations.ts`) by
 * name. There is no equivalent `SpotLocation` row for L'Enfant Plaza — the M1
 * directory only seeds origin park-and-ride lots, and L'Enfant only ever
 * appears there as a destination string — so it has no directory slug to match
 * and is named here for the first time.
 */

/** A stable, fixed v4-shaped UUID. Never derived from user input or randomness. */
export const HORNER_RD_LOCATION_ID = '11111111-1111-4111-8111-111111111111'
export const LENFANT_PLAZA_LOCATION_ID = '22222222-2222-4222-8222-222222222222'

export interface PilotCorridorLocation {
  readonly id: string
  readonly name: string
}

export const HORNER_RD: PilotCorridorLocation = { id: HORNER_RD_LOCATION_ID, name: "Horner Rd" }
export const LENFANT_PLAZA: PilotCorridorLocation = { id: LENFANT_PLAZA_LOCATION_ID, name: "L'Enfant Plaza" }

/** Both permutations of the one pair this slice serves. */
export const PILOT_CORRIDOR_PAIR_LOCATION_IDS: readonly [string, string] = [
  HORNER_RD_LOCATION_ID,
  LENFANT_PLAZA_LOCATION_ID,
]

export type CorridorDirection = 'horner-to-lenfant' | 'lenfant-to-horner'

export const CORRIDOR_DIRECTIONS: readonly CorridorDirection[] = ['horner-to-lenfant', 'lenfant-to-horner']

export function isCorridorDirection(value: unknown): value is CorridorDirection {
  return typeof value === 'string' && (CORRIDOR_DIRECTIONS as readonly string[]).includes(value)
}

/** origin/destination location ids for a chosen posting direction. */
export function corridorLocationsForDirection(direction: CorridorDirection): {
  readonly origin: PilotCorridorLocation
  readonly destination: PilotCorridorLocation
} {
  return direction === 'horner-to-lenfant'
    ? { origin: HORNER_RD, destination: LENFANT_PLAZA }
    : { origin: LENFANT_PLAZA, destination: HORNER_RD }
}

export interface CorridorDirectionOption {
  readonly value: CorridorDirection
  readonly label: string
}

/** The two directions, labelled, for a `<select>` — order matches `CORRIDOR_DIRECTIONS`. */
export function corridorDirectionOptions(): readonly CorridorDirectionOption[] {
  return CORRIDOR_DIRECTIONS.map((direction) => {
    const { origin, destination } = corridorLocationsForDirection(direction)
    return { value: direction, label: `${origin.name} -> ${destination.name}` }
  })
}

/** Whether a row's (origin, destination) pair is this slice's one corridor pair, in either direction. */
export function isPilotCorridorPair(originLocationId: string, destinationLocationId: string): boolean {
  return (
    (originLocationId === HORNER_RD_LOCATION_ID && destinationLocationId === LENFANT_PLAZA_LOCATION_ID) ||
    (originLocationId === LENFANT_PLAZA_LOCATION_ID && destinationLocationId === HORNER_RD_LOCATION_ID)
  )
}

function corridorLocationName(locationId: string): string | undefined {
  if (locationId === HORNER_RD_LOCATION_ID) return HORNER_RD.name
  if (locationId === LENFANT_PLAZA_LOCATION_ID) return LENFANT_PLAZA.name
  return undefined
}

/**
 * `"Horner Rd -> L'Enfant Plaza"`, or `undefined` for a pair that is not this
 * slice's corridor — never a guess at a name for an id this module does not know.
 */
export function corridorDirectionLabel(originLocationId: string, destinationLocationId: string): string | undefined {
  const origin = corridorLocationName(originLocationId)
  const destination = corridorLocationName(destinationLocationId)
  if (origin === undefined || destination === undefined) return undefined
  return `${origin} -> ${destination}`
}

/**
 * `lib/domain/corridor.ts` — the one corridor pair this slice serves: Horner Rd
 * <-> L'Enfant Plaza.
 *
 * SLUGS, NOT IDS (issue #132, `Docs/DECISIONS.md` D-82)
 * ---------------------------------------------------------------------------
 * The first version of this module committed two literal uuids for the pair, on
 * the written premise that `0004` — the `locations` directory and the foreign
 * keys `offers.origin_location_id` / `destination_location_id` carry to it —
 * "still isn't applied anywhere". It is `APPLIED: production` (D-41), its FKs
 * are enforced on every new insert, and `locations.id` is `gen_random_uuid()`,
 * so no committed literal can ever match a row: every post-a-seat request
 * raised 23503 and the board filter matched nothing.
 *
 * So this module now names the pair by **slug**, the one key `0004` declares
 * stable across databases ("`id` is `gen_random_uuid()`, so location ids differ
 * between environments. The stable cross-environment key is `slug`"), and the
 * ids are resolved per request from the database that is actually serving it —
 * `src/lib/corridor-locations.ts` does the read, `resolvePilotCorridor` below
 * does the pure half over the rows it fetched. Both slugs are `0004` rows,
 * active, on every database that has run the sequence — the first version of
 * this file also claimed L'Enfant Plaza had no directory row, and that was
 * wrong: `src/lib/domain/locations.ts` carries `lenfant-plaza` (an afternoon
 * spot, `routeSlug` `LEnfant-Plaza`), and so does the production table.
 *
 * Everything that takes ids (`corridorLocationIdsForDirection`,
 * `isPilotCorridorPair`, `corridorDirectionLabel`) takes the resolved pair as an
 * argument rather than reaching for a module constant. That is what keeps this
 * module pure (rev. 5.3 §8: `lib/domain` does no I/O) and keeps it honest — it
 * cannot name an id it was not handed.
 */

export const HORNER_RD_SLUG = 'horner-rd'
export const LENFANT_PLAZA_SLUG = 'lenfant-plaza'

export interface PilotCorridorLocation {
  /** `locations.slug` — the cross-environment key. Never an id. */
  readonly slug: string
  readonly name: string
}

export const HORNER_RD: PilotCorridorLocation = { slug: HORNER_RD_SLUG, name: 'Horner Rd' }
export const LENFANT_PLAZA: PilotCorridorLocation = { slug: LENFANT_PLAZA_SLUG, name: "L'Enfant Plaza" }

/** The two slugs the pair is resolved from, in a fixed order. */
export const PILOT_CORRIDOR_SLUGS: readonly [string, string] = [HORNER_RD_SLUG, LENFANT_PLAZA_SLUG]

export type CorridorDirection = 'horner-to-lenfant' | 'lenfant-to-horner'

export const CORRIDOR_DIRECTIONS: readonly CorridorDirection[] = ['horner-to-lenfant', 'lenfant-to-horner']

export function isCorridorDirection(value: unknown): value is CorridorDirection {
  return typeof value === 'string' && (CORRIDOR_DIRECTIONS as readonly string[]).includes(value)
}

/** origin/destination for a chosen posting direction — by slug and name, no ids. */
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

// -----------------------------------------------------------------------------
// The resolved pair: ids that exist on the database serving this request
// -----------------------------------------------------------------------------

/** The shape `src/lib/corridor-locations.ts` selects: `locations.id, locations.slug`. */
export interface LocationIdRow {
  readonly id: string
  readonly slug: string
}

/** Both ids of the pair, as they exist on one particular database. Never constructed from literals. */
export interface ResolvedPilotCorridor {
  readonly hornerRdId: string
  readonly lenfantPlazaId: string
}

export type ResolvePilotCorridorResult =
  | { readonly ok: true; readonly corridor: ResolvedPilotCorridor }
  /** Which of `PILOT_CORRIDOR_SLUGS` had no row. Non-empty. */
  | { readonly ok: false; readonly missing: readonly string[] }

/**
 * Pure: pairs the rows a caller fetched by slug with the two slugs this module
 * names. A slug with no row is reported by name, not papered over — a missing
 * row means `0004` is not on this database (or the row was deactivated), and
 * the caller's failure message should say which.
 */
export function resolvePilotCorridor(rows: readonly LocationIdRow[]): ResolvePilotCorridorResult {
  const bySlug = new Map(rows.map((row) => [row.slug, row.id] as const))
  const missing = PILOT_CORRIDOR_SLUGS.filter((slug) => !bySlug.has(slug))
  if (missing.length > 0) return { ok: false, missing }
  return {
    ok: true,
    corridor: {
      hornerRdId: bySlug.get(HORNER_RD_SLUG) as string,
      lenfantPlazaId: bySlug.get(LENFANT_PLAZA_SLUG) as string,
    },
  }
}

/** origin/destination ids for a posting direction, on the resolved pair. */
export function corridorLocationIdsForDirection(
  corridor: ResolvedPilotCorridor,
  direction: CorridorDirection
): { readonly originId: string; readonly destinationId: string } {
  return direction === 'horner-to-lenfant'
    ? { originId: corridor.hornerRdId, destinationId: corridor.lenfantPlazaId }
    : { originId: corridor.lenfantPlazaId, destinationId: corridor.hornerRdId }
}

/** Whether a row's (origin, destination) pair is this slice's one corridor pair, in either direction. */
export function isPilotCorridorPair(
  corridor: ResolvedPilotCorridor,
  originLocationId: string,
  destinationLocationId: string
): boolean {
  return (
    (originLocationId === corridor.hornerRdId && destinationLocationId === corridor.lenfantPlazaId) ||
    (originLocationId === corridor.lenfantPlazaId && destinationLocationId === corridor.hornerRdId)
  )
}

function corridorLocationName(corridor: ResolvedPilotCorridor, locationId: string): string | undefined {
  if (locationId === corridor.hornerRdId) return HORNER_RD.name
  if (locationId === corridor.lenfantPlazaId) return LENFANT_PLAZA.name
  return undefined
}

/**
 * `"Horner Rd -> L'Enfant Plaza"`, or `undefined` for a pair that is not this
 * slice's corridor — never a guess at a name for an id this module was not handed.
 */
export function corridorDirectionLabel(
  corridor: ResolvedPilotCorridor,
  originLocationId: string,
  destinationLocationId: string
): string | undefined {
  const origin = corridorLocationName(corridor, originLocationId)
  const destination = corridorLocationName(corridor, destinationLocationId)
  if (origin === undefined || destination === undefined) return undefined
  return `${origin} -> ${destination}`
}

/**
 * `lib/domain` — deterministic domain layer (rev. 5.3 §6, §8).
 *
 * Boundary rule, from the rev. 5.3 §8 dependency table:
 *
 *   lib/domain/**  --imports-->  lib/supabase only (never React, never lib/ai)
 *
 * That rule is enforced statically by `tests/domain-boundaries.test.mjs`, which
 * is the first *provable* slice of the boundary rule recorded as deferred in
 * `Docs/DECISIONS.md` D-10 — deferred because `lib/ai` still does not exist and a
 * lint rule against it could not be made to fail. `lib/domain` does exist now, so
 * its half of the rule is enforceable today.
 *
 * Load-bearing principle (rev. 5.3 §6): models propose; code and database
 * transactions decide. Nothing in this directory may reach `lib/ai`.
 */

export {
  OFFER_STATES,
  OFFER_TRANSITIONS,
  TERMINAL_OFFER_STATES,
  OPEN_OFFER_STATES,
  CONFIRMED_OR_LATER_STATES,
  isOfferState,
  isTerminalOfferState,
  nextOfferStates,
  canTransition,
  checkTransition,
  transitionPath,
  stateAfterReservation,
  stateAfterRelease,
} from './offer-state.ts'

export type { OfferState, TransitionCheck } from './offer-state.ts'

export {
  REVISION_START,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  TRANSITION_ERRCODES,
  OFFER_TRANSITION_OPERATIONS,
  RESERVATION_STATES,
  LIVE_RESERVATION_STATES,
  operationForEdge,
  isTransitionErrcode,
  transitionErrcodeOf,
  isConflictError,
  isRetryableError,
  isIdempotencyKey,
  nextRevision,
  checkRevision,
  checkTransitionRequest,
  toTransitionCheck,
  offerEdgeList,
} from './offer-transitions.ts'

export type {
  OfferTransitionOperation,
  ReservationState,
  TransitionActor,
  TransitionErrcode,
  TransitionRequest,
  TransitionRequestCheck,
} from './offer-transitions.ts'

export {
  SPOT_LOCATIONS,
  SPOT_LOCATION_COUNT,
  SPOT_CORRIDORS,
  SPOT_DIRECTIONS,
  canonicalSlug,
  findSpotLocation,
  hasSpotLocation,
  activeSpotLocations,
  inactiveSpotLocations,
  spotLocationsByCorridor,
  spotLocationsByDirection,
  spotLocationCounties,
  groupSpotLocations,
  distanceInMiles,
  spotLocationDistance,
  nearestSpotLocations,
} from './locations.ts'

export type {
  SpotCorridor,
  SpotDirection,
  SpotLocation,
  SpotLocationCorridorGroup,
  SpotCoordinates,
} from './locations.ts'

export {
  PUBLIC_SPOT_COUNTS_FUNCTION,
  PUBLIC_OPEN_OFFER_COUNTS_FUNCTION,
  PUBLIC_COUNT_FUNCTIONS,
  ZERO_SPOT_COUNTS,
  UNAVAILABLE_SNAPSHOT,
  isExpectedAbsence,
  errorCodeOf,
  normalizeCountRows,
  indexCountRows,
  fetchPublicSpotCounts,
  countsForSlug,
  totalCounts,
  corridorStatus,
} from './public-counts.ts'

export type {
  CorridorStatus,
  PublicCountsAvailability,
  PublicCountsClient,
  PublicCountsSnapshot,
  PublicSpotCountRow,
  PublicSpotCounts,
} from './public-counts.ts'

export {
  LOCATION_COLUMNS,
  publicLocationFromRow,
  publicLocationFromDirectory,
} from './public-location.ts'

export type { LocationRow, PublicLocation, PublicLocationSource } from './public-location.ts'

export {
  PRESENCE_CHECKIN_COLUMNS,
  PRESENCE_CLEAR_FUNCTION,
  PRESENCE_CHECKIN_FUNCTION,
  toPresenceDirection,
  SIGNED_OUT_PRESENCE,
  NO_PRESENCE,
  isPresenceLive,
  minutesRemaining,
  presenceFromRow,
  presenceDirectionLabel,
  buildFastBoard,
  activeFastBoardRows,
} from './fast-board.ts'

export type {
  FastBoard,
  FastBoardOptions,
  FastBoardRow,
  FastBoardTotals,
  MemberPresence,
  PresenceCheckinRow,
  PresenceDirection,
  PresenceState,
} from './fast-board.ts'

export {
  EMPTY_SPOT_SEARCH,
  matchesSpotQuery,
  matchesSpotStatus,
  searchSpotLocations,
  resolveSpotQuery,
} from './spot-search.ts'

export type { SpotSearchFilters, SpotStatusFilter } from './spot-search.ts'

export { isE164Phone, isOtpCode, normalizePhone, redactPii } from './phone.ts'

export {
  HORNER_RD,
  HORNER_RD_SLUG,
  LENFANT_PLAZA,
  LENFANT_PLAZA_SLUG,
  PILOT_CORRIDOR_SLUGS,
  CORRIDOR_DIRECTIONS,
  isCorridorDirection,
  corridorLocationsForDirection,
  corridorDirectionOptions,
  resolvePilotCorridor,
  corridorLocationIdsForDirection,
  isPilotCorridorPair,
  corridorDirectionLabel,
} from './corridor.ts'

export type {
  CorridorDirection,
  PilotCorridorLocation,
  CorridorDirectionOption,
  LocationIdRow,
  ResolvedPilotCorridor,
  ResolvePilotCorridorResult,
} from './corridor.ts'

export {
  BOARD_VISIBLE_STATES,
  CORRIDOR_OFFER_COLUMNS,
  seatsRemaining,
  buildCorridorBoard,
} from './board.ts'

export type { CorridorOfferRow, CorridorBoardOffer, CorridorBoard } from './board.ts'

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
} from './offer-state.ts'

export type { OfferState, TransitionCheck } from './offer-state.ts'

/**
 * The M3 API surface rev. 5.3 §8 names, minus the part that has a writer.
 *
 * rev. 5.3 §8 M3 lists `POST /api/offers/{advance,cancel,confirm,eta,waitlist}`,
 * `/api/reservations{,/confirm,/no-show}` and
 * `/api/recurring-offers/{cancel,pause,resume,skip}` in one sentence — but the
 * same section's table puts *"recurring templates + skips, waitlist/ETA/no-show"*
 * behind §11 **Phase 4**, and `0002_ride_coordinator_state.sql` says so in its
 * own scope note (line 67). Most of those tables and functions still do not
 * exist in any migration in this repo, applied or unapplied.
 *
 * `/api/recurring-offers/skip` is one exception, closed by Option B slice 4
 * (Docs/DECISIONS.md D-71, issue #90): its dependency, `recurring_offer_skips`,
 * landed in `0019_recurring_offers_schema.sql`, so it is wired live
 * (`src/lib/api/recurring-offer-skip-route.ts`) rather than registered here.
 * `recurring-offers/{cancel,pause,resume}` are unaffected — their own missing
 * dependency is a `recurring_offers` table distinct from that slice's
 * `recurring_offer_templates`, so they remain correctly deferred below.
 *
 * `/api/offers/waitlist` is the other, closed by Option B slice 5 (issue #90):
 * `offer_waitlist` landed in `0021_waitlist_eta_noshow_schema.sql`, so it is
 * wired live (`src/lib/api/offer-waitlist-join-route.ts`) rather than
 * registered here. `offers/eta` and `reservations/no-show` are unaffected —
 * their own deferred entries name `offer_set_eta` and
 * `reservation_mark_no_show`, and that slice's functions are
 * `post_eta_update()` and `report_no_show()`, so both remain correctly
 * deferred below.
 *
 * So five of the eleven routes have nothing to call. They are shipped as
 * **501 Not Implemented** with the missing dependency named in the response,
 * rather than omitted:
 *
 *   - the route surface matches the document, so a client can be written against
 *     the whole contract and discover the gap from the API instead of from a 404
 *     that is indistinguishable from a typo;
 *   - a 501 is a promise not kept *yet*, which is what this is — a 200 stub or a
 *     silently absent route would both be claims that are not true;
 *   - the missing objects are listed, so closing one is a mechanical change and
 *     `tests/api-routes.test.mjs` fails the moment a listed object appears in a
 *     migration while its route still answers 501.
 *
 * This module is pure so that last check can run: it imports nothing but types.
 */

export interface DeferredEndpoint {
  /** Request path, exactly as rev. 5.3 §8 M3 spells it. */
  readonly route: string
  /** What the endpoint would do once its dependency lands. */
  readonly operation: string
  /**
   * Database objects that must exist first. Each name is checked against
   * `supabase/migrations/**` by the API test: if one appears there, this entry
   * is stale and the route is due.
   */
  readonly missing: readonly string[]
  /** Where rev. 5.3 puts the work. */
  readonly blockedOn: string
}

export const DEFERRED_M3_ENDPOINTS: readonly DeferredEndpoint[] = [
  {
    route: '/api/offers/eta',
    operation: 'one-tap "running late +5/10/15" in CONFIRMED and ARRIVING',
    missing: ['offer_set_eta'],
    blockedOn: 'rev. 5.3 §11 Phase 4 — politeness mechanics (§9.4)',
  },
  {
    route: '/api/reservations/no-show',
    operation: 'privately record that the other party did not appear',
    missing: ['reservation_mark_no_show'],
    blockedOn: 'rev. 5.3 §11 Phase 4 — no-show flow (§9.4)',
  },
  {
    route: '/api/recurring-offers/cancel',
    operation: 'delete a recurring template',
    missing: ['recurring_offers', 'recurring_offer_cancel'],
    blockedOn: 'rev. 5.3 §11 Phase 4 — recurring templates + skips',
  },
  {
    route: '/api/recurring-offers/pause',
    operation: 'stop a recurring template generating offers, without deleting it',
    missing: ['recurring_offers', 'recurring_offer_pause'],
    blockedOn: 'rev. 5.3 §11 Phase 4 — recurring templates + skips',
  },
  {
    route: '/api/recurring-offers/resume',
    operation: 'resume a paused recurring template',
    missing: ['recurring_offers', 'recurring_offer_resume'],
    blockedOn: 'rev. 5.3 §11 Phase 4 — recurring templates + skips',
  },
  // '/api/recurring-offers/skip' is no longer here: Option B slice 4 (D-71,
  // issue #90) brought in `recurring_offer_skips` and
  // `skip_recurring_offer_occurrence()`, so this exact registration is what
  // told tests/api-routes.test.mjs the route was due. It is now wired live —
  // see src/lib/api/recurring-offer-skip-route.ts.
  //
  // '/api/offers/waitlist' is no longer here: Option B slice 5 (issue #90)
  // brought in `offer_waitlist` and `offer_waitlist_join()`, so this exact
  // registration is what told tests/api-routes.test.mjs the route was due. It
  // is now wired live — see src/lib/api/offer-waitlist-join-route.ts.
]

export function deferredEndpoint(route: string): DeferredEndpoint | undefined {
  return DEFERRED_M3_ENDPOINTS.find((endpoint) => endpoint.route === route)
}

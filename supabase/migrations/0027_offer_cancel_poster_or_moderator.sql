-- =============================================================================
-- 0027_offer_cancel_poster_or_moderator.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp),
--          applied 2026-09-06 through the Supabase MCP connector's apply_migration, one
--          file per apply, as the rehearsal for the production apply. Production has
--          NOT run this file. See Docs/DECISIONS.md D-96 and supabase/migrations/README.md.
--
-- SECURITY FIX. Issue #133, `Docs/DECISIONS.md` D-83. Re-creates
-- `public.offer_cancel(uuid, integer, text)` so that only the offer's poster
-- or a moderator may cancel an offer. Signature-preserving `create or
-- replace`, the `0003` pattern (`supabase/migrations/README.md`, "Correcting a
-- migration that has already been applied"): `0002` is `APPLIED: production`
-- and is not edited.
--
-- THE DEFECT
-- -----------------------------------------------------------------------------
-- `0002`'s `offer_cancel` admits any actor who is the poster OR holds an
-- ACTIVE/CONFIRMED reservation on the offer. On success it moves the offer to
-- CANCELLED (terminal) and sets EVERY live reservation on it to CANCELLED. So a
-- rider who claims one seat of a four-seat car can end the driver's ride for
-- the other three riders with two requests (`POST /api/reservations`, then
-- `POST /api/offers/cancel`), and one phone-verified account can empty a
-- corridor's board during a peak window. `0002`'s header called this the
-- "driver/rider bail-out" after rev. 5.3 sec.8 M3's label for the
-- CONFIRMED | ARRIVING -> CANCELLED edges; but the OFFER is the driver's, and a
-- rider's bail-out is a decision about their own SEAT, not about everyone
-- else's.
--
-- WHAT CHANGES
-- -----------------------------------------------------------------------------
-- One guard. `0002` (lines ~1275-1283):
--
--   if v_poster <> v_actor
--      and not exists (select 1 from public.reservations r
--                       where r.offer_id = p_offer_id and r.rider_id = v_actor
--                         and r.state in ('ACTIVE', 'CONFIRMED')) then
--     raise exception 'only a participant may cancel this offer' using errcode = '42501';
--
-- becomes
--
--   if v_poster <> v_actor and not public.caller_is_moderator() then
--     raise exception 'only the poster or a moderator may cancel this offer' using errcode = '42501';
--
-- `caller_is_moderator()` is `0002`'s own helper (SECURITY DEFINER, reads
-- `members.role` for `auth.uid()`), the same one every moderator-gated RLS
-- policy in the tree calls. Everything else in the body -- the idempotency
-- claim and completion, the `for update` lock, the P0002 on a missing offer,
-- the hop through `apply_offer_transition`, the cascade that sets live
-- reservations to CANCELLED -- is byte-for-byte what `0002` runs;
-- `tests/offer-state-machine.test.mjs` asserts that by normalising the two
-- bodies and comparing everything but the guard.
--
-- WHAT THIS TAKES AWAY, STATED RATHER THAN HIDDEN
-- -----------------------------------------------------------------------------
-- A rider holding an ACTIVE seat still has `offer_release_seat` (`0002`):
-- their seat goes back, the offer recomputes its state, nobody else is
-- touched. A rider holding a CONFIRMED seat has, after this file, no write
-- path of their own: `offer_release_seat` refuses a CONFIRMED reservation by
-- design ("bailing out after confirmation is offer_cancel()", `0002`'s own
-- comment above `offer_release_seat`), and this file removes that route. That
-- is a real gap, and it is the smaller one: a confirmed rider who cannot make
-- it has the poster's phone number from pickup details and the poster can
-- cancel or proceed; a rider who can cancel the whole car for everyone is the
-- failure that makes drivers stop posting. The rider-scoped withdrawal of a
-- CONFIRMED seat is a new function on a new edge and is filed as its own
-- issue, not smuggled in here -- see D-83.
--
-- GRANTS
-- -----------------------------------------------------------------------------
-- Identical to `0002`'s: revoked from PUBLIC, granted to `authenticated`, and
-- -- like `0026` does for every member entry point -- explicitly revoked from
-- `anon`, so this file is safe to apply before or after `0026`. The body reads
-- `auth.uid()` (R12's guard branch) as it always did.
--
-- ==> APPLIED: preview (phase-3-4-staging, 2026-09-06, D-96). Writing this
--     file was the job of the change that added it; the production apply is a
--     separate, explicitly authorised act still pending (README, "Applying a
--     migration"). Until it runs there, the defect is live on production.
-- =============================================================================

create or replace function public.offer_cancel(
  p_offer_id          uuid,
  p_expected_revision integer,
  p_idempotency_key   text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_replay   jsonb;
  v_state    text;
  v_poster   uuid;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_cancel', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  select state, poster_id
    into v_state, v_poster
    from public.offers
   where id = p_offer_id
     for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  -- The one changed statement (issue #133). A rider holding a seat is not a
  -- participant in the sense of "may end the ride for everyone"; their own
  -- seat is offer_release_seat's business.
  if v_poster <> v_actor and not public.caller_is_moderator() then
    raise exception 'only the poster or a moderator may cancel this offer' using errcode = '42501';
  end if;

  v_revision := public.apply_offer_transition(
    p_offer_id, 'CANCELLED', p_expected_revision, v_actor, 'offer_cancel', p_idempotency_key, 0, 0
  );

  update public.reservations
     set state      = 'CANCELLED',
         revision   = revision + 1,
         updated_at = now()
   where offer_id = p_offer_id
     and state in ('ACTIVE', 'CONFIRMED');

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_cancel(uuid, integer, text) from public;
revoke all on function public.offer_cancel(uuid, integer, text) from anon;
grant execute on function public.offer_cancel(uuid, integer, text) to authenticated;

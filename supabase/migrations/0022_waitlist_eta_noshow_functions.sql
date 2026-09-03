-- =============================================================================
-- 0022_waitlist_eta_noshow_functions.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp), applied 2026-09-02
--
-- The write path for 0021's offer_waitlist/eta_updates/no_show_reports
-- tables: join/leave the waitlist, post an ETA note, report a no-show, and the
-- promotion machinery a freed seat needs to reach the oldest waiting rider.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's
-- 0016_phase2_waitlist_eta_noshow_functions.sql
-- -----------------------------------------------------------------------------
-- Same adaptations as every other Option B slice (is_moderator() ->
-- caller_is_moderator(), log_audit_event() -> record_audit_event()), plus the
-- one that matters most in this file:
--
-- HOW PROMOTION REUSES THE OFFER STATE MACHINE, NOT A RAW WRITE
-- -----------------------------------------------------------------------------
-- Sluglines-AI's promote_from_waitlist() does `insert into reservations (...)`
-- and `update offers set state = ...` directly, because that repo's offers
-- table has no SECURITY DEFINER create-and-transition split. This repo's
-- offers table is 0002's M3 state machine: offer_reserve_seat() is a client
-- entry point keyed on auth.uid(), and offers.state/offers.revision move
-- nowhere except through apply_offer_transition() (0002's own words: "the
-- only place offers.state or offers.revision moves"). A raw insert/update
-- from this file would create a reservation and bump seats_taken with no
-- ledger row, no revision bump, and no idempotency claim -- exactly the gap
-- D-71 already closed for recurring-offer instantiation.
--
-- So promotion is built from the same two pieces D-71 used, applied here to
-- offer_reserve_seat() instead of offer_create():
--
--   1. offer_reserve_seat_for_member() (below) -- offer_reserve_seat()'s
--      (0002) body, with the actor as an explicit parameter instead of
--      auth.uid(), because promotion has no session to read one from.
--      offer_reserve_seat() itself (0002) is left completely untouched -- not
--      re-created, not wrapped, not wired to call this function. Same two
--      reasons D-71 gives for offer_create_for_member(): (a)
--      supabase/migrations/README.md's rule for correcting an applied file is
--      that a later ordinal may re-create a function only to fix a defect in
--      it, with the old signature carried exactly -- offer_reserve_seat() has
--      no defect; (b) tests/offer-state-machine.test.mjs asserts,
--      function-by-function, that every client-callable M3 entry point takes
--      its actor from auth.uid() and never accepts a caller-supplied
--      p_actor_id -- redefining offer_reserve_seat() to delegate to a
--      p_actor_id-taking internal would still pass that check technically
--      while making a promotion-only capability reachable through the exact
--      name that suite exists to keep pinned to session identity. Two
--      near-identical function bodies is the accepted cost, same as D-71's.
--   2. apply_offer_transition() (0002) -- reached from inside
--      offer_reserve_seat_for_member(), exactly as it is from inside
--      offer_reserve_seat() itself. The revision check, the offer_transitions
--      ledger row and record_audit_event() all fire exactly as they would for
--      a rider who reserved the seat directly -- nothing about the state
--      machine is bypassed, only the HTTP/session layer in front of it (which
--      a promotion has no use for) is absent.
--
-- Idempotency: offer_reserve_seat_for_member() claims a *deterministic* key,
-- 'waitlist-promotion:<waitlist_id>', through the same
-- claim_offer_operation()/complete_offer_operation() pair (0002) every client
-- call uses -- a replayed promotion attempt for the same waitlist entry
-- returns the first attempt's result rather than a second reservation. The
-- hard backstop is reservations_one_live_seat_per_rider (0002), the partial
-- unique index that already stops any rider (promoted or not) from holding
-- two live reservations on the same offer.
--
-- promote_from_waitlist() only ever calls offer_reserve_seat_for_member() once
-- an offer is already read as OPEN or PARTIALLY_RESERVED under its own `for
-- update` lock -- both states imply seats_taken < seats_total by construction
-- (offer_reserve_seat() only ever advances an offer to RESERVED in the same
-- transaction it fills the last seat), so the room check inside
-- offer_reserve_seat_for_member() cannot fail here.
--
-- report_no_show() does NOT call promote_from_waitlist(). A no-show is only
-- reportable once the offer has reached CONFIRMED or later (below), and 0002's
-- state graph has no CONFIRMED -> RELEASED or CONFIRMED -> OPEN edge at all --
-- a confirmed ride in progress cannot legally reopen for new reservations, so
-- there is no seat for a promotion to fill. This matches Sluglines-AI's own
-- report_no_show(), which likewise never touches offer state or seat counts
-- except to cancel the whole offer when every rider no-showed pre-departure --
-- the one mutation this file's report_no_show() also makes, and it makes that
-- one through apply_offer_transition(), never a raw `update offers set state`.
--
-- WHAT IS DELIBERATELY NOT HERE: THE SCHEDULE
-- -----------------------------------------------------------------------------
-- Same reasoning as 0008/0015/0017/0020's own headers: a migration carrying
-- `cron.schedule` would fail on any branch without pg_cron and would schedule
-- production's sweep onto every preview branch that ever runs this sequence.
-- This file ships promote_waitlist_sweep() -- the function that repeatedly
-- drains a fed offer's waitlist as seats are released elsewhere in the app --
-- and nothing else; scheduling it is a supabase/operations/ concern for
-- whichever session is authorised to apply this migration, not this one.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- offer_reserve_seat_for_member -- offer_reserve_seat()'s (0002) body, with the
-- actor as an explicit parameter instead of auth.uid(). See the file header
-- for why this is a new function rather than a redefinition.
--
-- Internal: revoked from PUBLIC below and never granted to any client role. A
-- client-callable version of this would let any authenticated caller reserve a
-- seat as an arbitrary member -- exactly the impersonation hole
-- offer_reserve_seat()'s own auth.uid()-only design exists to close.
-- -----------------------------------------------------------------------------
create or replace function public.offer_reserve_seat_for_member(
  p_actor_id          uuid,
  p_offer_id          uuid,
  p_idempotency_key   text,
  p_seats             integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_replay         jsonb;
  v_state          text;
  v_poster         uuid;
  v_taken          integer;
  v_total          integer;
  v_offer_revision integer;
  v_revision       integer;
begin
  if p_actor_id is null then
    raise exception 'actor is required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(p_actor_id, 'offer_reserve_seat_for_member', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  if p_seats is null or p_seats < 1 or p_seats > 4 then
    raise exception 'seats must be between 1 and 4' using errcode = '22023';
  end if;

  select state, poster_id, seats_taken, seats_total, revision
    into v_state, v_poster, v_taken, v_total, v_offer_revision
    from public.offers
   where id = p_offer_id
     for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if v_poster = p_actor_id then
    raise exception 'the poster cannot reserve a seat on their own offer' using errcode = '42501';
  end if;

  if v_state not in ('OPEN', 'PARTIALLY_RESERVED') then
    raise exception 'offer is % and is not accepting reservations', v_state using errcode = '55000';
  end if;

  if v_taken + p_seats > v_total then
    raise exception 'only % seat(s) remain', v_total - v_taken using errcode = '55000';
  end if;

  -- The partial unique index refuses a second live reservation by the same rider.
  insert into public.reservations (offer_id, rider_id, seats)
  values (p_offer_id, p_actor_id, p_seats);

  if v_state = 'OPEN' then
    v_revision := public.apply_offer_transition(
      p_offer_id, 'PARTIALLY_RESERVED', v_offer_revision, p_actor_id,
      'offer_reserve_seat_for_member', p_idempotency_key, p_seats, 0
    );

    if v_taken + p_seats >= v_total then
      v_revision := public.apply_offer_transition(
        p_offer_id, 'RESERVED', v_revision, p_actor_id,
        'offer_reserve_seat_for_member', p_idempotency_key, 0, 1
      );
    end if;
  elsif v_taken + p_seats >= v_total then
    v_revision := public.apply_offer_transition(
      p_offer_id, 'RESERVED', v_offer_revision, p_actor_id,
      'offer_reserve_seat_for_member', p_idempotency_key, p_seats, 0
    );
  else
    v_revision := public.apply_offer_transition(
      p_offer_id, null, v_offer_revision, p_actor_id,
      'offer_reserve_seat_for_member', p_idempotency_key, p_seats, 0
    );
  end if;

  perform public.complete_offer_operation(p_actor_id, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_reserve_seat_for_member(uuid, uuid, text, integer) from public;


-- -----------------------------------------------------------------------------
-- offer_waitlist_join -- the caller's own entry. Idempotent: joining twice
-- returns the existing ACTIVE entry rather than erroring or duplicating.
-- -----------------------------------------------------------------------------
create or replace function public.offer_waitlist_join(p_offer_id uuid)
returns public.offer_waitlist
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_entry public.offer_waitlist%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_entry
    from public.offer_waitlist
   where offer_id = p_offer_id and rider_id = v_actor and state = 'ACTIVE';

  if found then
    return v_entry;
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if v_offer.poster_id = v_actor then
    raise exception 'cannot join your own offer waitlist' using errcode = '42501';
  end if;

  if v_offer.state <> 'RESERVED' then
    raise exception 'offer is not full; reserve a seat directly' using errcode = '55000';
  end if;

  insert into public.offer_waitlist (offer_id, rider_id)
  values (p_offer_id, v_actor)
  returning * into v_entry;

  perform public.record_audit_event(v_actor, 'waitlist.joined', 'offer', p_offer_id,
    jsonb_build_object('waitlist_id', v_entry.id));

  return v_entry;
end;
$fn$;

revoke all on function public.offer_waitlist_join(uuid) from public;
grant execute on function public.offer_waitlist_join(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_waitlist_leave -- the caller's own entry, soft-cancelled (not deleted;
-- see the file header for why this is a function rather than
-- Sluglines-AI's direct delete-own RLS policy). Idempotent: leaving when there
-- is no ACTIVE entry is a no-op, matching offer_release_seat's replay style.
-- -----------------------------------------------------------------------------
create or replace function public.offer_waitlist_leave(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_entry public.offer_waitlist%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_entry
    from public.offer_waitlist
   where offer_id = p_offer_id and rider_id = v_actor and state = 'ACTIVE'
     for update;

  if not found then
    return;
  end if;

  update public.offer_waitlist
     set state = 'CANCELLED', revision = revision + 1, updated_at = now()
   where id = v_entry.id;

  perform public.record_audit_event(v_actor, 'waitlist.left', 'offer', p_offer_id,
    jsonb_build_object('waitlist_id', v_entry.id));
end;
$fn$;

revoke all on function public.offer_waitlist_leave(uuid) from public;
grant execute on function public.offer_waitlist_leave(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- promote_from_waitlist -- promotes the oldest ACTIVE waitlist entry into the
-- offer's next open seat, through offer_reserve_seat_for_member() (see the
-- file header). A no-op, returning false, if the offer is not in a promotable
-- state or the waitlist is empty. `for update skip locked` on the waitlist
-- read so a concurrent promotion on a *different* offer never blocks this one.
--
-- Internal: never granted to any client role, same as offer_expire_sweep().
-- -----------------------------------------------------------------------------
create or replace function public.promote_from_waitlist(p_offer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_offer public.offers%rowtype;
  v_entry public.offer_waitlist%rowtype;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;

  if not found or v_offer.state not in ('OPEN', 'PARTIALLY_RESERVED') then
    return false;
  end if;

  select * into v_entry
    from public.offer_waitlist
   where offer_id = p_offer_id and state = 'ACTIVE'
   order by created_at asc
   limit 1
     for update skip locked;

  if not found then
    return false;
  end if;

  perform public.offer_reserve_seat_for_member(
    v_entry.rider_id, p_offer_id, 'waitlist-promotion:' || v_entry.id, 1
  );

  update public.offer_waitlist
     set state = 'PROMOTED', revision = revision + 1, updated_at = now()
   where id = v_entry.id;

  perform public.record_audit_event(v_entry.rider_id, 'waitlist.promoted', 'offer', p_offer_id,
    jsonb_build_object('waitlist_id', v_entry.id));

  return true;
end;
$fn$;

revoke all on function public.promote_from_waitlist(uuid) from public;


-- -----------------------------------------------------------------------------
-- promote_waitlist_sweep -- the scheduled sweep (see the file header for why
-- its schedule lives outside this directory). offer_release_seat() (0002) is
-- an applied, frozen function this migration cannot call into to trigger
-- promotion synchronously, so a freed seat is picked up here instead: one
-- promotion attempt per eligible offer per run, self-correcting across
-- consecutive runs the same way instantiate_recurring_offers() (0020) is a
-- cheap idempotent no-op once nothing is left to do.
--
-- Each offer's attempt is isolated in its own sub-transaction (`exception when
-- others`) so one offer's failure -- e.g. its oldest waiting rider already
-- holds a seat some other way -- cannot abort promotion for every other
-- unrelated offer in the same run.
--
-- Internal: never granted to any client role, same as offer_expire_sweep().
-- -----------------------------------------------------------------------------
create or replace function public.promote_waitlist_sweep()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_offer   record;
  v_count   integer := 0;
  v_promoted boolean;
begin
  for v_offer in
    select distinct o.id
      from public.offers o
      join public.offer_waitlist w on w.offer_id = o.id and w.state = 'ACTIVE'
     where o.state in ('OPEN', 'PARTIALLY_RESERVED')
     order by o.id
  loop
    begin
      v_promoted := public.promote_from_waitlist(v_offer.id);
      if v_promoted then
        v_count := v_count + 1;
      end if;
    exception when others then
      null;
    end;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.promote_waitlist_sweep() from public;


-- -----------------------------------------------------------------------------
-- post_eta_update -- the poster posts a short note once the ride is CONFIRMED
-- or later.
-- -----------------------------------------------------------------------------
create or replace function public.post_eta_update(p_offer_id uuid, p_note text)
returns public.eta_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_note  text := btrim(coalesce(p_note, ''));
  v_entry public.eta_updates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(v_note) < 1 or char_length(v_note) > 280 then
    raise exception 'note must be 1 to 280 characters' using errcode = '22023';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if v_offer.poster_id <> v_actor then
    raise exception 'only the poster may post an ETA update' using errcode = '42501';
  end if;

  if v_offer.state not in ('CONFIRMED', 'ARRIVING') then
    raise exception 'offer must be confirmed before posting an ETA update, state=%', v_offer.state
      using errcode = '55000';
  end if;

  insert into public.eta_updates (offer_id, member_id, note)
  values (p_offer_id, v_actor, v_note)
  returning * into v_entry;

  perform public.record_audit_event(v_actor, 'eta.posted', 'offer', p_offer_id,
    jsonb_build_object('eta_update_id', v_entry.id));

  return v_entry;
end;
$fn$;

revoke all on function public.post_eta_update(uuid, text) from public;
grant execute on function public.post_eta_update(uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- report_no_show -- the poster only, once the ride reached CONFIRMED or later.
-- Cancels that rider's reservation and logs for moderator review -- no
-- automatic penalty to the rider, per the phased design's "no automatic
-- penalties" principle. See the file header for why this never promotes the
-- waitlist and only reaches apply_offer_transition() for the one case where
-- every rider no-showed before departure.
-- -----------------------------------------------------------------------------
create or replace function public.report_no_show(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_reservation  public.reservations%rowtype;
  v_offer        public.offers%rowtype;
  v_actor        uuid := auth.uid();
  v_live_count   integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'reservation % not found', p_reservation_id using errcode = 'P0002';
  end if;

  select * into v_offer from public.offers where id = v_reservation.offer_id for update;

  if v_offer.poster_id <> v_actor then
    raise exception 'only the poster may report a no-show' using errcode = '42501';
  end if;

  if v_offer.state not in ('CONFIRMED', 'ARRIVING', 'PICKED_UP') then
    raise exception 'no-show can only be reported after confirmation, state=%', v_offer.state
      using errcode = '55000';
  end if;

  if v_reservation.state <> 'CONFIRMED' then
    raise exception 'reservation is not confirmed, state=%', v_reservation.state using errcode = '55000';
  end if;

  update public.reservations
     set state = 'CANCELLED', revision = revision + 1, updated_at = now()
   where id = p_reservation_id;

  insert into public.no_show_reports (offer_id, reservation_id, rider_id, reported_by)
  values (v_offer.id, p_reservation_id, v_reservation.rider_id, v_actor);

  select count(*) into v_live_count
    from public.reservations
   where offer_id = v_offer.id and state = 'CONFIRMED';

  if v_offer.state = 'CONFIRMED' and v_live_count = 0 then
    -- Every rider no-showed on a not-yet-departed ride: nothing left to
    -- depart with. ARRIVING/PICKED_UP means the driver already has at least
    -- one other rider aboard, so the offer itself stays as-is.
    perform public.apply_offer_transition(
      v_offer.id, 'CANCELLED', v_offer.revision, v_actor, 'report_no_show', null, 0, 0
    );
  end if;

  perform public.record_audit_event(v_actor, 'no_show.reported', 'offer', v_offer.id,
    jsonb_build_object('reservation_id', p_reservation_id, 'rider_id', v_reservation.rider_id));
end;
$fn$;

revoke all on function public.report_no_show(uuid) from public;
grant execute on function public.report_no_show(uuid) to authenticated;

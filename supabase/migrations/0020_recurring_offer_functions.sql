-- =============================================================================
-- 0020_recurring_offer_functions.sql
--
-- APPLIED: no
--
-- The write path for 0019's recurring_offer_templates/recurring_offer_skips
-- tables, plus instantiate_recurring_offers() -- the scheduled sweep that turns
-- an ACTIVE template into today's concrete row in public.offers.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0014_recurring_offer_functions.sql
-- -----------------------------------------------------------------------------
-- Same adaptations as every other Option B slice (is_moderator() ->
-- caller_is_moderator(), log_audit_event() -> record_audit_event()), plus the
-- one that matters most in this file:
--
-- HOW INSTANTIATION REUSES THE OFFER STATE MACHINE, NOT A RAW INSERT
-- -----------------------------------------------------------------------------
-- Sluglines-AI's instantiate_recurring_offers() does `insert into offers (...)`
-- directly, because that repo's offers table has no SECURITY DEFINER
-- create-and-transition split for a scheduler to call into -- offer rows there
-- start life already in a live state. This repo's offers table is 0002's M3
-- state machine: every row starts DRAFT, `offer_create()` is a client entry
-- point keyed on auth.uid(), and offers.state/offers.revision move nowhere
-- except through apply_offer_transition() (0002's own words: "the only place
-- offers.state or offers.revision moves"). A raw insert from this file would
-- create a DRAFT row apply_offer_transition() never touched -- no ledger row,
-- no revision bump, invisible to offers_select_visible_for_caller (which only
-- shows OPEN/PARTIALLY_RESERVED to non-participants), and indistinguishable
-- from a client's abandoned draft.
--
-- So instantiation is built from the two pieces 0002 already provides, used
-- exactly as designed:
--
--   1. offer_create_for_member() (below) -- a new internal function, NOT a
--      redefinition of offer_create(). It is offer_create()'s body
--      (validation, insert, audit event, idempotency claim/complete) with one
--      change: the actor is an explicit parameter instead of auth.uid(),
--      because a scheduled sweep has no session and therefore no auth.uid().
--      offer_create() itself (0002) is left completely untouched -- not
--      re-created with `create or replace`, not wrapped, not wired to call
--      this function. Two reasons: (a) supabase/migrations/README.md's rule
--      for correcting an applied file is that a later ordinal may re-create a
--      function only to *fix a defect in it*, with the old signature carried
--      exactly (0003 corrects 0002 this way, D-30) -- offer_create() has no
--      defect, so there is nothing here to correct; (b)
--      tests/offer-state-machine.test.mjs deliberately scopes its "effective
--      definition" reasoning to the M3 migrations (0002, 0003) and asserts,
--      function-by-function, that every client-callable entry point takes its
--      actor from auth.uid() and never accepts a caller-supplied p_actor_id --
--      redefining offer_create() to delegate to a p_actor_id-taking internal
--      function would still satisfy that assertion technically (auth.uid() is
--      still read, just one hop up), but it would make a scheduler-only
--      capability reachable through the exact function name that test suite
--      exists to keep locked to session identity. Two near-identical function
--      bodies is the accepted cost, stated as a tradeoff rather than left
--      implicit -- the alternative silently touches a frozen, applied file's
--      effective behaviour for a capability nothing but this file needs.
--   2. apply_offer_transition() (0002) -- the choke point itself, called
--      directly (as offer_expire_sweep() already does for its actor-less
--      EXPIRED sweep) to move the freshly created offer DRAFT -> OPEN. This is
--      the same function every client entry point calls, so the revision
--      check, the offer_transitions ledger row and the record_audit_event()
--      call happen exactly as they would for a human-published offer -- nothing
--      about the state machine is bypassed, only the HTTP/session layer in
--      front of it (which a cron job has no use for) is absent.
--
-- Idempotency is therefore two layers deep, exactly matching 0019's own
-- "guarded twice" framing:
--   * offer_create_for_member() claims a *deterministic* idempotency key,
--     'recurring:<template_id>:<occurrence_date>', through the same
--     claim_offer_operation()/complete_offer_operation() pair (0002) every
--     client call uses -- a replayed sweep for a day already generated returns
--     the first call's offer id rather than creating a second one.
--   * offers_recurring_occurrence_idx (0019), a real unique index on
--     (recurring_template_id, occurrence_date), is the hard backstop if two
--     sweep runs ever raced past the application-level existence check below.
-- Audit is therefore also two-layered: apply_offer_transition()'s own
-- 'offer.open' event (entity_type 'offer') plus this file's own
-- 'recurring_offer.instantiated' event (entity_type 'recurring_offer_template'),
-- so the trail is walkable from either side.
--
-- cancel_recurring_offer() and skip_recurring_offer_occurrence() cascade-cancel
-- already-generated offers the same way: through apply_offer_transition(), never
-- a raw `update offers set state = ...`. Neither calls offer_cancel() (0002)
-- directly, because offer_cancel() authorizes only the offer's own poster or a
-- live participant, and a moderator cancelling someone else's series is
-- neither -- so this file does its own owner-or-moderator authorization (same
-- shape as every other Option B slice's write functions) and then reaches
-- apply_offer_transition() directly, exactly as offer_cancel() itself does
-- internally.
--
-- WHAT IS DELIBERATELY NOT HERE: THE SCHEDULE
-- -----------------------------------------------------------------------------
-- Same reasoning as 0008/0015/0017's own headers, restated because it is
-- this file's own precedent too: a migration carrying `cron.schedule` would
-- fail on any branch without pg_cron and would schedule production's sweep
-- onto every preview branch that ever runs this sequence. This file ships only
-- instantiate_recurring_offers() -- the sweep function -- not a trailing
-- `select cron.schedule(...)` call. Scheduling it (every 15 minutes is
-- Sluglines-AI's own choice and a reasonable one: cheap idempotent no-op once
-- a day's offer exists, and a template created or resumed mid-morning still
-- gets today's occurrence promptly) is a supabase/operations/ concern for
-- whichever session is authorised to apply this migration, not this one.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- offer_create_for_member -- offer_create()'s (0002) body, with the actor as an
-- explicit parameter instead of auth.uid(). See the file header for why this is
-- a new function rather than a redefinition of offer_create() itself.
--
-- Internal: revoked from PUBLIC below and never granted to any client role.
-- A client-callable version of this would let any authenticated caller post an
-- offer as an arbitrary member -- exactly the impersonation hole
-- offer_create()'s own auth.uid()-only design exists to close.
-- -----------------------------------------------------------------------------
create or replace function public.offer_create_for_member(
  p_actor_id                uuid,
  p_poster_role             text,
  p_origin_location_id      uuid,
  p_destination_location_id uuid,
  p_window_start            timestamptz,
  p_window_end              timestamptz,
  p_seats_total             integer,
  p_idempotency_key         text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_offer_id uuid := gen_random_uuid();
  v_replay   jsonb;
begin
  if p_actor_id is null then
    raise exception 'actor is required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(p_actor_id, 'offer_create', null, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'offer_id')::uuid;
  end if;

  if p_poster_role not in ('driver', 'rider') then
    raise exception 'poster_role must be driver or rider' using errcode = '22023';
  end if;

  if p_origin_location_id is null or p_destination_location_id is null then
    raise exception 'origin and destination are required' using errcode = '22023';
  end if;

  if p_origin_location_id = p_destination_location_id then
    raise exception 'origin and destination must differ' using errcode = '22023';
  end if;

  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'window_end must be after window_start' using errcode = '22023';
  end if;

  if p_seats_total is null or p_seats_total < 1 or p_seats_total > 6 then
    raise exception 'seats_total must be between 1 and 6' using errcode = '22023';
  end if;

  insert into public.offers (
    id, poster_id, poster_role, origin_location_id, destination_location_id,
    window_start, window_end, seats_total
  )
  values (
    v_offer_id, p_actor_id, p_poster_role, p_origin_location_id, p_destination_location_id,
    p_window_start, p_window_end, p_seats_total
  );

  perform public.record_audit_event(p_actor_id, 'offer.created', 'offer', v_offer_id,
    jsonb_build_object('poster_role', p_poster_role, 'seats_total', p_seats_total));

  perform public.complete_offer_operation(p_actor_id, p_idempotency_key, v_offer_id, 1);

  return v_offer_id;
end;
$fn$;

revoke all on function public.offer_create_for_member(uuid, text, uuid, uuid, timestamptz, timestamptz, integer, text) from public;


-- -----------------------------------------------------------------------------
-- instantiate_recurring_offers -- the sweep. Turns every ACTIVE template whose
-- schedule matches today (in the template's own timezone) into a concrete OPEN
-- offer, unless today is skipped or already generated. Run by pg_cron (see the
-- file header); must work correctly with zero connected clients, same as
-- offer_expire_sweep() (0002) and expire_stale_incidents() (0015).
--
-- Internal: never granted to any client role, same as offer_expire_sweep().
-- -----------------------------------------------------------------------------
create or replace function public.instantiate_recurring_offers()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_tpl            record;
  v_today          date;
  v_dow            integer;
  v_window_start   timestamptz;
  v_window_end     timestamptz;
  v_offer_id       uuid;
  v_offer_state    text;
  v_offer_revision integer;
  v_idem_key       text;
  v_count          integer := 0;
begin
  for v_tpl in
    select *
      from public.recurring_offer_templates
     where state = 'ACTIVE'
     order by id
       for update
  loop
    v_today := (now() at time zone v_tpl.timezone)::date;
    v_dow   := extract(dow from v_today)::integer;

    if v_tpl.starts_on > v_today then
      continue;
    end if;

    if v_tpl.ends_on is not null and v_tpl.ends_on < v_today then
      continue;
    end if;

    if not (v_dow = any(v_tpl.days_of_week)) then
      continue;
    end if;

    if exists (
      select 1 from public.recurring_offer_skips
       where template_id = v_tpl.id and occurrence_date = v_today
    ) then
      continue;
    end if;

    if exists (
      select 1 from public.offers
       where recurring_template_id = v_tpl.id and occurrence_date = v_today
    ) then
      continue;
    end if;

    -- Interpreting the naive (date + local time) as a wall-clock moment in the
    -- template's timezone, converting to the timestamptz offer_create_for_member()
    -- expects.
    v_window_start := (v_today + v_tpl.window_start_local) at time zone v_tpl.timezone;
    v_window_end   := (v_today + v_tpl.window_end_local) at time zone v_tpl.timezone;

    -- A day whose window has already fully passed (the sweep catching up late
    -- after downtime, or a template resumed mid-afternoon) would create an
    -- offer no rider could ever reserve. Skip today; tomorrow's occurrence, if
    -- days_of_week includes it, is unaffected.
    if v_window_end <= now() then
      continue;
    end if;

    v_idem_key := 'recurring:' || v_tpl.id::text || ':' || v_today::text;

    v_offer_id := public.offer_create_for_member(
      v_tpl.member_id, v_tpl.poster_role, v_tpl.origin_location_id, v_tpl.destination_location_id,
      v_window_start, v_window_end, v_tpl.seats_total, v_idem_key
    );

    select state, revision into v_offer_state, v_offer_revision
      from public.offers
     where id = v_offer_id
       for update;

    -- offer_create_for_member() is keyed on (template, occurrence date): a
    -- replayed key returns the same offer id it created the first time. If
    -- that first run already tagged and opened it, the existence check above
    -- would ordinarily already have skipped this template today -- this state
    -- check is the cheap second backstop, and it means a replay never reaches
    -- apply_offer_transition() with a stale expected revision.
    if v_offer_state <> 'DRAFT' then
      continue;
    end if;

    update public.offers
       set recurring_template_id = v_tpl.id,
           occurrence_date       = v_today
     where id = v_offer_id;

    perform public.apply_offer_transition(
      v_offer_id, 'OPEN', v_offer_revision, v_tpl.member_id,
      'instantiate_recurring_offers', v_idem_key, 0, 0
    );

    perform public.record_audit_event(
      v_tpl.member_id, 'recurring_offer.instantiated', 'recurring_offer_template', v_tpl.id,
      jsonb_build_object('offer_id', v_offer_id, 'occurrence_date', v_today)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.instantiate_recurring_offers() from public;


-- -----------------------------------------------------------------------------
-- create_recurring_offer -- the caller's own template.
-- -----------------------------------------------------------------------------
create or replace function public.create_recurring_offer(
  p_poster_role             text,
  p_origin_location_id      uuid,
  p_destination_location_id uuid,
  p_days_of_week            integer[],
  p_window_start_local      time,
  p_window_end_local        time,
  p_seats_total             integer,
  p_timezone                text default 'America/New_York',
  p_starts_on               date default current_date,
  p_ends_on                 date default null
)
returns public.recurring_offer_templates
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_template public.recurring_offer_templates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_poster_role not in ('driver', 'rider') then
    raise exception 'poster_role must be driver or rider' using errcode = '22023';
  end if;

  if p_origin_location_id is null or p_destination_location_id is null then
    raise exception 'origin and destination are required' using errcode = '22023';
  end if;

  if p_origin_location_id = p_destination_location_id then
    raise exception 'origin and destination must differ' using errcode = '22023';
  end if;

  if p_days_of_week is null or p_days_of_week = '{}'::integer[]
     or not (p_days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]) then
    raise exception 'days_of_week must be a non-empty subset of 0 (Sunday) to 6 (Saturday)' using errcode = '22023';
  end if;

  if p_window_start_local is null or p_window_end_local is null or p_window_end_local <= p_window_start_local then
    raise exception 'window_end_local must be after window_start_local' using errcode = '22023';
  end if;

  if p_seats_total is null or p_seats_total < 1 or p_seats_total > 6 then
    raise exception 'seats_total must be between 1 and 6' using errcode = '22023';
  end if;

  if p_ends_on is not null and p_ends_on < coalesce(p_starts_on, current_date) then
    raise exception 'ends_on must not be before starts_on' using errcode = '22023';
  end if;

  insert into public.recurring_offer_templates (
    member_id, poster_role, origin_location_id, destination_location_id,
    days_of_week, window_start_local, window_end_local, timezone,
    seats_total, starts_on, ends_on
  )
  values (
    v_actor, p_poster_role, p_origin_location_id, p_destination_location_id,
    p_days_of_week, p_window_start_local, p_window_end_local, coalesce(p_timezone, 'America/New_York'),
    p_seats_total, coalesce(p_starts_on, current_date), p_ends_on
  )
  returning * into v_template;

  perform public.record_audit_event(v_actor, 'recurring_offer.created', 'recurring_offer_template', v_template.id,
    jsonb_build_object('poster_role', p_poster_role, 'days_of_week', p_days_of_week));

  return v_template;
end;
$fn$;

revoke all on function public.create_recurring_offer(text, uuid, uuid, integer[], time, time, integer, text, date, date) from public;
grant execute on function public.create_recurring_offer(text, uuid, uuid, integer[], time, time, integer, text, date, date) to authenticated;


-- -----------------------------------------------------------------------------
-- pause_recurring_offer -- owner or moderator: no future occurrences are
-- generated, but offers already instantiated are untouched (pausing a series
-- doesn't retroactively cancel today's ride). Idempotent: pausing an
-- already-PAUSED template is a no-op, matching offer_release_seat's replay
-- style of "nothing left to do" rather than an error.
-- -----------------------------------------------------------------------------
create or replace function public.pause_recurring_offer(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_tpl   public.recurring_offer_templates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_tpl from public.recurring_offer_templates where id = p_template_id for update;

  if not found then
    raise exception 'recurring offer % not found', p_template_id using errcode = 'P0002';
  end if;

  if v_tpl.member_id <> v_actor and not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_tpl.state = 'CANCELLED' then
    raise exception 'cannot pause a cancelled series' using errcode = '55000';
  end if;

  if v_tpl.state = 'PAUSED' then
    return;
  end if;

  update public.recurring_offer_templates
     set state = 'PAUSED', revision = revision + 1, updated_at = now()
   where id = p_template_id;

  perform public.record_audit_event(v_actor, 'recurring_offer.paused', 'recurring_offer_template', p_template_id);
end;
$fn$;

revoke all on function public.pause_recurring_offer(uuid) from public;
grant execute on function public.pause_recurring_offer(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- resume_recurring_offer -- owner or moderator. Idempotent, same shape as
-- pause_recurring_offer.
-- -----------------------------------------------------------------------------
create or replace function public.resume_recurring_offer(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_tpl   public.recurring_offer_templates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_tpl from public.recurring_offer_templates where id = p_template_id for update;

  if not found then
    raise exception 'recurring offer % not found', p_template_id using errcode = 'P0002';
  end if;

  if v_tpl.member_id <> v_actor and not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_tpl.state = 'CANCELLED' then
    raise exception 'cannot resume a cancelled series' using errcode = '55000';
  end if;

  if v_tpl.state = 'ACTIVE' then
    return;
  end if;

  update public.recurring_offer_templates
     set state = 'ACTIVE', revision = revision + 1, updated_at = now()
   where id = p_template_id;

  perform public.record_audit_event(v_actor, 'recurring_offer.resumed', 'recurring_offer_template', p_template_id);
end;
$fn$;

revoke all on function public.resume_recurring_offer(uuid) from public;
grant execute on function public.resume_recurring_offer(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- cancel_recurring_offer -- owner or moderator: cancels the whole series and
-- cascades to every offer this template has already generated that is still in
-- a live, cancellable state. See the file header for why this reaches
-- apply_offer_transition() directly rather than calling offer_cancel() (0002).
-- Idempotent: cancelling an already-CANCELLED template is a no-op.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_recurring_offer(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_tpl      public.recurring_offer_templates%rowtype;
  v_offer    record;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_tpl from public.recurring_offer_templates where id = p_template_id for update;

  if not found then
    raise exception 'recurring offer % not found', p_template_id using errcode = 'P0002';
  end if;

  if v_tpl.member_id <> v_actor and not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_tpl.state = 'CANCELLED' then
    return;
  end if;

  update public.recurring_offer_templates
     set state = 'CANCELLED', revision = revision + 1, updated_at = now()
   where id = p_template_id;

  for v_offer in
    select id, revision
      from public.offers
     where recurring_template_id = p_template_id
       and state in ('OPEN', 'PARTIALLY_RESERVED', 'RESERVED')
     order by id
       for update
  loop
    v_revision := public.apply_offer_transition(
      v_offer.id, 'CANCELLED', v_offer.revision, v_actor, 'cancel_recurring_offer', null, 0, 0
    );

    update public.reservations
       set state = 'CANCELLED', revision = revision + 1, updated_at = now()
     where offer_id = v_offer.id
       and state in ('ACTIVE', 'CONFIRMED');
  end loop;

  perform public.record_audit_event(v_actor, 'recurring_offer.cancelled', 'recurring_offer_template', p_template_id);
end;
$fn$;

revoke all on function public.cancel_recurring_offer(uuid) from public;
grant execute on function public.cancel_recurring_offer(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- skip_recurring_offer_occurrence -- owner or moderator: records the skip
-- (idempotent via the unique index / on-conflict-do-nothing) and, if that
-- date's offer was already instantiated and is still cancellable, cancels it
-- through apply_offer_transition() the same way cancel_recurring_offer() does.
-- -----------------------------------------------------------------------------
create or replace function public.skip_recurring_offer_occurrence(
  p_template_id      uuid,
  p_occurrence_date  date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor          uuid := auth.uid();
  v_tpl            public.recurring_offer_templates%rowtype;
  v_offer_id       uuid;
  v_offer_revision integer;
  v_revision       integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_occurrence_date is null then
    raise exception 'occurrence_date is required' using errcode = '22023';
  end if;

  select * into v_tpl from public.recurring_offer_templates where id = p_template_id for update;

  if not found then
    raise exception 'recurring offer % not found', p_template_id using errcode = 'P0002';
  end if;

  if v_tpl.member_id <> v_actor and not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.recurring_offer_skips (template_id, occurrence_date)
  values (p_template_id, p_occurrence_date)
  on conflict (template_id, occurrence_date) do nothing;

  select id, revision into v_offer_id, v_offer_revision
    from public.offers
   where recurring_template_id = p_template_id
     and occurrence_date = p_occurrence_date
     and state in ('OPEN', 'PARTIALLY_RESERVED', 'RESERVED')
     for update;

  if found then
    v_revision := public.apply_offer_transition(
      v_offer_id, 'CANCELLED', v_offer_revision, v_actor, 'skip_recurring_offer_occurrence', null, 0, 0
    );

    update public.reservations
       set state = 'CANCELLED', revision = revision + 1, updated_at = now()
     where offer_id = v_offer_id
       and state in ('ACTIVE', 'CONFIRMED');
  end if;

  perform public.record_audit_event(
    v_actor, 'recurring_offer.occurrence_skipped', 'recurring_offer_template', p_template_id,
    jsonb_build_object('occurrence_date', p_occurrence_date, 'cancelled_offer_id', v_offer_id)
  );
end;
$fn$;

revoke all on function public.skip_recurring_offer_occurrence(uuid, date) from public;
grant execute on function public.skip_recurring_offer_occurrence(uuid, date) to authenticated;

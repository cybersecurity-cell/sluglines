-- =============================================================================
-- 0030_recurring_timezone_guard.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp),
--          applied 2026-09-06 through the Supabase MCP connector's apply_migration, one
--          file per apply, as the rehearsal for the production apply. Production has
--          NOT run this file. See Docs/DECISIONS.md D-96 and supabase/migrations/README.md.
--
-- Issue #139, `Docs/DECISIONS.md` D-89. Two signature-preserving re-creations
-- over `0020` (the `0003` pattern; `0020` is not edited):
--
--   1. `create_recurring_offer(...)` validates `p_timezone` against
--      `pg_timezone_names` and refuses an unknown name with `22023`. `0020`
--      accepted any text, and the function is granted to `authenticated`, so
--      any member with a JWT could store `timezone = 'garbage'` over PostgREST
--      even though no route exposes it.
--   2. `instantiate_recurring_offers()` runs each template in its own
--      sub-block. `0020` evaluated `now() at time zone v_tpl.timezone` in a
--      loop with no exception handler, so ONE bad template raised `22023` and
--      aborted instantiation for EVERY template -- a single member's typo (or
--      one deliberate call) silenced every recurring driver on the board. Now a
--      template's failure rolls back that template's work only, the loop
--      moves on, and the failure is recorded as an audit event
--      (`recurring_offer.instantiate_failed`, with the SQLSTATE and message)
--      against the template rather than dropped -- `promote_waitlist_sweep()`
--      (`0022`) swallows its per-offer failures with `null`; this one leaves a
--      trail, because a template that fails every morning is something a
--      moderator should be able to see.
--
-- Templates already stored with a bad timezone (none are known; the function
-- has no callers in this repo) are not repaired here: after this file the
-- sweep skips them, records the failure, and instantiates everyone else's.
--
-- WHAT IS UNCHANGED
-- -----------------------------------------------------------------------------
-- Every other check `create_recurring_offer` made, in order; the insert; the
-- audit event; the return. Every step of the sweep -- date and day-of-week
-- resolution, skips, the existing-occurrence check, the passed-window check,
-- `offer_create_for_member()` on the deterministic key, the DRAFT backstop,
-- the tag, the hop through `apply_offer_transition()`, the audit event -- is
-- byte-for-byte `0020`'s, one indentation level deeper.
--
-- ==> APPLIED: preview (phase-3-4-staging, 2026-09-06, D-96). Writing this
--     file was the job of the change that added it; the production apply is a
--     separate, explicitly authorised act still pending (README, "Applying a
--     migration").
-- =============================================================================

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

  -- Issue #139: the timezone is evaluated inside instantiate_recurring_offers()
  -- on every sweep, for every template. A name Postgres does not know would
  -- raise there, not here, and abort the sweep for everyone. Checked against
  -- the server's own catalogue of names, exactly as `at time zone` resolves it.
  if not exists (select 1 from pg_timezone_names where name = coalesce(p_timezone, 'America/New_York')) then
    raise exception 'timezone must be a name from pg_timezone_names, got %', p_timezone using errcode = '22023';
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
revoke all on function public.create_recurring_offer(text, uuid, uuid, integer[], time, time, integer, text, date, date) from anon;
grant execute on function public.create_recurring_offer(text, uuid, uuid, integer[], time, time, integer, text, date, date) to authenticated;


-- -----------------------------------------------------------------------------
-- instantiate_recurring_offers -- the sweep, per-template isolated.
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
    -- Issue #139: one template's failure is that template's, not the sweep's.
    -- Everything below runs in a sub-block; a bad timezone, a location row
    -- gone, a bound offer_create_for_member() refuses -- any of them -- rolls
    -- back this template's work and the loop moves on, the same shape
    -- promote_waitlist_sweep() (0022) uses. The failure is not swallowed
    -- silently: it is recorded as an audit event against the template.
    begin
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
    exception when others then
      perform public.record_audit_event(
        v_tpl.member_id, 'recurring_offer.instantiate_failed', 'recurring_offer_template', v_tpl.id,
        jsonb_build_object('sqlstate', SQLSTATE, 'message', SQLERRM)
      );
    end;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.instantiate_recurring_offers() from public;
revoke all on function public.instantiate_recurring_offers() from anon, authenticated;

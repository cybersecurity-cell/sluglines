-- =============================================================================
-- 0015_incidents_functions.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- The write path for 0014's incidents/incident_confirmations tables. Every
-- transition is a SECURITY DEFINER function: server-side, atomic, re-checks
-- ownership/moderator status internally, never trusts a client-supplied state
-- or expires_at.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0019_incident_reports_functions.sql
-- -----------------------------------------------------------------------------
-- Same adaptations as 0014's header: is_moderator() -> caller_is_moderator(),
-- log_audit_event() -> record_audit_event() (0001), and location comes from
-- members.location_id rather than a corridor_id.
--
-- WHAT IS DELIBERATELY NOT HERE: THE SCHEDULE
-- -----------------------------------------------------------------------------
-- Sluglines-AI's 0019 ends with `select cron.schedule('expire-stale-incidents',
-- ...)`. 0008's own header already states why that shape does not belong in
-- this directory: a migration carrying `cron.schedule` would fail on any branch
-- without pg_cron and would schedule production's sweep onto every preview
-- branch that ever runs this sequence. This file therefore ships only
-- expire_stale_incidents() -- the reader/sweep function -- exactly the split
-- 0001/sweep_expired_presence() and 0002/offer_expire_sweep() already use.
-- Scheduling it is a supabase/operations/ concern for whichever session is
-- authorised to apply this migration, not this one.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- incident_ttl_for_type -- TTL by type, chosen by how long each kind of
-- disruption realistically stays relevant to a commuter deciding whether to
-- leave now: police/accidents clear fastest, weather lingers longest.
--
-- Internal: not granted to any client role. report_incident() below is the
-- only caller, and a SECURITY DEFINER function's calls run as its owner, who
-- always has implicit privilege on functions it owns regardless of REVOKE.
-- -----------------------------------------------------------------------------
create or replace function public.incident_ttl_for_type(p_type public.incident_type)
returns interval
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case p_type
    when 'police'       then interval '2 hours'
    when 'accident'      then interval '3 hours'
    when 'other'         then interval '3 hours'
    when 'hov_closure'   then interval '4 hours'
    when 'road_closure'  then interval '6 hours'
    when 'weather'       then interval '8 hours'
  end;
$fn$;

revoke all on function public.incident_ttl_for_type(public.incident_type) from public;


-- -----------------------------------------------------------------------------
-- report_incident -- the caller's own report, at their own home spot.
-- -----------------------------------------------------------------------------
create or replace function public.report_incident(
  p_type        public.incident_type,
  p_description text
)
returns public.incidents
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor       uuid := auth.uid();
  v_location_id uuid;
  v_description text := btrim(coalesce(p_description, ''));
  v_incident    public.incidents%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(v_description) < 1 or char_length(v_description) > 500 then
    raise exception 'description must be 1 to 500 characters' using errcode = '22023';
  end if;

  select location_id into v_location_id from public.members where id = v_actor;

  if v_location_id is null then
    raise exception 'member has no home spot on file' using errcode = '42501';
  end if;

  insert into public.incidents (reporter_id, location_id, type, description, expires_at)
  values (v_actor, v_location_id, p_type, v_description, now() + public.incident_ttl_for_type(p_type))
  returning * into v_incident;

  perform public.record_audit_event(v_actor, 'incident.reported', 'incident', v_incident.id,
    jsonb_build_object('type', p_type));

  return v_incident;
end;
$fn$;

revoke all on function public.report_incident(public.incident_type, text) from public;
grant execute on function public.report_incident(public.incident_type, text) to authenticated;


-- -----------------------------------------------------------------------------
-- confirm_incident -- idempotent: a member re-confirming the same incident is a
-- no-op, not an error. Mirrors the presence check-in "still here" re-tap rather
-- than an idempotency-key replay, since there is no separate operation here to
-- replay against.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_incident(p_incident_id uuid)
returns public.incidents
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor                   uuid := auth.uid();
  v_incident                public.incidents%rowtype;
  v_confirmation_count      integer;
  v_confirmation_threshold  constant integer := 2;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_incident from public.incidents where id = p_incident_id for update;

  if not found then
    raise exception 'incident % not found', p_incident_id using errcode = 'P0002';
  end if;

  if v_incident.reporter_id = v_actor then
    raise exception 'reporter cannot confirm their own report' using errcode = '42501';
  end if;

  if v_incident.location_id <> (select location_id from public.members where id = v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_incident.state not in ('UNCONFIRMED', 'CONFIRMED') then
    raise exception 'incident cannot be confirmed from state=%', v_incident.state using errcode = '55000';
  end if;

  insert into public.incident_confirmations (incident_id, member_id)
  values (p_incident_id, v_actor)
  on conflict (incident_id, member_id) do nothing;

  select count(*) into v_confirmation_count
    from public.incident_confirmations
   where incident_id = p_incident_id;

  if v_incident.state = 'UNCONFIRMED' and v_confirmation_count >= v_confirmation_threshold then
    update public.incidents
       set state = 'CONFIRMED', revision = revision + 1, updated_at = now()
     where id = p_incident_id
    returning * into v_incident;
  end if;

  perform public.record_audit_event(v_actor, 'incident.confirmed', 'incident', p_incident_id);

  return v_incident;
end;
$fn$;

revoke all on function public.confirm_incident(uuid) from public;
grant execute on function public.confirm_incident(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- resolve_incident -- the reporter or a moderator: cleared.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_incident(p_incident_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_incident public.incidents%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_incident from public.incidents where id = p_incident_id for update;

  if not found then
    raise exception 'incident % not found', p_incident_id using errcode = 'P0002';
  end if;

  if v_incident.reporter_id <> v_actor and not public.caller_is_moderator() then
    raise exception 'only the reporter or a moderator may resolve this incident' using errcode = '42501';
  end if;

  if v_incident.state not in ('UNCONFIRMED', 'CONFIRMED') then
    raise exception 'incident cannot be resolved from state=%', v_incident.state using errcode = '55000';
  end if;

  update public.incidents
     set state       = 'RESOLVED',
         revision    = revision + 1,
         updated_at  = now(),
         resolved_at = now(),
         resolved_by = v_actor
   where id = p_incident_id;

  perform public.record_audit_event(v_actor, 'incident.resolved', 'incident', p_incident_id);
end;
$fn$;

revoke all on function public.resolve_incident(uuid) from public;
grant execute on function public.resolve_incident(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- cancel_incident -- the reporter retracts, or a moderator removes a false
-- report. Same shape as resolve_incident, kept a separate function (rather
-- than a p_reason flag) because the two are distinct audited actions.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_incident(p_incident_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_incident public.incidents%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_incident from public.incidents where id = p_incident_id for update;

  if not found then
    raise exception 'incident % not found', p_incident_id using errcode = 'P0002';
  end if;

  if v_incident.reporter_id <> v_actor and not public.caller_is_moderator() then
    raise exception 'only the reporter or a moderator may cancel this incident' using errcode = '42501';
  end if;

  if v_incident.state not in ('UNCONFIRMED', 'CONFIRMED') then
    raise exception 'incident cannot be cancelled from state=%', v_incident.state using errcode = '55000';
  end if;

  update public.incidents
     set state       = 'CANCELLED',
         revision    = revision + 1,
         updated_at  = now(),
         resolved_at = now(),
         resolved_by = v_actor
   where id = p_incident_id;

  perform public.record_audit_event(v_actor, 'incident.cancelled', 'incident', p_incident_id);
end;
$fn$;

revoke all on function public.cancel_incident(uuid) from public;
grant execute on function public.cancel_incident(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- expire_stale_incidents -- the sweep. Must work with zero connected clients;
-- see the file header for why its schedule lives outside this directory.
--
-- Every 5 minutes when scheduled, not every minute like the presence/offer
-- sweeps: incident TTLs are hours-scale, so minute-level precision buys
-- nothing. Internal: never granted to any client role.
-- -----------------------------------------------------------------------------
create or replace function public.expire_stale_incidents()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  with expired as (
    update public.incidents
       set state = 'EXPIRED', revision = revision + 1, updated_at = now()
     where state in ('UNCONFIRMED', 'CONFIRMED')
       and expires_at <= now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$fn$;

revoke all on function public.expire_stale_incidents() from public;

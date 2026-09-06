-- =============================================================================
-- 0029_no_show_report_guard.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp),
--          applied 2026-09-06 through the Supabase MCP connector's apply_migration, one
--          file per apply, as the rehearsal for the production apply. Production has
--          NOT run this file. See Docs/DECISIONS.md D-96 and supabase/migrations/README.md.
--
-- Issue #138, `Docs/DECISIONS.md` D-88. Three changes to how a no-show is
-- reported, all append-only over `0021`/`0022`:
--
--   1. `report_no_show(uuid)` is re-created (same signature, the `0003` pattern)
--      so a no-show can only be reported once the offer has reached ARRIVING
--      -- the driver is at the curb -- or PICKED_UP. `0022` accepted CONFIRMED,
--      which is before anyone could have failed to appear.
--   2. The same body caps reports at 5 per reporter per rolling day, raising
--      `PT429` (the D-30 PTnnn form; `transition-http.ts` maps it to
--      `limit_reached`). Not a rate limit on honest use -- a driver reports the
--      riders who did not come, once each -- but a ceiling on the harassment
--      lever the issue names.
--   3. A select policy lets the SUBJECT of a report read it. `0021` let only the
--      reporter and a moderator see the row, so the accused rider could neither
--      see nor contest it. rev. 5.3 sec.7's "politeness, not penalties" is only
--      true if the person being recorded can see the record.
--
-- THE ONE SEMANTIC CHANGE BEYOND THE GUARD, STATED
-- -----------------------------------------------------------------------------
-- `0022` cancelled the whole offer, through `apply_offer_transition()`, when
-- every rider no-showed while the offer was still CONFIRMED ("nothing left to
-- depart with"). With CONFIRMED no longer a reportable state that branch could
-- never fire, so it moves one state later: when every confirmed rider has
-- no-showed while the offer is ARRIVING -- the driver is at the curb and nobody
-- came -- the offer is cancelled through the same choke point
-- (ARRIVING -> CANCELLED is a legal edge; PICKED_UP -> CANCELLED is not, and a
-- PICKED_UP offer has at least one rider aboard). The mutation is the same one,
-- made the same way, at the first moment it can now be true.
--
-- WHAT IS UNCHANGED
-- -----------------------------------------------------------------------------
-- Poster-only. The reservation must be CONFIRMED. The reservation is set to
-- CANCELLED, the report row is inserted, the audit event is recorded, the
-- waitlist is never promoted (`0022`'s header says why), and `offers.state` is
-- never written directly. `0021` and `0022` are not edited.
--
-- ==> APPLIED: preview (phase-3-4-staging, 2026-09-06, D-96). Writing this
--     file was the job of the change that added it; the production apply is a
--     separate, explicitly authorised act still pending (README, "Applying a
--     migration").
-- =============================================================================

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
  v_reports_today integer;
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

  -- Issue #138: nobody can have failed to appear before the driver has
  -- arrived. CONFIRMED is no longer enough.
  if v_offer.state not in ('ARRIVING', 'PICKED_UP') then
    raise exception 'no-show can only be reported once the driver is arriving or has picked up, state=%', v_offer.state
      using errcode = '55000';
  end if;

  if v_reservation.state <> 'CONFIRMED' then
    raise exception 'reservation is not confirmed, state=%', v_reservation.state using errcode = '55000';
  end if;

  -- Issue #138: a ceiling per reporter per rolling day. Honest use is one
  -- report per rider who did not come; five a day is well above that.
  select count(*)
    into v_reports_today
    from public.no_show_reports r
   where r.reported_by = v_actor
     and r.created_at > now() - interval '1 day';

  if v_reports_today >= 5 then
    raise exception 'too many no-show reports today (limit 5)' using errcode = 'PT429';
  end if;

  update public.reservations
     set state = 'CANCELLED', revision = revision + 1, updated_at = now()
   where id = p_reservation_id;

  insert into public.no_show_reports (offer_id, reservation_id, rider_id, reported_by)
  values (v_offer.id, p_reservation_id, v_reservation.rider_id, v_actor);

  select count(*) into v_live_count
    from public.reservations
   where offer_id = v_offer.id and state = 'CONFIRMED';

  if v_offer.state = 'ARRIVING' and v_live_count = 0 then
    -- Every rider no-showed with the driver at the curb: nothing left to pick
    -- up. Through the choke point, on the legal ARRIVING -> CANCELLED edge.
    -- PICKED_UP means at least one other rider is aboard, so the offer stays.
    perform public.apply_offer_transition(
      v_offer.id, 'CANCELLED', v_offer.revision, v_actor, 'report_no_show', null, 0, 0
    );
  end if;

  perform public.record_audit_event(v_actor, 'no_show.reported', 'offer', v_offer.id,
    jsonb_build_object('reservation_id', p_reservation_id, 'rider_id', v_reservation.rider_id));
end;
$fn$;

revoke all on function public.report_no_show(uuid) from public;
revoke all on function public.report_no_show(uuid) from anon;
grant execute on function public.report_no_show(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The subject can read reports about them. Select only; the table still has no
-- write policy for any role, and report_no_show() remains the only writer.
-- -----------------------------------------------------------------------------
drop policy if exists no_show_reports_select_subject on public.no_show_reports;

create policy no_show_reports_select_subject
  on public.no_show_reports
  for select
  to authenticated
  using (rider_id = auth.uid());

-- The per-reporter cap's predicate.
create index if not exists idx_no_show_reports_reporter
  on public.no_show_reports (reported_by, created_at desc);

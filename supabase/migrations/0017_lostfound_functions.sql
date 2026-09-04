-- =============================================================================
-- 0017_lostfound_functions.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- The write path for 0016's lostfound_items/lostfound_claims/lostfound_messages
-- tables. Every transition is a SECURITY DEFINER function: server-side, atomic,
-- re-checks ownership/moderator status internally, never trusts a client-
-- supplied state or expires_at.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0021_lostfound_functions.sql
-- -----------------------------------------------------------------------------
-- Same adaptations as 0016's header, plus:
--
--   * is_moderator() -> caller_is_moderator() (0002).
--   * log_audit_event() -> record_audit_event() (0001).
--   * report_lostfound_item() and send_lostfound_message() are new relative to
--     Sluglines-AI's 0021 -- that file left item-reporting and message-sending
--     to plain RLS insert policies on lostfound_items/lostfound_messages. Both
--     policies would fail this repo's R4 (0016's header explains why), so this
--     file covers the two writes 0021 didn't need a function for, in addition
--     to the four (create_lostfound_claim, respond_to_lostfound_claim,
--     withdraw_lostfound_claim, reunite_lostfound_item) and the one
--     (cancel_lostfound_item) that were already functions there.
--   * every notification_outbox insert from Sluglines-AI's 0021 is dropped:
--     that table does not exist anywhere in this repo's migrations, and no
--     notification/push infrastructure has been transplanted yet. Adding one
--     to satisfy a write nothing here reads would be exactly the "schema no
--     task asked for" 0016's header already declines for `stops`.
--
-- WHAT IS DELIBERATELY NOT HERE: THE SCHEDULE
-- -----------------------------------------------------------------------------
-- Same reasoning as 0015's header (restated, not just referenced, since that is
-- this file's own precedent): a migration carrying `cron.schedule` would fail
-- on any branch without pg_cron and would schedule production's sweep onto
-- every preview branch that ever runs this sequence (0008's own header). This
-- file therefore ships only expire_stale_lostfound_items() -- the sweep
-- function -- not Sluglines-AI's trailing `select cron.schedule(...)` call.
-- Scheduling it (hourly, per the source's own comment -- 30-day item TTLs need
-- nothing finer) is a supabase/operations/ concern for whichever session is
-- authorised to apply this migration, not this one.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- report_lostfound_item -- the caller's own report, at their own home spot.
-- -----------------------------------------------------------------------------
create or replace function public.report_lostfound_item(
  p_kind        public.lostfound_kind,
  p_category    public.lostfound_category,
  p_description text,
  p_ride_date   date
)
returns public.lostfound_items
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor       uuid := auth.uid();
  v_location_id uuid;
  v_description text := btrim(coalesce(p_description, ''));
  v_item        public.lostfound_items%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(v_description) < 1 or char_length(v_description) > 500 then
    raise exception 'description must be 1 to 500 characters' using errcode = '22023';
  end if;

  if p_ride_date is null then
    raise exception 'ride_date is required' using errcode = '22023';
  end if;

  select location_id into v_location_id from public.members where id = v_actor;

  if v_location_id is null then
    raise exception 'member has no home spot on file' using errcode = '42501';
  end if;

  insert into public.lostfound_items (reporter_id, location_id, kind, category, description, ride_date)
  values (v_actor, v_location_id, p_kind, p_category, v_description, p_ride_date)
  returning * into v_item;

  perform public.record_audit_event(v_actor, 'lostfound.reported', 'lostfound_item', v_item.id,
    jsonb_build_object('kind', p_kind, 'category', p_category));

  return v_item;
end;
$fn$;

revoke all on function public.report_lostfound_item(public.lostfound_kind, public.lostfound_category, text, date) from public;
grant execute on function public.report_lostfound_item(public.lostfound_kind, public.lostfound_category, text, date) to authenticated;


-- -----------------------------------------------------------------------------
-- create_lostfound_claim -- the claimant may optionally include an opening
-- message in the same call. An item can accumulate multiple PENDING claims
-- while MATCHED (see 0016's item-state comment) -- filing a second claim from
-- a different member doesn't reject the first.
-- -----------------------------------------------------------------------------
create or replace function public.create_lostfound_claim(
  p_item_id  uuid,
  p_message  text default null
)
returns public.lostfound_claims
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_caller uuid := auth.uid();
  v_item   public.lostfound_items%rowtype;
  v_claim  public.lostfound_claims%rowtype;
  v_body   text := btrim(coalesce(p_message, ''));
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_item from public.lostfound_items where id = p_item_id for update;

  if not found then
    raise exception 'item % not found', p_item_id using errcode = 'P0002';
  end if;

  if v_item.reporter_id = v_caller then
    raise exception 'cannot claim your own report' using errcode = '42501';
  end if;

  if v_item.location_id <> (select location_id from public.members where id = v_caller) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_item.state not in ('REPORTED', 'MATCHED') then
    raise exception 'item cannot be claimed from state=%', v_item.state using errcode = '55000';
  end if;

  insert into public.lostfound_claims (item_id, claimant_id)
  values (p_item_id, v_caller)
  returning * into v_claim;

  if v_item.state = 'REPORTED' then
    update public.lostfound_items
       set state = 'MATCHED', revision = revision + 1, updated_at = now()
     where id = p_item_id;
  end if;

  if char_length(v_body) > 0 then
    insert into public.lostfound_messages (claim_id, sender_id, body)
    values (v_claim.id, v_caller, v_body);
  end if;

  perform public.record_audit_event(v_caller, 'lostfound.claim_created', 'lostfound_item', p_item_id,
    jsonb_build_object('claim_id', v_claim.id));

  return v_claim;
end;
$fn$;

revoke all on function public.create_lostfound_claim(uuid, text) from public;
grant execute on function public.create_lostfound_claim(uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- respond_to_lostfound_claim -- reporter (or a moderator) only: accepting one
-- claim auto-rejects every other still-PENDING claim on the same item (a found
-- umbrella can only go home with one person).
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_lostfound_claim(
  p_claim_id  uuid,
  p_accept    boolean
)
returns public.lostfound_claims
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_caller                 uuid := auth.uid();
  v_claim                  public.lostfound_claims%rowtype;
  v_item                   public.lostfound_items%rowtype;
  v_remaining_live_claims  integer;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_claim from public.lostfound_claims where id = p_claim_id for update;

  if not found then
    raise exception 'claim % not found', p_claim_id using errcode = 'P0002';
  end if;

  select * into v_item from public.lostfound_items where id = v_claim.item_id for update;

  if v_item.reporter_id <> v_caller and not public.caller_is_moderator() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_claim.state <> 'PENDING' then
    raise exception 'claim cannot be responded to from state=%', v_claim.state using errcode = '55000';
  end if;

  if p_accept then
    update public.lostfound_claims
       set state = 'ACCEPTED', revision = revision + 1, updated_at = now(), resolved_at = now()
     where id = p_claim_id
    returning * into v_claim;

    update public.lostfound_claims
       set state = 'REJECTED', revision = revision + 1, updated_at = now(), resolved_at = now()
     where item_id = v_item.id and id <> p_claim_id and state = 'PENDING';

    update public.lostfound_items
       set state = 'CLAIMED', revision = revision + 1, updated_at = now()
     where id = v_item.id;
  else
    update public.lostfound_claims
       set state = 'REJECTED', revision = revision + 1, updated_at = now(), resolved_at = now()
     where id = p_claim_id
    returning * into v_claim;

    select count(*) into v_remaining_live_claims
      from public.lostfound_claims
     where item_id = v_item.id and state in ('PENDING', 'ACCEPTED');

    if v_item.state = 'MATCHED' and v_remaining_live_claims = 0 then
      update public.lostfound_items
         set state = 'REPORTED', revision = revision + 1, updated_at = now()
       where id = v_item.id;
    end if;
  end if;

  perform public.record_audit_event(v_caller, 'lostfound.claim_responded', 'lostfound_item', v_item.id,
    jsonb_build_object('claim_id', p_claim_id, 'accepted', p_accept));

  return v_claim;
end;
$fn$;

revoke all on function public.respond_to_lostfound_claim(uuid, boolean) from public;
grant execute on function public.respond_to_lostfound_claim(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- withdraw_lostfound_claim -- claimant-only: withdraw a still-PENDING claim.
-- -----------------------------------------------------------------------------
create or replace function public.withdraw_lostfound_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_caller                 uuid := auth.uid();
  v_claim                  public.lostfound_claims%rowtype;
  v_item                   public.lostfound_items%rowtype;
  v_remaining_live_claims  integer;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_claim from public.lostfound_claims where id = p_claim_id for update;

  if not found or v_claim.claimant_id <> v_caller then
    raise exception 'claim not found for caller' using errcode = 'P0002';
  end if;

  if v_claim.state <> 'PENDING' then
    raise exception 'claim cannot be withdrawn from state=%', v_claim.state using errcode = '55000';
  end if;

  select * into v_item from public.lostfound_items where id = v_claim.item_id for update;

  update public.lostfound_claims
     set state = 'WITHDRAWN', revision = revision + 1, updated_at = now(), resolved_at = now()
   where id = p_claim_id;

  select count(*) into v_remaining_live_claims
    from public.lostfound_claims
   where item_id = v_item.id and state in ('PENDING', 'ACCEPTED');

  if v_item.state = 'MATCHED' and v_remaining_live_claims = 0 then
    update public.lostfound_items
       set state = 'REPORTED', revision = revision + 1, updated_at = now()
     where id = v_item.id;
  end if;

  perform public.record_audit_event(v_caller, 'lostfound.claim_withdrawn', 'lostfound_item', v_item.id,
    jsonb_build_object('claim_id', p_claim_id));
end;
$fn$;

revoke all on function public.withdraw_lostfound_claim(uuid) from public;
grant execute on function public.withdraw_lostfound_claim(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- send_lostfound_message -- either participant on a claim (the claimant, or
-- the item's reporter) may post to the thread. See 0016's header for why this
-- is a function rather than Sluglines-AI's direct insert policy.
-- -----------------------------------------------------------------------------
create or replace function public.send_lostfound_message(
  p_claim_id  uuid,
  p_body      text
)
returns public.lostfound_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_caller  uuid := auth.uid();
  v_body    text := btrim(coalesce(p_body, ''));
  v_message public.lostfound_messages%rowtype;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'message body must be 1 to 1000 characters' using errcode = '22023';
  end if;

  if not public.lostfound_is_claim_participant(p_claim_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.lostfound_messages (claim_id, sender_id, body)
  values (p_claim_id, v_caller, v_body)
  returning * into v_message;

  perform public.record_audit_event(v_caller, 'lostfound.message_sent', 'lostfound_claim', p_claim_id);

  return v_message;
end;
$fn$;

revoke all on function public.send_lostfound_message(uuid, text) from public;
grant execute on function public.send_lostfound_message(uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- reunite_lostfound_item -- reporter (or a moderator) confirms the handoff
-- actually happened -- final state.
-- -----------------------------------------------------------------------------
create or replace function public.reunite_lostfound_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_caller uuid := auth.uid();
  v_item   public.lostfound_items%rowtype;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_item from public.lostfound_items where id = p_item_id for update;

  if not found then
    raise exception 'item % not found', p_item_id using errcode = 'P0002';
  end if;

  if v_item.reporter_id <> v_caller and not public.caller_is_moderator() then
    raise exception 'only the reporter or a moderator may reunite this item' using errcode = '42501';
  end if;

  if v_item.state <> 'CLAIMED' then
    raise exception 'item cannot be reunited from state=%', v_item.state using errcode = '55000';
  end if;

  update public.lostfound_items
     set state = 'REUNITED', revision = revision + 1, updated_at = now()
   where id = p_item_id;

  perform public.record_audit_event(v_caller, 'lostfound.reunited', 'lostfound_item', p_item_id);
end;
$fn$;

revoke all on function public.reunite_lostfound_item(uuid) from public;
grant execute on function public.reunite_lostfound_item(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- cancel_lostfound_item -- reporter (or a moderator) withdraws the report
-- entirely (wrong post, found it themselves) -- rejects any still-PENDING
-- claims so claimants aren't left hanging.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_lostfound_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_caller uuid := auth.uid();
  v_item   public.lostfound_items%rowtype;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_item from public.lostfound_items where id = p_item_id for update;

  if not found then
    raise exception 'item % not found', p_item_id using errcode = 'P0002';
  end if;

  if v_item.reporter_id <> v_caller and not public.caller_is_moderator() then
    raise exception 'only the reporter or a moderator may cancel this item' using errcode = '42501';
  end if;

  if v_item.state not in ('REPORTED', 'MATCHED', 'CLAIMED') then
    raise exception 'item cannot be cancelled from state=%', v_item.state using errcode = '55000';
  end if;

  update public.lostfound_items
     set state = 'CANCELLED', revision = revision + 1, updated_at = now()
   where id = p_item_id;

  update public.lostfound_claims
     set state = 'REJECTED', revision = revision + 1, updated_at = now(), resolved_at = now()
   where item_id = p_item_id and state = 'PENDING';

  perform public.record_audit_event(v_caller, 'lostfound.cancelled', 'lostfound_item', p_item_id);
end;
$fn$;

revoke all on function public.cancel_lostfound_item(uuid) from public;
grant execute on function public.cancel_lostfound_item(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- expire_stale_lostfound_items -- the sweep. Must work with zero connected
-- clients; see the file header for why its schedule lives outside this
-- directory. CLAIMED items are deliberately excluded (see 0016's item-state
-- comment). Internal: never granted to any client role.
-- -----------------------------------------------------------------------------
create or replace function public.expire_stale_lostfound_items()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  with expired as (
    update public.lostfound_items
       set state = 'EXPIRED', revision = revision + 1, updated_at = now()
     where state in ('REPORTED', 'MATCHED')
       and expires_at <= now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$fn$;

revoke all on function public.expire_stale_lostfound_items() from public;

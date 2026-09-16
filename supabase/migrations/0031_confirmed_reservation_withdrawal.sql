-- =============================================================================
-- 0031_confirmed_reservation_withdrawal.sql
--
-- APPLIED: no
--
-- Issue #148, decision D-96. A rider may withdraw only their own CONFIRMED
-- reservation before the poster advances the offer to ARRIVING. The existing
-- ACTIVE-seat release stays intact; this append-only correction extends the
-- existing client writer rather than restoring rider authority to cancel an
-- offer. A confirmed withdrawal moves through RELEASED before the remaining-seat
-- recomputation, so every state/revision movement remains ledgered by
-- apply_offer_transition().
--
-- A freed confirmed seat remains open until the poster deliberately calls
-- offer_promote_waitlist(). That poster-only entry point delegates to the
-- existing FIFO primitive; it never selects a rider itself, and this migration
-- neither calls nor schedules promote_waitlist_sweep().
-- =============================================================================

-- The graph correction is append-only: 0002 is not edited.
create or replace function public.offer_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from (values
        ('DRAFT', 'OPEN'),
        ('OPEN', 'PARTIALLY_RESERVED'),
        ('OPEN', 'CANCELLED'),
        ('OPEN', 'EXPIRED'),
        ('PARTIALLY_RESERVED', 'RESERVED'),
        ('PARTIALLY_RESERVED', 'RELEASED'),
        ('PARTIALLY_RESERVED', 'CANCELLED'),
        ('PARTIALLY_RESERVED', 'EXPIRED'),
        ('RESERVED', 'CONFIRMED'),
        ('RESERVED', 'RELEASED'),
        ('RESERVED', 'CANCELLED'),
        ('CONFIRMED', 'RELEASED'),
        ('CONFIRMED', 'ARRIVING'),
        ('CONFIRMED', 'CANCELLED'),
        ('ARRIVING', 'PICKED_UP'),
        ('ARRIVING', 'CANCELLED'),
        ('PICKED_UP', 'COMPLETED'),
        ('RELEASED', 'OPEN'),
        ('RELEASED', 'PARTIALLY_RESERVED')
      ) as edge (from_state, to_state)
     where edge.from_state = p_from
       and edge.to_state = p_to
  );
$fn$;

revoke all on function public.offer_transition_allowed(text, text) from public;
revoke all on function public.offer_transition_allowed(text, text) from anon, authenticated;


-- A confirmed withdrawal opens a seat only when the poster decides it should
-- reach the FIFO queue. The existing periodic sweep continues to serve ordinary
-- ACTIVE-seat releases, but skips an offer carrying this marker.
alter table public.offers
  add column if not exists manual_waitlist_promotion_only boolean not null default false;


-- ACTIVE release remains unchanged in outcome. CONFIRMED withdrawal is allowed
-- while the rider is confirmed and the offer is not yet ARRIVING. A first
-- withdrawal can leave other confirmed riders on a PARTIALLY_RESERVED offer,
-- and a manual promotion can make it RESERVED again, so neither state may
-- strand those riders. The reservation state is CANCELLED for the confirmed
-- case, which also ends pickup-detail visibility through the existing RLS
-- predicate.
create or replace function public.offer_release_seat(
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
  v_actor             uuid := auth.uid();
  v_replay            jsonb;
  v_state             text;
  v_taken             integer;
  v_reservation_id    uuid;
  v_reservation_state text;
  v_seats             integer;
  v_remaining         integer;
  v_revision          integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_release_seat', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  select state, seats_taken
    into v_state, v_taken
    from public.offers
   where id = p_offer_id
   for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  select id, state, seats
    into v_reservation_id, v_reservation_state, v_seats
    from public.reservations
   where offer_id = p_offer_id
     and rider_id = v_actor
     and state in ('ACTIVE', 'CONFIRMED')
   for update;

  if not found then
    raise exception 'no active or confirmed reservation to release' using errcode = 'P0002';
  end if;

  if v_reservation_state = 'CONFIRMED' and v_state not in ('CONFIRMED', 'PARTIALLY_RESERVED', 'RESERVED') then
    raise exception 'confirmed seats may be withdrawn only before arriving, state=%', v_state using errcode = '55000';
  end if;

  if v_reservation_state = 'ACTIVE' and v_state not in ('PARTIALLY_RESERVED', 'RESERVED') then
    raise exception 'offer is % and cannot release an active seat', v_state using errcode = '55000';
  end if;

  update public.reservations
     set state      = case when v_reservation_state = 'CONFIRMED' then 'CANCELLED' else 'RELEASED' end,
         revision   = revision + 1,
         updated_at = now()
   where id = v_reservation_id;

  if v_reservation_state = 'CONFIRMED' then
    update public.offers
       set manual_waitlist_promotion_only = true
     where id = p_offer_id;
  end if;

  v_remaining := v_taken - v_seats;

  v_revision := public.apply_offer_transition(
    p_offer_id, 'RELEASED', p_expected_revision, v_actor,
    'offer_release_seat', p_idempotency_key, -v_seats, 0
  );

  v_revision := public.apply_offer_transition(
    p_offer_id,
    case when v_remaining = 0 then 'OPEN' else 'PARTIALLY_RESERVED' end,
    v_revision, v_actor,
    'offer_release_seat', p_idempotency_key, 0, 1
  );

  perform public.record_audit_event(v_actor, 'reservation.withdrawn', 'offer', p_offer_id,
    jsonb_build_object('reservation_id', v_reservation_id));
  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_release_seat(uuid, integer, text) from public;
revoke all on function public.offer_release_seat(uuid, integer, text) from anon;
grant execute on function public.offer_release_seat(uuid, integer, text) to authenticated;


-- The poster chooses when to fill a newly open seat. The existing internal
-- promote_from_waitlist() owns FIFO selection and the state-machine-backed
-- reservation; this wrapper supplies session authority, revision checking, and
-- idempotency without exposing a rider selector to the client.
create or replace function public.offer_promote_waitlist(
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
  v_offer    public.offers%rowtype;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_promote_waitlist', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  select * into v_offer
    from public.offers
   where id = p_offer_id
   for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if v_offer.poster_id <> v_actor then
    raise exception 'only the poster may promote the waitlist' using errcode = '42501';
  end if;

  if p_expected_revision is null or p_expected_revision <> v_offer.revision then
    raise exception 'revision conflict: offer % is at revision %, caller expected %',
      p_offer_id, v_offer.revision, coalesce(p_expected_revision, -1)
      using errcode = 'PT409';
  end if;

  if v_offer.state not in ('OPEN', 'PARTIALLY_RESERVED') then
    raise exception 'offer is % and cannot promote a waiting rider', v_offer.state using errcode = '55000';
  end if;

  perform public.promote_from_waitlist(p_offer_id);

  select revision into v_revision
    from public.offers
   where id = p_offer_id;

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);
  return v_revision;
end;
$fn$;

revoke all on function public.offer_promote_waitlist(uuid, integer, text) from public;
revoke all on function public.offer_promote_waitlist(uuid, integer, text) from anon;
grant execute on function public.offer_promote_waitlist(uuid, integer, text) to authenticated;


-- Keep ordinary ACTIVE-seat releases on the established periodic FIFO path, but
-- never let that scheduler override a poster's decision after a confirmed rider
-- withdraws. The poster-only offer_promote_waitlist() above remains the sole
-- promotion entry point for marked offers.
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
       and not o.manual_waitlist_promotion_only
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
revoke all on function public.promote_waitlist_sweep() from anon, authenticated;

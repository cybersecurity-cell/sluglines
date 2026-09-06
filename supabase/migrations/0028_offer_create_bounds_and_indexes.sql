-- =============================================================================
-- 0028_offer_create_bounds_and_indexes.sql
--
-- APPLIED: no
--
-- Issue #137, `Docs/DECISIONS.md` D-87. Two things `0002` left out of the
-- offers table and its one client entry point:
--
--   1. `offer_create` bounds the WINDOW (length, start horizon, staleness) and
--      the number of open offers one member may hold. Signature-preserving
--      `create or replace`, the `0003`/`0027` pattern; `0002` is not edited.
--   2. Three indexes on `public.offers`, which had none beyond the primary key
--      and `0019`'s partial recurring-occurrence index.
--
-- THE DEFECT
-- -----------------------------------------------------------------------------
-- `0002`'s `offer_create` checks seats 1-6, origin <> destination and
-- `window_end > window_start`, and nothing else. `offer_expire_sweep` keys on
-- `window_end <= now()`, so an offer whose window ends in 2099 sits on every
-- member's board until someone cancels it -- and there is no per-member cap,
-- so one phone-verified account can post fifty of them. Every reader of the
-- table (`offer_expire_sweep` every minute, the `/board` filter, the public
-- aggregates in `0005`, `record_completed_rides_sweep` in `0023`) scans it.
--
-- THE BOUNDS, AND WHY THESE NUMBERS
-- -----------------------------------------------------------------------------
--   window length      <= 4 hours     A slug-line pickup window is fifteen
--                                     minutes to an hour; four hours covers a
--                                     whole peak with room to spare and is
--                                     still a fraction of a day, so the sweep
--                                     is never more than a peak behind.
--   window start       <= 14 days out A driver plans a week, maybe two;
--                                     beyond that the board is a calendar.
--   window start       >= 1 hour ago  "Leaving in ten minutes" posted from a
--                                     phone with a slow clock, or a form
--                                     submitted at the top of the window, must
--                                     still land; a window that began two
--                                     hours ago is a mistake.
--   open offers/member <= 5           A pilot driver holds a morning and an
--                                     afternoon offer, perhaps for two days.
--                                     Five is generous for a person and
--                                     useless for a flood. "Open" is any
--                                     non-terminal state whose window has not
--                                     ended, plus DRAFTs created in the last
--                                     day (a DRAFT never expires, and this
--                                     entry point is reachable directly over
--                                     PostgREST without the publish call the
--                                     route makes).
--
-- The three window bounds raise `22023` (invalid_argument), like the checks
-- already there. The cap raises `PT429`: PostgREST reads the PTnnn form as an
-- HTTP status (D-30, the same mechanism as `PT409`/`PT425`), so a client that
-- reads nothing but the status line still sees 429 Too Many Requests, and
-- `src/lib/api/transition-http.ts` maps it to `limit_reached`, not retryable.
-- The numbers themselves are also published as `OFFER_CREATE_LIMITS` in
-- `src/lib/domain/offer-transitions.ts`, and `tests/offer-state-machine.test.mjs`
-- asserts the two agree.
--
-- The recurring-offer sweep creates rows through `offer_create_for_member`
-- (`0020`), a copy of `0002`'s body with an explicit actor. Its windows come
-- from templates, not from a request, and template validation is issue #139's;
-- this file does not touch it, and says so rather than leaving the asymmetry
-- to be discovered.
--
-- THE INDEXES
-- -----------------------------------------------------------------------------
--   idx_offers_state_window_end     (state, window_end)
--       offer_expire_sweep: `state in ('OPEN','PARTIALLY_RESERVED') and
--       window_end <= now()`; also the cap's `window_end > now()` predicate.
--   idx_offers_corridor_state       (origin_location_id, destination_location_id, state)
--       the /board filter (`src/lib/corridor-board.ts`), and -- by its leading
--       column -- the 0005 aggregates' join on origin_location_id.
--   idx_offers_poster_state         (poster_id, state)
--       the per-member cap, and any future "my offers" read (#140).
--
-- `if not exists` on each, so the file is re-runnable. Plain (not CONCURRENTLY):
-- this runs inside a migration transaction on a table with, today, a handful
-- of rows.
--
-- ==> APPLIED: no. Writing this file is the job of the change that adds it;
--     applying it is a separate, explicitly authorised act, rehearsed on a
--     preview branch first (README, "Applying a migration").
-- =============================================================================

create or replace function public.offer_create(
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
  v_actor    uuid := auth.uid();
  v_offer_id uuid := gen_random_uuid();
  v_replay   jsonb;
  v_open     integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_create', null, p_idempotency_key);
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

  -- Issue #137: the window is bounded in length, in how far ahead it may
  -- start, and in how far behind it may already be.
  if p_window_end - p_window_start > interval '4 hours' then
    raise exception 'window may not be longer than 4 hours' using errcode = '22023';
  end if;

  if p_window_start > now() + interval '14 days' then
    raise exception 'window_start must be within 14 days' using errcode = '22023';
  end if;

  if p_window_start < now() - interval '1 hour' then
    raise exception 'window_start may not be more than 1 hour in the past' using errcode = '22023';
  end if;

  if p_seats_total is null or p_seats_total < 1 or p_seats_total > 6 then
    raise exception 'seats_total must be between 1 and 6' using errcode = '22023';
  end if;

  -- Issue #137: one member may hold at most 5 open offers. Counted after the
  -- argument checks so a malformed request is refused for what is wrong with
  -- it, and before the insert so the cap is never exceeded by the row it
  -- refuses.
  select count(*)
    into v_open
    from public.offers o
   where o.poster_id = v_actor
     and (
       (o.state in ('OPEN', 'PARTIALLY_RESERVED', 'RESERVED', 'CONFIRMED', 'ARRIVING') and o.window_end > now())
       or (o.state = 'DRAFT' and o.created_at > now() - interval '1 day')
     );

  if v_open >= 5 then
    raise exception 'too many open offers (limit 5); cancel one first' using errcode = 'PT429';
  end if;

  insert into public.offers (
    id, poster_id, poster_role, origin_location_id, destination_location_id,
    window_start, window_end, seats_total
  )
  values (
    v_offer_id, v_actor, p_poster_role, p_origin_location_id, p_destination_location_id,
    p_window_start, p_window_end, p_seats_total
  );

  perform public.record_audit_event(v_actor, 'offer.created', 'offer', v_offer_id,
    jsonb_build_object('poster_role', p_poster_role, 'seats_total', p_seats_total));

  perform public.complete_offer_operation(v_actor, p_idempotency_key, v_offer_id, 1);

  return v_offer_id;
end;
$fn$;

revoke all on function public.offer_create(text, uuid, uuid, timestamptz, timestamptz, integer, text) from public;
revoke all on function public.offer_create(text, uuid, uuid, timestamptz, timestamptz, integer, text) from anon;
grant execute on function public.offer_create(text, uuid, uuid, timestamptz, timestamptz, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Indexes. See the header for which reader each serves.
-- -----------------------------------------------------------------------------
create index if not exists idx_offers_state_window_end
  on public.offers (state, window_end);

create index if not exists idx_offers_corridor_state
  on public.offers (origin_location_id, destination_location_id, state);

create index if not exists idx_offers_poster_state
  on public.offers (poster_id, state);

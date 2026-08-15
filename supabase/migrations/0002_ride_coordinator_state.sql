-- =============================================================================
-- 0002_ride_coordinator_state.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp),
--          applied 2026-08-14 by `supabase db push`. NOT applied to production
--          (parent project bwpguotjzczmieeepczf). See Docs/DECISIONS.md D-28 and
--          supabase/migrations/README.md.
--
-- KNOWN DEFECT, found by the live suite this file was applied for: the revision
-- conflict below raises SQLSTATE 40001, which PostgREST retries as transient.
-- Through the data API a conflict therefore takes ~125 s and returns a codeless
-- gateway timeout instead of a conflict. Docs/DECISIONS.md D-29.
--
-- M3 Ride Coordinator state machine (rev. 5.3 sec.8 M3), built on the default-deny
-- foundation established by 0001_rebuild_foundation.sql.
--
-- rev. 5.3 sec.12 constraint 6 is the whole specification of this file:
--
--   "State transitions are SECURITY DEFINER SQL functions with revision checks
--    and idempotency keys."
--
-- Each of those three words is a concrete artefact below:
--
--   SECURITY DEFINER   no table here carries an insert/update/delete policy for
--                      any role. Every write is a function call.
--   revision checks    offers.revision is an integer bumped by exactly one per
--                      applied hop. Every client entry point takes the revision
--                      the caller believes it is acting on and refuses the call
--                      if the row has moved -- read under FOR UPDATE inside the
--                      transaction, which is the only place the comparison is
--                      safe against a concurrent writer.
--   idempotency keys   offer_idempotency_keys is claimed before any effect and
--                      completed after. A replayed call returns the first call's
--                      result and applies nothing.
--
-- THE STATE GRAPH IS NOT DECIDED HERE
-- -----------------------------------------------------------------------------
-- offer_transition_allowed() below is a transcription of the rev. 5.3 sec.8 M3
-- diagram, and it is the same edge list as src/lib/domain/offer-state.ts.
-- tests/offer-state-machine.test.mjs parses the VALUES list out of this file and
-- requires it to equal that module's table edge-for-edge, so the two cannot
-- drift apart without a test failing.
--
-- Two outcomes are two hops rather than one, because the diagram has no single
-- edge for either and this file does not invent one:
--
--   a one-seat offer filling   OPEN -> PARTIALLY_RESERVED -> RESERVED
--   a seat given back          RESERVED -> RELEASED -> OPEN
--
-- Both hops are applied through the same choke point in the same transaction, so
-- both are revision-checked and both appear in offer_transitions. RELEASED is
-- therefore transient: it is entered and left inside one transaction and no
-- client ever observes an offer sitting in it.
--
-- Scope, deliberately narrow -- the tables the state machine cannot work without:
--
--   offers                   rev. 5.3 sec.8 M3
--   reservations             rev. 5.3 sec.8 M3, partial-unique live constraint
--   offer_pickup_details     rev. 5.3 sec.8 M3, confirmed participants only
--   offer_transitions        the sec.12 constraint 6 hop ledger, append-only
--   offer_idempotency_keys   the sec.12 constraint 6 key claim
--
-- Explicitly NOT here, because rev. 5.3 assigns them elsewhere and this slice
-- does not front-run them:
--
--   recurring templates + skips, waitlist, ETA, no-show   sec.11 Phase 4
--   completed_rides + leaderboard views, app_settings     sec.11 Phase 4+
--   corridor scoping of offer visibility                  needs the sec.11 P1
--                                                         locations directory
--   get_public_offer_summary()                            sec.8 M1, Phase 2
--
-- SECURITY POSTURE -- unchanged from 0001 and re-stated because it is per-file:
-- every table below enables RLS, is revoked from anon and authenticated, and is
-- granted back SELECT only. Every function below is revoked from PUBLIC before
-- anything is granted back, because Postgres grants EXECUTE to PUBLIC by default
-- and that default would make the tables' default-deny irrelevant.
-- scripts/sql-lint.mjs enforces both (rules R7, R9, R11).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- offers  (rev. 5.3 sec.8 M3)
--
-- origin/destination carry NO foreign key for the same reason members.location_id
-- does not: the locations table is the sec.11 P1 43-spot directory seed and does
-- not exist yet. The FK is added by that migration rather than guessed here.
-- -----------------------------------------------------------------------------
create table if not exists public.offers (
  id                      uuid primary key default gen_random_uuid(),
  poster_id               uuid not null references public.members (id) on delete cascade,
  poster_role             text not null check (poster_role in ('driver', 'rider')),
  origin_location_id      uuid not null,
  destination_location_id uuid not null,
  window_start            timestamptz not null,
  window_end              timestamptz not null,
  seats_total             integer not null check (seats_total between 1 and 6),
  seats_taken             integer not null default 0 check (seats_taken >= 0),
  state                   text not null default 'DRAFT' check (state in (
                            'DRAFT',
                            'OPEN',
                            'PARTIALLY_RESERVED',
                            'RESERVED',
                            'CONFIRMED',
                            'ARRIVING',
                            'PICKED_UP',
                            'COMPLETED',
                            'RELEASED',
                            'CANCELLED',
                            'EXPIRED'
                          )),
  revision                integer not null default 1 check (revision >= 1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint offers_window_ordered check (window_end > window_start),
  constraint offers_seats_within_total check (seats_taken <= seats_total)
);

comment on column public.offers.revision is
  'Optimistic-concurrency token. Bumped by exactly one per applied hop, only inside '
  'apply_offer_transition(). rev. 5.3 sec.12 constraint 6: every transition is revision-checked.';

comment on column public.offers.state is
  'rev. 5.3 sec.8 M3. The CHECK list is the state set; the legal edges between them are '
  'offer_transition_allowed(), not this constraint. RELEASED is transient -- see the file header.';

comment on column public.offers.origin_location_id is
  'FK to the locations table is added by the P1 directory migration; that table does not exist yet.';

alter table public.offers enable row level security;

revoke all on table public.offers from anon;
revoke all on table public.offers from authenticated;
grant select on table public.offers to authenticated;


-- -----------------------------------------------------------------------------
-- reservations  (rev. 5.3 sec.8 M3, "reservations with partial-unique ACTIVE
-- constraint")
--
-- The partial unique index below covers ACTIVE *and* CONFIRMED, not ACTIVE alone.
-- rev. 5.3's one-line summary names ACTIVE because that is the state a seat is
-- claimed in; but a reservation moves to CONFIRMED and keeps the seat, so an
-- ACTIVE-only index would let a rider hold two seats on one offer the moment the
-- first was confirmed. The index covers every state that occupies a seat, which
-- is the constraint the summary is describing.
--
-- NO_SHOW is deliberately absent from the CHECK list: rev. 5.3 sec.11 Phase 4 owns
-- the no-show flow and this migration ships no writer for it. A state with no
-- writer cannot be reached, and committing one would only make the machine look
-- more complete than it is.
-- -----------------------------------------------------------------------------
create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers (id) on delete cascade,
  rider_id   uuid not null references public.members (id) on delete cascade,
  seats      integer not null default 1 check (seats between 1 and 4),
  state      text not null default 'ACTIVE' check (state in ('ACTIVE', 'CONFIRMED', 'RELEASED', 'CANCELLED')),
  revision   integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reservations enable row level security;

revoke all on table public.reservations from anon;
revoke all on table public.reservations from authenticated;
grant select on table public.reservations to authenticated;

create unique index if not exists reservations_one_live_seat_per_rider
  on public.reservations (offer_id, rider_id)
  where state in ('ACTIVE', 'CONFIRMED');

create index if not exists idx_reservations_offer on public.reservations (offer_id, state);
create index if not exists idx_reservations_rider on public.reservations (rider_id, created_at desc);


-- -----------------------------------------------------------------------------
-- offer_pickup_details  (rev. 5.3 sec.8 M3)
--
-- "Vehicle description and pickup instructions are visible to confirmed
--  participants only."
--
-- Split from offers into its own table precisely so that visibility rule is a
-- property of a row, enforceable by one policy, rather than a column-level
-- exception the application has to remember to apply on every read.
--
-- These two columns are member free text, which rev. 5.3 sec.12 constraint 3
-- permits *only* in the fields sec.8 defines. These are two of them.
-- -----------------------------------------------------------------------------
create table if not exists public.offer_pickup_details (
  offer_id            uuid primary key references public.offers (id) on delete cascade,
  vehicle_description text check (char_length(btrim(vehicle_description)) between 1 and 200),
  pickup_instructions text check (char_length(btrim(pickup_instructions)) between 1 and 500),
  updated_at          timestamptz not null default now()
);

comment on table public.offer_pickup_details is
  'rev. 5.3 sec.8 M3: readable by the poster and by confirmed participants only. Deliberately a '
  'separate table so that rule is one RLS policy rather than a per-column read rule.';

alter table public.offer_pickup_details enable row level security;

revoke all on table public.offer_pickup_details from anon;
revoke all on table public.offer_pickup_details from authenticated;
grant select on table public.offer_pickup_details to authenticated;


-- -----------------------------------------------------------------------------
-- offer_transitions -- the hop ledger.
--
-- One row per applied hop, append-only on the same grounds as audit_events: the
-- SECURITY DEFINER writers bypass RLS, so "no update policy" would not stop a
-- future function from rewriting the record of what happened.
--
-- A row with from_state = to_state is a seat-count change that moved no state --
-- a rider taking one of three seats. It still bumps the revision, because a
-- client holding the old revision now has a stale seat count.
-- -----------------------------------------------------------------------------
create table if not exists public.offer_transitions (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references public.offers (id) on delete cascade,
  actor_id        uuid,
  operation       text not null,
  idempotency_key text,
  hop_index       integer not null default 0 check (hop_index >= 0),
  from_state      text not null,
  to_state        text not null,
  seats_delta     integer not null default 0,
  from_revision   integer not null check (from_revision >= 1),
  to_revision     integer not null,
  created_at      timestamptz not null default now(),
  constraint offer_transitions_revision_steps_by_one check (to_revision = from_revision + 1)
);

comment on column public.offer_transitions.actor_id is
  'Opaque member UUID, and null for the scheduler sweep. Deliberately NOT a foreign key, on the '
  'same rev. 5.3 sec.8 M7 grounds as audit_events.actor_id: account deletion must orphan it.';

alter table public.offer_transitions enable row level security;

revoke all on table public.offer_transitions from anon;
revoke all on table public.offer_transitions from authenticated;
grant select on table public.offer_transitions to authenticated;

create index if not exists idx_offer_transitions_offer
  on public.offer_transitions (offer_id, created_at desc, hop_index desc);


-- -----------------------------------------------------------------------------
-- offer_idempotency_keys -- the key claim.
--
-- Kept separate from the hop ledger on purpose. The ledger records hops, and one
-- operation can apply zero, one or two of them; the claim records *operations*,
-- which is the unit a client retries. Folding them together would leave a
-- zero-hop operation with nothing to replay against.
--
-- offer_id carries no FK: offer_create() claims its key before the offer row
-- exists, which is what makes a retried create return the first call's offer
-- instead of a second offer.
-- -----------------------------------------------------------------------------
create table if not exists public.offer_idempotency_keys (
  actor_id        uuid not null,
  idempotency_key text not null,
  operation       text not null,
  offer_id        uuid,
  result_revision integer,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  primary key (actor_id, idempotency_key)
);

comment on table public.offer_idempotency_keys is
  'rev. 5.3 sec.12 constraint 6 idempotency keys. Claimed before any effect, completed after. The '
  'primary key is the serialisation point: a concurrent duplicate blocks on it rather than '
  'double-applying, and reads the first call''s recorded result once that call commits.';

alter table public.offer_idempotency_keys enable row level security;

revoke all on table public.offer_idempotency_keys from anon;
revoke all on table public.offer_idempotency_keys from authenticated;
grant select on table public.offer_idempotency_keys to authenticated;


-- =============================================================================
-- VISIBILITY PREDICATES
--
-- Policies below need to ask "is the caller a participant in this offer?", which
-- means reading reservations from a policy on offers and vice versa. Written
-- inline that is an infinite RLS recursion. These SECURITY DEFINER helpers are
-- the standard break in the cycle: they run as the table owner, who is exempt
-- from the policies.
--
-- Each takes no member argument and reads auth.uid() itself, so a caller can
-- only ever ask about their own relationship to an offer -- a p_member_id
-- parameter would turn each of these into a membership oracle.
-- =============================================================================

create or replace function public.caller_owns_offer(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from public.offers o
     where o.id = p_offer_id
       and o.poster_id = auth.uid()
  );
$fn$;

revoke all on function public.caller_owns_offer(uuid) from public;
grant execute on function public.caller_owns_offer(uuid) to authenticated;


create or replace function public.caller_is_offer_participant(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from public.offers o
     where o.id = p_offer_id
       and o.poster_id = auth.uid()
  )
  or exists (
    select 1
      from public.reservations r
     where r.offer_id = p_offer_id
       and r.rider_id = auth.uid()
       and r.state in ('ACTIVE', 'CONFIRMED')
  );
$fn$;

revoke all on function public.caller_is_offer_participant(uuid) from public;
grant execute on function public.caller_is_offer_participant(uuid) to authenticated;


create or replace function public.caller_has_confirmed_seat(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from public.reservations r
     where r.offer_id = p_offer_id
       and r.rider_id = auth.uid()
       and r.state = 'CONFIRMED'
  );
$fn$;

revoke all on function public.caller_has_confirmed_seat(uuid) from public;
grant execute on function public.caller_has_confirmed_seat(uuid) to authenticated;


create or replace function public.caller_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from public.members m
     where m.id = auth.uid()
       and m.role = 'moderator'
  );
$fn$;

revoke all on function public.caller_is_moderator() from public;
grant execute on function public.caller_is_moderator() to authenticated;


-- =============================================================================
-- POLICIES -- SELECT only, for authenticated only. There is no insert, update or
-- delete policy on any table in this file, for any role, by design.
-- =============================================================================

-- rev. 5.3 sec.8 M3 offers_visible_for_caller: "an authenticated member sees offers
-- in OPEN/PARTIALLY_RESERVED states for corridor pairs touching their active
-- location set, plus every offer they participate in regardless of state."
--
-- The corridor-pair half is NOT implemented here and this is not an oversight:
-- "active location set" is defined against the sec.11 P1 locations directory,
-- which does not exist, and a scoping predicate written against a table that is
-- not there would be a guess. What is implemented is the strictly wider board
-- read -- every open offer -- plus the participant clause exactly as specified.
-- During the pilot's single corridor pair the two are the same set. The narrowing
-- lands with the locations migration, and is a *narrowing*, so no member gains
-- visibility later.
create policy offers_select_visible_for_caller
  on public.offers
  for select
  to authenticated
  using (
    poster_id = auth.uid()
    or state in ('OPEN', 'PARTIALLY_RESERVED')
    or public.caller_is_offer_participant(id)
  );

create policy reservations_select_participant
  on public.reservations
  for select
  to authenticated
  using (
    rider_id = auth.uid()
    or public.caller_owns_offer(offer_id)
  );

-- The confirmed-participants-only rule of rev. 5.3 sec.8 M3, as one predicate.
create policy offer_pickup_details_select_confirmed
  on public.offer_pickup_details
  for select
  to authenticated
  using (
    public.caller_owns_offer(offer_id)
    or public.caller_has_confirmed_seat(offer_id)
  );

create policy offer_transitions_select_participant
  on public.offer_transitions
  for select
  to authenticated
  using (
    actor_id = auth.uid()
    or public.caller_is_offer_participant(offer_id)
    or public.caller_is_moderator()
  );

create policy offer_idempotency_keys_select_self
  on public.offer_idempotency_keys
  for select
  to authenticated
  using (actor_id = auth.uid());


-- =============================================================================
-- THE STATE GRAPH
-- =============================================================================

-- -----------------------------------------------------------------------------
-- offer_transition_allowed -- the rev. 5.3 sec.8 M3 edge list, transcribed.
--
-- This VALUES list is the single source of legality in SQL, and it is parsed
-- verbatim by tests/offer-state-machine.test.mjs and compared to
-- src/lib/domain/offer-state.ts. Adding an edge here without adding it there
-- fails the suite, and vice versa.
--
-- Internal: never granted to a client role. Its answer is not a secret, but a
-- client that needs it has src/lib/domain for the same table.
-- -----------------------------------------------------------------------------
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


-- =============================================================================
-- IDEMPOTENCY
-- =============================================================================

-- -----------------------------------------------------------------------------
-- claim_offer_operation -- take the key, or report the first call's result.
--
-- Returns null when the claim is fresh and the caller should proceed. Returns the
-- recorded result as jsonb when this is a replay, in which case the caller must
-- apply nothing.
--
-- The primary key on (actor_id, idempotency_key) is what makes this safe under
-- concurrency: a second caller with the same key blocks on the uncommitted row
-- until the first transaction ends, then either reads its committed result or,
-- if the first rolled back, finds no row and proceeds itself.
--
-- Keys are scoped to the calling member. A key is therefore not a capability:
-- knowing another member's key grants nothing.
--
-- Internal: called only from the entry points below.
-- -----------------------------------------------------------------------------
create or replace function public.claim_offer_operation(
  p_actor_id        uuid,
  p_operation       text,
  p_offer_id        uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_key      text := btrim(coalesce(p_idempotency_key, ''));
  v_op       text;
  v_offer_id uuid;
  v_revision integer;
  v_done     timestamptz;
begin
  if char_length(v_key) < 8 or char_length(v_key) > 200 then
    raise exception 'idempotency_key must be 8 to 200 characters'
      using errcode = '22023';
  end if;

  insert into public.offer_idempotency_keys (actor_id, idempotency_key, operation, offer_id)
  values (p_actor_id, v_key, p_operation, p_offer_id)
  on conflict (actor_id, idempotency_key) do nothing;

  -- FOUND is false when the insert hit the conflict, i.e. this is a replay.
  if found then
    return null;
  end if;

  select operation, offer_id, result_revision, completed_at
    into v_op, v_offer_id, v_revision, v_done
    from public.offer_idempotency_keys
   where actor_id = p_actor_id
     and idempotency_key = v_key;

  -- A key that means one thing must not silently come to mean another. Reuse
  -- across operations or offers is a client bug, and it is reported rather than
  -- absorbed.
  if v_op is distinct from p_operation then
    raise exception 'idempotency_key was already used for operation %', v_op
      using errcode = '22023';
  end if;

  if p_offer_id is not null and v_offer_id is distinct from p_offer_id then
    raise exception 'idempotency_key was already used for a different offer'
      using errcode = '22023';
  end if;

  if v_done is null then
    raise exception 'an operation with this idempotency_key is still in flight'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'replayed', true,
    'offer_id', v_offer_id,
    'result_revision', v_revision
  );
end;
$fn$;

revoke all on function public.claim_offer_operation(uuid, text, uuid, text) from public;


-- -----------------------------------------------------------------------------
-- complete_offer_operation -- record what the claimed key produced.
--
-- Until this runs the claim is incomplete, which is what lets a concurrent caller
-- tell "already done, here is the answer" from "in flight, do not proceed".
--
-- Internal.
-- -----------------------------------------------------------------------------
create or replace function public.complete_offer_operation(
  p_actor_id        uuid,
  p_idempotency_key text,
  p_offer_id        uuid,
  p_result_revision integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.offer_idempotency_keys
     set offer_id        = coalesce(offer_id, p_offer_id),
         result_revision = p_result_revision,
         completed_at    = now()
   where actor_id = p_actor_id
     and idempotency_key = btrim(p_idempotency_key);

  if not found then
    raise exception 'idempotency claim not found' using errcode = 'P0002';
  end if;
end;
$fn$;

revoke all on function public.complete_offer_operation(uuid, text, uuid, integer) from public;


-- =============================================================================
-- THE CHOKE POINT
-- =============================================================================

-- -----------------------------------------------------------------------------
-- apply_offer_transition -- the only place offers.state or offers.revision moves.
--
-- Order of operations, and every step of it is load-bearing:
--
--   1. SELECT ... FOR UPDATE      serialises concurrent writers on this offer.
--                                 Without the lock, two callers can both read
--                                 revision 4, both pass the check, and both
--                                 write revision 5.
--   2. revision check             the caller acted on a view of the row; if the
--                                 row has moved since, the call is refused with
--                                 SQLSTATE 40001 rather than applied to a state
--                                 the caller never saw. This is the anomaly
--                                 rev. 5.3 sec.10 needs distinguishable in the UI
--                                 ("seat just taken" vs. a network failure).
--   3. edge check                 against offer_transition_allowed(), skipped
--                                 only when p_to_state is null, which means "no
--                                 state change, seat count only".
--   4. write                      state, seats and revision in one UPDATE.
--   5. ledger + audit             the hop is recorded before the function
--                                 returns, in the same transaction, so a
--                                 committed state change cannot lack a record.
--
-- p_to_state null is the seat-count-only hop: a rider taking one of three seats
-- moves no state but must still bump the revision, because a client holding the
-- old revision now has a stale seat count.
--
-- Internal: never granted to a client role. A client-callable "apply any
-- transition" function would be a hole straight through every authorisation
-- check in the entry points below.
-- -----------------------------------------------------------------------------
create or replace function public.apply_offer_transition(
  p_offer_id          uuid,
  p_to_state          text,
  p_expected_revision integer,
  p_actor_id          uuid,
  p_operation         text,
  p_idempotency_key   text,
  p_seats_delta       integer default 0,
  p_hop_index         integer default 0
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_from_state text;
  v_revision   integer;
  v_seats      integer;
  v_total      integer;
  v_to_state   text;
  v_next       integer;
begin
  select state, revision, seats_taken, seats_total
    into v_from_state, v_revision, v_seats, v_total
    from public.offers
   where id = p_offer_id
     for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if p_expected_revision is null or p_expected_revision <> v_revision then
    raise exception 'revision conflict: offer % is at revision %, caller expected %',
      p_offer_id, v_revision, coalesce(p_expected_revision, -1)
      using errcode = '40001';
  end if;

  v_to_state := coalesce(p_to_state, v_from_state);

  if p_to_state is not null and not public.offer_transition_allowed(v_from_state, p_to_state) then
    raise exception 'illegal transition % -> %', v_from_state, p_to_state
      using errcode = '55000';
  end if;

  if v_seats + coalesce(p_seats_delta, 0) < 0
     or v_seats + coalesce(p_seats_delta, 0) > v_total then
    raise exception 'seat count out of range: % taken of %, delta %',
      v_seats, v_total, p_seats_delta
      using errcode = '55000';
  end if;

  v_next := v_revision + 1;

  update public.offers
     set state       = v_to_state,
         seats_taken = v_seats + coalesce(p_seats_delta, 0),
         revision    = v_next,
         updated_at  = now()
   where id = p_offer_id;

  insert into public.offer_transitions (
    offer_id, actor_id, operation, idempotency_key, hop_index,
    from_state, to_state, seats_delta, from_revision, to_revision
  )
  values (
    p_offer_id, p_actor_id, p_operation, p_idempotency_key, coalesce(p_hop_index, 0),
    v_from_state, v_to_state, coalesce(p_seats_delta, 0), v_revision, v_next
  );

  perform public.record_audit_event(
    p_actor_id,
    case when p_to_state is null then 'offer.seats_changed' else 'offer.' || lower(p_to_state) end,
    'offer',
    p_offer_id,
    jsonb_build_object(
      'from_state', v_from_state,
      'to_state', v_to_state,
      'from_revision', v_revision,
      'to_revision', v_next,
      'seats_delta', coalesce(p_seats_delta, 0),
      'operation', p_operation
    )
  );

  return v_next;
end;
$fn$;

revoke all on function public.apply_offer_transition(uuid, text, integer, uuid, text, text, integer, integer) from public;


-- -----------------------------------------------------------------------------
-- offer_transitions_append_only -- same reasoning as audit_events_append_only().
-- The ledger is evidence; evidence that can be edited is not evidence.
-- -----------------------------------------------------------------------------
create or replace function public.offer_transitions_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  raise exception 'offer_transitions is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$fn$;

revoke all on function public.offer_transitions_append_only() from public;

drop trigger if exists offer_transitions_no_mutate on public.offer_transitions;
create trigger offer_transitions_no_mutate
  before update or delete on public.offer_transitions
  for each row execute function public.offer_transitions_append_only();


-- =============================================================================
-- CLIENT ENTRY POINTS
--
-- Every one of these: requires auth.uid(), claims an idempotency key before any
-- effect, checks authorisation itself, applies hops only through
-- apply_offer_transition(), completes the claim, and returns the resulting
-- offer revision so the caller can pin its next call.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- offer_create -- a DRAFT offer. Not a transition: it creates the row the
-- machine then operates on, in the machine's initial state.
--
-- The claim is taken against a locally generated id *before* the insert, which
-- is why offer_idempotency_keys.offer_id has no FK. A retried create therefore
-- returns the first call's offer rather than creating a second one -- the failure
-- mode that matters here, because a duplicate offer is visible on the board.
-- -----------------------------------------------------------------------------
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

  if p_seats_total is null or p_seats_total < 1 or p_seats_total > 6 then
    raise exception 'seats_total must be between 1 and 6' using errcode = '22023';
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
grant execute on function public.offer_create(text, uuid, uuid, timestamptz, timestamptz, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_publish -- DRAFT -> OPEN. The poster only.
-- -----------------------------------------------------------------------------
create or replace function public.offer_publish(
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
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_publish', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  if not exists (select 1 from public.offers where id = p_offer_id and poster_id = v_actor) then
    raise exception 'only the poster may publish this offer' using errcode = '42501';
  end if;

  v_revision := public.apply_offer_transition(
    p_offer_id, 'OPEN', p_expected_revision, v_actor, 'offer_publish', p_idempotency_key, 0, 0
  );

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_publish(uuid, integer, text) from public;
grant execute on function public.offer_publish(uuid, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_reserve_seat -- a rider claims seats.
--
-- The two-hop case: an offer in OPEN whose last seats are taken goes
-- OPEN -> PARTIALLY_RESERVED -> RESERVED, because sec.8 M3 has no OPEN -> RESERVED
-- edge. Each hop is a separate revision, and the function returns the last one.
--
-- The race this is written against: two riders reserving the last seat at the
-- same instant. Three things stop the oversell, and all three are needed --
-- FOR UPDATE inside apply_offer_transition() serialises them, the revision check
-- refuses the loser's stale view, and offers_seats_within_total is the backstop
-- if a future writer ever forgets both.
-- -----------------------------------------------------------------------------
create or replace function public.offer_reserve_seat(
  p_offer_id          uuid,
  p_expected_revision integer,
  p_idempotency_key   text,
  p_seats             integer default 1
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
  v_taken    integer;
  v_total    integer;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_reserve_seat', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  if p_seats is null or p_seats < 1 or p_seats > 4 then
    raise exception 'seats must be between 1 and 4' using errcode = '22023';
  end if;

  select state, poster_id, seats_taken, seats_total
    into v_state, v_poster, v_taken, v_total
    from public.offers
   where id = p_offer_id
     for update;

  if not found then
    raise exception 'offer % not found', p_offer_id using errcode = 'P0002';
  end if;

  if v_poster = v_actor then
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
  values (p_offer_id, v_actor, p_seats);

  if v_state = 'OPEN' then
    v_revision := public.apply_offer_transition(
      p_offer_id, 'PARTIALLY_RESERVED', p_expected_revision, v_actor,
      'offer_reserve_seat', p_idempotency_key, p_seats, 0
    );

    if v_taken + p_seats >= v_total then
      v_revision := public.apply_offer_transition(
        p_offer_id, 'RESERVED', v_revision, v_actor,
        'offer_reserve_seat', p_idempotency_key, 0, 1
      );
    end if;
  elsif v_taken + p_seats >= v_total then
    v_revision := public.apply_offer_transition(
      p_offer_id, 'RESERVED', p_expected_revision, v_actor,
      'offer_reserve_seat', p_idempotency_key, p_seats, 0
    );
  else
    -- Seats moved, state did not. Still a revision bump: the caller's seat count
    -- is now stale even though its state is not.
    v_revision := public.apply_offer_transition(
      p_offer_id, null, p_expected_revision, v_actor,
      'offer_reserve_seat', p_idempotency_key, p_seats, 0
    );
  end if;

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_reserve_seat(uuid, integer, text, integer) from public;
grant execute on function public.offer_reserve_seat(uuid, integer, text, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_release_seat -- a rider gives seats back.
--
-- Always two hops: X -> RELEASED -> (OPEN | PARTIALLY_RESERVED), which is how
-- sec.8 M3 draws it. The destination is recomputed from the seats still held --
-- "a rider releasing one seat of several recomputes state from remaining count".
--
-- Only an ACTIVE reservation can be released. A CONFIRMED seat is not given back
-- through this path: rev. 5.3 gives CONFIRMED no RELEASED edge, and bailing out
-- after confirmation is offer_cancel(), which is an SMS-critical event.
-- -----------------------------------------------------------------------------
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
  v_actor          uuid := auth.uid();
  v_replay         jsonb;
  v_state          text;
  v_taken          integer;
  v_reservation_id uuid;
  v_seats          integer;
  v_remaining      integer;
  v_revision       integer;
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

  select id, seats
    into v_reservation_id, v_seats
    from public.reservations
   where offer_id = p_offer_id
     and rider_id = v_actor
     and state = 'ACTIVE'
     for update;

  if not found then
    raise exception 'no active reservation to release' using errcode = 'P0002';
  end if;

  if v_state not in ('PARTIALLY_RESERVED', 'RESERVED') then
    raise exception 'offer is % and cannot release a seat', v_state using errcode = '55000';
  end if;

  update public.reservations
     set state      = 'RELEASED',
         revision   = revision + 1,
         updated_at = now()
   where id = v_reservation_id;

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

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_release_seat(uuid, integer, text) from public;
grant execute on function public.offer_release_seat(uuid, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_confirm -- RESERVED -> CONFIRMED. The poster only.
--
-- Confirmation is what makes offer_pickup_details readable to the riders, so the
-- reservation rows move to CONFIRMED in the same transaction as the offer.
-- -----------------------------------------------------------------------------
create or replace function public.offer_confirm(
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
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_confirm', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  if not exists (select 1 from public.offers where id = p_offer_id and poster_id = v_actor) then
    raise exception 'only the poster may confirm this offer' using errcode = '42501';
  end if;

  v_revision := public.apply_offer_transition(
    p_offer_id, 'CONFIRMED', p_expected_revision, v_actor, 'offer_confirm', p_idempotency_key, 0, 0
  );

  update public.reservations
     set state      = 'CONFIRMED',
         revision   = revision + 1,
         updated_at = now()
   where offer_id = p_offer_id
     and state = 'ACTIVE';

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_confirm(uuid, integer, text) from public;
grant execute on function public.offer_confirm(uuid, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_advance -- CONFIRMED -> ARRIVING -> PICKED_UP -> COMPLETED.
--
-- One step per call, next state derived from the current one. The poster only:
-- these three are assertions about the vehicle, and only the driver can make them.
-- -----------------------------------------------------------------------------
create or replace function public.offer_advance(
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
  v_next     text;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_replay := public.claim_offer_operation(v_actor, 'offer_advance', p_offer_id, p_idempotency_key);
  if v_replay is not null then
    return (v_replay ->> 'result_revision')::integer;
  end if;

  select state
    into v_state
    from public.offers
   where id = p_offer_id
     and poster_id = v_actor
     for update;

  if not found then
    raise exception 'only the poster may advance this offer' using errcode = '42501';
  end if;

  v_next := case v_state
              when 'CONFIRMED' then 'ARRIVING'
              when 'ARRIVING'  then 'PICKED_UP'
              when 'PICKED_UP' then 'COMPLETED'
            end;

  if v_next is null then
    raise exception 'offer is % and has nothing to advance to', v_state using errcode = '55000';
  end if;

  v_revision := public.apply_offer_transition(
    p_offer_id, v_next, p_expected_revision, v_actor, 'offer_advance', p_idempotency_key, 0, 0
  );

  perform public.complete_offer_operation(v_actor, p_idempotency_key, p_offer_id, v_revision);

  return v_revision;
end;
$fn$;

revoke all on function public.offer_advance(uuid, integer, text) from public;
grant execute on function public.offer_advance(uuid, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_cancel -- the bail-out, from any live state.
--
-- Callable by the poster or by any rider holding a live seat, because rev. 5.3
-- sec.8 M3 describes CONFIRMED | ARRIVING -> CANCELLED as "driver/rider bail-out"
-- and calls it an SMS-critical event. The notification fan-out is M9's and is not
-- in this file; the state change it keys on is.
-- -----------------------------------------------------------------------------
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

  if v_poster <> v_actor
     and not exists (
       select 1
         from public.reservations r
        where r.offer_id = p_offer_id
          and r.rider_id = v_actor
          and r.state in ('ACTIVE', 'CONFIRMED')
     ) then
    raise exception 'only a participant may cancel this offer' using errcode = '42501';
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
grant execute on function public.offer_cancel(uuid, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_set_pickup_details -- the poster's vehicle description and instructions.
--
-- Not a transition; it writes the table whose visibility confirmation unlocks.
-- Free text is bounded here and by the table's CHECK constraints, and is visible
-- only to confirmed participants (rev. 5.3 sec.12 constraint 3).
-- -----------------------------------------------------------------------------
create or replace function public.offer_set_pickup_details(
  p_offer_id            uuid,
  p_vehicle_description text,
  p_pickup_instructions text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor   uuid := auth.uid();
  v_vehicle text := nullif(btrim(coalesce(p_vehicle_description, '')), '');
  v_pickup  text := nullif(btrim(coalesce(p_pickup_instructions, '')), '');
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.offers where id = p_offer_id and poster_id = v_actor) then
    raise exception 'only the poster may set pickup details' using errcode = '42501';
  end if;

  -- Bounds are validated here as well as by the table's CHECK constraints, so an
  -- over-long field is a stated error rather than a raw constraint violation.
  if char_length(v_vehicle) > 200 then
    raise exception 'vehicle_description must be at most 200 characters' using errcode = '22023';
  end if;

  if char_length(v_pickup) > 500 then
    raise exception 'pickup_instructions must be at most 500 characters' using errcode = '22023';
  end if;

  insert into public.offer_pickup_details (offer_id, vehicle_description, pickup_instructions)
  values (p_offer_id, v_vehicle, v_pickup)
  on conflict (offer_id) do update
     set vehicle_description = excluded.vehicle_description,
         pickup_instructions = excluded.pickup_instructions,
         updated_at          = now();

  -- No free text in the audit metadata: rev. 5.3 sec.12 constraint 3 keeps member
  -- text out of logs and telemetry. Only the fact of the change is recorded.
  perform public.record_audit_event(v_actor, 'offer.pickup_details_set', 'offer', p_offer_id);
end;
$fn$;

revoke all on function public.offer_set_pickup_details(uuid, text, text) from public;
grant execute on function public.offer_set_pickup_details(uuid, text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- offer_expire_sweep -- OPEN | PARTIALLY_RESERVED -> EXPIRED, past the window.
--
-- The pg_cron counterpart to sweep_expired_presence() in 0001. Not granted to any
-- client role; the scheduler runs it as owner. Scheduling is a database
-- operation, not a migration concern, and is not done here.
--
-- It carries no idempotency key and needs none: it is keyed on time, so a second
-- run finds nothing left to expire. It reads each offer's current revision and
-- passes that as the expectation, because the sweep is not acting on a client's
-- stale view -- it is acting on the row as it stands.
-- -----------------------------------------------------------------------------
create or replace function public.offer_expire_sweep()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_offer   record;
  v_expired integer := 0;
begin
  for v_offer in
    select id, revision
      from public.offers
     where state in ('OPEN', 'PARTIALLY_RESERVED')
       and window_end <= now()
     order by id
       for update
  loop
    perform public.apply_offer_transition(
      v_offer.id, 'EXPIRED', v_offer.revision, null, 'offer_expire_sweep', null, 0, 0
    );
    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$fn$;

revoke all on function public.offer_expire_sweep() from public;

-- =============================================================================
-- 0003_resolve_transition_conflicts.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp),
--          applied 2026-08-14 by `supabase db push --db-url`. NOT applied to
--          production. See Docs/DECISIONS.md D-29 and supabase/migrations/README.md.
--
-- Closes Docs/DECISIONS.md D-29, the defect 0002's own header records.
--
-- THE DEFECT
-- -----------------------------------------------------------------------------
-- 0002 raises a revision conflict with SQLSTATE 40001 (serialization_failure),
-- and an in-flight idempotency claim with the same code. The name reads
-- correctly -- both *are* optimistic-concurrency outcomes -- but 40001 is the
-- class the stack treats as transient and automatically retryable, and a
-- revision conflict is permanent: every retry re-reads the same revision and
-- fails identically. Measured on the branch, one stale-revision `offer_publish`
-- through PostgREST took 125,058 ms and returned `upstream request timeout`
-- with no SQLSTATE, while the same call issued straight at the database
-- returned 40001 in 382 ms.
--
-- So the SQL was right and the SQLSTATE *choice* was wrong.
--
-- THE FIX, AND WHY THESE CODES
-- -----------------------------------------------------------------------------
-- A conflict must be delivered to the client as a conflict: promptly, with a
-- SQLSTATE, and distinguishable from a transport failure -- that distinction is
-- the whole point of rev. 5.3 sec.10's "seat just taken" vs. "something went
-- wrong" UI requirement.
--
--   PT409  revision conflict. Permanent for the revision the caller holds: the
--          caller must re-read the offer and decide again. Never retry.
--   PT425  an operation with this idempotency_key is still in flight. Genuinely
--          transient -- the first call is mid-transaction -- so this one *is*
--          safe to retry, which is exactly why it must not share a code with the
--          conflict that is not.
--
-- The PTnnn form is PostgREST's documented escape hatch: a SQLSTATE of `PT`
-- followed by three digits sets the HTTP status of the response. PT409 therefore
-- arrives as `409 Conflict` and PT425 as `425 Too Early`, each carrying its
-- SQLSTATE in the error body, and neither is in a class anything upstream
-- retries. A plain domain code (P0001) would also have failed fast, but P0001 is
-- what *every* un-coded RAISE in Postgres produces, so it cannot serve as the
-- stable published contract that src/lib/domain/offer-transitions.ts needs.
--
-- WHAT THIS FILE CHANGES, AND WHAT IT DELIBERATELY DOES NOT
-- -----------------------------------------------------------------------------
-- Two functions are re-created, byte-identical to 0002 apart from the raised
-- SQLSTATE on the conflict paths. No table, no policy, no grant, no revoke and
-- no entry point is touched, and no other error code moves: 55000, 22023, 42501
-- and P0002 all already fail fast and are already correct.
--
-- 0002 is applied and this harness is append-only, so it is left exactly as it
-- was pushed -- including its KNOWN DEFECT header, which is now the historical
-- record of a closed defect rather than a live warning. This file is the
-- correction; `create or replace` on an unchanged signature means the effective
-- definition after 0003 is the one below.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- claim_offer_operation -- 0002 verbatim, except the in-flight raise is PT425.
--
-- Signature, body, ordering and every other raised code are unchanged. See
-- 0002 for the full commentary on why the primary key on
-- (actor_id, idempotency_key) is the serialisation point.
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

  -- D-29: was 40001. The first call is still inside its transaction, so this is
  -- the one genuinely transient outcome in the pair -- but it must still be
  -- *delivered*, not retried into a gateway timeout. PT425 => 425 Too Early.
  if v_done is null then
    raise exception 'an operation with this idempotency_key is still in flight'
      using errcode = 'PT425';
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
-- apply_offer_transition -- 0002 verbatim, except the revision conflict is PT409.
--
-- Still the only place offers.state or offers.revision moves, still SECURITY
-- DEFINER with search_path pinned, still internal (revoked from PUBLIC, granted
-- to nobody), and the five-step order that is the race defence is unchanged:
--
--   1. SELECT ... FOR UPDATE   serialise concurrent writers on this offer
--   2. revision check          refuse a caller acting on a row that has moved
--   3. edge check              offer_transition_allowed(), skipped when
--                              p_to_state is null (seat count only)
--   4. write                   state, seats and revision in one UPDATE
--   5. ledger + audit          in the same transaction as the write
--
-- The only edit is in step 2: the raise carries PT409 instead of 40001, so the
-- refusal reaches the client as a conflict rather than as a timeout.
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

  -- D-29: was 40001, which PostgREST retried into a 125 s gateway timeout with
  -- no SQLSTATE. This failure is permanent for the revision the caller holds --
  -- retrying re-reads the same row and fails identically -- so it is raised as
  -- PT409 => 409 Conflict and refused on the first attempt.
  if p_expected_revision is null or p_expected_revision <> v_revision then
    raise exception 'revision conflict: offer % is at revision %, caller expected %',
      p_offer_id, v_revision, coalesce(p_expected_revision, -1)
      using errcode = 'PT409';
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

-- Neither function is granted to any client role here, and 0002 granted neither.
-- `create or replace` preserves existing privileges, so the revokes above are
-- restatements, not repairs: the choke point stays reachable only from the
-- SECURITY DEFINER entry points that 0002 granted to `authenticated`.

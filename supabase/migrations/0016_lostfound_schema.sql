-- =============================================================================
-- 0016_lostfound_schema.sql
--
-- APPLIED: no
--
-- Option B slice 2 (Docs/DECISIONS.md D-69, issue #90): the lost & found schema
-- `src/lib/ai/tools.ts`'s `lostfound.search` has been waiting on since the AI
-- runtime transplant (D-65) and the incidents slice (D-68) that followed it.
-- Deterministic report -> claim -> reunite lifecycle, no photo/AI matching (out
-- of scope, per the source's own header -- see below).
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0020_lostfound_schema.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13). This file keeps
-- that migration's state machine -- REPORTED -> MATCHED -> CLAIMED -> REUNITED,
-- with CANCELLED/EXPIRED off-ramps -- and changes what this repo's schema
-- actually requires it to change:
--
--   * every RLS policy and function calls caller_is_moderator() (0002), NOT
--     Sluglines-AI's is_moderator() -- that function does not exist in this
--     repo under that name. Same adaptation as the incidents slice (D-68).
--   * "same location" is members.location_id (0001/0006), the same predicate
--     offers_visible_for_caller, audit_events_select_moderator and 0014's
--     incidents policies already use.
--   * lostfound_items.location_id carries a real foreign key to
--     public.locations, same as 0014's incidents.location_id -- the directory
--     already exists by this ordinal (0004), so there is nothing to defer.
--   * THE STOP COLUMNS ARE DROPPED. Sluglines-AI's lostfound_items carries
--     origin_stop_id/dest_stop_id, both referencing a `stops` table. `stops`
--     does not exist anywhere in this repo's migrations -- it belongs to the
--     still-deferred `transit.explain_alternatives` tool (tools.ts's own
--     TODO(Option B) on that tool says so). `lostfound.search` (the only
--     consumer this slice ships) filters by kind/category/rideDate only and
--     never touches a stop id, so there is nothing calling for the columns
--     here. Re-add them, and the origin_name/dest_name join the source's
--     lostfound_items_board view carries, with the transit `stops` slice --
--     inventing a `stops` table here to satisfy an FK nothing reads would be
--     exactly the "schema no task asked for" this harness avoids elsewhere.
--     The plain `ride_date` column the tool actually filters on is kept.
--   * EVERY WRITE IS A SECURITY DEFINER FUNCTION, INCLUDING THE REPORT ITSELF.
--     Sluglines-AI's 0020 gives lostfound_items a `for insert` RLS policy
--     (`lostfound_items_insert_own`) and lostfound_messages a `for insert`
--     policy (`lostfound_messages_insert_participant`). Neither would pass
--     this repo's R4 ("no insert/update/delete/all policy on any new table,
--     for any role -- client writes must go through a SECURITY DEFINER
--     function", enforced by scripts/sql-lint.mjs and re-asserted table-by-
--     table in tests/sql-migration-harness.test.mjs) -- R4 has no carve-out
--     for a "plain" insert. 0017 therefore ships report_lostfound_item() and
--     send_lostfound_message() alongside the claim/response functions the
--     source already wrote as functions, and no table in this file carries
--     any insert/update policy at all.
--
-- WHY THE THREE lostfound_is_* HELPERS ARE GRANTED TO authenticated
-- -----------------------------------------------------------------------------
-- lostfound_items and lostfound_claims each need to read the other to decide
-- visibility (an item's reporter should see claims on it; a claim's row should
-- be visible to the item's reporter), and a plain sub-select each way is the
-- cross-table RLS recursion Sluglines-AI's own 0020 header documents hitting
-- live ("infinite recursion detected in policy for relation lostfound_items").
-- The fix carried over unchanged: a SECURITY DEFINER function breaks the cycle
-- the same way caller_is_moderator() (0002) already does for members' own
-- self-referential checks -- it runs with the function owner's privileges,
-- bypassing RLS on the tables it touches, so evaluating it from inside another
-- table's policy never re-triggers that other table's own policy evaluation.
-- Unlike 0017's write-path functions, these three are *evaluated as part of
-- the querying member's own SELECT* (inside a USING clause), not called from
-- inside another SECURITY DEFINER function -- so, exactly like
-- caller_is_moderator(), the querying role itself needs EXECUTE on them
-- directly. That is why they are revoked from PUBLIC and granted to
-- authenticated here, in this file, rather than left ungranted like 0017's
-- internal expire_stale_lostfound_items().
--
-- SECURITY POSTURE -- unchanged from every other file in this harness: RLS on,
-- no insert/update/delete policy for any role, revoked from anon, granted
-- SELECT to authenticated only. Every write goes through a SECURITY DEFINER
-- function in 0017.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enums.
-- -----------------------------------------------------------------------------
create type public.lostfound_kind as enum ('lost', 'found');

create type public.lostfound_category as enum (
  'electronics', 'bag', 'clothing', 'documents', 'keys', 'wallet', 'umbrella', 'other'
);

create type public.lostfound_item_state as enum (
  'REPORTED', 'MATCHED', 'CLAIMED', 'REUNITED', 'CANCELLED', 'EXPIRED'
);

comment on type public.lostfound_item_state is
  'REPORTED -> MATCHED (0017''s create_lostfound_claim, first claim filed); MATCHED -> REPORTED '
  '(every claim on it rejected/withdrawn -- reopens); MATCHED -> CLAIMED (reporter accepts one '
  'claim via respond_to_lostfound_claim, which auto-rejects every other still-PENDING claim); '
  'CLAIMED -> REUNITED (reporter confirms handoff via reunite_lostfound_item, final); '
  'REPORTED|MATCHED|CLAIMED -> CANCELLED (reporter withdraws, cancel_lostfound_item); '
  'REPORTED|MATCHED -> EXPIRED (expire_stale_lostfound_items sweep -- CLAIMED is deliberately '
  'excluded, same as 0014''s incident_state: an active handoff should not vanish out from under '
  'two members just because the original post aged out). No client ever writes this column.';

create type public.lostfound_claim_state as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');


-- -----------------------------------------------------------------------------
-- lostfound_items
--
-- pending_claim_count / my_claim_state are NOT columns here -- both are derived
-- in lostfound_items_board below, the same "compute, don't store" choice this
-- repo already makes for offers_board.active_reservation_count and 0014's
-- incidents_board.confirmation_count.
-- -----------------------------------------------------------------------------
create table if not exists public.lostfound_items (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.members (id) on delete cascade,
  kind         public.lostfound_kind not null,
  category     public.lostfound_category not null,
  description  text not null check (char_length(btrim(description)) between 1 and 500),
  location_id  uuid not null references public.locations (id),
  ride_date    date not null,
  state        public.lostfound_item_state not null default 'REPORTED',
  revision     integer not null default 0 check (revision >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_lostfound_items_location_state
  on public.lostfound_items (location_id, state, ride_date desc);

alter table public.lostfound_items enable row level security;

revoke all on table public.lostfound_items from anon;
revoke all on table public.lostfound_items from authenticated;
grant select on table public.lostfound_items to authenticated;


-- -----------------------------------------------------------------------------
-- lostfound_claims -- an item can accumulate multiple PENDING claims while
-- MATCHED (see the item-state comment above): more than one member may
-- plausibly claim the same found umbrella. A claimant may hold at most one
-- live (PENDING or ACCEPTED) claim per item, enforced below -- doesn't block
-- re-claiming after a REJECTED/WITHDRAWN one.
-- -----------------------------------------------------------------------------
create table if not exists public.lostfound_claims (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.lostfound_items (id) on delete cascade,
  claimant_id  uuid not null references public.members (id) on delete cascade,
  state        public.lostfound_claim_state not null default 'PENDING',
  revision     integer not null default 0 check (revision >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create unique index if not exists idx_lostfound_claims_item_claimant_active
  on public.lostfound_claims (item_id, claimant_id)
  where (state in ('PENDING', 'ACCEPTED'));

create index if not exists idx_lostfound_claims_item_state
  on public.lostfound_claims (item_id, state);

alter table public.lostfound_claims enable row level security;

revoke all on table public.lostfound_claims from anon;
revoke all on table public.lostfound_claims from authenticated;
grant select on table public.lostfound_claims to authenticated;


-- -----------------------------------------------------------------------------
-- lostfound_messages -- a plain chat thread between an item's reporter and one
-- claimant on one claim. rev. 5.3's claim messaging that never exposes phone
-- numbers -- enforced client-side and by community.draft_response's posting
-- rules (src/lib/ai/tools.ts), same as every other free-text field in this
-- schema; this table adds no server-side content filter of its own.
-- -----------------------------------------------------------------------------
create table if not exists public.lostfound_messages (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references public.lostfound_claims (id) on delete cascade,
  sender_id   uuid not null references public.members (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists idx_lostfound_messages_claim
  on public.lostfound_messages (claim_id, created_at);

alter table public.lostfound_messages enable row level security;

revoke all on table public.lostfound_messages from anon;
revoke all on table public.lostfound_messages from authenticated;
grant select on table public.lostfound_messages to authenticated;


-- =============================================================================
-- RECURSION-BREAKING VISIBILITY HELPERS -- see the file header for why these
-- exist and why (unlike 0017's internal functions) they are granted to
-- authenticated directly.
-- =============================================================================

create or replace function public.lostfound_is_item_reporter(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.lostfound_items where id = p_item_id and reporter_id = auth.uid()
  );
$fn$;

revoke all on function public.lostfound_is_item_reporter(uuid) from public;
grant execute on function public.lostfound_is_item_reporter(uuid) to authenticated;


create or replace function public.lostfound_is_item_claimant(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.lostfound_claims where item_id = p_item_id and claimant_id = auth.uid()
  );
$fn$;

revoke all on function public.lostfound_is_item_claimant(uuid) from public;
grant execute on function public.lostfound_is_item_claimant(uuid) to authenticated;


create or replace function public.lostfound_is_claim_participant(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.lostfound_claims c
     where c.id = p_claim_id
       and (c.claimant_id = auth.uid() or public.lostfound_is_item_reporter(c.item_id))
  );
$fn$;

revoke all on function public.lostfound_is_claim_participant(uuid) from public;
grant execute on function public.lostfound_is_claim_participant(uuid) to authenticated;


-- =============================================================================
-- POLICIES
-- =============================================================================

-- Board browse: any member in the same location sees active (non-terminal)
-- items, same posture as offers_select_same_location / 0014's
-- incidents_select_same_location. Reporters and claimants keep seeing their own
-- items regardless of state -- their own history.
create policy lostfound_items_select_active_same_location
  on public.lostfound_items
  for select
  to authenticated
  using (
    state in ('REPORTED', 'MATCHED', 'CLAIMED')
    and location_id in (select location_id from public.members where id = auth.uid())
  );

create policy lostfound_items_select_own
  on public.lostfound_items
  for select
  to authenticated
  using (reporter_id = auth.uid());

create policy lostfound_items_select_claimant
  on public.lostfound_items
  for select
  to authenticated
  using (public.lostfound_is_item_claimant(id));

create policy lostfound_items_select_moderator
  on public.lostfound_items
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. Reporting goes through
-- report_lostfound_item(); every state transition through create_lostfound_claim
-- / respond_to_lostfound_claim / withdraw_lostfound_claim / reunite_lostfound_item
-- / cancel_lostfound_item / expire_stale_lostfound_items -- all 0017.


create policy lostfound_claims_select_claimant
  on public.lostfound_claims
  for select
  to authenticated
  using (claimant_id = auth.uid());

create policy lostfound_claims_select_item_reporter
  on public.lostfound_claims
  for select
  to authenticated
  using (public.lostfound_is_item_reporter(item_id));

create policy lostfound_claims_select_moderator
  on public.lostfound_claims
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. create_lostfound_claim()
-- / respond_to_lostfound_claim() / withdraw_lostfound_claim() (0017) are the
-- only writers.


create policy lostfound_messages_select_participant
  on public.lostfound_messages
  for select
  to authenticated
  using (public.lostfound_is_claim_participant(claim_id));

create policy lostfound_messages_select_moderator
  on public.lostfound_messages
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. send_lostfound_message()
-- (0017) is the only writer -- see the file header for why this differs from
-- Sluglines-AI's direct insert policy.


-- -----------------------------------------------------------------------------
-- lostfound_items_board -- one row per item, with the derived pending-claim
-- count and the caller's own most recent claim state on it, if any.
--
-- security_invoker = true: the view carries no privilege of its own. Every row
-- and every join it can see is exactly what the policies above already allow
-- the calling member (or moderator) to read directly. No origin/dest stop
-- names are joined in -- see the file header for why those columns are absent
-- from this slice entirely.
-- -----------------------------------------------------------------------------
create view public.lostfound_items_board
  with (security_invoker = true) as
  select
    li.*,
    coalesce(c.pending_count, 0) as pending_claim_count,
    (
      select mc.state from public.lostfound_claims mc
       where mc.item_id = li.id and mc.claimant_id = auth.uid()
       order by mc.created_at desc
       limit 1
    ) as my_claim_state
  from public.lostfound_items li
  left join (
    select item_id, count(*) as pending_count
      from public.lostfound_claims
     where state = 'PENDING'
     group by item_id
  ) c on c.item_id = li.id;

revoke all on public.lostfound_items_board from anon;
revoke all on public.lostfound_items_board from authenticated;
grant select on public.lostfound_items_board to authenticated;

-- =============================================================================
-- 0021_waitlist_eta_noshow_schema.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- Option B slice 5 (issue #90, the last of the four Docs/DECISIONS.md D-71
-- named as still owed): a full-offer waitlist with FIFO auto-promotion, a
-- driver ETA note once a ride is CONFIRMED, and moderator-visible no-show
-- reports. No new AI tool: none of this is in src/lib/ai/tools.ts's catalog,
-- so this slice touches nothing under src/lib/ai/.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's
-- 0015_phase2_waitlist_eta_noshow_schema.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13). This file keeps
-- that migration's three tables and its waitlist_state enum, and changes what
-- this repo's schema actually requires it to change:
--
--   * every RLS policy and function calls caller_is_moderator() (0002), NOT
--     Sluglines-AI's is_moderator() -- that function does not exist in this
--     repo under that name. Same adaptation as every other Option B slice.
--   * the write functions (0022) call record_audit_event(), not
--     log_audit_event().
--   * offer_id/rider_id/member_id reference public.offers(id) /
--     public.members(id) directly: this repo's offers table has poster_id and
--     reservations has rider_id (0002), not Sluglines-AI's own column names,
--     and there is no stops dependency here at all -- this slice, unlike the
--     recurring-offers one, is a clean transplant of the reference shape onto
--     this repo's existing offers/reservations tables.
--   * "is the caller a participant on this offer" is answered by
--     caller_owns_offer() / caller_is_offer_participant() (0002's own
--     recursion-breaking helpers), not a fresh EXISTS subquery repeating what
--     those functions already do.
--   * EVERY WRITE IS A SECURITY DEFINER FUNCTION, INCLUDING LEAVING THE
--     WAITLIST. Sluglines-AI's 0015 gives offer_waitlist a plain
--     `offer_waitlist_delete_own` RLS policy for leaving ("no cross-cutting
--     effects... no function needed"). That would fail this repo's R4 ("no
--     insert/update/delete/all policy on any new table, for any role --
--     client writes must go through a SECURITY DEFINER function", enforced by
--     scripts/sql-lint.mjs and re-asserted per-table in
--     tests/sql-migration-harness.test.mjs) -- R4 has no carve-out for a
--     "plain" delete, the same conversion 0016/0019's headers describe for
--     their own tables. 0022 therefore ships offer_waitlist_leave(), a soft
--     cancel (state -> CANCELLED) rather than a hard delete, matching this
--     repo's audit-trail convention elsewhere (offer_waitlist rows are never
--     deleted, only transitioned, same as reservations).
--
-- WHAT DOES NOT SHIP: THE CONFIRMATION-TTL COLUMNS, notification_outbox
-- -----------------------------------------------------------------------------
-- Sluglines-AI's 0015 also adds must_confirm_by/ttl_prompt_sent_at to
-- reservations and a dedup_key column plus unique index to
-- notification_outbox, in service of its own send_confirmation_prompts()
-- sweep. Issue #90 scopes this slice to offer_waitlist, eta_updates,
-- no_show_reports and the join/leave/promote, post-ETA and report-no-show
-- functions -- a confirmation-TTL nudge is a different feature this slice was
-- not asked for, and notification_outbox does not exist anywhere in this
-- repo's migrations (no push/notification infrastructure has been
-- transplanted yet, the same gap 0017's header already recorded for lost &
-- found). Adding either here would be exactly the "schema no task asked for"
-- 0016/0018's headers already decline.
--
-- SECURITY POSTURE -- unchanged from every other file in this harness: RLS on,
-- no insert/update/delete policy for any role, revoked from anon, granted
-- SELECT to authenticated only. Every write goes through a SECURITY DEFINER
-- function in 0022.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enum.
-- -----------------------------------------------------------------------------
create type public.waitlist_state as enum ('ACTIVE', 'PROMOTED', 'CANCELLED');

comment on type public.waitlist_state is
  'ACTIVE -> PROMOTED (0022''s promote_from_waitlist, a seat opened up and this was the oldest '
  'entry); ACTIVE -> CANCELLED (offer_waitlist_leave, the rider''s own choice). No client ever '
  'writes this column directly.';


-- -----------------------------------------------------------------------------
-- offer_waitlist -- a rider joins only once an offer is full (state RESERVED,
-- 0002's M3), the "I want a seat if one opens up" queue, distinct from
-- reserving a seat directly.
-- -----------------------------------------------------------------------------
create table if not exists public.offer_waitlist (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers (id) on delete cascade,
  rider_id   uuid not null references public.members (id) on delete cascade,
  state      public.waitlist_state not null default 'ACTIVE',
  revision   integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live entry per rider per offer; promotion order is FIFO by created_at,
-- so this index also serves the promotion query.
create unique index if not exists idx_offer_waitlist_active_rider
  on public.offer_waitlist (offer_id, rider_id)
  where (state = 'ACTIVE');

create index if not exists idx_offer_waitlist_offer_fifo
  on public.offer_waitlist (offer_id, created_at)
  where (state = 'ACTIVE');

alter table public.offer_waitlist enable row level security;

revoke all on table public.offer_waitlist from anon;
revoke all on table public.offer_waitlist from authenticated;
grant select on table public.offer_waitlist to authenticated;

create policy offer_waitlist_select_own
  on public.offer_waitlist
  for select
  to authenticated
  using (rider_id = auth.uid());

-- Offer owner can see who is waiting -- useful demand signal, same posture as
-- reservations_select_participant's owner clause (0002).
create policy offer_waitlist_select_offer_owner
  on public.offer_waitlist
  for select
  to authenticated
  using (public.caller_owns_offer(offer_id));

create policy offer_waitlist_select_moderator
  on public.offer_waitlist
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. offer_waitlist_join() /
-- offer_waitlist_leave() / promote_from_waitlist() (0022) are the only writers.


-- -----------------------------------------------------------------------------
-- eta_updates -- the poster posts a short note once the ride is CONFIRMED or
-- later, visible to the same people who can see pickup details: the poster,
-- a moderator, and any confirmed participant.
-- -----------------------------------------------------------------------------
create table if not exists public.eta_updates (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers (id) on delete cascade,
  member_id  uuid not null references public.members (id),
  note       text not null check (char_length(btrim(note)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists idx_eta_updates_offer
  on public.eta_updates (offer_id, created_at desc);

alter table public.eta_updates enable row level security;

revoke all on table public.eta_updates from anon;
revoke all on table public.eta_updates from authenticated;
grant select on table public.eta_updates to authenticated;

create policy eta_updates_select_participant
  on public.eta_updates
  for select
  to authenticated
  using (
    public.caller_is_offer_participant(offer_id)
    or public.caller_is_moderator()
  );

-- No insert/update/delete policy exists, for any role. post_eta_update() (0022)
-- is the only writer.


-- -----------------------------------------------------------------------------
-- no_show_reports -- driver-reported, moderator-visible only. Per the phased
-- design's "no automatic penalties" principle: this is detection + logging for
-- human review, never an automatic penalty against the rider's account.
-- -----------------------------------------------------------------------------
create table if not exists public.no_show_reports (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references public.offers (id) on delete cascade,
  reservation_id  uuid not null references public.reservations (id),
  rider_id        uuid not null references public.members (id),
  reported_by     uuid not null references public.members (id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_no_show_reports_offer
  on public.no_show_reports (offer_id, created_at desc);

alter table public.no_show_reports enable row level security;

revoke all on table public.no_show_reports from anon;
revoke all on table public.no_show_reports from authenticated;
grant select on table public.no_show_reports to authenticated;

create policy no_show_reports_select_reporter
  on public.no_show_reports
  for select
  to authenticated
  using (reported_by = auth.uid());

create policy no_show_reports_select_moderator
  on public.no_show_reports
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. report_no_show() (0022)
-- is the only writer.

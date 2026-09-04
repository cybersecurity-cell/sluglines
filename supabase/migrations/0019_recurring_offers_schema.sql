-- =============================================================================
-- 0019_recurring_offers_schema.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- Option B slice 4 (Docs/DECISIONS.md D-90's queue, issue #90): the last of the
-- four Option B slices. Recurring ride templates -- "6:45-7:00am every weekday,
-- Horner Rd -> L'Enfant Plaza" -- that generate concrete offers rows on a
-- schedule via instantiate_recurring_offers() (0020). No new AI tool: recurring
-- offers are not in src/lib/ai/tools.ts's catalog, so this slice touches
-- nothing under src/lib/ai/.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0013_recurring_offers_schema.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13), and this is the
-- second file in the Option B sequence (after 0018's stops) where "adapted
-- from" means an architectural change, not a moderator-helper swap:
--
-- THE STOP -> LOCATION ADAPTATION
-- -----------------------------------------------------------------------------
-- Sluglines-AI's recurring_offer_templates carries origin_stop_id/dest_stop_id,
-- both `not null references stops(id)` -- because that repo's offers table is
-- itself stop-keyed (D-70 explains why: every Sluglines-AI offer references a
-- stop). **This repo's offers table has never worked that way.** 0002 gives it
-- origin_location_id/destination_location_id -> public.locations directly, and
-- 0018's stops table is a standalone lookup wired into nothing -- explicitly
-- NOT into offers (D-70, tests/transit-stops-schema.test.mjs asserts this).
-- So a template here names origin_location_id/destination_location_id, the
-- same columns offer_create() (0002) takes, not a stop pair. Templates
-- generate offers through offer_create()'s own validated column set, unchanged.
--
-- Everything else follows the same adaptations as every other Option B slice:
--   * every RLS policy and function calls caller_is_moderator() (0002), not
--     Sluglines-AI's is_moderator().
--   * the write functions (0020) call record_audit_event(), not
--     log_audit_event().
--   * Sluglines-AI's recurring_offer_templates_insert_own / _update_own and
--     recurring_offer_skips_insert_own / _delete_own RLS policies are dropped
--     entirely -- they would fail this repo's R4 ("no insert/update/delete
--     policy on any new table, for any role -- client writes must go through
--     a SECURITY DEFINER function"), the same conversion 0016's header
--     describes for lost & found. create_recurring_offer() / pause_ / resume_
--     / cancel_recurring_offer() / skip_recurring_offer_occurrence() (0020)
--     are the only writers to either table.
--
-- WHAT offers GAINS, AND WHY THIS FILE IS ALLOWED TO TOUCH IT
-- -----------------------------------------------------------------------------
-- Unlike 0018 (which states explicitly, and tests, that it must not touch
-- public.offers), this file adds two columns -- recurring_template_id,
-- occurrence_date -- plus a partial unique index on the pair. That is the one
-- schema change this slice cannot avoid: instantiate_recurring_offers() (0020)
-- must be able to prove "at most one generated offer per template per local
-- day" as a real database constraint, not an application-level promise, and
-- that constraint has nowhere to live but on offers itself. recurring_template_id
-- is `on delete set null` -- a deleted template must not cascade-delete the
-- rides it already generated; occurrence_date is the idempotency key
-- instantiate_recurring_offers() and the unique index both key on.
--
-- WHAT DOES NOT SHIP: A BOARD VIEW, AN UNSKIP FUNCTION
-- -----------------------------------------------------------------------------
-- Sluglines-AI's 0013 re-exposes its offers_board view with the two new
-- columns appended. This repo has no offers_board view anywhere in its
-- migrations to extend -- inventing one here, for a client surface issue #90
-- never asked this slice to build, would be exactly the "schema no task
-- asked for" 0016/0018 already decline. recurring_offer_templates itself is
-- readable directly (RLS below); a board view is a later slice's concern if
-- one is ever scoped.
--
-- Sluglines-AI's recurring_offer_skips carries a delete-own RLS policy, which
-- doubles as its "undo a skip" affordance. R4 forbids that policy shape, and
-- issue #90 scopes this slice to five named functions plus the sweep -- none
-- of them an unskip -- so no unskip function ships either. A member who
-- skipped a day in error is unaffected in practice: skip_recurring_offer_occurrence
-- only cancels an occurrence already generated, and a fresh weekday still
-- instantiates normally the next time its own days_of_week bit matches.
--
-- SECURITY POSTURE -- unchanged from every other file in this harness: RLS on,
-- no insert/update/delete policy for any role, revoked from anon, granted
-- SELECT to authenticated only. Every write goes through a SECURITY DEFINER
-- function in 0020.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enum.
-- -----------------------------------------------------------------------------
create type public.recurring_offer_state as enum ('ACTIVE', 'PAUSED', 'CANCELLED');

comment on type public.recurring_offer_state is
  'ACTIVE -> PAUSED (0020''s pause_recurring_offer); PAUSED -> ACTIVE (resume_recurring_offer); '
  'either -> CANCELLED (cancel_recurring_offer, final -- a cancelled series is never resumed). No '
  'client ever writes this column directly.';


-- -----------------------------------------------------------------------------
-- recurring_offer_templates
--
-- poster_role is text with the same CHECK offers.poster_role (0002) uses, not
-- a new enum -- a template generates an offer through offer_create_for_member()
-- (0020), which shares offer_create()'s own poster_role validation.
-- -----------------------------------------------------------------------------
create table if not exists public.recurring_offer_templates (
  id                       uuid primary key default gen_random_uuid(),
  member_id                uuid not null references public.members (id) on delete cascade,
  poster_role              text not null check (poster_role in ('driver', 'rider')),
  origin_location_id       uuid not null references public.locations (id),
  destination_location_id uuid not null references public.locations (id),
  days_of_week             integer[] not null,
  window_start_local       time not null,
  window_end_local         time not null,
  timezone                 text not null default 'America/New_York',
  seats_total              integer not null check (seats_total between 1 and 6),
  starts_on                date not null default current_date,
  ends_on                  date,
  state                    public.recurring_offer_state not null default 'ACTIVE',
  revision                 integer not null default 0 check (revision >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint recurring_offer_templates_window_ordered check (window_end_local > window_start_local),
  constraint recurring_offer_templates_locations_differ check (origin_location_id <> destination_location_id),
  constraint recurring_offer_templates_ends_after_starts check (ends_on is null or ends_on >= starts_on),
  constraint recurring_offer_templates_days_of_week_shape check (
    days_of_week <> '{}'::integer[]
    and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
  )
);

comment on column public.recurring_offer_templates.days_of_week is
  'Postgres extract(dow) convention: 0=Sunday .. 6=Saturday. instantiate_recurring_offers() (0020) '
  'compares this against extract(dow from <today in the template''s own timezone>).';

comment on column public.recurring_offer_templates.window_start_local is
  'Local clock time, not an instant -- "6:45-7:00am every weekday". instantiate_recurring_offers() '
  '(0020) converts (occurrence date + this time) at timezone into the timestamptz offer_create_for_member() '
  '(0020) expects.';

create index if not exists idx_recurring_offer_templates_active
  on public.recurring_offer_templates (state)
  where (state = 'ACTIVE');

alter table public.recurring_offer_templates enable row level security;

revoke all on table public.recurring_offer_templates from anon;
revoke all on table public.recurring_offer_templates from authenticated;
grant select on table public.recurring_offer_templates to authenticated;

create policy recurring_offer_templates_select_own
  on public.recurring_offer_templates
  for select
  to authenticated
  using (member_id = auth.uid());

create policy recurring_offer_templates_select_moderator
  on public.recurring_offer_templates
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. create_recurring_offer()
-- creates a template; pause_recurring_offer() / resume_recurring_offer() /
-- cancel_recurring_offer() are its only transitions -- all 0020.


-- -----------------------------------------------------------------------------
-- recurring_offer_skips -- one row per skipped occurrence ("I don't need my
-- Tuesday ride this week"). See the file header for why no unskip function
-- ships in this slice.
-- -----------------------------------------------------------------------------
create table if not exists public.recurring_offer_skips (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.recurring_offer_templates (id) on delete cascade,
  occurrence_date date not null,
  created_at      timestamptz not null default now(),
  unique (template_id, occurrence_date)
);

alter table public.recurring_offer_skips enable row level security;

revoke all on table public.recurring_offer_skips from anon;
revoke all on table public.recurring_offer_skips from authenticated;
grant select on table public.recurring_offer_skips to authenticated;

create policy recurring_offer_skips_select_own
  on public.recurring_offer_skips
  for select
  to authenticated
  using (
    template_id in (select id from public.recurring_offer_templates where member_id = auth.uid())
  );

create policy recurring_offer_skips_select_moderator
  on public.recurring_offer_skips
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role.
-- skip_recurring_offer_occurrence() (0020) is the only writer.


-- -----------------------------------------------------------------------------
-- offers -- two columns added. See the file header ("WHAT offers GAINS") for
-- why this migration, unlike 0018, is allowed to alter this table.
-- -----------------------------------------------------------------------------
alter table public.offers
  add column if not exists recurring_template_id uuid references public.recurring_offer_templates (id) on delete set null,
  add column if not exists occurrence_date date;

comment on column public.offers.recurring_template_id is
  'Set only by instantiate_recurring_offers() (0020), never by a client. on delete set null: a '
  'deleted template must not cascade-delete the concrete offers it already generated.';

comment on column public.offers.occurrence_date is
  'The local calendar date (in the template''s own timezone) this offer was generated for. Paired '
  'with recurring_template_id as the idempotency backstop -- see offers_recurring_occurrence_idx.';

-- The hard backstop against a double-post: instantiate_recurring_offers() (0020)
-- also guards this in application logic (an explicit existence check before
-- ever calling offer_create_for_member()), but this index is what actually
-- prevents it if two sweep runs were ever to race.
create unique index if not exists offers_recurring_occurrence_idx
  on public.offers (recurring_template_id, occurrence_date)
  where (recurring_template_id is not null);

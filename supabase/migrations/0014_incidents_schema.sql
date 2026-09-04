-- =============================================================================
-- 0014_incidents_schema.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- Option B slice 1 (Docs/DECISIONS.md D-65's deferral, closed here for issue
-- #90): the `incidents` schema `src/lib/ai/tools.ts`'s `incidents.get_active`
-- has been waiting on since the AI runtime transplant. Community incident
-- reports -- traffic, HOV closures, lot conditions -- with a TTL and a
-- confirmation count that promotes visibility.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0018_incident_reports_schema.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13). This file keeps that
-- migration's content -- the two tables, the state machine, the confirmation
-- count derived rather than stored -- and changes what this repo's schema
-- actually requires it to change:
--
--   * every RLS policy and function calls caller_is_moderator() (0002), NOT
--     is_moderator() -- that function does not exist in this repo under that
--     name.
--   * "same location" is members.location_id (0001/0006), the same predicate
--     0002's offers_visible_for_caller and audit_events_select_moderator
--     already use -- Sluglines-AI's corridor_id has no equivalent here.
--   * incidents.location_id carries a real foreign key to public.locations:
--     unlike 0002 (written before 0004 existed), the locations directory is
--     already in this repo's schema by the time this file is written, so there
--     is nothing to defer.
--   * the write functions (0015) call record_audit_event(), not
--     log_audit_event() -- this repo's audit writer, from 0001.
--
-- SECURITY POSTURE -- unchanged from every other file in this harness: RLS on,
-- no insert/update/delete policy for any role, revoked from anon, granted
-- SELECT to authenticated only. Every write goes through a SECURITY DEFINER
-- function in 0015.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enums.
-- -----------------------------------------------------------------------------
create type public.incident_type as enum (
  'accident', 'hov_closure', 'road_closure', 'police', 'weather', 'other'
);

create type public.incident_state as enum (
  'UNCONFIRMED', 'CONFIRMED', 'RESOLVED', 'CANCELLED', 'EXPIRED'
);

comment on type public.incident_state is
  'UNCONFIRMED -> CONFIRMED (0015''s confirm_incident, once enough other members confirm); '
  'either -> RESOLVED | CANCELLED (reporter or moderator, 0015); either -> EXPIRED (0015''s '
  'expire_stale_incidents sweep, TTL by type). No client ever writes this column directly.';


-- -----------------------------------------------------------------------------
-- incidents
--
-- confirmation_count is NOT a column here -- it is derived in incidents_board
-- below from incident_confirmations, the same "compute, don't store" choice
-- this repo already makes for offers_seats_within_total-adjacent counts.
-- -----------------------------------------------------------------------------
create table if not exists public.incidents (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.members (id) on delete cascade,
  location_id  uuid not null references public.locations (id),
  type         public.incident_type not null,
  description  text not null check (char_length(btrim(description)) between 1 and 500),
  state        public.incident_state not null default 'UNCONFIRMED',
  revision     integer not null default 0 check (revision >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  resolved_at  timestamptz,
  resolved_by  uuid references public.members (id)
);

comment on column public.incidents.expires_at is
  'Server-computed from type by report_incident() (0015) via incident_ttl_for_type() -- never '
  'client-supplied.';

create index if not exists idx_incidents_location_state
  on public.incidents (location_id, state, created_at desc);

alter table public.incidents enable row level security;

revoke all on table public.incidents from anon;
revoke all on table public.incidents from authenticated;
grant select on table public.incidents to authenticated;

-- Same broad-read posture as offers/presence: any member sees every incident
-- in their own home spot regardless of state -- the board (below) decides what
-- reads as "active" vs. history -- and a moderator sees every incident anywhere.
create policy incidents_select_same_location
  on public.incidents
  for select
  to authenticated
  using (
    location_id in (select location_id from public.members where id = auth.uid())
  );

create policy incidents_select_moderator
  on public.incidents
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. Inserts go through
-- report_incident(); transitions go through confirm_incident() /
-- resolve_incident() / cancel_incident() / expire_stale_incidents() -- all 0015.


-- -----------------------------------------------------------------------------
-- incident_confirmations -- "N confirmations promote visibility."
-- -----------------------------------------------------------------------------
create table if not exists public.incident_confirmations (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references public.incidents (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (incident_id, member_id)
);

alter table public.incident_confirmations enable row level security;

revoke all on table public.incident_confirmations from anon;
revoke all on table public.incident_confirmations from authenticated;
grant select on table public.incident_confirmations to authenticated;

-- Same-location visibility, not "own confirmations only": the count is what
-- drives promotion to CONFIRMED, so any member who can see the incident can
-- see who has corroborated it. incidents_board sums it; nothing here exposes
-- more than the roster of confirmers on a report the caller already sees.
create policy incident_confirmations_select_same_location
  on public.incident_confirmations
  for select
  to authenticated
  using (
    incident_id in (
      select id from public.incidents
       where location_id in (select location_id from public.members where id = auth.uid())
    )
  );

create policy incident_confirmations_select_moderator
  on public.incident_confirmations
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update/delete policy exists, for any role. confirm_incident() (0015)
-- is the only writer, and it also refuses a reporter confirming their own report.


-- -----------------------------------------------------------------------------
-- incidents_board -- one row per incident, with the derived confirmation count
-- and whether the caller has already confirmed it.
--
-- security_invoker = true: the view carries no privilege of its own. Every row
-- and every join it can see is exactly what the two policies above already
-- allow the calling member (or moderator) to read directly.
-- -----------------------------------------------------------------------------
create view public.incidents_board
  with (security_invoker = true) as
  select
    i.*,
    coalesce(c.confirmation_count, 0) as confirmation_count,
    exists (
      select 1 from public.incident_confirmations ic
       where ic.incident_id = i.id
         and ic.member_id = auth.uid()
    ) as confirmed_by_me
  from public.incidents i
  left join (
    select incident_id, count(*) as confirmation_count
      from public.incident_confirmations
     group by incident_id
  ) c on c.incident_id = i.id;

revoke all on public.incidents_board from anon;
revoke all on public.incidents_board from authenticated;
grant select on public.incidents_board to authenticated;

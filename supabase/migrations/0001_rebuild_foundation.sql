-- =============================================================================
-- 0001_rebuild_foundation.sql
--
-- APPLIED: no
-- TARGET:  none. This file has NOT been applied to any database, including
--          Supabase project bwpguotjzczmieeepczf. See supabase/migrations/README.md.
--
-- First migration of the rebuild decided in Docs/DECISIONS.md D-13: the core is
-- built here from Docs/2026-08-14-consolidated-architecture.md (rev. 5.3) rather
-- than transplanted from Sluglines-AI.
--
-- Scope, deliberately narrow -- the three tables rev. 5.3 specifies completely
-- enough to write without inventing anything:
--
--   members            rev. 5.3 sec.8 M2  (identity)
--   audit_events       rev. 5.3 sec.8 M7  (append-only moderation trail)
--   presence_checkins  rev. 5.3 sec.8 M4  (presence)
--
-- Explicitly NOT here, because rev. 5.3 assigns them to later phases and this
-- slice does not front-run them:
--
--   offers / reservations / offer_pickup_details   sec.8 M3, Phase 1
--   locations (the 43-spot directory)              sec.11 P1, 0026_*
--   product_events / manual_metrics / metrics_weekly  sec.8 M10, see D-22
--   get_public_spot_counts() and the other two
--     anonymous-callable aggregates                sec.8 M1, Phase 2, 0027_*
--
-- SECURITY POSTURE (rev. 5.3 sec.6, sec.12 constraints 2 and 6)
-- -----------------------------------------------------------------------------
-- Default deny. Every table below enables RLS and carries NO insert/update/
-- delete policy for any role. All client writes go through SECURITY DEFINER
-- functions, which are the only place a write decision is made.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Every function
-- below is therefore revoked from PUBLIC before anything is granted back --
-- otherwise the default-deny tables would be reachable through the functions
-- that bypass them. scripts/sql-lint.mjs enforces this (rule R9).
--
-- PII (rev. 5.3 sec.12 constraint 3): no phone numbers and no contact-detail
-- columns appear here. Supabase Auth is the only durable store of phone numbers
-- (rev. 5.3 sec.6 identity invariant); application tables hold opaque UUIDs.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- members  (rev. 5.3 sec.8 M2)
--
-- "members(id, display_name, role member|moderator, location_id)".
--
-- location_id intentionally carries NO foreign key yet: the locations table is
-- rev. 5.3 sec.11 P1's 43-spot directory seed and does not exist. The FK is added
-- by that migration rather than guessed here.
-- -----------------------------------------------------------------------------
create table if not exists public.members (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  role         text not null default 'member' check (role in ('member', 'moderator')),
  location_id  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.members.role is
  'rev. 5.3 sec.8 M2 moderator grant: no RLS policy permits any client write to this column. '
  'Changes happen only via migration or the operator SQL console, and must append an audit_events row.';

comment on column public.members.location_id is
  'Home spot. FK to the locations table is added by the P1 directory migration; that table does not exist yet.';

alter table public.members enable row level security;

revoke all on table public.members from anon;
revoke all on table public.members from authenticated;
grant select on table public.members to authenticated;

-- Read only, own row only. rev. 5.3 sec.8 M3: "All members are visible to each
-- other only through offers -- there is no member directory."
create policy members_select_self
  on public.members
  for select
  to authenticated
  using (auth.uid() = id);

-- No insert/update/delete policy exists, for any role, by design.
-- Row creation is handle_new_member() below; display_name changes are
-- set_display_name() below; role changes are operator-only.


-- -----------------------------------------------------------------------------
-- audit_events  (rev. 5.3 sec.8 M7)
--
-- "audit_events.actor_id carries the opaque member UUID with NO FK constraint;
--  on account deletion the member row and auth user are deleted and audit rows
--  are left untouched -- the orphan UUID resolves to nothing, which achieves
--  anonymization without ever updating an append-only table."
--
-- The absent FK below is that requirement, not an omission.
-- -----------------------------------------------------------------------------
create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on column public.audit_events.actor_id is
  'Opaque member UUID. Deliberately NOT a foreign key (rev. 5.3 sec.8 M7): account deletion must '
  'orphan this value rather than update an append-only table.';

comment on column public.audit_events.metadata is
  'Structured detail only. rev. 5.3 sec.12 constraint 3: no member free text and no identifiers beyond opaque UUIDs.';

alter table public.audit_events enable row level security;

revoke all on table public.audit_events from anon;
revoke all on table public.audit_events from authenticated;
grant select on table public.audit_events to authenticated;

create policy audit_events_select_moderator
  on public.audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.members m
       where m.id = auth.uid()
         and m.role = 'moderator'
    )
  );

create index if not exists idx_audit_events_created on public.audit_events (created_at desc);
create index if not exists idx_audit_events_entity on public.audit_events (entity_type, entity_id, created_at desc);

-- Append-only enforced at the table, not merely by the absence of a policy: the
-- SECURITY DEFINER writers below bypass RLS, so "no update policy" would not stop
-- a future function from rewriting history.
create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'audit_events is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

revoke all on function public.audit_events_append_only() from public;

drop trigger if exists audit_events_no_mutate on public.audit_events;
create trigger audit_events_no_mutate
  before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();


-- -----------------------------------------------------------------------------
-- presence_checkins  (rev. 5.3 sec.8 M4)
--
-- "presence_checkins (upsert one row per member, ~20-min read-time expiry).
--  Public read is the aggregate only (via M1's functions); raw rows are
--  RLS-protected -- the sec.6 label 'public AGGREGATE read' is normative, and no
--  anonymous policy on the table itself exists."
--
-- The aggregate reader is a Phase 2 function (0027_*) and is not in this file.
-- Until it exists there is no public read path at all, which is the safe order.
-- -----------------------------------------------------------------------------
create table if not exists public.presence_checkins (
  member_id     uuid primary key references public.members (id) on delete cascade,
  location_id   uuid not null,
  direction     text not null check (direction in ('morning', 'afternoon')),
  checked_in_at timestamptz not null default now(),
  expires_at    timestamptz not null
);

comment on table public.presence_checkins is
  'One row per member (PK is member_id, so upsert is the only insert shape). rev. 5.3 sec.8 M4.';

alter table public.presence_checkins enable row level security;

revoke all on table public.presence_checkins from anon;
revoke all on table public.presence_checkins from authenticated;
grant select on table public.presence_checkins to authenticated;

create policy presence_checkins_select_self
  on public.presence_checkins
  for select
  to authenticated
  using (auth.uid() = member_id);

create index if not exists idx_presence_checkins_location
  on public.presence_checkins (location_id, direction, expires_at desc);


-- =============================================================================
-- WRITE PATH -- SECURITY DEFINER functions
--
-- These are the only writers. Each one: pins search_path, requires auth.uid(),
-- validates its inputs, and is revoked from PUBLIC before being granted to
-- authenticated.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- record_audit_event -- internal only. Never granted to any client role; it is
-- callable solely from inside the other SECURITY DEFINER functions, where the
-- effective user is the function owner.
-- -----------------------------------------------------------------------------
create or replace function public.record_audit_event(
  p_actor_id    uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_audit_event(uuid, text, text, uuid, jsonb) from public;


-- -----------------------------------------------------------------------------
-- handle_new_member -- creates the members row for a new auth user.
--
-- Contrast with the legacy handle_new_user() in supabase/schema.sql, which
-- copies auth.users.email into profiles.email. That is the pattern rev. 5.3
-- sec.6 forbids: it duplicates an identity attribute out of Supabase Auth into an
-- application table. Nothing but the opaque UUID crosses over here.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.members (id, display_name)
  values (new.id, 'member-' || substr(new.id::text, 1, 8))
  on conflict (id) do nothing;

  perform public.record_audit_event(new.id, 'member.created', 'member', new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_member() from public;

drop trigger if exists on_auth_user_created_member on auth.users;
create trigger on_auth_user_created_member
  after insert on auth.users
  for each row execute function public.handle_new_member();


-- -----------------------------------------------------------------------------
-- set_display_name -- the only client-reachable write to members.
-- Note what it cannot touch: role and location_id.
-- -----------------------------------------------------------------------------
create or replace function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid := auth.uid();
  v_clean     text := btrim(coalesce(p_display_name, ''));
begin
  if v_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(v_clean) < 1 or char_length(v_clean) > 40 then
    raise exception 'display_name must be 1 to 40 characters' using errcode = '22023';
  end if;

  update public.members
     set display_name = v_clean,
         updated_at   = now()
   where id = v_member_id;

  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform public.record_audit_event(v_member_id, 'member.display_name_changed', 'member', v_member_id);
end;
$$;

revoke all on function public.set_display_name(text) from public;
grant execute on function public.set_display_name(text) to authenticated;


-- -----------------------------------------------------------------------------
-- presence_checkin -- upsert the caller's own presence row.
--
-- The caller cannot name the member: it is taken from auth.uid(). This is the
-- structural difference from the legacy riders/drivers tables, where a
-- client-supplied device_id was the identity and any client could overwrite or
-- delete any row (rev. 5.3 sec.14 risk 1).
-- -----------------------------------------------------------------------------
create or replace function public.presence_checkin(
  p_location_id uuid,
  p_direction   text,
  p_ttl_minutes integer default 20
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid := auth.uid();
  v_expires   timestamptz;
begin
  if v_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_location_id is null then
    raise exception 'location_id is required' using errcode = '22023';
  end if;

  if p_direction not in ('morning', 'afternoon') then
    raise exception 'direction must be morning or afternoon' using errcode = '22023';
  end if;

  if p_ttl_minutes is null or p_ttl_minutes < 1 or p_ttl_minutes > 60 then
    raise exception 'ttl_minutes must be between 1 and 60' using errcode = '22023';
  end if;

  v_expires := now() + make_interval(mins => p_ttl_minutes);

  insert into public.presence_checkins (member_id, location_id, direction, checked_in_at, expires_at)
  values (v_member_id, p_location_id, p_direction, now(), v_expires)
  on conflict (member_id) do update
     set location_id   = excluded.location_id,
         direction     = excluded.direction,
         checked_in_at = excluded.checked_in_at,
         expires_at    = excluded.expires_at;

  return v_expires;
end;
$$;

revoke all on function public.presence_checkin(uuid, text, integer) from public;
grant execute on function public.presence_checkin(uuid, text, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- presence_clear -- the caller withdraws their own presence row.
-- -----------------------------------------------------------------------------
create or replace function public.presence_clear()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid := auth.uid();
begin
  if v_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.presence_checkins
   where member_id = v_member_id;
end;
$$;

revoke all on function public.presence_clear() from public;
grant execute on function public.presence_clear() to authenticated;


-- -----------------------------------------------------------------------------
-- sweep_expired_presence -- the pg_cron sweep of rev. 5.3 sec.6. Not granted to any
-- client role; the scheduler runs it as owner. Scheduling itself is a database
-- operation, not a migration concern, and is not done here.
-- -----------------------------------------------------------------------------
create or replace function public.sweep_expired_presence()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.presence_checkins
   where expires_at <= now();

  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all on function public.sweep_expired_presence() from public;

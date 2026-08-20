-- Sluglines Phase 1: verified public information and private commuter accounts.
-- Existing real-time prototype data is preserved, while its anonymous mutation surface is retired.

create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null check (url ~ '^https://[^[:space:]]+$'),
  source_type text not null check (source_type in ('official', 'community', 'historical', 'operator')),
  publisher text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  corridor text not null check (corridor in ('I-95/I-395', 'I-66', 'Other')),
  direction text not null check (direction in ('inbound', 'outbound', 'both')),
  address text,
  municipality text,
  region text not null default 'Northern Virginia',
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  parking_details text,
  transit_details text,
  operating_notes text,
  status text not null default 'review_needed'
    check (status in ('active', 'inactive', 'seasonal', 'review_needed')),
  verification_status text not null default 'review_needed'
    check (verification_status in ('verified', 'community_reported', 'review_needed', 'historical')),
  last_verified_at timestamptz,
  source_id uuid references public.sources(id) on delete set null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not published or source_id is not null)
);

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  municipality text,
  description text,
  verification_status text not null default 'review_needed'
    check (verification_status in ('verified', 'community_reported', 'review_needed', 'historical')),
  last_verified_at timestamptz,
  source_id uuid references public.sources(id) on delete set null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not published or source_id is not null)
);

create table if not exists public.location_routes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  peak_start time,
  peak_end time,
  schedule_notes text,
  pickup_notes text,
  dropoff_notes text,
  verification_status text not null default 'review_needed'
    check (verification_status in ('verified', 'community_reported', 'review_needed', 'historical')),
  last_verified_at timestamptz,
  source_id uuid references public.sources(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, destination_id, direction),
  check (not active or source_id is not null)
);

create table if not exists public.advisories (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  title text not null check (char_length(title) between 3 and 140),
  message text not null check (char_length(message) between 3 and 2000),
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  status text not null default 'draft' check (status in ('draft', 'published', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  verification_status text not null default 'review_needed'
    check (verification_status in ('verified', 'community_reported', 'review_needed', 'historical')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (status <> 'published' or source_id is not null)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  role text not null default 'commuter' check (role in ('commuter', 'steward', 'editor', 'admin')),
  home_location_id uuid references public.locations(id) on delete set null,
  preferred_destination_id uuid references public.destinations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'commuter';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists home_location_id uuid references public.locations(id) on delete set null;
alter table public.profiles add column if not exists preferred_destination_id uuid references public.destinations(id) on delete set null;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles alter column role drop default;
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles profiles
set email = coalesce(users.email, profiles.id::text || '@invalid.local')
from auth.users users
where users.id = profiles.id and profiles.email is null;
update public.profiles set email = id::text || '@invalid.local' where email is null;
alter table public.profiles alter column email set not null;
create unique index if not exists profiles_email_key on public.profiles (email);
update public.profiles set role = 'commuter' where role = 'user';
alter table public.profiles
  add constraint profiles_role_check check (role in ('commuter', 'steward', 'editor', 'admin'));
alter table public.profiles alter column role set default 'commuter';

create table if not exists public.saved_locations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table if not exists public.commute_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  home_location_id uuid references public.locations(id) on delete set null,
  destination_id uuid references public.destinations(id) on delete set null,
  preferred_direction text check (preferred_direction in ('inbound', 'outbound', 'both')),
  email_advisories boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.correction_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  category text not null check (category in ('location', 'route', 'schedule', 'parking', 'transit', 'safety', 'other')),
  summary text not null check (char_length(summary) between 10 and 160),
  details text not null check (char_length(details) between 20 and 3000),
  source_url text check (source_url is null or source_url ~ '^https://'),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_public_lookup_idx
  on public.locations (published, corridor, direction, status, name);
create index if not exists location_routes_lookup_idx
  on public.location_routes (location_id, destination_id, direction, active);
create index if not exists advisories_active_idx
  on public.advisories (status, severity, starts_at, ends_at);
create index if not exists correction_reports_owner_idx
  on public.correction_reports (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sources', 'locations', 'destinations', 'location_routes', 'advisories',
    'profiles', 'commute_preferences', 'correction_reports'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('editor', 'admin')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.id and new.role is distinct from old.role then
    raise exception 'Users cannot change their own role';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
  before update of role on public.profiles
  for each row execute function public.prevent_profile_role_change();

revoke all on function public.prevent_profile_role_change() from public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@invalid.local'),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;

alter table public.sources enable row level security;
alter table public.locations enable row level security;
alter table public.destinations enable row level security;
alter table public.location_routes enable row level security;
alter table public.advisories enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_locations enable row level security;
alter table public.commute_preferences enable row level security;
alter table public.correction_reports enable row level security;

create policy "Public read sources" on public.sources for select
  using (is_active);
create policy "Public read locations" on public.locations for select
  using (published and exists (select 1 from public.sources where sources.id = locations.source_id and sources.is_active));
create policy "Public read destinations" on public.destinations for select
  using (published and exists (select 1 from public.sources where sources.id = destinations.source_id and sources.is_active));
create policy "Public read location_routes" on public.location_routes for select
  using (
    active
    and exists (select 1 from public.sources where sources.id = location_routes.source_id and sources.is_active)
    and exists (
      select 1 from public.locations
      where locations.id = location_routes.location_id
        and locations.published
    )
    and exists (
      select 1 from public.destinations
      where destinations.id = location_routes.destination_id
        and destinations.published
    )
  );
create policy "Public read advisories" on public.advisories for select
  using (
    status = 'published'
    and exists (select 1 from public.sources where sources.id = advisories.source_id and sources.is_active)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

create policy "Staff manage sources" on public.sources for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage locations" on public.locations for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage destinations" on public.destinations for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage location_routes" on public.location_routes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff manage advisories" on public.advisories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Owners read profiles" on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_staff());
create policy "Owners update profiles" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Owners read saved_locations" on public.saved_locations for select to authenticated
  using (auth.uid() = user_id);
create policy "Owners insert saved_locations" on public.saved_locations for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Owners delete saved_locations" on public.saved_locations for delete to authenticated
  using (auth.uid() = user_id);

create policy "Owners read commute_preferences" on public.commute_preferences for select to authenticated
  using (auth.uid() = user_id);
create policy "Owners insert commute_preferences" on public.commute_preferences for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Owners update commute_preferences" on public.commute_preferences for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Owners read correction_reports" on public.correction_reports for select to authenticated
  using (auth.uid() = user_id or public.is_staff());
create policy "Owners insert correction_reports" on public.correction_reports for insert to authenticated
  with check (auth.uid() = user_id and status = 'submitted' and reviewed_by is null and reviewed_at is null);
create policy "Staff update correction_reports" on public.correction_reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

revoke all on public.sources, public.locations, public.destinations, public.location_routes,
  public.advisories, public.profiles, public.saved_locations, public.commute_preferences,
  public.correction_reports from anon, authenticated;

grant select (id, name, url, source_type, is_active, created_at, updated_at) on public.sources to anon, authenticated;
grant select on public.locations, public.destinations, public.location_routes, public.advisories to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, home_location_id, preferred_destination_id) on public.profiles to authenticated;
grant select, insert, delete on public.saved_locations to authenticated;
grant select, insert, update on public.commute_preferences to authenticated;
grant select, insert, update on public.correction_reports to authenticated;
grant insert, update, delete on public.sources, public.locations, public.destinations, public.location_routes, public.advisories
  to authenticated;

-- Retire write access from the superseded real-time prototype without deleting its data.
do $$
begin
  if to_regclass('public.spot_status') is not null then
    execute 'drop policy if exists "Anyone can update spot counts" on public.spot_status';
    execute 'revoke insert, update, delete on public.spot_status from anon, authenticated';
  end if;
  if to_regprocedure('public.reset_daily_counts()') is not null then
    execute 'revoke all on function public.reset_daily_counts() from public';
  end if;
end;
$$;

-- =================================================
-- Sluglines Database Schema (Supabase / PostgreSQL)
-- Run this in your Supabase SQL editor
-- =================================================

-- Enable real-time for the spot_status table
-- (Done in Supabase Dashboard > Database > Replication)

-- -----------------------------------------------
-- SPOT STATUS TABLE (Real-time driver/rider board)
-- -----------------------------------------------
create table if not exists spot_status (
  id              uuid primary key default gen_random_uuid(),
  spot_name       text not null,
  slug            text unique,
  location        text not null,
  destination     text not null,
  highway         text not null default 'I-395',
  latitude        double precision,
  longitude       double precision,
  drivers_waiting integer not null default 0 check (drivers_waiting >= 0),
  riders_waiting  integer not null default 0 check (riders_waiting >= 0),
  last_updated    timestamptz not null default now(),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table spot_status add column if not exists slug text unique;
alter table spot_status add column if not exists latitude double precision;
alter table spot_status add column if not exists longitude double precision;

-- -----------------------------------------------
-- SEED: Initial Spots
-- -----------------------------------------------
insert into spot_status (spot_name, slug, location, destination, highway, latitude, longitude, is_active) values
  ('Pentagon City',       'pentagon-city',       'S Hayes St & Army Navy Dr, Arlington, VA',  'Pentagon / Downtown DC',  'I-395', 38.8621, -77.0590, true),
  ('Horner Road',         'horner-road',         'Horner Rd & US-1, Woodbridge, VA',          'Pentagon / Crystal City', 'I-95',  38.6586, -77.2807, true),
  ('Potomac Mills',       'potomac-mills',       'Smoketown Rd & Clover Rd, Woodbridge, VA',  'Pentagon / Crystal City', 'I-95',  38.6407, -77.2939, true),
  ('Rippon Landing',      'rippon-landing',      'Rippon Blvd, Woodbridge, VA',               'Pentagon / Crystal City', 'I-95',  38.6109, -77.2894, true),
  ('Backlick Road',       'backlick-road',       'Backlick Rd & Rolling Rd, Springfield, VA', 'Pentagon / Rosslyn',      'I-395', 38.7826, -77.1850, true),
  ('Rosslyn',             'rosslyn',             'N Moore St, Arlington, VA',                 'Downtown DC',             'I-66',  38.8979, -77.0718, true),
  ('Crystal City',        'crystal-city',        '23rd St S, Arlington, VA',                  'Downtown DC / Pentagon',  'I-395', 38.8524, -77.0496, true),
  ('Stafford Courthouse', 'stafford-courthouse', 'Courthouse Rd, Stafford, VA',               'Pentagon / Crystal City', 'I-95',  38.4221, -77.4083, true)
on conflict (slug) do update set
  spot_name = excluded.spot_name,
  location = excluded.location,
  destination = excluded.destination,
  highway = excluded.highway,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_active = excluded.is_active;

-- -----------------------------------------------
-- PROFILES TABLE (User accounts)
-- -----------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  display_name  text,
  role          text not null default 'user' check (role in ('user','admin')),
  home_spot     text,
  work_dest     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- -----------------------------------------------
-- COMMUTE LOG TABLE (track arrivals/departures)
-- -----------------------------------------------
create table if not exists commute_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  spot_id     uuid references spot_status(id) on delete cascade,
  entry_type  text not null check (entry_type in ('driver_arrived','rider_arrived','driver_left','rider_left')),
  logged_at   timestamptz not null default now()
);

-- -----------------------------------------------
-- LIVE CHECK-INS (anonymous, auto-stale after 2h)
-- -----------------------------------------------
create table if not exists riders (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references spot_status(id) on delete cascade,
  device_id     text not null,
  destination   text not null check (destination in ('Pentagon','Crystal City','L''Enfant Plaza','DC')),
  checked_in_at timestamptz not null default now(),
  unique (device_id)
);

create table if not exists drivers (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references spot_status(id) on delete cascade,
  device_id       text not null,
  destination     text not null check (destination in ('Pentagon','Crystal City','L''Enfant Plaza','DC')),
  seats_available integer not null default 2 check (seats_available between 1 and 3),
  checked_in_at   timestamptz not null default now(),
  unique (device_id)
);

-- -----------------------------------------------
-- COMMUNITY ALERTS
-- -----------------------------------------------
create table if not exists alerts (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references spot_status(id) on delete cascade,
  message     text not null,
  type        text not null default 'info' check (type in ('info','warning','urgent')),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------
-- DAILY RESET FUNCTION (run via cron at 6 AM ET)
-- -----------------------------------------------
create or replace function reset_daily_counts()
returns void as $$
begin
  update spot_status set
    drivers_waiting = 0,
    riders_waiting = 0,
    last_updated = now();
end;
$$ language plpgsql;

-- -----------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------
alter table spot_status enable row level security;
alter table profiles enable row level security;
alter table commute_log enable row level security;
alter table riders enable row level security;
alter table drivers enable row level security;
alter table alerts enable row level security;

-- Public read for spot_status
create policy "Public read spot_status"
  on spot_status for select using (true);

-- Anyone can increment counts
create policy "Anyone can update spot counts"
  on spot_status for update using (true) with check (true);

-- Public live check-in reads and anonymous upserts
create policy "Public read riders"
  on riders for select using (true);

create policy "Public insert riders"
  on riders for insert with check (true);

create policy "Public update own rider check-in"
  on riders for update using (true) with check (true);

create policy "Public delete rider check-ins"
  on riders for delete using (true);

create policy "Public read drivers"
  on drivers for select using (true);

create policy "Public insert drivers"
  on drivers for insert with check (true);

create policy "Public update own driver check-in"
  on drivers for update using (true) with check (true);

create policy "Public delete driver check-ins"
  on drivers for delete using (true);

-- Public read for community alerts
create policy "Public read alerts"
  on alerts for select using (true);

-- Users can read own profile
create policy "Users read own profile"
  on profiles for select using (auth.uid() = id);

-- Users can update own profile
create policy "Users update own profile"
  on profiles for update using (auth.uid() = id);

-- -----------------------------------------------
-- INDEXES
-- -----------------------------------------------
create index if not exists idx_spot_status_active on spot_status(is_active);
create index if not exists idx_spot_status_slug on spot_status(slug);
create index if not exists idx_commute_log_spot on commute_log(spot_id, logged_at desc);
create index if not exists idx_commute_log_user on commute_log(user_id, logged_at desc);
create index if not exists idx_riders_location_checked_in on riders(location_id, checked_in_at desc);
create index if not exists idx_drivers_location_checked_in on drivers(location_id, checked_in_at desc);
create index if not exists idx_alerts_location_created on alerts(location_id, created_at desc);

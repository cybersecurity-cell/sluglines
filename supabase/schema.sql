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
  location        text not null,
  destination     text not null,
  highway         text not null default 'I-395',
  drivers_waiting integer not null default 0 check (drivers_waiting >= 0),
  riders_waiting  integer not null default 0 check (riders_waiting >= 0),
  last_updated    timestamptz not null default now(),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------
-- SEED: Initial Spots
-- -----------------------------------------------
insert into spot_status (spot_name, location, destination, highway, is_active) values
  ('Pentagon City',         'S Hayes St & Army Navy Dr, Arlington, VA',    'Pentagon / Downtown DC',    'I-395', true),
  ('Horner Road',           'Horner Rd & US-1, Woodbridge, VA',            'Pentagon / Crystal City',   'I-95',  true),
  ('Potomac Mills',         'Smoketown Rd & Clover Rd, Woodbridge, VA',    'Pentagon / Crystal City',   'I-95',  true),
  ('Rippon Landing',        'Rippon Blvd, Woodbridge, VA',                 'Pentagon / Crystal City',   'I-95',  true),
  ('Backlick Road',         'Backlick Rd & Rolling Rd, Springfield, VA',   'Pentagon / Rosslyn',        'I-395', true),
  ('Rosslyn',               'N Moore St, Arlington, VA',                   'Downtown DC',               'I-66',  true),
  ('Crystal City',          '23rd St S, Arlington, VA',                    'Downtown DC / Pentagon',    'I-395', true),
  ('Stafford Courthouse',   'Courthouse Rd, Stafford, VA',                 'Pentagon / Crystal City',   'I-95',  true);

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

-- Public read for spot_status
create policy "Public read spot_status"
  on spot_status for select using (true);

-- Anyone can increment counts
create policy "Anyone can update spot counts"
  on spot_status for update using (true) with check (true);

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
create index if not exists idx_commute_log_spot on commute_log(spot_id, logged_at desc);
create index if not exists idx_commute_log_user on commute_log(user_id, logged_at desc);

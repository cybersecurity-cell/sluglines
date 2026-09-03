-- =============================================================================
-- 0012_durable_rate_limit.sql
--
-- APPLIED: preview
-- TARGET:  Supabase preview branch phase-3-4-staging (project ref xqonrogwwytkmqfinszp), applied 2026-09-02
--
-- Closes issue #55. `src/lib/api/rate-limit.ts` is a fixed-window limiter
-- backed by a module-level Map -- single-process, best-effort, resets on every
-- redeploy, and does not coordinate across serverless instances. Its own
-- header says so, and Docs/DECISIONS.md D-45 records the same gap for the
-- OTP routes specifically: "the per-number cap D-8 actually specifies is
-- still enforced only by rate-limit.ts, which is in-memory, single-process
-- and resets on redeploy... Defence in depth, not the durable control."
--
-- This migration gives that control a durable, cross-instance backing store,
-- per the maintainer's decision recorded alongside this file: a Supabase
-- Postgres table, not a new vendor and not Redis/KV.
--
-- DESIGN
-- -----------------------------------------------------------------------------
-- One SECURITY DEFINER function, rate_limit_hit(), does the whole job in one
-- round trip: it computes the caller's fixed window, atomically increments the
-- counter for that window IF AND ONLY IF the window is not already at its cap,
-- and reports whether the call is allowed and how long until the window
-- resets. Folding "read count, compare, increment" into a single
-- `insert ... on conflict do update ... where ... returning` statement is what
-- makes it race-free under concurrent callers hitting the same key from
-- different serverless instances -- exactly the case a Map cannot handle.
--
-- NO PII IN THIS TABLE
-- -----------------------------------------------------------------------------
-- The two callers this migration exists for key their buckets on a phone
-- number and an IP address. rev. 5.3 sec.6 and sec.12 constraint 3 -- enforced
-- everywhere else in this schema -- forbid either from landing in an
-- application table; Supabase Auth is the sole durable store of phone numbers.
-- `bucket_key` is therefore never the raw value: the adapter
-- (`src/lib/api/durable-rate-limit.ts`) hashes it (SHA-256 hex) before this
-- function ever sees it. This table cannot answer "which phone number is
-- this", only "has this opaque bucket been hit".
--
-- WHO MAY CALL rate_limit_hit(), AND WHY NOT anon OR authenticated
-- -----------------------------------------------------------------------------
-- The function takes p_max and p_window_ms as caller-supplied arguments -- that
-- is what makes one function serve all four OTP limiters (D-8's four different
-- caps) instead of four near-identical copies. That is also exactly why it
-- must never be reachable by anon or authenticated: a client that could call
-- it directly could pass p_max := 2000000000 to defeat its own limit, or spend
-- someone else's bucket key to lock them out (a denial-of-service on a real
-- phone number's OTP verification, via the very table meant to stop abuse).
-- The send-otp/verify-otp routes run before any session exists, so
-- "authenticated" is not even reachable for them regardless.
--
-- The only caller is the Next.js server, over a service-role client
-- (`src/lib/supabase/service.ts`) constructed with SUPABASE_SERVICE_ROLE_KEY,
-- which never reaches a browser. `grant execute ... to service_role` below is
-- the first grant of this shape in this repo (every earlier SECURITY DEFINER
-- writer is either `authenticated`-only or, like sweep_expired_presence(),
-- granted to nobody and run by a superuser scheduler) -- tests/
-- sql-migration-harness.test.mjs's per-function grant loop is widened by
-- exactly one literal exception for this function, in the same commit, for
-- the same reason ANON_CALLABLE_FUNCTIONS exists in scripts/sql-lint.mjs: a
-- widened grant is a reviewed decision, not a habit.
--
-- scripts/sql-lint.mjs's R10 does not need widening: it only forbids grants to
-- anon/public, and service_role is neither.
--
-- PURGING EXPIRED WINDOWS
-- -----------------------------------------------------------------------------
-- Two mechanisms, so the table stays bounded with or without a scheduler:
--   1. rate_limit_hit() itself sweeps with low probability (~1 in 200 calls) on
--      every call, deleting windows more than two days old -- comfortably past
--      the longest window any caller uses today (D-8's 24h per-IP cap). This
--      means retention works in every environment, including ones with no
--      pg_cron (local, preview, CI).
--   2. rate_limit_sweep(), for pg_cron to call on a schedule, exactly like
--      sweep_expired_presence() (0001) and offer_expire_sweep() (0002):
--      granted to nobody, revoked from PUBLIC, run by the scheduler as owner.
--      Wiring the schedule itself is a database operation, not a migration
--      concern (0008's own header makes the same call for the other two
--      sweeps) and is not done here.
-- =============================================================================

create table if not exists public.rate_limit_windows (
  bucket_key   text not null,
  window_start timestamptz not null,
  hit_count    integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (bucket_key, window_start)
);

comment on table public.rate_limit_windows is
  'Durable, cross-instance fixed-window rate-limit counters (issue #55). bucket_key is an opaque '
  'SHA-256 hex digest computed by the caller -- never a raw phone number or IP address -- so this '
  'table carries no PII even though its counters gate phone-number- and IP-scoped limits.';

alter table public.rate_limit_windows enable row level security;

revoke all on table public.rate_limit_windows from anon;
revoke all on table public.rate_limit_windows from authenticated;

-- No policy of any kind, for any role: this table has no client-reachable read
-- or write path. Its only writer is rate_limit_hit() below, and that function
-- is callable only by the server's service-role client, never by anon or
-- authenticated, and never through a table grant.

create index if not exists idx_rate_limit_windows_window_start
  on public.rate_limit_windows (window_start);


-- -----------------------------------------------------------------------------
-- rate_limit_hit -- atomic check-and-increment for one fixed window.
--
-- p_now is a parameter, never `now()` read internally, for the same reason
-- src/lib/api/rate-limit.ts takes `now` as an argument: a caller (test or
-- otherwise) can drive the window without a real clock. The adapter always
-- passes the current time explicitly; the default exists only so the function
-- is callable from the SQL console without one.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_hit(
  p_key       text,
  p_window_ms bigint,
  p_max       integer,
  p_now       timestamptz default now()
)
returns table (allowed boolean, retry_after_ms bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start_ms bigint;
  v_window_start     timestamptz;
  v_window_end       timestamptz;
  v_count            integer;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'p_key is required' using errcode = '22023';
  end if;

  if p_window_ms is null or p_window_ms <= 0 then
    raise exception 'p_window_ms must be positive' using errcode = '22023';
  end if;

  if p_max is null or p_max <= 0 then
    raise exception 'p_max must be positive' using errcode = '22023';
  end if;

  v_window_start_ms := (floor(extract(epoch from p_now) * 1000)::bigint / p_window_ms) * p_window_ms;
  v_window_start := to_timestamp(v_window_start_ms / 1000.0);
  v_window_end := v_window_start + make_interval(secs => p_window_ms / 1000.0);

  -- The whole race-freedom argument lives in this one statement: the row is
  -- created at count 1 on first hit, or incremented only if the existing count
  -- is still under the cap. If the cap is already reached, the WHERE clause on
  -- the DO UPDATE fails, the row is left untouched, and RETURNING yields no
  -- row for it -- which is how "already at max" is distinguished from
  -- "just hit max", entirely inside Postgres's own conflict handling rather
  -- than a read-then-write pair a concurrent caller could interleave with.
  insert into public.rate_limit_windows as w (bucket_key, window_start, hit_count, updated_at)
  values (p_key, v_window_start, 1, p_now)
  on conflict (bucket_key, window_start) do update
     set hit_count  = w.hit_count + 1,
         updated_at = p_now
   where w.hit_count < p_max
  returning w.hit_count into v_count;

  -- Opportunistic retention: no scheduler required. See the file header.
  if random() < 0.005 then
    delete from public.rate_limit_windows where window_start < p_now - interval '2 days';
  end if;

  if v_count is null then
    select w.hit_count into v_count
      from public.rate_limit_windows w
     where w.bucket_key = p_key
       and w.window_start = v_window_start;

    return query select false, greatest(0, ceil(extract(epoch from (v_window_end - p_now)) * 1000))::bigint;
  else
    return query select true, 0::bigint;
  end if;
end;
$$;

revoke all on function public.rate_limit_hit(text, bigint, integer, timestamptz) from public;
grant execute on function public.rate_limit_hit(text, bigint, integer, timestamptz) to service_role;


-- -----------------------------------------------------------------------------
-- rate_limit_sweep -- pg_cron target, exactly the sweep_expired_presence()
-- shape (0001): granted to nobody, run by the scheduler as owner. Not
-- scheduled here -- see the file header and supabase/operations/README.md.
-- -----------------------------------------------------------------------------
create or replace function public.rate_limit_sweep()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_windows
   where window_start < now() - interval '2 days';

  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all on function public.rate_limit_sweep() from public;

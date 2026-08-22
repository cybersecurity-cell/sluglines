-- =============================================================================
-- 0008_scheduled_job_health.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied
--          2026-08-22 alongside supabase/operations/2026-08-22-schedule-sweeps.sql.
--          See Docs/DECISIONS.md D-46 and supabase/migrations/README.md.
--
-- Gives `/api/health` a way to answer "when did the sweeps last run?" with a
-- measurement instead of the hardcoded `null` it has carried since #21.
-- Closes the third item of issue #46.
--
-- WHY THE SCHEDULE ITSELF IS NOT IN THIS FILE
-- -----------------------------------------------------------------------------
-- `0001` and `0002` each say, of their sweep function, that scheduling "is a
-- database operation, not a migration concern, and is not done here". That still
-- holds, and for a sharper reason than when it was written: this sequence is
-- rehearsed on an ephemeral preview branch before production. A migration
-- carrying `create extension pg_cron` + `cron.schedule` would (a) fail wherever
-- the extension is unavailable and (b) schedule production's sweeps onto every
-- preview branch that ever runs the sequence. So the extension and the two
-- schedules live in `supabase/operations/2026-08-22-schedule-sweeps.sql`, which
-- is applied by hand to one named database, and this file ships only the part
-- that is schema: a reader.
--
-- WHY IT RETURNS ZERO ROWS RATHER THAN FAILING WHEN pg_cron IS ABSENT
-- -----------------------------------------------------------------------------
-- Preview branches and local checkouts have no scheduler. A reader that throws
-- there would make `/api/health` report the *database* as down on an environment
-- whose database is fine. Zero rows is the honest answer to "which sweeps are
-- scheduled" on a machine where none are, and the caller renders that as
-- `supported: false` with a reason -- the same discipline as an `unavailable`
-- count never rendering as zero (D-33).
--
-- WHY anon MAY CALL IT
-- -----------------------------------------------------------------------------
-- `/api/health` is watched by an unauthenticated external monitor (#21), and it
-- reaches the database through the anon key like any visitor. This is the third
-- function in the repo granted to `anon`, and the grant is deliberate: the row
-- shape is a job name, a cron expression, a timestamp and a status string. It
-- carries no member data and cannot -- there is no column that could hold one.
-- What it does reveal is that two sweeps exist and how often they run, which is
-- already stated in this repository and in the issue tracker.
-- `scripts/sql-lint.mjs` R10 keeps this a reviewed decision rather than a habit:
-- the function is named in `ANON_CALLABLE_FUNCTIONS` in the same commit.
-- -----------------------------------------------------------------------------

create or replace function public.get_scheduled_job_health()
returns table (
  job_name    text,
  schedule    text,
  active      boolean,
  last_run_at timestamptz,
  last_status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- `to_regclass` returns null rather than raising for a missing relation, and
  -- resolves nothing from a schema that does not exist, so this is the cheap
  -- total test for "is pg_cron installed here".
  if to_regclass('cron.job') is null then
    return;
  end if;

  -- Dynamic, so the body is parsed only on the branch where `cron.job` exists.
  -- A static reference would be planned on first call in *every* environment and
  -- would fail the ones the guard above is there to protect.
  return query execute $q$
    select
      j.jobname::text,
      j.schedule::text,
      j.active,
      d.last_run_at,
      d.last_status
    from cron.job j
    left join lateral (
      select r.start_time as last_run_at,
             r.status::text as last_status
        from cron.job_run_details r
       where r.jobid = j.jobid
       order by r.start_time desc
       limit 1
    ) d on true
    where j.jobname in ('sweep_expired_presence', 'offer_expire_sweep')
    order by j.jobname
  $q$;
end;
$fn$;

revoke all on function public.get_scheduled_job_health() from public;
grant execute on function public.get_scheduled_job_health() to anon, authenticated;

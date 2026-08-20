-- Enforce correction-report abuse controls at the database boundary so direct
-- authenticated Supabase clients cannot bypass the Next.js Server Action.

create or replace function public.enforce_correction_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize submissions per user so concurrent check-and-insert requests
  -- cannot each observe the same pre-insert count.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if (
    select count(*)
    from public.correction_reports
    where user_id = new.user_id
      and created_at >= now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Correction report rate limit exceeded'
      using errcode = 'P0001';
  end if;

  -- Server-owned workflow fields cannot be backdated or pre-reviewed by a
  -- direct client, including callers that bypass PostgREST column grants.
  new.created_at = now();
  new.updated_at = now();
  new.status = 'submitted';
  new.reviewed_by = null;
  new.reviewed_at = null;
  return new;
end;
$$;

revoke all on function public.enforce_correction_report_rate_limit() from public;

drop trigger if exists enforce_correction_report_rate_limit
  on public.correction_reports;
create trigger enforce_correction_report_rate_limit
  before insert on public.correction_reports
  for each row execute function public.enforce_correction_report_rate_limit();

-- Callers may supply report content and ownership only. Timestamps, status,
-- and review metadata remain server-controlled.
revoke insert on public.correction_reports from authenticated;
grant insert (user_id, location_id, category, summary, details, source_url)
  on public.correction_reports to authenticated;

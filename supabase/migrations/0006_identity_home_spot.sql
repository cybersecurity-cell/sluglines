-- =============================================================================
-- 0006_identity_home_spot.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied
--          2026-08-22 under the project owner's authorisation of 2026-08-21.
--          Rehearsed first on preview branch phase-3-4-staging (xqonrogwwytkmqfinszp).
--          See Docs/DECISIONS.md D-41 and supabase/migrations/README.md.
--
-- rev. 5.3 sec.8 M2 "Identity": the one write `0001_rebuild_foundation.sql`
-- deferred when it created `members.location_id` with no writer --
-- `set_display_name(text)` was the only client-reachable write to the table.
-- This file adds the other: the onboarding home-spot picker's write path.
--
-- WHY THIS WAITS ON 0004
-- -----------------------------------------------------------------------------
-- `location_id` has no FK until `0004_spot_locations_directory.sql` adds one
-- (0001's own comment says so), and the validation below reads `is_active` off
-- `public.locations`. Neither the FK nor that read means anything until 0004
-- has run. Same ordering note 0005 already carries for the same table.
--
-- rev. 5.3 sec.8 M3: "the onboarding home-spot picker offers only *active*
-- locations; inactive directory spots ... cannot be selected as home." The
-- function enforces that server-side rather than trusting the client to only
-- ever submit an id it was shown -- the UI filtering and this check are the
-- same rule, checked twice, which is the point of a SECURITY DEFINER writer.
--
-- SECURITY POSTURE -- unchanged from every other writer in this harness
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER, search_path pinned (R8), actor taken from auth.uid() (never
-- client-supplied), revoked from PUBLIC before anything is granted back (R9),
-- granted to authenticated only (R10 -- this is not one of the two named M1
-- exceptions).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- set_home_spot -- the caller's own onboarding/home-spot write.
--
-- Deliberately narrow: it validates the target row exists and is active, and
-- writes exactly one column. It does not touch display_name or role, the same
-- way set_display_name does not touch location_id -- one writer per concern,
-- so no future edit to one accidentally widens the other.
-- -----------------------------------------------------------------------------
create or replace function public.set_home_spot(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid := auth.uid();
  v_active    boolean;
begin
  if v_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_location_id is null then
    raise exception 'location_id is required' using errcode = '22023';
  end if;

  select l.is_active into v_active
    from public.locations l
   where l.id = p_location_id;

  if v_active is null then
    raise exception 'location not found' using errcode = 'P0002';
  end if;

  if not v_active then
    raise exception 'location is not active' using errcode = '22023';
  end if;

  update public.members
     set location_id = p_location_id,
         updated_at  = now()
   where id = v_member_id;

  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform public.record_audit_event(v_member_id, 'member.home_spot_changed', 'member', v_member_id);
end;
$$;

revoke all on function public.set_home_spot(uuid) from public;
grant execute on function public.set_home_spot(uuid) to authenticated;

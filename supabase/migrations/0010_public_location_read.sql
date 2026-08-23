-- =============================================================================
-- 0010_public_location_read.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied
--          2026-08-23 under the project owner's explicit authorisation of the same
--          day, through apply_migration -- recorded in
--          supabase_migrations.schema_migrations as 20260823114757. 0009 was
--          applied immediately before it; see the hazard note below, which was
--          honoured.
--          Verified after applying: get_public_location('bobs-old-keene-mill-rd')
--          returns 1 row with a 683-character description, an inactive spot
--          returns 0 rows, the lookup is case-insensitive,
--          has_function_privilege('anon', ...) is true, and
--          has_table_privilege('anon','public.locations','select') is still FALSE.
--
-- Anonymous read for a single spot row, issue #72.
--
-- WHY A FUNCTION AND NOT `grant select ... to anon`
-- -----------------------------------------------------------------------------
-- The ask was a table grant. It cannot be one. `locations` has RLS on and its
-- only read policy, `locations_select_active` in 0004, is `to authenticated`, so
-- a bare `grant select on public.locations to anon` returns zero rows -- the
-- grant passes, RLS refuses every row, and the caller sees an empty result
-- rather than an error. Admitting `anon` in a policy instead is refused by
-- sql-lint R5, which forbids any policy naming `anon` or `public`.
--
-- So this follows the mechanism 0005 established for the M1 aggregates: a
-- `security definer` function on sql-lint's reviewed ANON_CALLABLE_FUNCTIONS
-- allowlist. `anon` still touches no table directly, which is the posture R4/R7
-- exist to hold.
--
-- WHAT IT EXPOSES, AND WHAT IT DELIBERATELY DOES NOT
-- -----------------------------------------------------------------------------
-- Exactly the columns `LOCATION_COLUMNS` already names in
-- src/lib/domain/public-location.ts -- the same record the committed directory
-- renders for anonymous visitors today. It adds no column, and `id`,
-- `created_at` and `updated_at` are not returned.
--
-- `where is_active` mirrors `locations_select_active` exactly, so this exposes
-- no row an authenticated caller could not already read. Inactive spots keep
-- resolving from the committed directory, which is what happens for every
-- caller today. That is a smaller change than making the function total, and it
-- keeps one predicate rather than two that must be kept in step.
--
-- ORDER WITH 0009 -- READ THIS BEFORE APPLYING
-- -----------------------------------------------------------------------------
-- `getPublicLocation` is database-first. Today the database branch never wins
-- for anonymous visitors (that is #72), so every public spot page renders from
-- the committed directory -- including the content D-59 rewrote from the legacy
-- pages, which is live now.
--
-- Applying THIS migration makes the table answer. If 0009 has not been applied
-- first, the table still holds 0004's paraphrases, and applying 0010 alone would
-- REGRESS every spot page to the shorter pre-D-59 text -- silently, with no
-- error and no failing test. Apply 0009 first, or apply both together.
-- =============================================================================

create or replace function public.get_public_location(p_slug text)
returns table (
  slug          text,
  route_slug    text,
  name          text,
  corridor      text,
  direction     text,
  county        text,
  destination   text,
  description   text,
  latitude      numeric,
  longitude     numeric,
  is_active     boolean,
  peak_hours    text,
  parking       text,
  lines_from    text[],
  lines_to      text[],
  community_url text,
  notes         text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    l.slug,
    l.route_slug,
    l.name,
    l.corridor,
    l.direction,
    l.county,
    l.destination,
    l.description,
    l.latitude,
    l.longitude,
    l.is_active,
    l.peak_hours,
    l.parking,
    l.lines_from,
    l.lines_to,
    l.community_url,
    l.notes
  from public.locations as l
  where l.slug = lower(btrim(p_slug))
    and l.is_active;
$$;

comment on function public.get_public_location(text) is
  'Public read for one active spot. Mirrors locations_select_active; exposes no '
  'column beyond LOCATION_COLUMNS. Issue #72, Docs/DECISIONS.md D-60.';

revoke all on function public.get_public_location(text) from public;
grant execute on function public.get_public_location(text) to anon, authenticated;

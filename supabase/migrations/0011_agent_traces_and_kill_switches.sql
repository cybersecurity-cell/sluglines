-- =============================================================================
-- 0011_agent_traces_and_kill_switches.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- The AI runtime transplant (Docs/DECISIONS.md D-13's consolidation follow-on,
-- recorded as D-65): the agent trace log, the per-tool kill switches, and the
-- #56 spend-cap counters that back src/lib/ai/**.
--
-- ADAPTED FROM, NOT COPIED FROM, Sluglines-AI's 0024_agent_traces_and_kill_switches.sql
-- -----------------------------------------------------------------------------
-- Sluglines-AI is reference/documentation only (D-5, D-13). This file keeps that
-- migration's *content* -- the trace log, the tool-call audit, the kill-switch
-- table, ai_skill_enabled() -- and changes what this repo's schema actually
-- requires it to change:
--
--   * agent_traces.member_id references members(id) -- this repo's identity
--     table (Sluglines-AI's schema differs in ways that do not matter here).
--   * every RLS policy calls caller_is_moderator() (0002), NOT is_moderator() --
--     that function does not exist in this repo under that name.
--   * the channel enum is named ai_channel, not agent_channel.
--   * ai_kill_switches has NO update policy. Sluglines-AI's
--     ai_kill_switches_update_moderator policy is a direct `for update`
--     policy on the table, which is legal there but fails this repo's R4
--     ("no insert/update/delete/all policy on any new table, for any role --
--     writes are SECURITY DEFINER functions only", enforced by
--     scripts/sql-lint.mjs and re-asserted table-by-table in
--     tests/sql-migration-harness.test.mjs). Toggling a switch here is
--     ai_set_kill_switch() below: SECURITY DEFINER, checks caller_is_moderator()
--     itself, and is the only write path to the table.
--   * the kill-switch seed keys are FIXED (see "THE #3 FIX" below) -- Sluglines-AI's
--     seed used hyphenated skill names (skills.ride.explain-match) that never
--     matched its own gate's `skills.${toolName}` lookup (toolName uses dots and
--     underscores), and it seeded switches for tools its tools.ts never defined
--     while omitting five of the seven it did. That bug is issue #3.
--   * two counters are new: ai_member_turn_count_today() and
--     ai_global_turn_count_today(), for issue #56 (see below). Sluglines-AI's
--     0024 has no spend-cap machinery at all.
--   * one column is new: agent_traces.stop_details_category, for issue #13.
--   * two columns are new: agent_traces.capacity_denied and .cost_capped, and
--     one more: agent_traces.estimated_cost_usd -- all three for issue #56.
--
-- SCOPE (Docs/DECISIONS.md D-65, "Option A"; amended by D-68, D-69 and D-70,
-- "Option B" slices 1, 2 and 3)
-- -----------------------------------------------------------------------------
-- src/lib/ai/tools.ts ships eight tool definitions. At D-65 three of them --
-- incidents.get_active, lostfound.search, transit.explain_alternatives --
-- read tables that did not exist anywhere in this repo's migrations, so
-- tools.ts marked each `implemented: false` and the gate denied them on that
-- ground before a kill-switch lookup was ever reached. All three have since
-- shipped: D-68 (issue #90) ships the `incidents` schema (0014/0015) and flips
-- the first live; D-69 (same issue) ships the `lostfound` schema (0016/0017)
-- and flips the second; D-70 (same issue) ships `stops` (0018) and flips the
-- third and last. This file therefore seeds a switch for exactly the eight
-- tools that are both `implemented: true` and tier R0/R1 -- i.e. every tool
-- CALLABLE_TOOLS in tools.ts actually advertises to the model -- plus
-- `global`. Seeding a switch for a tool the gate can never reach for a
-- different reason first would be a row nothing reads;
-- tests/ai-agent-runtime.test.mjs asserts the seed and the catalog agree on
-- this set exactly, in both directions.
--
-- This file is `APPLIED: preview` (see the header above); the incidents/
-- lostfound/transit seed rows were folded in before any database applied it, so
-- 0014/0015, is not the supabase/migrations/README.md "never edit an applied
-- migration" case. That rule protects a file that is a record of what a real
-- database ran; this one is not that yet.
--
-- THE #3 FIX
-- -----------------------------------------------------------------------------
-- callThroughGate() (src/lib/ai/tool-gate.ts) looks up
-- `ai_kill_switches.key = 'skills.' || toolName`, and toolName is always one of
-- the dot-and-underscore names in tools.ts (`presence.get_counts`,
-- `ride.list_offers`, ...). Every key below is `'skills.' || <that exact name>`,
-- character for character. A moderator disabling `skills.ride.explain_match`
-- therefore disables `ride.explain_match` and nothing else -- which is the
-- property Sluglines-AI's seed never had.
--
-- SECURITY POSTURE -- unchanged from every prior file in this directory.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enums.
-- -----------------------------------------------------------------------------
create type public.ai_channel as enum ('web_text', 'web_voice');

comment on type public.ai_channel is
  'web_voice is declared for forward compatibility with the Sluglines-AI reference design; '
  'this repo has no voice UI yet and every trace today is web_text.';

-- Risk tiers, unchanged in name and meaning from the architecture doc: R0/R1 are
-- the only tiers any tool in this file's phase may be `implemented: true` for
-- (src/lib/ai/tool-gate.ts's MAX_TIER_THIS_PHASE). R2/R3 exist in the enum so the
-- gate can refuse them by tier rather than by "unknown tool".
create type public.tool_risk_tier as enum ('R0', 'R1', 'R2', 'R3');

create type public.gate_decision as enum ('ALLOW', 'DENY');


-- -----------------------------------------------------------------------------
-- agent_traces -- one row per assistant turn.
-- -----------------------------------------------------------------------------
create table public.agent_traces (
  id                    uuid primary key default gen_random_uuid(),
  member_id             uuid not null references public.members (id) on delete cascade,
  channel               public.ai_channel not null,
  skill                 text not null,
  prompt_version        text not null,
  model_class           text not null,
  model                 text not null,
  effort                text not null,
  user_message          text not null,
  agent_message         text,
  stop_reason           text,
  -- issue #13: the policy category of a `refusal` stop, read from
  -- response.stop_details.category. Null for every other stop_reason.
  stop_details_category text,
  input_tokens          integer,
  output_tokens         integer,
  -- issue #56: computed from token usage against src/lib/ai/cost.ts's rate
  -- table. Null when the turn never reached a model call (killed, or
  -- capacity_denied).
  estimated_cost_usd    numeric(10, 4),
  -- issue #56: true when the per-member or global daily turn cap (checked
  -- before any model call, via the two functions below) was already exceeded.
  -- No model_class/model/tokens/cost are meaningful on a capacity_denied row.
  capacity_denied        boolean not null default false,
  -- issue #56: true when the running per-turn cost crossed
  -- src/lib/ai/cost.ts's PER_TURN_COST_CEILING_USD mid-loop and the agent
  -- stopped taking further steps rather than let the turn keep spending.
  cost_capped            boolean not null default false,
  latency_ms            integer,
  error                  text,
  created_at             timestamptz not null default now(),
  constraint agent_traces_capacity_denied_has_no_spend
    check (not capacity_denied or (model_class = 'none' and estimated_cost_usd is null))
);

comment on column public.agent_traces.user_message is
  'Truncated by the runtime (src/lib/ai/agent.ts) before insert. Free text from the member -- rev. '
  '5.3 sec.12 constraint 3 permits member free text only in the fields sec.8 defines; this is a chat '
  'turn the member typed themselves, not a field on another table.';

create index agent_traces_member_created_idx on public.agent_traces (member_id, created_at desc);
create index agent_traces_created_idx on public.agent_traces (created_at desc);

alter table public.agent_traces enable row level security;

revoke all on table public.agent_traces from anon;
revoke all on table public.agent_traces from authenticated;
grant select on table public.agent_traces to authenticated;

create policy agent_traces_select_own
  on public.agent_traces
  for select
  to authenticated
  using (member_id = auth.uid());

create policy agent_traces_select_moderator
  on public.agent_traces
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update policy exists, for any role, by design (R4). Every trace is
-- written by the server-side runtime through the service-role client
-- (src/lib/supabase/service-role.ts), which bypasses RLS entirely -- a member
-- can never forge or suppress their own audit trail.


-- -----------------------------------------------------------------------------
-- agent_tool_calls -- one row per gate decision (ALLOW or DENY), every time.
-- -----------------------------------------------------------------------------
create table public.agent_tool_calls (
  id              uuid primary key default gen_random_uuid(),
  trace_id        uuid not null references public.agent_traces (id) on delete cascade,
  tool_name       text not null,
  risk_tier       public.tool_risk_tier not null,
  arguments       jsonb not null,
  decision        public.gate_decision not null,
  deny_reason     text,
  result_summary  text,
  latency_ms      integer,
  created_at      timestamptz not null default now(),
  -- A denial must always say why; an allow never carries a denial reason.
  constraint agent_tool_calls_deny_reason_matches_decision
    check ((decision = 'DENY') = (deny_reason is not null))
);

create index agent_tool_calls_trace_idx on public.agent_tool_calls (trace_id, created_at);

alter table public.agent_tool_calls enable row level security;

revoke all on table public.agent_tool_calls from anon;
revoke all on table public.agent_tool_calls from authenticated;
grant select on table public.agent_tool_calls to authenticated;

create policy agent_tool_calls_select_own
  on public.agent_tool_calls
  for select
  to authenticated
  using (
    trace_id in (select id from public.agent_traces where member_id = auth.uid())
  );

create policy agent_tool_calls_select_moderator
  on public.agent_tool_calls
  for select
  to authenticated
  using (public.caller_is_moderator());

-- No insert/update policy, for any role. Written only by the service-role
-- client, from inside src/lib/ai/tool-gate.ts's callThroughGate() -- see issue
-- #8 below for what happens when that write itself fails.


-- -----------------------------------------------------------------------------
-- ai_kill_switches -- 'global' plus one row per callable tool.
--
-- Read by every authenticated member's own session (the gate evaluates these on
-- the request path, from inside the member's own turn), written only through
-- ai_set_kill_switch() below.
-- -----------------------------------------------------------------------------
create table public.ai_kill_switches (
  key         text primary key,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.members (id)
);

alter table public.ai_kill_switches enable row level security;

revoke all on table public.ai_kill_switches from anon;
revoke all on table public.ai_kill_switches from authenticated;
grant select on table public.ai_kill_switches to authenticated;

-- Not `using (true)` -- R6 forbids the literal unconditional predicate, on the
-- same grounds the legacy schema's anonymous write policies are quarantined
-- for (Docs/DECISIONS.md D-24). `to authenticated` already excludes every
-- anonymous caller; `auth.uid() is not null` states the real predicate this
-- policy relies on -- a live authenticated session -- rather than writing
-- `true` and letting the `to authenticated` clause carry the whole meaning
-- silently. It is broad by design (every member reads every switch; there is
-- no per-member scoping to have), not broad by omission.
create policy ai_kill_switches_select_authenticated
  on public.ai_kill_switches
  for select
  to authenticated
  using (auth.uid() is not null);

-- No insert/update/delete policy, for any role (R4). ai_set_kill_switch() below
-- is the only writer.


-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ai_skill_enabled -- single round trip for the gate's pre-flight check.
-- Returns false if either the global switch or this skill's switch is off. A
-- missing skill row is treated as disabled (fail closed), not as an implicit
-- allow -- collapsing "global off" and "this skill has no row" into one boolean
-- previously made a per-tool switch inert once the global switch covered for it
-- (the defect tool-gate.test.ts in Sluglines-AI was written to catch); this
-- function is unchanged from that fix.
-- -----------------------------------------------------------------------------
create or replace function public.ai_skill_enabled(p_skill_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce((select enabled from public.ai_kill_switches where key = 'global'), false)
     and coalesce((select enabled from public.ai_kill_switches where key = p_skill_key), false);
$fn$;

revoke all on function public.ai_skill_enabled(text) from public;
grant execute on function public.ai_skill_enabled(text) to authenticated;


-- -----------------------------------------------------------------------------
-- ai_set_kill_switch -- the only write path to ai_kill_switches.
--
-- Moderator-only, checked here rather than by an RLS update policy, because an
-- update policy on a new table is exactly what R4 forbids in this repo (see the
-- file header). Records an audit_events row so a switch flip is traceable the
-- same way every other moderator action is (rev. 5.3 sec.8 M7).
-- -----------------------------------------------------------------------------
create or replace function public.ai_set_kill_switch(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.caller_is_moderator() then
    raise exception 'only a moderator may change an AI kill switch' using errcode = '42501';
  end if;

  update public.ai_kill_switches
     set enabled    = p_enabled,
         updated_at = now(),
         updated_by = v_actor
   where key = p_key;

  if not found then
    raise exception 'unknown kill switch key %', p_key using errcode = 'P0002';
  end if;

  perform public.record_audit_event(
    v_actor, 'ai.kill_switch_changed', 'ai_kill_switch', null,
    jsonb_build_object('key', p_key, 'enabled', p_enabled)
  );
end;
$fn$;

revoke all on function public.ai_set_kill_switch(text, boolean) from public;
grant execute on function public.ai_set_kill_switch(text, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- issue #56 -- daily turn counters.
--
-- src/lib/ai/agent.ts checks both, before any model call, against the pilot
-- defaults recorded in Docs/costs.md and Docs/DECISIONS.md D-65
-- (40 turns/member/day, 2000 turns/day globally). SQL rather than an
-- application-side count so every app instance reads the same number --
-- "atomic" here means "one source of truth", not a transactional guarantee
-- against the check-then-insert race between this read and the next trace
-- insert; closing that race is out of this slice's scope and is noted in the
-- PR rather than silently assumed away.
--
-- Neither takes a member argument: like caller_is_moderator() and its siblings
-- in 0002, each reads auth.uid() itself, so a member can only ever ask about
-- their own count -- a p_member_id parameter would turn the per-member counter
-- into a cross-member usage oracle. The global counter carries no member
-- dimension at all, so it has nothing to scope.
--
-- Both exclude capacity_denied rows: a denied turn spent no model tokens, and
-- counting it would let a stream of already-denied requests push the *global*
-- counter past the cap by attempted volume alone, denying every other member
-- for a reason unconnected to actual spend.
--
-- "Day" is the database's own UTC day (date_trunc('day', now()) with Postgres'
-- default UTC session timezone on Supabase), not the caller's local day. Stated
-- because a per-member cap that silently resets at a different moment than a
-- member's midnight is a support question waiting to happen, not a bug in this
-- function.
-- -----------------------------------------------------------------------------
create or replace function public.ai_member_turn_count_today()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select count(*)
    from public.agent_traces
   where member_id = auth.uid()
     and capacity_denied = false
     and created_at >= date_trunc('day', now());
$fn$;

revoke all on function public.ai_member_turn_count_today() from public;
grant execute on function public.ai_member_turn_count_today() to authenticated;

create or replace function public.ai_global_turn_count_today()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select count(*)
    from public.agent_traces
   where capacity_denied = false
     and created_at >= date_trunc('day', now());
$fn$;

revoke all on function public.ai_global_turn_count_today() from public;
grant execute on function public.ai_global_turn_count_today() to authenticated;


-- =============================================================================
-- SEED -- 'global' plus exactly the seven tools tools.ts marks `implemented:
-- true` at tier R0/R1 (CALLABLE_TOOLS). See the file header, "THE #3 FIX", for
-- why every key is `'skills.' || <exact tool name>` and nothing else.
--
-- tests/ai-agent-runtime.test.mjs parses this VALUES list and requires it to
-- equal `['global', ...CALLABLE_TOOLS.map(t => 'skills.' + t.name)]` exactly, in
-- both directions -- a seeded key with no matching tool is caught, and a
-- callable tool with no seeded key is caught.
-- =============================================================================
insert into public.ai_kill_switches (key, enabled) values
  ('global', true),
  ('skills.presence.get_counts', true),
  ('skills.ride.list_offers', true),
  ('skills.ride.get_offer', true),
  ('skills.ride.explain_match', true),
  ('skills.incidents.get_active', true),
  ('skills.lostfound.search', true),
  ('skills.transit.explain_alternatives', true),
  ('skills.community.draft_response', true)
on conflict (key) do nothing;

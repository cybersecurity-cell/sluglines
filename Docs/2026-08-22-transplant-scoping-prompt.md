# Scoping prompt — the `Sluglines-AI` → `sluglines` transplant

**Date:** 2026-08-22
**Status:** Not started. This document is the brief, not the plan.

The 2026-08-20 ADR (`Docs/2026-08-20-adr-sluglines-is-the-host-repo.md`) decides that
`Sluglines-AI`'s `apps/web/**` flattens into `sluglines/src/**` — a code move with no history
replay, which the ADR calls a **transplant**. It has not happened.

Everything below is written to be pasted into a fresh session that has none of this context. It
front-loads the two facts that a plain reading of the ADR gets wrong, because both were discovered
after the ADR was written and both change the cost.

Related: `Docs/DECISIONS.md` D-34 (schema ancestry reversed), D-50 (there are two Supabase
projects), D-57 (why #3 was fixed outside the transplant), and issue #43.

---

## The prompt

```text
Scope (do not implement) the transplant of cybersecurity-cell/Sluglines-AI into
cybersecurity-cell/sluglines. Deliverable is a written plan, not code.

## Read these first, in full, before proposing anything

In the `sluglines` repo:
- `Docs/2026-08-20-adr-sluglines-is-the-host-repo.md` — the governing decision.
  Read the Notes section at the end; it is load-bearing.
- `Docs/DECISIONS.md` — especially D-13, D-34, D-50, D-54, D-57.
- `supabase/migrations/README.md` — the migration conventions and the APPLIED ledger.
- `scripts/sql-lint.mjs` — rules R1–R11 that any new migration must satisfy.

Verify current state yourself rather than trusting this prompt; things move.

## Two facts that contradict a plain reading of the ADR

1. The ADR says take Sluglines-AI's 24 migrations as the schema ancestry.
   **D-34 reversed that.** `sluglines`' own lineage `0001`–`0008` is the schema, and
   it is applied to production. The AI repo's 26 migrations do NOT come across.
   Its code depends on tables from its own schema (`ai_kill_switches`,
   `agent_traces`, `agent_tool_calls`, `offers_visible`, …) which must be
   re-expressed as new migrations on `sluglines`' lineage, satisfying R1–R11
   (writes are SECURITY DEFINER functions only; no direct client write policies;
   `ANON_CALLABLE_FUNCTIONS` in sql-lint is a reviewed allowlist).
   **This is the largest and least visible piece of work. Scope it first.**

2. The ADR's Context says there is one Supabase project holding no data.
   **False — see D-50.** There are two:
   - `bwpguotjzczmieeepczf` — sluglines production, `0001`–`0008` applied, **0 member rows**
   - `kejglwcmzudpehddqkhh` — sluglines-AI, in a DIFFERENT org (`xcpawiqzzjvuzhmzuooo`).
     Not returned by `list_projects`/`list_organizations`, but reachable and writable
     by ref. 26 tables, 69 locations, 3 member rows. `0025`/`0026` applied 2026-08-22.
   The ADR's "effectively free today" cost argument was written against the false
   premise. Re-derive the cost yourself.

## What moves

`Sluglines-AI/apps/web/` → `sluglines/src/` under a route group. Not a monorepo,
not a workspace package, no git history replay.

- 79 `.ts`/`.tsx` files, ~6,200 lines
- `app/`: api, assistant, board, history, leaderboard, login, lostfound, moderator,
  onboarding, verify
- `lib/`: ai (agent, tool-gate, tools, model-router), domain, supabase, phone.ts, push.ts
- 11 RLS test files under `apps/web/tests/rls/`

## Known complications to scope

- **Route collisions.** `login`, `verify`, `onboarding`, `lostfound` exist in BOTH
  repos. `sluglines` has its own phone-OTP identity path (`src/lib/api/send-otp-route.ts`,
  `src/app/api/auth/**`). Per route, decide which implementation survives and why.
- **Framework gap.** sluglines is Next 14.2.35 / React 18.3 / Tailwind 3.
  Sluglines-AI is Next 16.2.10 / React 19.2.4 / Tailwind 4. The ADR says this cannot
  be done incrementally file-by-file. Is the upgrade a separate prior phase?
- **Deferred phase.** `tests/domain-boundaries.test.mjs` defers the `lib/ai` boundary
  rule "until lib/ai exists". This transplant creates it. Decide what the rule becomes.
- **The AI repo's RLS suite runs against the live `kejglwcmzudpehddqkhh` project**
  (see its `vitest.config.ts`). Retiring that project breaks that repo's CI, and a
  `beforeAll` in `tests/rls/tool-gate.test.ts` writes seed rows into it. Sequence the
  retirement against the transplant.
- **Carry across, don't lose:** Sluglines-AI PR #1 fixes issues #3, #8, #9, #13
  (inert kill switches, unchecked audit writes, orphaned traces, discarded
  stop_details). It is green and unmerged. The ADR says the kill-switch fix should
  have happened *as part of* the transplant — see D-57 for why it didn't.
- **Also collapses:** the `sluglines-ai` Vercel project
  (`prj_cFMKLGo3cVNzolzyjH0oYv6eFFYy`) alongside `sluglines`
  (`prj_Uvmtv5fVBVg9tw5CJUyMSD4UHmGS`), same team. This is what unblocks issue #43.

## Constraints

- **Scope only. Write no application code, apply no migrations, push nothing.**
- Do not modify either database.
- `sluglines` has an open PR #54 (green) — read it for what changed recently, and
  do not conflict with it.

## Produce

1. Phase breakdown with a dependency order, and what "done" means for each phase.
2. The schema re-expression plan: which AI-repo tables must exist in `sluglines`'
   lineage, as which new migration ordinals, and which need SECURITY DEFINER
   functions to satisfy R4/R7.
3. Per-route resolution for the four collisions.
4. Decisions needed from the owner before work starts, each stated as a question
   with options and a recommendation.
5. Risks, with the ones that are cheap now and expensive after the pilot called out.
6. A rough size estimate per phase.
```

---

## Notes for whoever runs it

**Expect the estimate to be dominated by item 1, not by the file move.** Moving 79 files is
mechanical. Re-expressing the AI schema onto a lineage with a strict default-deny posture — every
client write behind a SECURITY DEFINER function, every anon-callable function individually
allowlisted — is design work with a security review attached.

**Re-verification is not boilerplate.** Several claims in this repository's own documents were found
false on 2026-08-22: the "exactly one Supabase project" claim in the ADR (D-50), the schema-ancestry
decision the ADR records (D-34), and a reachability claim in D-50 itself, corrected the same day. The
prompt tells the session to check rather than trust, and it should.

**The timing argument still favours doing it.** `bwpguotjzczmieeepczf` holds zero member rows, so
there is no cutover window and no backfill. The ADR's reasoning — that this is a code move now and a
data migration later — holds for the production project even though its "one empty project" premise
did not.

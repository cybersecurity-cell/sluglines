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
- **There is no UI shell to bring across.** `Sluglines-AI`'s `apps/web/app/layout.tsx`
  is still create-next-app — `title: "Create Next App"`, no nav, no footer — and there
  is no `middleware.ts`; every page carries its own ad-hoc chrome. `sluglines` has a
  full chromed site: `Navbar` plus footer in `src/app/layout.tsx`, nav driven by
  `PRIMARY_NAV`/`ABOUT_NAV` in `src/lib/site-content.ts`. None of that is inherited
  automatically. The two are also different products: every AI page except `/login`
  and `/verify` redirects an unauthenticated visitor to `/login` or `/onboarding`,
  whereas `sluglines` is a public content site.
- **`/api/agent` is uncapped, and every model class is Opus.** The route validates the
  message (<= 2000 chars) and checks membership; there is no rate limit, no per-member
  turn cap and no daily cap. One turn is up to `MAX_STEPS = 6` model calls. There is
  exactly one model call site in application code (`lib/ai/agent.ts`), reachable only
  through `POST /api/agent`. `lib/ai/model-router.ts` routes every class — `filter`
  included — to `claude-opus-5`. `Docs/costs.md` records C1 (<= $0.10/turn, a hard
  gate) and C2 (<= $50/month, an alarm) as PENDING with no instrument; `agent_traces`
  already records `input_tokens`/`output_tokens`, so C1's data source arrives with the
  transplant and nothing reads it.

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
   with options and a recommendation. At minimum it must include: does the AI module
   ship authed-only, or with an anonymous free tier ("a couple of free chats, then
   sign in")? Note for that one that `sluglines` has no separate sign-up step —
   `src/lib/api/send-otp-route.ts` is a single phone-OTP flow, so the gate is "verify
   a number", not "log in vs register" — and that an anonymous tier is not a config
   change. It needs a second mode through the tool gate, whose `IntentEnvelope`
   requires a non-optional `memberId`/`locationId` and whose stated invariant is that
   a tool call can only ever act as the authenticated caller; a schema change to
   `agent_traces`, whose `member_id` is `not null references members(id)` under an
   RLS policy of `member_id = auth.uid()`; and a durable meter, which does not exist
   — `src/lib/api/rate-limit.ts` is in-memory and resets on redeploy (see #53), and
   CAPTCHA has no provider credential (#24). Recommendation: authed-only, with a
   zero-LLM scripted demo on the public page as the funnel instead.
5. Risks, with the ones that are cheap now and expensive after the pilot called out.
6. A rough size estimate per phase.
7. The UI integration plan. There is no shell to bring across, so decide what the
   transplanted pages inherit and what they replace: which layout the AI route group
   renders under, whether the AI surfaces appear in `PRIMARY_NAV` or behind an
   authenticated-only nav, and what an unauthenticated visitor to an AI route sees on
   a site whose other routes are public. State it per surface — `assistant`, `board`,
   `history`, `leaderboard`, `moderator`, `lostfound` — not as one blanket rule.
8. The AI enable/disable design, framed as **off by default plus spend bounds**, not
   as a feature flag. Before scoping it, note that the switch already exists and
   already works: `lib/ai/agent.ts` checks `ai_skill_enabled('global')` *before* any
   model call and returns a canned reply with no trace and no spend, and
   `lib/ai/tool-gate.ts` checks it again per tool call. What is missing is the bound,
   not the switch. Scope:
   a. The migration creating `ai_kill_switches` seeds `global` as **disabled**, so the
      module is dark on arrival and costs nothing until a row is deliberately flipped.
   b. A per-member turn cap and a global daily turn cap, enforced before the model
      call. This is what makes C2 a bound rather than an alarm. Cheap inside this
      work; expensive to retrofit once a pilot has run up an invoice.
   c. Per-turn cost enforcement for C1. `MAX_STEPS = 6` is a step bound, not a dollar
      bound, and the tokens are already summed for `agent_traces`.
   d. Whether `model-router.ts` keeps every class on Opus. That one is a decision for
      item 4, not a default.
   When the module is disabled the UI hides its nav entries and its routes 404; it
   does not render a chat box that answers "I am switched off".
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

**Items 7 and 8 were added after the brief was first written**, from a read of the AI repo
rather than of the ADR. Item 8 is the one most likely to be misread as small: the ask is not
"build a feature flag", it is "ship the module off, and bound what it can spend while it is
on". The kill switch already stops spend; nothing currently bounds volume, and every model
class is Opus.

**The timing argument still favours doing it.** `bwpguotjzczmieeepczf` holds zero member rows, so
there is no cutover window and no backfill. The ADR's reasoning — that this is a code move now and a
data migration later — holds for the production project even though its "one empty project" premise
did not.

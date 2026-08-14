# Sluglines — Decision Log

Append-only decision record. Each entry states the decision, the evidence behind it, and its
status. Nothing here is inferred: where a fact could not be verified within this session's
authorised scope, the entry says `PENDING` or `BLOCKED` and names what is needed to close it.

**Architecture input:** `Docs/2026-08-14-consolidated-architecture.md` (rev. 5.3)
**Slice executed:** P0-adapted (see D-3)
**Date:** 2026-08-14
**Repo:** `sluglines`, branch `codex/phase-3-4`

---

## D-1 — rev. 5.3 adopted as the architecture input

**Decision:** `2026-08-14-consolidated-architecture.md` **rev. 5.3** is adopted as the governing
architecture and product plan for Sluglines.

**Header verification (required by the rev. 5.3 §12 preamble):** the source file's `**Status:**`
line reads *"Proposed rev. 5.3"*. Verified before any change was made. The document was copied
byte-identically into this repo at `Docs/2026-08-14-consolidated-architecture.md` (`diff` clean
against the source at `C:\Users\kalai\Projects\Temp\Sluglines\`).

**Status:** ADOPTED.

**Scope caveat carried forward from the document itself:** rev. 5.3's own §18 addendum states that
its final six residual fixes were **not** re-certified by a fourth cold-reader loop. Adopting rev.
5.3 adopts that uncertainty too; it is not treated here as fully certified.

---

## D-2 — Canonical implementation repo overridden to `sluglines`

**Decision:** the canonical implementation repo is **`sluglines`**
(`https://github.com/cybersecurity-cell/sluglines`), overriding rev. 5.3.

**Conflict being resolved:** rev. 5.3 §5 and §12 target `Sluglines-AI` as the canonical repo and
explicitly say "Until Q1 is decided, §12 targets `github.com/cybersecurity-cell/Sluglines-AI`".
rev. 5.3 §15 Q1 ("which repo *name* survives") was left open for a human.

**Resolution:** the human has decided §15 Q1 in favour of the `sluglines` name. rev. 5.3 §5
anticipated exactly this: *"if it resolves to 'transplant into the `sluglines` repo', the §12
prompts' repo URL changes but nothing else in this document does."* This entry is the one-line
DECISIONS.md change that §15 Q1 said it would require.

**Consequence:** all P0 destinations that rev. 5.3 pins to "the canonical repo" resolve to
`sluglines`, not `Sluglines-AI`.

**Status:** DECIDED (human).

**Open consequence — NOT resolved by this entry:** rev. 5.3's §5 rationale for choosing
`Sluglines-AI` as the *code* base (identity, RLS posture, state machine, ~98-test live-DB suite)
is unaffected by the repo-*name* decision. Deciding that the `sluglines` name survives does **not**
by itself decide whether `Sluglines-AI`'s code is transplanted into it, or whether the app is
rebuilt here. That is a distinct, still-open decision — see D-13.

---

## D-3 — P0 is executed as a "P0-adapted" slice

**Decision:** Phase 0 is executed as an adapted slice scoped to what is valid in the `sluglines`
repo as it actually exists, not as rev. 5.3's P0 literally reads.

**Reason:** rev. 5.3's P0 task list is written against `Sluglines-AI`'s file tree. A large part of
it refers to artefacts that do not exist in this repo: `lib/domain/**`, `lib/ai/**`, a migrations
directory with 24 sequential migrations, a live-database RLS test harness, `.claude/skills/*`
security-gate skills, and an existing `ci.yml` with jobs for the new scans to run "alongside".
Executing those steps here would mean inventing the referents, which rev. 5.3 §12's preamble
forbids ("never guess a path").

**What the adapted slice covers:** D-4 (baseline), D-5..D-7 (identities, verification, staging),
D-8 (OTP), D-9 (costs), D-10 (lint boundary), D-11 (deferrals), D-12 (PR #1), plus the repo
changes listed in "Changes made" below.

**Status:** EXECUTED.

---

## D-4 — Baseline test count `N` for this repo

**Decision:** the P0 baseline for the `sluglines` repo is recorded as:

| Measure | Value |
|---|---|
| Test files (`tests/*.test.mjs`) | **12** |
| Assertion calls across those files | **137** |
| Suite result at baseline | **green** (`npm run test` exit code 0) |
| Suite kind | Pure Node assertions over local TypeScript modules — **no database** |

`N` for this repo is therefore **12 test files / 137 assertions**, green as of 2026-08-14.

**Per-file assertion counts** (so a later phase can detect silent deletion, not just totals):

| File | Asserts |
|---|---|
| `checkins.test.mjs` | 8 |
| `community-channels.test.mjs` | 10 |
| `homepage-content.test.mjs` | 2 |
| `how-it-works.test.mjs` | 6 |
| `legacy-content.test.mjs` | 21 |
| `legacy-posts.test.mjs` | 8 |
| `location-fallbacks.test.mjs` | 6 |
| `locations.test.mjs` | 2 |
| `public-route-files.test.mjs` | 11 |
| `site-content.test.mjs` | 6 |
| `spot-directory.test.mjs` | 54 |
| `spot-search.test.mjs` | 3 |

### Why rev. 5.3's "~98 live-RLS baseline" does not apply here

rev. 5.3 §1/§5 records a baseline of *approximately 98 tests* and instructs P0 to record the exact
count as `N`. **That number describes `Sluglines-AI`'s Vitest suite running against a live Supabase
database.** It cannot be recorded as this repo's `N`, because:

1. **Different repo.** Under the D-2 override the canonical repo is `sluglines`; the ~98-test suite
   lives in `Sluglines-AI` and was not ported by this slice.
2. **Different instrument.** The ~98 figure counts live-database RLS tests — positive and negative
   policy assertions executed against real Postgres. This repo's suite has no database dependency
   whatsoever; it asserts over static content and directory/search helpers.
3. **Nothing to test RLS against.** This repo's only schema artefact is `supabase/schema.sql`, and
   its policies are the ones rev. 5.3 §14 risks 1 and 4 flag as defective (`Anyone can update spot
   counts`; anonymous insert/update/**delete** on `riders` and `drivers`). An RLS suite here would
   currently be asserting the correctness of policies the architecture says to delete.

**Consequence for later gates:** rev. 5.3 says "every later gate references that recorded `N`, not
this approximation". Later gates in **this** repo must reference **12 files / 137 assertions**,
and must not be read as satisfying the ~98 live-RLS bar — those are different measurements of
different things. Adopting `Sluglines-AI`'s suite (D-13) would replace this `N`, and that
replacement must be recorded as a new entry here.

**Status:** RECORDED.

---

## D-5 — Approved identities

The following are the **only** identities authorised for this work. Anything not on this list is
out of scope and must be escalated before use.

| Kind | Identity |
|---|---|
| Local implementation repo | `C:\Users\kalai\Projects\sluglines` |
| GitHub | `https://github.com/cybersecurity-cell/sluglines` (public; owner is a user account) |
| Supabase project ref | `bwpguotjzczmieeepczf` |
| Vercel project | `https://vercel.com/kalaikandasamy-4291s-projects/sluglines` (project `sluglines`) |
| GCP project (only if truly needed) | `sluglines-504318` |

**Explicitly NOT an implementation target:** `Sluglines-AI`. Documentation may be read or copied
from it; no source edits, git operations, installs, tests, or deploys there.
**Explicitly untouched:** `SluglinesAgent` (see D-11).

**Status:** BINDING.

---

## D-6 — The three rev. 5.3 §2 UNVERIFIED checks

rev. 5.3 §2 carries three items as UNVERIFIED and assigns their verification to P0. All three are
properties of **`Sluglines-AI` and its Vercel project**, neither of which is in the D-5 authorised
identity set. None was verified. None is fabricated below.

| # | Check (rev. 5.3 §2) | Status | Evidence / reason |
|---|---|---|---|
| U1 | The `Sluglines-AI` Vercel deployment is live | **PARTIAL — INCONCLUSIVE** | An unauthenticated public GET to `https://sluglines-ai.vercel.app/` returned **HTTP 307**. A deployment answers on that hostname; a 307 is consistent with an auth redirect. This establishes *reachability only* — not that the app is functional, current, or correctly configured. Not treated as verifying U1. |
| U2 | `Sluglines-AI` CI currently passes | **BLOCKED** | Requires reading Actions runs in the `Sluglines-AI` repo, which is outside the D-5 identity set. |
| U3 | No `ANTHROPIC_API_KEY` exists in the Vercel env config | **BLOCKED** | Requires `vercel env ls` (or dashboard) against the **`sluglines-ai`** Vercel project. Only the `sluglines` Vercel project is authorised (D-5). Not attempted. |

**Tooling note (so the block is understood as scope, not capability):** the Vercel CLI (v50.44.0)
and Supabase CLI (v2.109.1) are both installed locally, and a local `Sluglines-AI` checkout exists
at `C:\Users\kalai\Projects\Sluglines-AI`. The blocker is **authorisation, not access.**

**To close U2/U3, the operator must supply one of:**
- explicit authorisation to run read-only checks against the `Sluglines-AI` repo and its Vercel
  project (for U3, `vercel env ls` lists variable *names* only — no values need to be read or
  printed), **or**
- the answers directly, recorded here with their source.

rev. 5.3 §11's Phase 0 edge rules apply once these are checked: a dead deployment is *recorded and
proceeded past* (Phase 2 rebuilds the deployment path), and an unexpectedly present
`ANTHROPIC_API_KEY` is *recorded and left untouched* (it matters only at P5).

**Status:** U1 PARTIAL/INCONCLUSIVE; U2 BLOCKED; U3 BLOCKED.

---

## D-7 — Staging environment

**Decision:** **UNKNOWN / PENDING.** No staging choice is recorded, because none could be
established from repo evidence without a dashboard-side action.

**What was checked:** the repo's branches (`main`, `codex/phase-1`, `codex/phase-3-4`, plus local
`claude/*` working branches) contain **no `staging` branch**; `.vercel/project.json` links this
directory to a Vercel project but does not describe a staging target; there is no
`supabase/config.toml` declaring preview branches.

**rev. 5.3's default (§11 Phase 0):** *"Supabase preview branch of the production project; a second
project only if preview branches are unavailable on the plan."* That default is recorded here as
the **proposed** choice, but it is **not** confirmed, because confirming it requires knowing whether
the Supabase plan for project `bwpguotjzczmieeepczf` includes preview branches — a billing/plan
fact that is a dashboard read.

**Source needed to close:** the Supabase plan tier for `bwpguotjzczmieeepczf` (does it include
branching?). With that, this entry resolves to either "Supabase preview branch" or "second project"
without further discussion.

**Not urgent:** rev. 5.3 §11 explicitly makes P0 *record the choice only* — provisioning happens at
P3, the first phase that uses it.

**Status:** PENDING (blocking nothing before P3).

---

## D-8 — OTP configuration values

**Decision:** the rev. 5.3 §8 M2 values are **recorded as the intended configuration**; **none has
been applied or verified.**

| Control | Intended value (rev. 5.3 §8 M2) | Status |
|---|---|---|
| Resend cooldown | 60 s | **PENDING** — not applied |
| Verify attempts per number per hour | ≤ 5 | **PENDING** — not applied |
| OTP sends per IP per day | ≤ 10 | **DEFERRED to P2** — rev. 5.3 assigns this to edge middleware, not auth config |
| CAPTCHA on send | enabled | **PENDING [H]** — needs a provider credential (e.g. Turnstile) the operator may not hold |
| Generic errors (anti-enumeration, T10) | required | **PENDING** — not applied |
| Test phone ranges with deterministic OTPs | disabled in production | **DEFERRED to P2** — rev. 5.3 assigns the measurement to P2 |

**Why nothing was applied:** every one of these is a change to the Supabase Auth configuration of
the production project `bwpguotjzczmieeepczf`. That is a dashboard-side / project-configuration
mutation, which this session is instructed to stop and report on rather than perform. **No OTP
config artefact was captured**, because capturing one requires the same authenticated read.

Per rev. 5.3 §11's Phase 0 edge rules, the CAPTCHA sub-item is *already* allowed to be `[H] pending`
without failing the gate. The other items are pending here for a different reason (authorisation),
and that difference is stated rather than blurred.

**Additional current-state fact:** this repo's `supabase/schema.sql` contains **no auth or OTP
configuration at all** — it defines `spot_status`, `profiles`, `commute_log`, `riders`, `drivers`,
and `alerts`. There is no phone-OTP identity in this repo today.

**Status:** PENDING — requires explicit operator authorisation for auth-config changes.

---

## D-9 — Cost caps

**Decision:** the rev. 5.3 §11 Phase 0 provisional caps are recorded in **`Docs/costs.md`**:

| Cap | Value | Kind |
|---|---|---|
| Model spend per assistant turn | ≤ $0.10 / turn | hard cap (P5 gate) |
| Model spend per month | ≤ $50 / month | alarm |
| SMS sends per day | 500 / day | alarm |

All three are explicitly **provisional**. None is currently measured — the instruments
(`agent_traces`, `manual_metrics`) do not exist in this repo. `Docs/costs.md` states that gap.

**Status:** RECORDED (provisional, unmeasured).

---

## D-10 — Lint boundary rule: no subject in this repo yet

**Decision:** the rev. 5.3 §8 dependency rule's first slice — *"forbid `lib/ai/**` imports from
everywhere except `app/**/assistant/**` and `lib/ai/**` itself"* — is **NOT IMPLEMENTED**, because
its subject does not exist here.

**Verified current layout** (rev. 5.3 §11 requires verifying actual paths at execution rather than
assuming):

- `src/lib/` contains: `checkins.ts`, `community-channels.ts`, `legacy-content.ts`,
  `legacy-posts.ts`, `legacy-spot-media.ts`, `location-fallbacks.ts`, `locations.ts`,
  `site-content.ts`, `spot-directory.ts`, `spot-search.ts`, `supabase/`.
- **There is no `lib/ai`, no `lib/domain`, and no `assistant` route.**
- `src/app/` contains: `[...legacyPath]`, `about-slugging`, `about-us`, `app`, `blog`, `dashboard`,
  `how-it-works`, `news`, `slug_pickup`, `slugging-rules`, `slugging-rules-and-etiquette`, `spots`.

A `no-restricted-imports` rule against `lib/ai/**` here would restrict nothing, and rev. 5.3's P0
measurement *"boundary-violation commit fails lint (then reverted)"* would be unprovable — there is
no import to violate it with. Adding a rule that cannot fail would be a gate that only looks green.

**What WAS done instead (a real prerequisite that was missing):** `npm run lint` was **broken** —
see D-14. It is now working, which is the precondition for any future boundary rule.

**Allowlist recorded for when the paths exist** (so the future slice does not re-derive it):

```
lib/ai/**            importable ONLY by:  app/**/assistant/**  and  lib/ai/**
lib/domain/**        may import:          lib/supabase only (never React, never lib/ai)
everything else      may import:          lib/domain, lib/supabase (never lib/ai)
```

**Status:** DEFERRED — subject does not exist. Becomes actionable the moment `lib/ai/` is created.

---

## D-11 — Deferred / not attempted, with exact reasons

Each item below was in rev. 5.3's P0 and was **deliberately not done**. The reason is stated so a
later session does not re-litigate it or assume an oversight.

| # | Item (rev. 5.3 P0) | Status | Exact reason |
|---|---|---|---|
| 1 | `0025_product_events.sql` (+ `manual_metrics`, `metrics_weekly`) | **DEFERRED** | This repo has **no migrations directory and no migration harness** — the only schema artefact is a single hand-maintained `supabase/schema.sql`. Numbering a migration `0025` implies a sequence 0001–0024 that does not exist here; it exists in `Sluglines-AI`. Creating it would produce a file with no runner, a misleading ordinal, and no way to apply or test it. |
| 2 | RLS tests for new tables | **DEFERRED** | Requires (a) the tables from item 1 and (b) a live-database test harness. This repo's suite is pure Node assertions with no DB connection (D-4). Both prerequisites are absent. |
| 3 | Live Supabase migrations against production | **NOT ATTEMPTED** | rev. 5.3 §11 explicitly authorises P0 to target the production project. That authorisation is **not exercised**: there is no migration to apply (item 1), and this session is instructed to stop and report before destructive or production DB operations. The rev. 5.3 authorisation is recorded here as available to a future slice, not consumed by this one. |
| 4 | Full `lib/ai` boundary lint rule | **DEFERRED** | See D-10 — no `lib/ai` exists. |
| 5 | Port assets to `lib/legacy/` + `docs/legacy/` | **NOT DONE** | rev. 5.3 pins these ports as *"from `codex/phase-3-4` into the canonical repo"*. Under the D-2 override, `sluglines`/`codex/phase-3-4` **is** the canonical repo and branch — the assets are already here, in place, at `src/lib/` and `Docs/sluglines-content-inventory.md`. The port is a no-op; moving files into a `lib/legacy/` holding area would be a pure restructure with no consolidation value, and rev. 5.3 declares those files *inert until P1* anyway. P1's restructure should place them directly. |
| 6 | `SluglinesAgent`: git init + rotation artefact | **NOT TOUCHED** | Out of scope by explicit instruction for this session. rev. 5.3 §14 risk 2 (live credentials in plaintext, no VCS) **remains open and is High severity.** See D-15. |
| 7 | WhatsApp volume baseline | **PENDING [H]** | Human measurement. See D-15. |
| 8 | Founding-driver recruitment | **PENDING [H]** | Human task. See D-15. |

**Status:** RECORDED.

---

## D-12 — Draft PR #1

**Decision:** PR #1 is **left OPEN**. It was not closed.

**Facts:** `gh pr list` reports PR #1 — *"[codex] Build live slugline check-ins"* — state `OPEN`,
`isDraft: true`, head branch **`codex/phase-3-4`**.

**Why it was not closed**, despite rev. 5.3 P0 task (2) saying "Close draft PR #1 with a decision
reference":

1. **The premise inverted under D-2.** rev. 5.3 wanted PR #1 closed because, in its model,
   `sluglines` was a *non-canonical content repo* whose check-in tables (§14 risk 1) must never
   merge. Under the D-2 override, `sluglines` is the canonical repo and **`codex/phase-3-4` — PR
   #1's own head branch — is the active working branch**, the branch this P0-adapted slice is
   committed to.
2. **Closing it would be ambiguous.** Closing a PR while simultaneously committing new canonical
   work onto its head branch sends contradictory signals about the branch's status, and would need
   an immediate replacement PR.
3. **The instruction is conditional.** This session was told not to close PR #1 unless it could be
   done "safely without ambiguity". Condition not met.

**Still valid and NOT waived:** rev. 5.3 §14 risk 1 stands — PR #1's `riders`/`drivers`/`alerts`
tables allow any anonymous client to update or delete any other user's row. Confirmed directly in
`supabase/schema.sql`, which contains the policies `Anyone can update spot counts`,
`Public update own rider check-in`, `Public delete rider check-ins`, `Public update own driver
check-in`, and `Public delete driver check-ins`. **This schema must not reach production as
written**, regardless of what happens to the PR.

**To close this entry, the human must decide:** does `codex/phase-3-4` become the mainline of the
canonical repo (in which case PR #1 should be retargeted/retitled, not closed), or is it superseded
by a transplant from `Sluglines-AI` (in which case close it with a reference to D-2 and D-13)?
That is D-13.

**Status:** OPEN — deliberately, pending D-13.

---

## D-13 — OPEN: does `Sluglines-AI`'s code get transplanted here?

**This is the highest-value open question and D-2 does not answer it.**

D-2 settled the repo *name*. It did not settle whether this repo receives `Sluglines-AI`'s
application core — phone-OTP identity, the offer/reservation state machine, default-deny RLS, the
~98-test live-DB suite, the tool gate — or whether that core is rebuilt here.

rev. 5.3 §5's analysis is unchanged by the naming decision and is worth restating: porting this
repo's *content* onto that *core* is a content task; the reverse means rebuilding identity, the
state machine, the RLS suite, and the tool gate from scratch.

Almost every deferral in D-11 collapses the moment this is decided: the migration harness, the RLS
test harness, `lib/domain`, and `lib/ai` all arrive with the transplant.

**Status:** OPEN — human decision required. Blocks P1.

---

## D-14 — `npm run lint` was broken; fixed mechanically

**Finding:** `npm run lint` (`next lint`) did not run. With no ESLint configuration present, it
dropped into Next's **interactive setup prompt** ("How would you like to configure ESLint?"), which
in a non-interactive context is a hang or a non-zero exit. Exit code was **1**.

**This is a real gap, not cosmetic:** the repo had a lint gate that had never been executable, so
no lint signal had ever gated anything — and rev. 5.3's P0/P1 boundary-rule measurements are all
expressed as "fails lint".

**Fix:** added `.eslintrc.json` extending `next/core-web-vitals`, using the already-installed
`eslint@8` and `eslint-config-next@14.2.0` — no new dependencies. Non-source directories (`AI/`,
`Docs/`, `public/`, `.next/`) are ignored.

**Result:** `npm run lint` now exits **0**, reporting 4 warnings and 0 errors. The warnings
(`no-img-element` ×3, `react-hooks/exhaustive-deps` ×1) are in pre-existing and
currently-uncommitted UI work and were **deliberately left unfixed** — fixing them is not this
slice's scope and would alter the user's in-flight changes.

**Status:** FIXED.

---

## D-15 — `[H]` / `[C]` items outstanding

Per rev. 5.3 §11, `[H]` (human-performed) and `[C]` (calendar-scoped) items are out of an
implementing session's scope and must be reported as pending, never as done.

| Item | Tag | Status | Note |
|---|---|---|---|
| `SluglinesAgent` credential rotation | `[H]` rotation, `[S]` artefact | **PENDING** | rev. 5.3 §14 risk 2, **High**: live OAuth credentials in plaintext, no VCS. Out of scope for this session by instruction. rev. 5.3 §11 makes the rotation artefact a **Phase 1 entry criterion** if still pending at P0 exit — it is pending, so that criterion is now live. |
| Founding-driver recruitment (3–5 Horner drivers) | `[H]` | **PENDING** | Phase 3 gate requires ≥3 active. rev. 5.3 notes recruitment "starts now" — long lead time, worth starting before P1 completes. |
| WhatsApp volume baseline | `[H]` | **PENDING** | Template (rev. 5.3 §11): per group, **one integer per week, minimum two observation weeks, averaged**. Groups: **Horner Rd ↔ L'Enfant/GSA** and **Horner Rd ↔ 18th St**. Record **aggregate integers only** — no names, no numbers, no message content. This is the denominator for Phase 3's "≥25% of baseline" gate; without it that gate is uncomputable. |
| Pilot scope (§15 Q4) | `[H]` | **OPEN** | One group or both. Decides Phase 3 invite and gate denominators. |
| §15 Q2, Q3, Q5, Q6 | `[H]` | **OPEN** | Legacy archive; SluglinesAgent keep/retire; founding-driver thank-you; leaderboard keep/cut. |

**Status:** REPORTED PENDING.

---

## D-16 — Document overrides and inaccuracies found

Recorded per instruction. These are places where rev. 5.3 does not match the repo as it exists.

| # | Item | Type | Detail |
|---|---|---|---|
| 1 | Canonical repo | **Override** | rev. 5.3 targets `Sluglines-AI`; overridden to `sluglines` (D-2). rev. 5.3 §5 anticipated this. |
| 2 | `~98` test baseline | **Inapplicable** | Describes `Sluglines-AI`'s live-DB suite. This repo's `N` is 12 files / 137 assertions, a different instrument (D-4). |
| 3 | `0025_product_events.sql` | **Referent missing** | No migrations directory or harness in this repo; the `0025` ordinal presumes a sequence that exists only in `Sluglines-AI` (D-11.1). |
| 4 | `lib/ai/**` boundary rule | **Referent missing** | No `lib/ai`, no `lib/domain`, no `assistant` route in this repo (D-10). |
| 5 | *"the three new CI jobs green **alongside the pre-existing jobs**"* | **Inaccurate for this repo** | There were **no** pre-existing CI jobs — `.github/workflows/` did not exist. The three new workflows are this repo's first CI. |
| 6 | *"Update `AI/README.md` — its 'implementation: not started' claim is false"* | **Accurate, and corrected** | The claim was indeed false (`Sluglines-AI` is a substantially complete build). Corrected in place, not deleted, per rev. 5.3 (D-17). |
| 7 | `docs/` vs `Docs/` | **Path deviation** | rev. 5.3 says `docs/`. This repo already tracks **`Docs/`** (`Docs/sluglines-content-inventory.md`) and sits on a case-insensitive filesystem (`core.ignorecase=true`), where `docs/` and `Docs/` are the *same directory*. Committing both casings would create a tree that cannot be checked out cleanly on Windows or macOS. **All P0 documents therefore use the existing `Docs/` casing.** Read every rev. 5.3 reference to `docs/X` as `Docs/X`. |
| 8 | rev. 5.3 §5 comparison table, "CI: none" for the `sluglines` repo | **Confirmed** | Verified — no workflows existed. Now three exist. |
| 9 | rev. 5.3 §14 risk 1 / risk 4 (open anonymous write & delete) | **Confirmed in this repo** | `supabase/schema.sql` contains `Anyone can update spot counts`, plus public insert/update/**delete** policies on `riders` and `drivers` (D-12). |
| 10 | rev. 5.3 §2 "no working-tree state" caveat | **Material here** | rev. 5.3 assessed this repo from committed state only. At session start the working tree carried **uncommitted modifications** to `globals.css`, `layout.tsx`, `Navbar.tsx`, `SpotDetailLayout.tsx`, `SpotQuickFacts.tsx`, `spot-directory.ts`, `spot-directory.test.mjs`, plus untracked `public/` and `src/lib/legacy-spot-media.ts`. All were preserved untouched. |
| 11 | rev. 5.3 §11 Phase 0 "N baseline + new P0 tests, all green" | **Partially inapplicable** | This slice adds **no new tests** — it adds CI gates. There were no new tables or code paths to test (D-11.1, D-11.2). The baseline suite is green and unchanged at 12/137. |

**Status:** RECORDED.

---

## D-17 — `AI/README.md` corrected

**Finding:** `AI/README.md` stated *"Application implementation: not started"*. rev. 5.3 §14 risk 5
flags this as false, and it is: `Sluglines-AI` is a substantially complete build (24 migrations,
28 commits, a live-DB RLS suite).

**Action:** corrected in place. rev. 5.3 explicitly says **update, don't delete** — §11's deferred
list cites `AI/docs/specs/2026-07-18-sluglines-ai-phased-design.md`, a file inside that folder, so
deleting the directory would break a live reference. Scope kept tight: the status block was
corrected and a pointer to rev. 5.3 added; the rest of the file is unchanged.

**Status:** FIXED.

---

## D-18 — CI security workflows added

**Decision:** three GitHub Actions workflows were added — this repo's first CI.

| Workflow | Job(s) | Instrument |
|---|---|---|
| `.github/workflows/audit.yml` | `npm-audit` | `scripts/audit-check.mjs` over `npm audit --json`, high/critical threshold, with a documented exceptions file |
| `.github/workflows/static-analysis.yml` | `codeql`, `typecheck` | CodeQL (`javascript-typescript`, `security-and-quality`) + `tsc --noEmit` |
| `.github/workflows/secret-scan.yml` | `gitleaks`, `tracked-env-files` | gitleaks over full history (`fetch-depth: 0`) + a deterministic tracked-`.env` backstop |

**"static-analysis distinct from ESLint" — how the distinction is real:** ESLint is a
single-file style/pattern linter. CodeQL performs **interprocedural dataflow / taint tracking**
across the whole repo, which is the class of analysis ESLint structurally cannot do. `tsc --noEmit`
is whole-program type checking, isolated from `next build` so a type regression reports as a type
failure rather than a build failure.

**No heavyweight dependencies were added.** The audit gate is a single ~130-line Node script using
only Node built-ins. CodeQL and gitleaks are marketplace actions, not project dependencies.

### The audit exceptions mechanism

`.github/audit-exceptions.json`. Every entry requires `advisory` (GHSA) or `package` scope,
`reason`, `approvedBy`, and `expires` (YYYY-MM-DD). Design point: **an expired entry does not waive
anything and fails the job**, which forces a re-review rather than letting accepted risk become
permanent silently.

**Baseline at time of writing:** `npm audit` reports **14 vulnerabilities (2 low, 11 high, 1
critical)**. All high/critical findings are currently waived with dated, reasoned entries, so the
gate passes — see D-19 for the one that genuinely matters.

**Status:** ADDED. Verified locally (see "Verification" below). Not yet observed running on GitHub.

---

## D-19 — ACTION REQUIRED: critical `next@14.2.0` advisory waived, not fixed

**Flagged prominently because it is the single most consequential finding of this slice.**

`next` is pinned at exactly **14.2.0** and carries a **critical** advisory —
[GHSA-f82v-jwr5-mffw, *Authorization Bypass in Next.js Middleware*](https://github.com/advisories/GHSA-f82v-jwr5-mffw)
— plus ~30 further high-severity advisories (cache poisoning, SSRF, DoS, XSS).

**The fix is small and non-breaking:** npm reports the fix as **`next@14.2.35`**, which is
`isSemVerMajor: false` — the same 14.2.x line. It also clears the `postcss` high-severity cluster.

**Why this slice did not apply it:** the working tree carried uncommitted UI work (D-16.10), and a
framework bump under someone else's in-flight changes is not a change to make unilaterally. It
needs its own reviewable commit with a full `test` / `lint` / `build` pass.

**It is therefore waived in `.github/audit-exceptions.json` with a deliberately short expiry of
2026-09-15**, after which the `audit` job fails until it is addressed.

**Remediation:** set `"next": "14.2.35"` in `package.json`, `npm install`, re-run
`npm run test && npm run lint && npm run build`, then delete the `next` and `postcss` entries from
the exceptions file.

**Status:** OPEN — recommended as the immediate next slice.

---

## Changes made in this slice

| File | Change |
|---|---|
| `Docs/DECISIONS.md` | **New** — this file |
| `Docs/2026-08-14-consolidated-architecture.md` | **New** — rev. 5.3 committed to the repo (byte-identical copy) |
| `Docs/costs.md` | **New** — provisional cost caps |
| `.eslintrc.json` | **New** — repairs the broken `next lint` gate (D-14) |
| `.github/workflows/audit.yml` | **New** — dependency audit gate |
| `.github/workflows/static-analysis.yml` | **New** — CodeQL + typecheck |
| `.github/workflows/secret-scan.yml` | **New** — gitleaks + tracked-`.env` backstop |
| `.github/audit-exceptions.json` | **New** — documented, dated audit waivers |
| `scripts/audit-check.mjs` | **New** — audit gate implementation |
| `package.json` | Added `typecheck` and `audit:check` scripts. **No dependency changes.** |
| `AI/README.md` | Corrected the false "implementation: not started" status (D-17) |

**Untouched, as instructed:** all pre-existing uncommitted user work; `SluglinesAgent`; every
`.env*` file; the `Sluglines-AI` repo; production Supabase; Vercel; DNS.

---

## Verification run in this slice

| Command | Result |
|---|---|
| `npm run test` | **PASS** — exit 0; 12 files / 137 assertions, unchanged from baseline |
| `npm run lint` | **PASS** — exit 0; 4 warnings, 0 errors (was **broken**, exit 1, before D-14) |
| `npm run build` | **PASS** — exit 0; 405 static paths generated |
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `node scripts/audit-check.mjs` | **PASS** — exit 0; all high/critical waived with dated reasons |
| `node scripts/audit-check.mjs --exceptions=<absent>` | **FAIL as designed** — exit 1 (negative test proving the gate can fail) |
| Workflow YAML + exceptions JSON parse | **PASS** — all 3 workflows parse; all 12 exception entries carry reason/approvedBy/expires |

**Not verified:** the three workflows have not been observed executing on GitHub. YAML validity and
local equivalents of the audit/typecheck steps were confirmed; the CodeQL and gitleaks actions
themselves run only on GitHub.

---

## Recommended next slice

1. **D-19** — bump `next` to 14.2.35 (critical advisory), verify all gates, drop the waivers.
2. **D-13** — human decision: transplant `Sluglines-AI`'s core into this repo, or rebuild here.
   This unblocks P1 and collapses most of D-11.
3. **D-6** — authorise the two blocked verification reads (U2, U3).
4. **D-15** — start the `[H]` long-lead items now: `SluglinesAgent` rotation (High severity, and a
   Phase 1 entry criterion), founding-driver recruitment, and the two-week WhatsApp volume baseline.

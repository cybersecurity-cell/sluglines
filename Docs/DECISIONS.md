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

## D-13 — CLOSED: the core is **rebuilt** inside `sluglines`, not transplanted

> **Decided 2026-08-14 by the human.** The original OPEN text is preserved below the decision, as
> the record of what the question was. First implementation slice: the rebuild-foundation slice
> recorded at the end of this file.

**Decision:** the application core is **rebuilt inside the `sluglines` repo from the rev. 5.3
specification**. `Sluglines-AI`'s code is **not** transplanted.

**Consequences — each is a commitment, not an aspiration:**

1. **`Sluglines-AI` becomes reference and documentation only.** It may be read for design intent;
   no file is copied into this repo as implementation, and D-5's "explicitly NOT an implementation
   target" now covers reading-for-transplant as well as writing. Where rev. 5.3 describes a
   `Sluglines-AI` artefact (a migration ordinal, a test count, a skills file), that description is
   a **content specification** to be satisfied here, not a file to be reproduced.
2. **This repo must grow its own migration harness, RLS posture, domain layer and test harness.**
   None of it arrives for free. Every D-11 deferral that was blocked on "the transplant brings it"
   is now blocked on nothing and must be built: see D-21 (migration harness), D-23 (RLS test
   harness), D-26 (`lib/domain`).
3. **`N` does not get replaced by `Sluglines-AI`'s ~98.** D-4 anticipated that a transplant would
   replace the baseline. It will not. This repo's `N` grows by the tests each rebuild slice adds
   (see D-25 for a correction to the recorded baseline itself).
4. **PR #1 is retargeted, not closed.** D-12's condition resolves in favour of the first branch:
   `codex/phase-3-4` is the mainline of the canonical repo. PR #1 should be retitled and
   retargeted rather than closed with a supersession reference. That is a GitHub-side action and
   was **not** performed by the rebuild slice, which was not authorised to push.
5. **The legacy schema is quarantined, not deleted.** See D-24.

**The concrete sequence to P1/P2**, in dependency order. Each item names its blocker so the next
session does not have to re-derive the ordering:

| # | Step | Blocked by | Status |
|---|---|---|---|
| 1 | Migration harness + static SQL security analyser | — | **DONE** (D-21) |
| 2 | Rebuild-foundation migration: `members`, `audit_events`, `presence_checkins`, default-deny RLS, SECURITY DEFINER writers | 1 | **DONE, unapplied** (D-22) |
| 3 | `lib/domain` boundary + offer state machine as committed data | — | **DONE** (D-26) |
| 4 | Live-database RLS test harness (positive + negative), against a non-production target | staging choice (D-7) | **OPEN** (D-23) |
| 5 | Apply migrations `0001+` to a real database | 4, and explicit operator authorisation | **OPEN** |
| 6 | M2 identity: phone-OTP wiring, `/login` `/verify` `/onboarding`, OTP abuse controls | 5, D-8 | **OPEN** |
| 7 | M3 offers/reservations tables + the state-machine SQL functions (revision checks, idempotency keys), checked against step 3's committed table | 5, 6 | **OPEN** |
| 8 | P1 restructure to §8 route groups; ESLint boundary rule completed once `lib/ai` exists | 3, 7 | **OPEN** (D-10) |
| 9 | `0026` 43-spot directory seed; `/[...legacy]` handler with the 165-route test | 8 | **OPEN** |
| 10 | Content preservation: the existing `src/lib/*` content libraries and 405 built routes survive the restructure unchanged in behaviour, asserted by the existing suite passing pre- and post-restructure | 8 | **OPEN** |
| 11 | P2 public aggregates (`0027`), the three anonymous-callable functions, and legacy write-path retirement | 9, 10 | **OPEN** |

**Content preservation is a hard constraint on all of the above.** The rebuild replaces the
*schema and domain core*; it does not replace the content site. The 405 built routes, the legacy
redirect inventory, and `src/lib/{spot-directory,legacy-content,site-content,...}.ts` are carried
forward. rev. 5.3 §11 P1's "behaviour-preserving; suite green before/after at count N" is the
instrument, and no rebuild slice may reduce the passing test set to satisfy a restructure.

**Status:** DECIDED (human), 2026-08-14. No longer blocks P1.

<details>
<summary>Original entry, as written when this was open</summary>

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

</details>

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

## D-19 — RESOLVED: critical `next@14.2.0` advisory fixed by the 14.2.35 bump

> **Update — 2026-08-14, dependency-security slice.** This is now **CLOSED**. `next` was bumped
> 14.2.0 → 14.2.35 and the critical advisory **GHSA-f82v-jwr5-mffw is cleared**. npm audit went
> from 14 vulnerabilities (2 low, 11 high, 1 critical) to **7 (2 low, 5 high, 0 critical)**, and
> nine waivers were deleted. The original entry is preserved below for the record; see **D-20**
> for the residual high-severity `next` advisories that a 14.2.x bump could not reach.

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

**Status:** ~~OPEN — recommended as the immediate next slice.~~ **CLOSED 2026-08-14** by the
dependency-security slice. The remediation above was applied in full, with one correction to its
premise: deleting the `next` and `postcss` entries outright was **not** possible (see D-20).

---

## D-20 — Residual high-severity `next` advisories need a Next 15 migration

**Raised by the dependency-security slice, 2026-08-14, as the successor to D-19.**

D-19 predicted that `next@14.2.35` would clear the whole `next` + `postcss` cluster and let both
waivers be deleted. **That prediction was half right.** What the audit actually showed after the
bump:

| | Before | After |
|---|---|---|
| npm audit total | 14 (2 low, 11 high, 1 critical) | **7 (2 low, 5 high, 0 critical)** |
| `next` advisories ≥ high | 12 (1 critical, 11 high) | 8 high |
| `postcss` advisories ≥ high | 2 high | 2 high (nested copy only) |
| Waiver entries | 12 | **3** |

**Cleared by 14.2.35:** the critical GHSA-f82v-jwr5-mffw, plus GHSA-gp8f-8m3g-qvj9 (cache
poisoning), GHSA-7gfc-8cq8-jh5f (authorization bypass), GHSA-mwv6-3258-q52c and GHSA-5j59-xgg2-r9c4
(RSC DoS).

**Not cleared, and not clearable on the 14.2.x line:** eight high advisories whose fixed-in ranges
all begin at **15.5.x** — GHSA-h25m-26qc-wcjf, GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj,
GHSA-c4j6-fc7j-m34r, GHSA-36qx-fr4f-26g5, GHSA-m99w-x7hq-7vfj, GHSA-89xv-2m56-2m9x,
GHSA-p9j2-gv94-2wf4. npm reports the only fix as `next@16.3.1` (`isSemVerMajor: true`). A Next
15/16 jump was explicitly out of scope for this slice.

Likewise the two `postcss` highs: the direct devDependency was raised to `^8.5.26` and that
top-level copy is clean, but `next@14.2.35` hard-pins `node_modules/next/node_modules/postcss` to
exactly **8.4.31** in its own `dependencies`, which cannot be overridden while staying on Next 14.

**Reachability was measured, not assumed.** This app has no `middleware.ts`, no i18n config, no
Server Actions (`'use server'` appears nowhere in `src/`), no rewrites in `next.config.js`, and no
custom server. That structurally rules out four of the eight — the i18n proxy bypass, both Server
Actions issues, and the rewrite-destination SSRF. Residual exposure is the RSC / WebSocket-upgrade
DoS and SSRF cluster, against a build that is 405 static paths plus two dynamic routes.

**Waived with a 2026-10-15 expiry** — shorter than the dev-toolchain waivers because these are
runtime-reachable in principle. The waiver text names the reachability assumptions explicitly so
that introducing middleware, i18n, Server Actions, rewrites, or a custom server invalidates it
early rather than silently.

**Remediation:** plan a Next 15 migration slice — `next >= 15.5.21`, `eslint-config-next` bumped in
lockstep, App Router codemods, full `test` / `lint` / `typecheck` / `build` / `audit:check` pass.
That single bump also unpins the bundled `postcss` and, with the matching `eslint-config-next`
major, clears the last `glob` waiver.

**Status:** OPEN — recommended as a near-term slice, but materially larger than D-19 was.

---

## D-21 — Migration harness established (file-based; no runner)

**Decision:** `supabase/migrations/` is created as this repo's migration harness, with
`scripts/sql-lint.mjs` as its static security analyser and `supabase/migrations/README.md` as its
convention document. This closes the D-11.1 deferral, whose stated reason ("no migrations directory
and no migration harness") was itself the thing to fix once D-13 chose rebuild.

**Deliberately *not* included: a runner.** Nothing in this repo applies SQL to a database. There is
no `supabase db push`, no connection string, no live suite. The harness is a *file* convention plus
a *text* analyser, and both run offline.

**Why that split rather than wiring the Supabase CLI now:** the only database in the authorised
identity set (D-5) is the **production** project `bwpguotjzczmieeepczf`. A harness whose only
possible target is production is not a test harness. Wiring one would either sit unused or invite a
production apply, so the file/static half ships now and the live half waits for a non-production
target (D-7, D-23).

**Status:** ESTABLISHED.

---

## D-22 — Migration ordinals restart at `0001`; rev. 5.3 filenames are content specs

**Decision:** this repo's migration sequence starts at **`0001`**. rev. 5.3's migration filenames
are read as *content* specifications, not filenames to reproduce.

**Reason:** rev. 5.3 §11/§12 names `0025_product_events.sql`, `0026_full_spot_directory.sql` and
`0027_public_aggregates.sql`. Those ordinals index `Sluglines-AI`'s 24-migration history. Under
D-13 that history is not inherited, so reproducing the ordinals would encode a sequence that does
not exist here — exactly the objection D-11.1 raised, now resolved by renumbering rather than by
deferring.

**Mapping** (so no later session re-derives it):

| rev. 5.3 filename | This repo | Phase |
|---|---|---|
| — (new; no rev. 5.3 equivalent) | `0001_rebuild_foundation.sql` | rebuild foundation |
| `0025_product_events.sql` | next free ordinal when M10 is built | P0 content, deferred |
| `0026_full_spot_directory.sql` | next free ordinal after that | P1 |
| `0027_public_aggregates.sql` | next free ordinal after that | P2 |

### `0001_rebuild_foundation.sql` — what it contains and its applied state

Three tables, chosen because rev. 5.3 specifies them completely enough to write without inventing
anything: `members` (§8 M2), `audit_events` (§8 M7), `presence_checkins` (§8 M4). Plus seven
functions forming the entire write path.

**APPLIED: no.** It has not been run against `bwpguotjzczmieeepczf` or any other database. The file
carries an `APPLIED:` header line, a test asserts it reads `no`, and that line is only changed by
the session that actually applies it.

Posture: RLS enabled on every table; **zero** insert/update/delete policies for any role; the three
SELECT policies are `to authenticated` with real predicates; every write goes through a
SECURITY DEFINER function that takes the actor from `auth.uid()` rather than from its arguments;
every function is revoked from `PUBLIC` before anything is granted back.

That last point is the one worth stating explicitly, because it is the easy thing to get wrong:
**Postgres grants `EXECUTE` on a new function to `PUBLIC` by default.** A migration can satisfy
every RLS rule and still hand anonymous callers a write path through the very functions that bypass
RLS. Analyser rule R9 exists for that, and it is the rule most likely to catch a future mistake.

**Status:** WRITTEN, LINTED, **NOT APPLIED**.

---

## D-23 — Static SQL validation now; live RLS tests still owed

**Decision:** SQL security is currently enforced **statically**, by `scripts/sql-lint.mjs` under
`npm run test` and `npm run sql:check`. Positive/negative live-database RLS tests remain **owed**.

**The distinction matters and is not being blurred.** The analyser proves *"the SQL contains no
shape that grants an anonymous or authenticated client a direct table write."* It cannot prove
*"this policy predicate is correct."* A green `sql:check` is **not** an RLS verification, and
rev. 5.3 §12 constraint 2 ("default-deny RLS + positive and negative RLS tests in the same PR") is
therefore **partially satisfied only** — the default-deny half is evidenced; the tests half is not.

Eleven rules (R1–R11) are enforced and documented in `supabase/migrations/README.md`, together with
the analyser's known limits (overload-blind, shape-not-semantics, no catalogue awareness). Each rule
is exercised by a **negative** fixture in `tests/sql-migration-harness.test.mjs`, so the gate is
demonstrably able to fail — the D-10 objection to gates that only look green applies to this gate
too, and is answered rather than repeated.

**To close:** a non-production database target (D-7's staging choice), then a live suite asserting
anon-denied / member-denied / function-succeeds for each table.

**Status:** PARTIAL — static enforced, live owed. Step 4 of D-13's sequence.

---

## D-24 — Legacy `supabase/schema.sql`: quarantined, pinned, not dropped

**Findings, confirmed by reading the file rather than quoting rev. 5.3.** Eight write policies exist;
seven are reachable with no authentication whatsoever, because they carry no `TO` clause (Postgres
defaults that to `PUBLIC`) and an unconditional `using (true)`:

| Table | Command | Policy |
|---|---|---|
| `spot_status` | UPDATE | `Anyone can update spot counts` (rev. 5.3 §14 risk 4) |
| `riders` | INSERT | `Public insert riders` |
| `riders` | UPDATE | `Public update own rider check-in` |
| `riders` | DELETE | `Public delete rider check-ins` |
| `drivers` | INSERT | `Public insert drivers` |
| `drivers` | UPDATE | `Public update own driver check-in` |
| `drivers` | DELETE | `Public delete driver check-ins` |

(rev. 5.3 §14 risk 1 for the six `riders`/`drivers` rows.) The eighth, `Users update own profile`, is
at least scoped to `auth.uid() = id` and is not in the anonymous set. The policy names say "own", but
nothing in them is scoped to a person: identity in these tables is a **client-supplied `device_id`**,
so there is no principal to authorise against — any client can overwrite or delete any other
person's row.

**What this slice did:** added a `LEGACY SCHEMA -- QUARANTINED. DO NOT APPLY.` banner to the top of
the file (comment only; no SQL changed), and pinned the unsafe set in
`tests/legacy-schema-risks.test.mjs` so it cannot grow unnoticed and so removing an entry forces a
recorded decision.

**What this slice deliberately did NOT do:** drop or alter a single table, policy or function, in
the file or in any database. Two reasons. (1) These policies are the only write path the currently
deployed UI has; removing them before the replacement read/write path exists breaks a live site to
fix a schema that is already superseded on paper. (2) rev. 5.3 assigns the retirement to **Phase 2**
("Retire the legacy Supabase project's write paths", with a test proving the old policies are gone),
after the P2 public functions exist. Doing it early would be out of sequence, not ahead of schedule.

**The risk therefore remains live in production and is not mitigated by this slice.** It is
mitigated by P2. Recorded as open, not as handled.

**Status:** QUARANTINED IN REPO; **live risk OPEN**, owned by P2.

---

## D-25 — Correction to the D-4 baseline: `spot-directory.test.mjs` is 16 assertions, not 54

**Finding.** D-4 records `N` as 12 files / 137 assertions with a per-file table. Re-counting the
committed tree at `aa7b306` with the same instrument (source-level `assert.*` call sites) reproduces
**eleven of the twelve rows exactly**. The twelfth, `spot-directory.test.mjs`, contains **16**
assertion calls in 32 lines, not the recorded 54. `git log` shows the file's last change was
`be6ec65`, well before the P0 slice, and it contains no loops that could make executed assertions
exceed written ones.

Eleven exact matches and one 38-assertion gap is not a methodology difference; the recorded 54 most
plausibly counted a working-tree version of that file which D-16.10 lists as uncommitted at the time
and which never reached a commit.

**Correction.** The committed baseline is **12 files / 99 assertions**, not 12 / 137. Later gates
that reference `N` must use 99 for the pre-rebuild baseline. D-4's other eleven rows stand.

**After this slice:** **16 files / 178 assertions**, all green — the 12 baseline files unchanged, plus
four new files (`sql-migration-harness` 33, `offer-state-machine` 27, `legacy-schema-risks` 10,
`domain-boundaries` 9 = 79 new).

**Status:** CORRECTED. This is a bookkeeping fix, not a test regression: no test was deleted or
weakened by any slice, and the suite is green.

---

## D-26 — `lib/domain` created; its half of the boundary rule is now enforceable

**Decision:** `src/lib/domain/` is created with the rev. 5.3 §8 M3 offer state machine expressed as
committed data (`offer-state.ts`) and a barrel documenting the boundary (`index.ts`).

**This closes half of D-10, and only half.** D-10 deferred the boundary rule because its subject did
not exist — with no `lib/ai`, a `no-restricted-imports` rule against it could not be made to fail.
That reasoning still holds for the `lib/ai` half. But the rule has two halves, and the other one —
*`lib/domain/**` may import `lib/supabase` only; never React, never `lib/ai`* — now has a subject,
so it is enforced today by `tests/domain-boundaries.test.mjs` (allowlist check on every import
specifier, plus a `.tsx`/`'use client'` ban). That test also asserts `src/lib/ai` still does not
exist, so the day it appears, the test fails and the ESLint rule becomes due in the same change.

**Why a test rather than the ESLint rule:** the test fails inside `npm run test`, which is the gate
rev. 5.3 §12 constraint 7 requires output from. The ESLint rule lands with the P1 restructure, when
route groups and `lib/ai` paths exist for it to reference.

**On the state machine:** it is a transcription of the §8 M3 diagram, asserted edge-for-edge — the
test declares the spec's edge list independently and requires the module's table to equal it exactly,
so a stray edge fails as loudly as a missing one. It is a **reference, not an enforcement point**:
rev. 5.3 §12 constraint 6 makes the SECURITY DEFINER SQL functions authoritative. Those functions do
not exist yet (`offers` is a P1 table); pinning the machine first means they have something committed
to be checked against.

**Status:** DONE. D-10's `lib/ai` half remains DEFERRED, unchanged.

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

1. ~~**D-19** — bump `next` to 14.2.35 (critical advisory), verify all gates, drop the waivers.~~
   **DONE 2026-08-14** — see the dependency-security slice record below. Superseded by **D-20**
   (Next 15 migration for the eight residual high advisories), which is no longer the *smallest*
   next slice and should be sequenced against the items below rather than ahead of them.
2. ~~**D-13** — human decision: transplant `Sluglines-AI`'s core into this repo, or rebuild here.~~
   **DECIDED 2026-08-14 — rebuild.** See D-13 and the rebuild-foundation slice record below.
3. **D-6** — authorise the two blocked verification reads (U2, U3).
4. **D-15** — start the `[H]` long-lead items now: `SluglinesAgent` rotation (High severity, and a
   Phase 1 entry criterion), founding-driver recruitment, and the two-week WhatsApp volume baseline.

---

## Dependency-security slice — 2026-08-14

Follow-on to D-19. Scope deliberately limited to dependency versions; no application code touched.

### Version changes

| Package | Before | After | Kind |
|---|---|---|---|
| `next` | `14.2.0` | `14.2.35` | patch, same 14.2.x line |
| `eslint-config-next` | `14.2.0` | `14.2.35` | patch, kept in lockstep with the Next 14 runtime |
| `postcss` (direct devDep) | `^8.4.38` (resolved 8.5.8) | `^8.5.26` | minor, within existing range |
| transitive (`npm audit fix`) | — | — | non-breaking only; cleared `nanoid`, `ws`, `brace-expansion`, `minimatch`, `js-yaml` |

`eslint-config-next` was held on the 14.2 line on purpose: npm's suggested fix is `16.3.1`, which
would outpace the pinned Next 14 runtime. It moves with the runtime in the D-20 migration.

### Files changed

| File | Change |
|---|---|
| `package.json` | `next`, `eslint-config-next`, `postcss` version bumps |
| `package-lock.json` | regenerated by `npm install` + `npm audit fix` |
| `.github/audit-exceptions.json` | 12 entries → 3; `next` and `postcss` rewritten and narrowed |
| `Docs/DECISIONS.md` | D-19 closed; D-20 added; this record |

### Waivers removed (advisories no longer reported)

`@next/eslint-plugin-next`, `eslint-config-next`, `@typescript-eslint/parser`,
`@typescript-eslint/typescript-estree`, `brace-expansion`, `minimatch`, `js-yaml`, `nanoid`, `ws`.

### Waivers retained (narrowed, with re-checked reasons)

`next` (8 high, need ≥ 15.5.21 — expiry 2026-10-15), `postcss` (2 high, next-bundled 8.4.31 only —
expiry 2026-10-15), `glob` (1 high, dev lint toolchain — expiry 2026-11-14).

**No new waivers were added, and no waiver expiry was extended.**

### Verification

| Command | Result |
|---|---|
| `npm run test` | **PASS** — exit 0 |
| `npm run lint` | **PASS** — exit 0; same 4 pre-existing warnings, no regression |
| `npm run typecheck` | **PASS** — exit 0 |
| `npm run build` | **PASS** — exit 0; 405 static paths, unchanged from the pre-bump baseline |
| `npm run audit:check` | **PASS** — exit 0; 11 advisories ≥ high, 11 waived, 0 unwaived, 0 expired |
| `npm audit` | 14 vulns (2 low, 11 high, **1 critical**) → **7 (2 low, 5 high, 0 critical)** |

**GHSA-f82v-jwr5-mffw (critical, Authorization Bypass in Next.js Middleware) no longer appears in
`npm audit` output.** The repo now has zero critical advisories.

---

## Rebuild-foundation slice — 2026-08-14

The first implementation slice under D-13. Scope held deliberately narrow: establish the harness
and the security posture, not the product.

### Files changed

| File | Change |
|---|---|
| `Docs/DECISIONS.md` | D-13 closed (rebuild, consequences, 11-step sequence to P1/P2); D-21..D-26 added; this record |
| `supabase/migrations/README.md` | **New** — harness conventions, rules R1–R11 with sources, analyser limits, apply policy |
| `supabase/migrations/0001_rebuild_foundation.sql` | **New** — `members`, `audit_events`, `presence_checkins`; default-deny RLS; 7 SECURITY DEFINER functions. `APPLIED: no` |
| `scripts/sql-lint.mjs` | **New** — static SQL security analyser + CLI. Node built-ins only |
| `src/lib/domain/offer-state.ts` | **New** — rev. 5.3 §8 M3 state machine as committed data |
| `src/lib/domain/index.ts` | **New** — barrel + boundary documentation |
| `tests/sql-migration-harness.test.mjs` | **New** — 33 assertions; positive + one negative fixture per rule |
| `tests/legacy-schema-risks.test.mjs` | **New** — 10 assertions; pins the D-24 unsafe set |
| `tests/offer-state-machine.test.mjs` | **New** — 27 assertions; edge-for-edge against §8 M3 |
| `tests/domain-boundaries.test.mjs` | **New** — 9 assertions; §8 dependency rule for `lib/domain` |
| `supabase/schema.sql` | Quarantine banner only — a leading SQL comment block. **No SQL statement was added, removed or altered** (D-24) |
| `package.json` | Added the `sql:check` script. No dependency changes |

Two pre-existing tracked files were touched, both minimally and both because the task required it:
`supabase/schema.sql` (comment-only banner — the slice's whole point is that this file must not be
applied, and the file itself is where that has to be said) and `package.json` (one script line).
Nothing else in the working tree was modified; the tree was clean at slice start, the earlier
in-flight UI work having landed in `698ce45`.

### Not done, deliberately

| Item | Why |
|---|---|
| Applying any migration to `bwpguotjzczmieeepczf` | Out of scope and unauthorised. `APPLIED: no` |
| Dropping the legacy unsafe policies | rev. 5.3 Phase 2 work; would break the live write path (D-24) |
| Live RLS tests | No non-production target exists (D-7, D-23) |
| `lib/ai` or any assistant path | Phase 5. D-10's `lib/ai` half stays deferred |
| Wiring `lib/domain` into the UI | Not needed by any test; would enlarge the review surface |
| Retargeting PR #1 per D-13 consequence 4 | GitHub-side action; this slice was not authorised to push |
| `0025_product_events.sql` content | Still deferred; the harness that blocked it now exists (D-22) |

### Verification

| Command | Result |
|---|---|
| `npm run test` | **PASS** — exit 0; 16 files / 178 assertions (12 baseline files unchanged + 4 new) |
| `npm run lint` | **PASS** — exit 0; the same 4 pre-existing warnings, no new ones |
| `npm run typecheck` | **PASS** — exit 0 |
| `npm run build` | **PASS** — exit 0; route table unchanged, `/dashboard` and `/spots/[slug]` dynamic, the rest static |
| `npm run audit:check` | **PASS** — exit 0; 11 advisories >= high, 11 waived, 0 unwaived, 0 expired. No waiver added, removed or extended |
| `npm run sql:check` | **PASS** — exit 0; 1 migration, 47 statements, 0 violations |

The analyser's ability to fail is evidenced inside `npm run test` rather than by a manual negative
run: every rule R1–R11 has an unsafe in-memory fixture asserting the exact rule set it triggers.

**Not verified, and not claimed:** no database was contacted; no Supabase, Vercel or GCP state was
read or changed; the CI workflows were not observed running on GitHub.

### Recommended next slice

**Stand up a non-production database target, then apply `0001` to it and write the live RLS tests**
(D-13 steps 4–5, closing D-23 and D-7). That is the single highest-value next move, because every
remaining rebuild step depends on being able to prove a policy *behaves*, and right now nothing in
this repo can.

It needs two human inputs first, neither of which an implementing session can supply:

1. **D-7** — does the Supabase plan for `bwpguotjzczmieeepczf` include preview branches? Answer
   picks preview-branch vs. second project.
2. **Explicit authorisation** to create and write to that target.

If both are blocked, the next-best slice is **D-13 step 7** — the M3 `offers`/`reservations`
migration with its state-machine SQL functions, checked against the now-committed
`src/lib/domain/offer-state.ts`. It is fully static work, needs no database, and extends the same
harness this slice built.

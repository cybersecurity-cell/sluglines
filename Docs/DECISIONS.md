# Sluglines — Decision Log

Append-only decision record. Each entry states the decision, the evidence behind it, and its
status. Nothing here is inferred: where a fact could not be verified within this session's
authorised scope, the entry says `PENDING` or `BLOCKED` and names what is needed to close it.

**Architecture input:** `Docs/consolidated-architecture.md` — currently **rev. 6**. Entries below are
dated; each was written against the revision current at its own date, and D-1 records rev. 5.3 as
the one originally adopted.
**First slice executed:** P0-adapted (see D-3), 2026-08-14, on branch `codex/phase-3-4` — since
merged as PR #1. **`main` is now the only live branch.**

---

## D-1 — rev. 5.3 adopted as the architecture input

**Decision:** `Docs/consolidated-architecture.md` **rev. 5.3** is adopted as the governing
architecture and product plan for Sluglines.

**Header verification (required by the rev. 5.3 §12 preamble):** the source file's `**Status:**`
line reads *"Proposed rev. 5.3"*. Verified before any change was made. The document was copied
byte-identically into this repo at `Docs/consolidated-architecture.md` (`diff` clean
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

> **CLOSED 2026-08-22 by D-40.** The staging target is the Supabase preview branch
> `phase-3-4-staging` (`xqonrogwwytkmqfinszp`) — rev. 5.3's own default. The plan question this
> entry could not answer was settled by demonstration: the branch has existed and been healthy since
> 2026-08-14 (D-28), so branching is available and no second project is needed. Vercel's
> non-production environments now point off production accordingly. Original text preserved below.

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

**Status:** ~~PENDING (blocking nothing before P3).~~ **CLOSED 2026-08-22 — see D-40.**

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
| 2 | Rebuild-foundation migration: `members`, `audit_events`, `presence_checkins`, default-deny RLS, SECURITY DEFINER writers | 1 | **DONE**, applied to preview (D-22 **CLOSED**, D-28) |
| 3 | `lib/domain` boundary + offer state machine as committed data | — | **DONE** (D-26) |
| 4 | Live-database RLS test harness (positive + negative), against a non-production target | staging choice (D-7) | **DONE** (D-28) — `tests/live-rls.test.mjs`, 38 assertions against `xqonrogwwytkmqfinszp` |
| 5 | Apply migrations `0001+` to a real database | 4, and explicit operator authorisation | **DONE for preview** (D-28, D-30) — `0001`–`0003` applied to the branch; production untouched, `0004` unapplied anywhere |
| 6 | M2 identity: phone-OTP wiring, `/login` `/verify` `/onboarding`, OTP abuse controls | 5, D-8 | **OPEN** |
| 7 | M3 offers/reservations tables + the state-machine SQL functions (revision checks, idempotency keys), checked against step 3's committed table | 5, 6 | **WRITTEN, unapplied and unproven** (D-27) — the SQL exists and is statically verified; 5 and 6 still gate any claim that it *works* |
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

**Mapping** (so no later session re-derives it). The right-hand column was "next free ordinal"
when this decision was written; every ordinal that has since been allocated is now named, which is
what closes it:

| rev. 5.3 filename | This repo | Phase | State |
|---|---|---|---|
| — (new; no rev. 5.3 equivalent) | `0001_rebuild_foundation.sql` | rebuild foundation | **APPLIED** to preview (D-28) |
| — (new; no rev. 5.3 equivalent) | `0002_ride_coordinator_state.sql` | M3 state machine | **APPLIED** to preview (D-28) |
| — (new; a correction to `0002`) | `0003_resolve_transition_conflicts.sql` | M3 conflict codes | **APPLIED** to preview (D-30) |
| `0026_full_spot_directory.sql` | **`0004_spot_locations_directory.sql`** | P1 | Written, `APPLIED: no` |
| `0027_public_aggregates.sql` | **`0005`** — next free ordinal | P2 | Not written. The two function *names* are already pinned by `lib/domain/public-counts.ts`, which is the contract this file must satisfy |
| `0025_product_events.sql` | next free ordinal when M10 is built | P0 content, deferred | Not written (D-11.1) |

**Why this closes rather than stays open.** The decision itself — renumber, treat rev. 5.3
filenames as content specs — was never in doubt after it was taken; what kept it open was that its
mapping pointed at ordinals nobody had allocated yet, so a later session still had to guess where
`0026`'s content would land. Two of the three unallocated rows are now allocated and one is pinned
by name from the TypeScript side. There is nothing left in this decision that a future session
could get wrong by reading it.

The `APPLIED:` state above is recorded here for navigation only. The rule in
`supabase/migrations/README.md` still stands: **only the session that applies a file changes that
file's header**, and no committed migration may claim `production` (enforced by
`tests/sql-migration-harness.test.mjs`).

### `0001_rebuild_foundation.sql` — what it contains and its applied state

Three tables, chosen because rev. 5.3 specifies them completely enough to write without inventing
anything: `members` (§8 M2), `audit_events` (§8 M7), `presence_checkins` (§8 M4). Plus seven
functions forming the entire write path.

**APPLIED: preview** (was `no` when this was written; D-28 applied it to the `phase-3-4-staging`
branch and changed the header). It has **not** been run against `bwpguotjzczmieeepczf`. The file
carries an `APPLIED:` header line, a test asserts no committed migration claims `production`, and
that line is only changed by the session that actually applies it.

Posture: RLS enabled on every table; **zero** insert/update/delete policies for any role; the three
SELECT policies are `to authenticated` with real predicates; every write goes through a
SECURITY DEFINER function that takes the actor from `auth.uid()` rather than from its arguments;
every function is revoked from `PUBLIC` before anything is granted back.

That last point is the one worth stating explicitly, because it is the easy thing to get wrong:
**Postgres grants `EXECUTE` on a new function to `PUBLIC` by default.** A migration can satisfy
every RLS rule and still hand anonymous callers a write path through the very functions that bypass
RLS. Analyser rule R9 exists for that, and it is the rule most likely to catch a future mistake.

**Status:** **CLOSED.** The renumbering is settled and every rev. 5.3 filename now maps to a named
ordinal in this repo or to a rule that names one. `0001` is applied to preview and proven live
(D-28); production is untouched.

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

## D-27 — M3 state machine written in SQL, out of sequence, and verified only statically

**Decision:** `supabase/migrations/0002_ride_coordinator_state.sql` implements the rev. 5.3 §8 M3
Ride Coordinator state machine — `offers`, `reservations`, `offer_pickup_details`, and the two
tables rev. 5.3 §12 constraint 6 implies but does not name (`offer_transitions`,
`offer_idempotency_keys`) — with every transition a SECURITY DEFINER function carrying a revision
check and an idempotency key.

**It is taken out of the D-13 order deliberately, and the cost is stated first.** D-13 sequences
step 7 behind step 5 (a real database) and step 6 (M2 identity). Neither exists. This slice was
directed to proceed on the static harness anyway, which is a legitimate call — the SQL is fully
writable without a database and the *shape* properties are fully checkable without one — but it
means the following are **written and unproven**, not done:

| Claim | Status |
|---|---|
| The SQL contains no anonymous or authenticated direct write path to `offers`/`reservations` | **Proven statically** — `sql:check` + `tests/sql-migration-harness.test.mjs` |
| The SQL edge list is the rev. 5.3 §8 M3 graph and matches `lib/domain` | **Proven statically** — the test parses `offer_transition_allowed()` and compares it |
| Every transition takes a revision and an idempotency key, claims before applying, completes after | **Proven statically** — asserted per function, including ordering within each body |
| Any policy predicate is *correct* | **Unproven.** Needs a live Postgres (D-23) |
| The SECURITY DEFINER visibility helpers actually break RLS recursion | **Unproven.** The construction is standard; it has not been executed |
| The `FOR UPDATE` + revision pairing actually stops a concurrent oversell | **Unproven.** Concurrency is not observable in a text analyser |
| The file parses as SQL at all | **Unproven.** No Postgres has read it |

That last row is not pedantry. A static analyser proves things about the *text*; it does not
compile SQL. Nothing in `0002` may be described as working until step 5 exists.

### Design decisions taken while writing it, each with its reason

1. **`RELEASED` is transient, and two outcomes are two hops.** §8 M3 has no `OPEN -> RESERVED`
   edge, yet a one-seat offer plainly fills in one call; and it draws release as
   `RESERVED -> RELEASED -> OPEN`. Rather than invent a shortcut edge, both cases apply two hops
   through the same choke point inside one transaction. Each hop is revision-checked and recorded,
   and no client ever observes an offer sitting in `RELEASED`. The alternative — adding
   `OPEN -> RESERVED` to the graph — was rejected because the graph is a transcription, and a
   transcription that adds convenient edges is not one.
2. **The partial-unique index covers `ACTIVE` *and* `CONFIRMED`, not `ACTIVE` alone.** rev. 5.3's
   one-line summary says "partial-unique ACTIVE constraint". Read literally, the index stops
   holding the moment a reservation is confirmed, and a rider could take a second seat on the same
   offer. The index covers every state that occupies a seat, which is the constraint the summary
   describes. This is a strengthening, recorded because it is a deviation from the literal text.
3. **Idempotency claims are a separate table from the hop ledger.** One operation applies zero, one
   or two hops; a client retries *operations*. Keying idempotency off the ledger would leave a
   zero-hop operation (a rider taking one of three seats — seats move, state does not) with nothing
   to replay against. The claim's primary key is the serialisation point: a concurrent duplicate
   blocks on it rather than double-applying.
4. **A seat change with no state change still bumps the revision.** Otherwise two callers holding
   revision 4 both act on a seat count only one of them can still see.
5. **Corridor scoping of `offers_visible_for_caller` is NOT implemented.** rev. 5.3 §8 M3 scopes
   board visibility to "corridor pairs touching their active location set", which is defined
   against the §11 P1 locations directory — a table that does not exist. The committed policy is
   the strictly wider read (every `OPEN`/`PARTIALLY_RESERVED` offer) plus the participant clause
   exactly as specified. During the pilot's single corridor pair these are the same set, and the
   later change is a *narrowing*, so no member gains visibility by the deferral. Writing a scoping
   predicate against an absent table would have been a guess.
6. **`NO_SHOW` is absent from the reservation CHECK list.** rev. 5.3 §11 Phase 4 owns the no-show
   flow and this slice ships no writer for it. A state with no writer cannot be reached; committing
   it would make the machine look more complete than it is.
7. **`apply_offer_transition()` and `offer_expire_sweep()` are granted to nobody.** A
   client-callable "apply any transition" function would be a hole straight through every
   authorisation check in the entry points that call it. The test asserts the ungranted set by name.

**Status:** DONE as a static artefact. **Not applied, not executed, not behaviourally verified.**
D-23 is unchanged and now covers more surface than before.

---

## Changes made in this slice

| File | Change |
|---|---|
| `Docs/DECISIONS.md` | **New** — this file |
| `Docs/consolidated-architecture.md` | **New** — rev. 5.3 committed to the repo (byte-identical copy) |
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

> **Taken 2026-08-14.** Both human inputs were still blocked, so the fallback was executed. See the
> M3 ride-coordinator slice record below and **D-27**.

---

## M3 ride-coordinator slice — 2026-08-14

D-13 step 7, executed on the static harness because steps 4–5 remain blocked on the two human
inputs above. Full rationale and the honest limits of what this proves are in **D-27** — read that
before treating any of it as working software.

### Files changed

| File | Change |
|---|---|
| `supabase/migrations/0002_ride_coordinator_state.sql` | **New** — 5 tables, 5 read-only policies, 18 functions (12 client-callable), the §8 M3 edge list. `APPLIED: no` |
| `src/lib/domain/offer-transitions.ts` | **New** — the operation catalogue (which function owns which edge), revision and idempotency guards, SQLSTATE map, reservation states |
| `src/lib/domain/offer-state.ts` | Added `transitionPath()`, `stateAfterReservation()`, `stateAfterRelease()`; header now points at the SQL that enforces the machine |
| `src/lib/domain/index.ts` | Barrel re-exports for the above |
| `tests/offer-state-machine.test.mjs` | 27 → 127 assertions; adds the operations invariant, the guards, and the SQL↔TypeScript cross-check |
| `tests/sql-migration-harness.test.mjs` | 33 → 48 assertions; per-table M3 write-path proof, the granted-function allowlist, and an unsafe-`offers` negative fixture |
| `Docs/DECISIONS.md` | D-13 step 7 status; **D-27**; this record |

No other file was touched. No dependency changed. `supabase/schema.sql` was not read into anything
and not modified.

### What is actually enforced, and by which gate

| Property | Gate |
|---|---|
| Zero anonymous or authenticated direct write to `offers`, `reservations`, `offer_pickup_details`, `offer_transitions`, `offer_idempotency_keys` | `sql:check` R4/R7/R11 + a per-table block in `sql-migration-harness.test.mjs` naming each table, its RLS, its revokes, its single SELECT-only policy |
| Nothing in `0002` is granted to `anon` or `public` | harness test, over every `grant` statement in the file |
| Every SECURITY DEFINER function is revoked from `PUBLIC` | `sql:check` R9 |
| Only 12 named functions are callable by `authenticated`; the choke point and sweep are callable by nobody | harness test, by exact list |
| The SQL edge list equals the rev. 5.3 §8 M3 graph and `lib/domain`'s table | `offer-state-machine.test.mjs` parses `offer_transition_allowed()`'s `VALUES` list |
| `offers.state` CHECK equals the domain state set; `reservations.state` CHECK equals the domain reservation set | same test |
| Every client transition takes `p_expected_revision` and `p_idempotency_key`, claims the key before applying, completes it after, and returns early on replay | same test, per function, asserting order of operations inside each body |
| The choke point locks, *then* compares the revision, *then* checks the edge, *then* writes | same test, by index ordering in `apply_offer_transition()`'s body |
| A revision steps by exactly one | the ledger CHECK constraint, asserted by the test |
| No client entry point lets a caller name the actor (it is always `auth.uid()`) | same test — this is rev. 5.3 §14 risk 1 in a new shape |
| Every rule above can fail | negative in-memory fixtures, including an unsafe `offers` migration that must trip R4/R5/R6/R7 |

### Verification

| Command | Result |
|---|---|
| `npm run test` | **PASS** — exit 0; 16 files / 293 assertions (was 178) |
| `npm run lint` | **PASS** — exit 0; 0 errors, 2 warnings, both pre-existing in `.tsx` files this slice does not touch |
| `npm run typecheck` | **PASS** — exit 0 |
| `npm run build` | **PASS** — exit 0; 405 static paths, unchanged |
| `npm run sql:check` | **PASS** — exit 0; 2 migrations, 137 statements, 0 violations |
| `npm run audit:check` | **PASS** — exit 0; unchanged, no waiver added, removed or extended |

### Not done, deliberately

| Item | Why |
|---|---|
| Applying `0002` (or `0001`) to any database | Out of scope and unauthorised. `APPLIED: no` |
| Live RLS tests, and any claim that `0002` executes | No target exists (D-7, D-23). See D-27's table of unproven claims |
| Corridor scoping of offer visibility | Needs the §11 P1 `locations` table. D-27 item 5 |
| Waitlist, ETA/running-late, no-show, recurring templates, `completed_rides`, `app_settings` | rev. 5.3 §11 Phase 4+ |
| `/api/offers/*` and `/api/reservations/*` routes | Need M2 identity (D-13 step 6) to have a session to act as |
| Wiring `lib/domain` into any UI | Not needed by any test; would enlarge the review surface |

### Recommended next slice

**Unchanged: stand up a non-production database target and apply `0001`+`0002` to it** (D-13
steps 4–5). This slice has made that more valuable, not less — there is now a whole state machine
whose behaviour nothing in this repo can check, and every static gate above stops exactly at the
line where a live Postgres would begin. The two human inputs it needs are still the two named
above: the D-7 staging answer, and explicit authorisation to write to the target.

If those remain blocked, the next fully-static slice is **D-13 step 9's `0003` locations
directory** — the 43-spot seed. It has no database dependency, it is specified completely enough to
write without inventing anything, and it unblocks the corridor-scoping narrowing this slice had to
defer (D-27 item 5) as well as the `location_id` foreign keys `0001` and `0002` both left open.

---

## D-28 — A database exists: preview branch `phase-3-4-staging`, `0001`+`0002` applied, live RLS proven

D-23 recorded the harness's central limitation: *"a static analyser cannot prove a policy behaves
correctly"*, and D-27 closed on the same blocker — no target. Both are now discharged.

### The target

| | |
|---|---|
| Preview branch name | `phase-3-4-staging` |
| Branch project ref | `xqonrogwwytkmqfinszp` |
| Branch id | `0a891990-d161-4ee2-8b9c-37b92232455f` |
| Parent (production) | `bwpguotjzczmieeepczf` — **not written to** |
| Region / size | `us-east-2`, `micro` |
| Persistent | No. Ephemeral, billed while it exists |
| Created | 2026-08-14, `supabase branches create`, under the D-7 authorisation |

Recorded in `supabase/config.toml` as a named remote (`[remotes.staging]`) so `--remote staging`
resolves to the branch and never to the parent. Credentials are **not** in the repo: they are
fetched into `.env.preview.local`, which `.gitignore` already excluded via `.env.*`.

**The branch was a clean slate, which was checked rather than assumed.** It inherited two migration
history rows from the parent (`20260719025630 create_sluglines_ai_schema`,
`20260719031015 drop_stray_sluglines_ai_schema`) whose net effect is nothing — the branch's `public`
schema contained 0 tables, 0 functions and 0 policies. Because those two versions sort *after* the
local `0001`/`0002`, `db push` refused to run out of order. They were marked `reverted` with
`supabase migration repair` **on the branch only**; no SQL in this repo was skipped, altered or
forced, and the parent's history was not touched. This is the reconciliation the CLI itself
prescribes, and it is recorded because it is the only command in this slice that changed state
without applying a repo file.

### Migration result

`supabase db push` applied both files, in order, without error. The only output was three
`does not exist, skipping` NOTICEs from the files' own `drop trigger if exists` guards.

Post-condition, read back from the branch catalogue rather than inferred from the exit code:
**8 tables, all with `relrowsecurity = true`; 8 policies, every one `SELECT`-only and every one
`{authenticated}`; zero INSERT/UPDATE/DELETE/ALL policies; zero grants to `anon`.** The rev. 5.3 §12
constraint 2 and §6 posture holds in a real catalogue, not only in the file text.

Both files' `APPLIED:` headers now read `preview` and name the branch, per the rule in
`supabase/migrations/README.md` that only the applying session changes that line. The header
vocabulary is now `no | preview | production`, and `tests/sql-migration-harness.test.mjs` enforces
that **no committed migration may claim `production`** — that remains a separately authorised act.

### Live RLS evidence

`tests/live-rls.test.mjs` — **36 assertions, green, 4.2 s**, run as part of `npm run test`. It uses
real JWTs over PostgREST rather than `set role`, so it exercises the path the app will use. It skips
silently without credentials (so CI stays green) and **refuses to run against the production ref** —
both behaviours verified, the guard by pointing it at the parent and watching it abort before any
network call.

Negative — anonymous. Every one a database refusal (`42501`), not an empty result:

| Attempt | Result |
|---|---|
| `INSERT offers` / `INSERT reservations` | `42501 permission denied for table …` |
| `UPDATE offers` / `DELETE reservations` | `42501 permission denied for table …` |
| `SELECT offers` / `SELECT members` | `42501 permission denied for table …` |
| `RPC offer_create` | `42501 authentication required` — R10, no execute grant to `anon` |

Negative — **authenticated**, which is the case that matters, because a logged-in member is the
realistic attacker and holds a valid JWT:

| Attempt | Result |
|---|---|
| `INSERT offers`, `INSERT reservations` | `42501 permission denied for table …` |
| `INSERT offer_transitions` (ledger forgery) | `42501 permission denied for table …` |
| `UPDATE offer_transitions` (rewriting history) | `42501 permission denied for table …` |
| `UPDATE members SET role='moderator'` (self-promotion) | `42501 permission denied for table members` |

Positive — the same clients, the same JWTs, writing through the SECURITY DEFINER entry points. The
full rev. 5.3 §8 M3 happy path executed end to end, and the ledger recorded exactly seven hops, in
order, each bumping `revision` by exactly one:

`DRAFT→OPEN → OPEN→PARTIALLY_RESERVED → PARTIALLY_RESERVED→RESERVED → RESERVED→CONFIRMED →
CONFIRMED→ARRIVING → ARRIVING→PICKED_UP → PICKED_UP→COMPLETED` (revision 1 → 8).

Behaviours proven live that the static gate could not reach:

- the one-seat fill really is **two hops inside one transaction** (revision 2 → 4);
- a **replayed idempotency key** returns the first call's revision and moves nothing;
- `offer_confirm` also confirms the live reservation;
- **authorisation inside the functions**: a poster cannot reserve a seat on their own offer; a rider
  cannot confirm (`42501 only the poster may confirm this offer`);
- the **visibility predicate behaves as a predicate**, not as a blanket: a non-participant cannot see
  a `DRAFT`, *can* see the offer while `OPEN` (the board-read half), and cannot see it again once
  `RESERVED`, nor its reservations, nor its ledger;
- **pickup details are confirmed-participants-only** — the confirmed rider reads them, the outsider
  gets zero rows.

**Status:** APPLIED to preview and PROVEN live. D-23's owed live suite is delivered. Production
remains untouched and unproven.

---

## D-29 — Revision conflicts raise SQLSTATE `40001`, which PostgREST retries into a 125-second timeout

**Found by the D-28 suite on its first run, and it is the reason that slice was worth doing.**

`apply_offer_transition` raises a revision conflict with `errcode = '40001'`
(`serialization_failure`), and `claim_offer_operation` uses the same code for an in-flight key.
`src/lib/domain/offer-transitions.ts` publishes it as `TRANSITION_ERRCODES.CONFLICT`. The name reads
correctly — this *is* an optimistic-concurrency failure — but `40001` is the class the stack treats
as **transient and automatically retryable**, and a revision conflict is permanent: every retry
re-reads the same revision and fails identically.

Measured on the branch — same offer, same call:

| Path | Elapsed | Result |
|---|---|---|
| PostgREST `rpc offer_publish`, stale revision | **125,058 ms** | `upstream request timeout`, **no SQLSTATE** |
| The same call, direct SQL | 382 ms | `40001: revision conflict: offer … is at revision 2, caller expected 1` |
| PostgREST, illegal transition (`55000`) | 209 ms | clean structured error |

So the SQL is correct and the SQLSTATE *choice* is wrong. The impact is not cosmetic:

1. The most ordinary contention outcome in the whole design — two members acting on one offer, one
   holding a stale revision — becomes a two-minute hang ending in a 504.
2. It defeats the stated purpose of `TRANSITION_ERRCODES`. That constant's own doc-comment says the
   §10 UI distinction *"seat just taken vs. a network failure"* is `CONFLICT` versus a transport
   error. Through the data API the conflict **is delivered as** a transport error, so the UI cannot
   tell them apart and will show "something went wrong" for the one case rev. 5.3 asks it to explain.
3. Each occurrence holds a connection for ~125 s, so modest contention is a pool-exhaustion risk.

**A second finding, about the test rather than the code.** The assertion covering this path *passed*
on the first run — it asked only "was there an error?", and a gateway timeout is an error. A codeless
transport failure is not evidence that a policy or a revision check did anything. `expectRefused` now
requires the error to carry a SQLSTATE, so this class of false green cannot recur; that change is why
the run reports 36 assertions rather than 37.

**Not fixed in this slice, deliberately.** The fix is a one-token change to the raised code, but that
code is a published cross-file contract (SQL × `lib/domain` × `offer-state-machine.test.mjs`), and
choosing its replacement — and the HTTP status it should map to — is a design decision belonging to
the M3 author, not to the session that happened to stand up a database. `0002` is applied, so the
harness's append-only rule makes the vehicle a new `0003`, not an edit.

The live check is therefore committed but **gated off** (`LIVE_RLS_CONFLICT_PATH=1`), because it
costs over two minutes per run. It asserts the property that matters — that a conflict is refused
*promptly* and *with a SQLSTATE* — rather than any particular replacement code, so it will pass on
the fix and needs no rewrite. Both `0002`'s header and this entry record the defect so it cannot be
rediscovered as a surprise in production.

**Status:** ~~OPEN. Present in `0002` as applied to preview; **not** in production, which has no
migration applied. Owned by the next slice.~~ **CLOSED 2026-08-14** by
`0003_resolve_transition_conflicts.sql`, applied to preview and proven live. The replacement codes,
the reasoning behind them and the measurements are in **D-30**.

---

## D-30 — D-29 closed: conflicts raise `PT409` / `PT425` and are refused in 80 ms

**Decision:** the two conflict paths in the M3 write path stop raising SQLSTATE `40001` and raise
PostgREST's `PTnnn` form instead. `0003_resolve_transition_conflicts.sql` re-creates the two
functions that raised it:

| Path | Was | Now | Meaning to a caller |
|---|---|---|---|
| `apply_offer_transition` — revision conflict | `40001` | **`PT409`** → HTTP 409 | Permanent for the revision held. Re-read the offer and decide again. **Never retry.** |
| `claim_offer_operation` — key still in flight | `40001` | **`PT425`** → HTTP 425 | Genuinely transient: the first call is mid-transaction. Retrying the *same key* is safe and returns that call's result. |

**Why not `40001`.** It is `serialization_failure`, the class the stack treats as transient and
retries automatically. A revision conflict is permanent — every retry re-reads the same revision and
fails identically — so the retry loop ran until the gateway gave up. D-29 measured it: **125,058 ms,
`upstream request timeout`, no SQLSTATE at all.** The conflict was therefore delivered to the client
as precisely the transport error that `TRANSITION_ERRCODES` exists to be distinguishable from, which
is the rev. 5.3 §10 requirement ("seat just taken" vs. "something went wrong") failing in the one
case it was written for.

**Why `PTnnn` and not `P0001`.** Both fail fast, which is the property that matters. `PTnnn` is
PostgREST's documented escape hatch: the code sets the HTTP status of the response, so the refusal is
a `409` to a caller that only reads the status line *and* carries its SQLSTATE to one that reads the
body. `P0001` was rejected because it is what every un-coded `RAISE` in Postgres produces, so it
cannot serve as the stable published contract `src/lib/domain/offer-transitions.ts` needs — a UI
branching on `P0001` would be branching on "some function raised something".

**Why a new file rather than an edit.** `0002` is applied to preview and this harness is append-only
(D-21), so the correction is a later `create or replace` on an unchanged signature. `0002` keeps its
`KNOWN DEFECT` header, which is now the historical record of a closed defect rather than a live
warning; `tests/offer-state-machine.test.mjs` was changed to read the **last** definition of each
function across the sequence, because reading `0002` alone would now assert a definition no database
runs. That test also asserts `0003` re-creates `0002`'s exact signature — a changed parameter would
create an overload and leave the defect live — and that normalising the codes back makes the two
bodies identical, i.e. that nothing else moved.

**Measurement, same call, same offer, on the preview branch:**

| Path | Before (D-29) | After (`0003`) |
|---|---|---|
| PostgREST `rpc offer_publish`, stale revision | 125,058 ms, `upstream request timeout`, no SQLSTATE | **80 ms, HTTP 409, `PT409: revision conflict: offer … is at revision 2, caller expected 1`** |

**Evidence.** `tests/live-rls.test.mjs` — the D-29 block is **no longer gated**. `LIVE_RLS_CONFLICT_PATH`
is gone; the check runs on every live run and asserts all three properties that were broken: the
refusal is prompt (< 15 s), it carries `TRANSITION_ERRCODES.CONFLICT`, and it arrives as HTTP 409. It
also asserts the refused call applied nothing — revision and state unmoved. **38 assertions passed
against `xqonrogwwytkmqfinszp`.**

**Caller-side half.** `lib/domain` now publishes `isConflictError()`, `isRetryableError()`,
`transitionErrcodeOf()` and `isTransitionErrcode()`, so the §10 distinction is a function call rather
than a string comparison each call site reinvents. `transitionErrcodeOf()` returning `undefined` is
load-bearing, not a fallback: a refusal with no SQLSTATE is a transport failure, and D-29 was exactly
the bug where a real conflict arrived looking like one.

**Status:** CLOSED. `0003` APPLIED to preview and PROVEN live. Production remains untouched: it has
no migration applied at all, so it has never carried the defect.

---

## D-33 — `/dashboard` rebuilt on the M1 aggregates and the `presence_checkins` writer

> **Numbering note.** This entry is D-33 because **D-31 and D-32 are cited by shipped code and
> tests but were never written into this log** — `lib/domain/locations.ts`, `SpotDetailLayout.tsx`,
> `0004_spot_locations_directory.sql` and four test files cite D-31 for the nullable-coordinate
> rule; `lib/legacy-redirects.ts` and two test files cite D-32 for the `/blog/**` `410` rule.
> Both numbers are therefore **reserved, not free**, and writing this slice into either one would
> silently redirect a dozen live citations at the wrong decision. Recording the gap rather than
> closing it over: the two entries are owed by whoever holds the context that produced them.

**Decision:** `/dashboard` is rebuilt as a **server-rendered** page over the §8 M1 public
aggregates and the `presence_checkins` row, and the client component that backed it is deleted.

### What was actually wrong with the page it replaces

`DashboardClient.tsx` mounted in the browser and issued `select` against **`riders`** and
**`drivers`**, matching on a `device_id` column, then rendered `LocationCard`s over a `spot_status`
table. All three tables were dropped by the rebuild (D-13). The consequences were not cosmetic:

| Symptom | Cause |
|---|---|
| Every spot showed 0 riders, 0 drivers | The tables the counts came from do not exist. A zero from a missing table is indistinguishable on screen from a quiet line — the exact confusion `SpotLiveCounts` was written to avoid on the public side |
| "Check out" appeared to work and cleared nothing | It issued `.delete()` on `riders`/`drivers`. Against the current schema there is nothing to delete; against `presence_checkins` there is **no delete policy for any role**, so a direct delete is refused by design (§6 default-deny) |
| Nothing rendered until after hydration | The counts, the check-in state and a realtime subscription were all client-side, on the one page whose audience is a commuter looking at a phone for a few seconds |

**This is the same defect class as the one M1 fixed on `/spots/[slug]`**, left behind on the
member-facing route because M1's scope stopped at the public surface.

### The four decisions inside this one

**1. Counts come from the M1 public functions, not from a second counting path.**
`get_public_spot_counts()` / `get_public_open_offer_counts()` via `lib/domain/public-counts.ts` —
the same source as the homepage strip and the spot pages. A signed-in member is deliberately *not*
shown a richer count than the aggregates support: a second path would be a second thing to keep
honest, and the §8 note that accepts corridor roll-ups as non-identifying was written about these
functions. They are §11 Phase 2 objects and are **not deployed**, so the board's live state today
is `unavailable`, and it says so instead of printing 41 rows of zero. On this page the fabricated
zero is worse than on the public one: a commuter who reads "0 waiting" and drives past has been
handed a measurement nobody took.

**2. Presence is read from `presence_checkins`, scoped by `auth.uid()`, and expiry is computed.**
The table is keyed by `member_id`, so the panel is singular by schema. `expires_at` comes from
`presence_checkin(..., p_ttl_minutes)`; an expired row stays readable until
`sweep_expired_presence()` runs, so "am I checked in" is computed against `expires_at` rather than
inferred from the row existing. The old two-hour client-side staleness window over `device_id` is
gone with the tables that held it.

`MemberPresence` has **four** states and they are rendered as four:

| State | Means | Rendered as |
|---|---|---|
| `checked-in` | A live row | Spot, direction, minutes left, the checkout button |
| `none` | Signed in, database answered, no live row | "You are not checked in anywhere" |
| `signed-out` | No session | "Your check-in is not visible here" — **not** "you are not checked in" |
| `unavailable` | The read or the auth call failed | "This panel is not saying whether you are checked in" |

Collapsing the last two into `none` would tell a member they are clear on the strength of a network
error, on the screen they check before walking away from a curb. That is the whole reason the
distinction is in the type rather than in a comment.

**3. Checkout is a Server Action calling `presence_clear()`.** Not a browser Supabase call, and
never a direct table write. Two independent reasons, and either would have been enough:

- **Correctness.** `presence_clear()` is the 0001 SECURITY DEFINER writer; it takes the actor from
  `auth.uid()` and deletes only that member's row. It is the only path RLS permits.
- **Weight.** Importing `@supabase/ssr` into the page cost **62 kB of route JavaScript / 162 kB
  first load**, measured by `next build`, to parse one button press. Server-side the same build
  reports **1.11 kB / 97.1 kB** — a 40% cut in first-load bytes on the page whose entire audience
  is someone on a commuter-lot cell signal. The form also works with JavaScript disabled.

A failed checkout redirects to `?checkout=failed` and is rendered; it is not swallowed. There is no
confirmation dialog, deliberately — checking out is cheap and reversible, and the failure it
prevents (a member who has driven off still showing as waiting) costs a driver a detour.

**4. Ordering is a product decision, and it is tested.** The caller's own check-in is pinned first;
then, when counts are `live`, busiest first with ties broken on riders waiting and then on name, so
two identical loads do not reshuffle rows a commuter is scanning by position. When counts are
`unavailable` there is nothing to rank by, so the board falls back to corridor → direction → name —
the grouping a commuter already knows — rather than an arbitrary order that *looks* like a ranking.
Alphabetical would put Bob's first every morning regardless of whether anyone is there.

### What this does *not* claim

- **Nothing here is proven against a database.** The domain half runs against fixtures; the wiring
  half is structural assertions on the route files. `presence_checkins` is applied to preview and
  its RLS is proven (D-28), but no test in this slice signs a member in and reads the panel.
- **`locations` (0004) is unapplied everywhere**, so the `presence_checkins.location_id` (uuid) →
  spot lookup is expected to fail today. An unresolved check-in is a first-class outcome: it is
  reported, and it is clearable. A member whose row cannot be *labelled* must not thereby lose the
  button that *deletes* it.
- **There is no sign-in surface** (§8 M2), so the state a real visitor lands in is `signed-out`.
  The board below the panel needs no account and renders regardless.

**Status:** DONE. Four gates green; no database was written.

---

## M3 dashboard slice — 2026-08-15

Rationale, and the limits of what it proves, are in **D-33**. D-22 is closed in the same change.

### Files changed

| File | Change |
|---|---|
| `src/lib/domain/fast-board.ts` | **New** — presence mapping (`presenceFromRow`, `isPresenceLive`, `minutesRemaining`), the `MemberPresence` four-state type, `buildFastBoard` and its ordering rule. Pure; no IO |
| `src/lib/dashboard.ts` | **New** — the IO half: `auth.getUser()`, the `presence_checkins` select, the `locations` id→spot lookup. Resolves every failure to a state; never throws. Re-exports `getPublicSpotCounts` |
| `src/app/dashboard/page.tsx` | **Rewritten** — server component; issues the counts and presence reads together, renders the panel and the board |
| `src/app/dashboard/actions.ts` | **New** — `clearPresence()` Server Action over `presence_clear()` |
| `src/components/FastBoard.tsx` | **New** — server-rendered table of every active line, with the `live` / `unavailable` split |
| `src/components/CheckInStatusPanel.tsx` | **New** — server-rendered status panel; the checkout form |
| `src/components/CheckOutButton.tsx` | **New** — the only client component on the page; `useFormStatus` pending state |
| `src/components/DashboardClient.tsx` | **DELETED** — read `riders`, `drivers` and `spot_status`, all dropped by D-13 |
| `src/lib/domain/index.ts` | Barrel re-exports for `fast-board.ts` |
| `tests/dashboard-fast-board.test.mjs` | **New** — 78 assertion calls (more at run time; several are inside loops): presence states, board ordering, the wiring, and the accessibility rules |
| `Docs/DECISIONS.md` | D-22 **CLOSED** (mapping completed, applied state corrected); sequence-table rows 2, 4, 5 brought in line with D-28/D-30; **D-33**; this record |

No dependency changed. No migration was written, edited or applied.

### What is enforced, and by which gate

| Property | Gate |
|---|---|
| The dashboard reads the M1 aggregate functions, not a second counting path | `dashboard-fast-board.test.mjs` — `getPublicSpotCounts` / `buildFastBoard` in the route file |
| It reads none of `spot_status`, `riders`, `drivers`, `alerts` | same test, by exact string, the same list `public-directory-ui.test.mjs` uses for the spot page |
| `DashboardClient.tsx` is gone, not merely unused | same test, `fs.existsSync` |
| Presence is scoped by `auth.uid()`, not by a device id | same test, over `src/lib/dashboard.ts` |
| Checkout goes through `presence_clear()`; no `.delete()` from any client | same test, over the action and the panel, with comments stripped so the prose about the ban does not satisfy it |
| The Supabase **browser** client is not imported by any dashboard file | same test, over all four page/component files |
| `unavailable` never renders as measured zero | same test — `activeFastBoardRows` returns `[]`, `spotsWithActivity` is 0, and the component carries both the "Quiet right now" and "not switched on yet" strings |
| An expired or unparseable `expires_at` is not a check-in | same test |
| An unresolved spot is still a check-in, and still clearable | same test |
| Exactly one row can be flagged `isCheckedIn` | same test, both availabilities |
| Ordering is stable between identical builds | same test, two builds compared |
| Counts are labelled in text and column-headed (§10, WCAG 1.4.1) | same test |
| `lib/domain/fast-board.ts` imports no React, no Next, no `lib/ai` | `domain-boundaries.test.mjs`, which walks the whole directory |

### Verification

| Command | Result |
|---|---|
| `npm run test` | **PASS** — exit 0; 24 files, `dashboard-fast-board: ok` among them. `live-rls` ran and reported **38 assertions passed against `xqonrogwwytkmqfinszp`** (unchanged by this slice) |
| `npm run lint` | **PASS** — exit 0; 0 errors, 2 warnings, both pre-existing and in files this slice does not touch (`how-it-works/page.tsx`, `RealTimeBoard.tsx`) |
| `npm run typecheck` | **PASS** — exit 0 |
| `npm run build` | **PASS** — exit 0; route table unchanged except `/dashboard`, which goes from **62 kB / 162 kB** to **1.11 kB / 97.1 kB** |

**No production database write.** No migration applied; `supabase db push` was not run. The only
database contact in the whole run is `tests/live-rls.test.mjs`, which targets the preview branch
under the existing D-7/D-28 authorisation and is unchanged by this slice.

### Not done, deliberately

| Item | Why |
|---|---|
| Check-*in* from the dashboard | `presence_checkin()` needs a `location_id` **uuid**, which only the unapplied `0004` `locations` table can supply. Checking *out* needs no id, which is why it ships and check-in does not |
| A signed-in end-to-end test of the panel | Needs M2 identity to have a session to be. The states are covered as fixtures |
| Realtime count updates | The M1 aggregate functions do not exist yet; a subscription to nothing is what the deleted component had |
| `HomeLocationGrid.tsx`, `LiveBoardPreview.tsx`, `RealTimeBoard.tsx`, `CheckIn.tsx` | **Dead code that still reads the dropped tables.** No route imports any of them (`RealTimeBoard` is the source of the one pre-existing lint warning). They are the same defect class as `DashboardClient`, but they are not this slice's route, and deleting four unrelated components inside a dashboard change would hide it. **Owed, and named here so it is not rediscovered as a surprise** |
| Writing D-31 and D-32 | See the numbering note in D-33. They are cited by shipped code; reconstructing someone else's reasoning into a decision log is how a log stops being evidence |

### Recommended next slice

**Write `0005_public_aggregates.sql`** — the two functions `lib/domain/public-counts.ts` has been
holding a typed contract for since M1, and which `tests/public-counts.test.mjs` already exercises
against a fake client.

It is the highest-value next step because it is the single unblock for **three** finished surfaces
at once: the homepage corridor strip, `/spots/[slug]`, and now the dashboard board are all written,
tested and rendering their `unavailable` state for want of the same two functions. Every one of
them turns from "the directory" into "what is happening right now" the moment it lands — and none
of them needs a line of UI changed to do it, which the `availability` split was designed for.

It is also fully specified and fully gated before it touches anything: the names, the row shape and
the string→number coercion are pinned in the domain module; `sql:check` R1–R11 apply; the preview
branch exists and `0001`–`0003` are proven on it (D-28, D-30). The one thing it must get right is
the §6 posture the analyser exists to check — SECURITY DEFINER, `revoke ... from public` before any
grant, and **counts only** in the return type, no member id and no timestamp.

Then, in order: **apply `0004`** to preview (it unblocks the uuid→spot lookup, dashboard check-in,
and corridor scoping), and **delete the four dead components** listed above.

---

## D-34 — One lineage, and it is this repo's `0001`–`0007`

**Decision:** the competing-`0001` question (issue #4) closes in favour of **`sluglines`'
`supabase/migrations/0001`–`0007`**. `Sluglines-AI`'s 24 migrations are **not** adopted, squashed,
or replayed. This is the lineage that `0001`–`0003` proved live on the preview branch (D-28, D-30)
and the one authorised for production on 2026-08-21.

**This supersedes one bullet of `Docs/2026-08-20-adr-sluglines-is-the-host-repo.md`** — *"Schema
ancestry: `Sluglines-AI`'s"* — and its two dependent bullets (*"Squash, don't reconcile"*,
*"`codex/phase-3-4` is demoted to a content contribution"*). Every other part of that ADR stands:
`sluglines` is the host repo, there is one Supabase project, and there is one lineage. The ADR was
right about the shape and wrong about which lineage fills it.

**Why the reversal, stated rather than assumed:**

1. **It contradicts D-13, which was never revisited.** D-13 decided (human, 2026-08-14) that the
   core is *rebuilt* in `sluglines`, not transplanted, and enumerated the consequences as
   commitments. `0001`–`0006` **are** that rebuild. The ADR's schema-ancestry bullet re-opened the
   question six days later without executing it, so the repo has been carrying two contradictory
   decisions and one implementation.
2. **The implementation is the one with evidence behind it.** `0001`–`0003` are applied to
   `xqonrogwwytkmqfinszp` with 38 live RLS assertions green (D-28, D-30). `Sluglines-AI`'s 24
   migrations have never been applied to any Sluglines project — the correction notice in the
   architecture doc establishes that as verified-and-false, not merely unverified.
3. **Adopting the other lineage is a different project.** The ADR itself says the absorption is
   also a Next 14→16 / React 18→19 / Tailwind 3→4 upgrade that "cannot be done incrementally". The
   app layer it would bring — the AI/chat layer and the ride-coordinator UI — is explicitly out of
   scope for P2. Nothing in the content cutover depends on it.
4. **Reversal stays cheap.** The ADR's own argument is that the decision is free while the database
   is empty and expensive afterwards. It is still empty. Whichever way this goes it must go before
   the pilot, and only one of the two candidates can be evidenced today.

**What is NOT decided here:** whether `Sluglines-AI` is absorbed *at all*, and on what timetable.
That question survives this entry intact; it is a repo-topology and upgrade decision, and it no
longer blocks applying a schema to production. Issue #3 (the per-tool kill switches) remains tied to
it.

### The three legacy tables, and why `0007` must land before `0001` reaches production

Read from `bwpguotjzczmieeepczf` on 2026-08-22, not inferred:

| Object | State |
|---|---|
| `spot_status`, `profiles`, `commute_log` | 3 tables, **0 rows each** |
| `spot_status` UPDATE policy `Anyone can update spot counts` | `to public`, `using (true) with check (true)` |
| `commute_log` INSERT `Auth insert commute log` | `to public`, `with check (true)` |
| `commute_log` SELECT `Public read commute log` | `to public`, `using (true)` |
| `profiles` SELECT/UPDATE | `to public`, scoped `auth.uid() = id` |
| Trigger `on_auth_user_created` on `auth.users` | live, runs `public.handle_new_user()` |
| `public.handle_new_user()` | body is `insert into public.profiles (id, email) values (new.id, new.email)` |
| `public.reset_daily_counts()` | zeroes `spot_status` counters |

Two consequences, and the second is the load-bearing one:

1. **Three unauthenticated write/read paths are live in production today.** rev. 5.3 §14 risk 4 and
   the live half of D-24, still open because D-24 correctly declined to drop them before a
   replacement existed. The replacement exists now.
2. **`0001` does not remove the legacy auth trigger; it adds a second one.**
   `on_auth_user_created_member` and `on_auth_user_created` would both be armed on `auth.users`
   insert. The moment identity works (#24), **every signup writes the member's email address into
   `profiles.email`** — `text unique not null` — which is precisely the duplication of an identity
   attribute into an application table that rev. 5.3 §6 forbids and that `0001`'s own comment on
   `handle_new_member()` singles out. This is not cleanup that can follow the apply; it is a
   precondition of it.

`0007_retire_legacy_tables.sql` drops the trigger, both functions, and the three tables, and asserts
its own post-condition so a partial apply cannot report success. It creates nothing, so R3–R11 have
no subject; `sql:check` reports 7 migrations, 173 statements, 0 violations.

`riders`, `drivers` and `alerts` are deliberately **not** in `0007`: they exist only in the
quarantined `supabase/schema.sql` and were never applied to production, which holds three tables and
not six. That file stays quarantined and `tests/legacy-schema-risks.test.mjs` keeps pinning its
unsafe set.

**Consequence for #19:** the production apply is `0001`–**`0007`**, not `0001`–`0006`. Applying the
authorised six without the seventh would arm the email-copying trigger described above.

**Status:** DECIDED. `0007` written, `APPLIED: no`. Nothing applied to any database by this entry.

---

## D-35 — Baseline `N` recounted to 28 files / 872 assertion call sites, and made machine-checked

**Supersedes D-25** (12 files / 99 assertions), which in turn corrected D-4 (12 / 137). This entry
is written rather than editing either, per the append-only rule D-25 itself followed.

**The recount, taken 2026-08-22 with D-25's instrument** — source-level `assert(` / `assert.method(`
call sites, counting what is *written* rather than what executes, which is the distinction that made
D-4's 137 unreproducible:

| | Files | Assertion call sites |
|---|---|---|
| D-4 (2026-08-14) | 12 | 137 — included a working-tree file that never landed |
| D-25 (2026-08-14) | 12 | 99 |
| Architecture header (2026-08-20) | 26 | not recomputed |
| **This entry (2026-08-22)** | **28** | **872** |

The 28th file is `tests/baseline-n.test.mjs`, added by this change; the 27th is the count the repo
already carried when issue #7 measured 26 — one further test file landed between that review and
this recount.

**Why the number keeps drifting, and what actually stops it.** Three sessions have now recorded a
different `N`, and each correction was itself prose in a document nothing checks. §11's gates are
written as *"no gate may reduce `N`"*, so a stale baseline is not a bookkeeping annoyance: it means
every gate compares against the wrong number **in the permissive direction**. At `N = 12`, a change
could have deleted sixteen test files and still cleared the gate.

So the number stops living only in prose. The architecture document's header is the single source of
truth, and `tests/baseline-n.test.mjs` re-measures the repo and fails when the two disagree. Adding
or removing a test file, or adding assertions, now fails the suite until the header is updated in
the same change. That is the third work item of issue #7, and it is the only one of the three that
prevents a fourth recount.

The same file carries a floor (`>= 28` files, `>= 872` sites) so that lowering the repo and the
header together in one edit is still a deliberate act rather than a silent one, and two structural
assertions that were previously nobody's job: every test file matches `^[a-z0-9-]+\.test\.mjs$`, and
`tests/` is flat. `scripts/run-tests.mjs` globs exactly that pattern and does not recurse, so a file
named `.test.js` or placed in a subdirectory would count nowhere and run nowhere — which is a way to
lose coverage that no count would catch.

**Not claimed:** that 872 is a measure of coverage. It counts call sites in source. Two files with
identical assertions over the same code path count twice, and a loop asserting fifty times counts
once. It is a drift detector, which is what `N` is used for.

**Status:** RECORDED and ENFORCED.

---

## D-36 — Phone-OTP identity (M2): two JSON routes, one new writer, and a session-only onboarding page

> **Folded in from `tmp/m2-decisions-addendum.md` on 2026-08-22 (issue #12), and renumbered.** The
> addendum was written as D-34 by the M2 slice but never landed in this log, so that number was
> still free when D-34 (one migration lineage) and D-35 (baseline `N`) were written and merged. The
> content below is the addendum verbatim; only the heading number changed. Nothing in `src/`,
> `tests/` or `supabase/` cited D-34, so no live reference is redirected by the renumber — checked
> with `git grep -nE 'D-3[0-9]'` before moving it, which is the check the D-33 numbering note asks
> for. The addendum's closing line refers to "the slice record below"; no such record was in the
> file, and one is not invented here.

**Decision:** rev. 5.3 §8 M2 ships as two `/api/auth/*` route handlers over Supabase Auth's phone
OTP (`signInWithOtp` / `verifyOtp`), a new SECURITY DEFINER writer (`set_home_spot`, `0006`), and
three pages (`/login`, `/verify`, `/onboarding`) that hand off to each other by URL, not by shared
client state.

### Why two JSON routes, not a Server Action, for the OTP exchange

Every other write in this app (`clearPresence()`, the M3 transitions) is a Server Action or a
route handler reached by a same-origin `<form>`, chosen specifically to avoid shipping
`@supabase/ssr` to the browser (D-33's 62 kB/162 kB → 1.11 kB/97.1 kB figure). The OTP exchange
breaks that pattern on purpose:

- The task this slice was scoped from asks for `/api/auth/send-otp` and `/api/auth/verify-otp` as
  a stable, machine-readable contract — not only a page that happens to work.
- A plain `<form action="...">` POSTs as `x-www-form-urlencoded`/`multipart`, not JSON; supporting
  it would mean a second body-parsing path in every handler for a flow that is inherently
  multi-step (send, wait, receive a text, type a code, get told it was wrong) and already needs
  client JS for a usable resend timer and inline error text. The "works with JS off" argument that
  justified a Server Action for checkout does not transfer cleanly here, so it was not forced.
- `LoginForm.tsx` and `VerifyForm.tsx` are therefore the only two client components this slice
  adds. Both `fetch()` the JSON routes and hold no Supabase import — the client never sees a
  service key or talks to Supabase directly, only to this app's own routes.

### Anti-enumeration (D-8, threat T10) has a smaller job than it looks like

Phone OTP has no separate "sign up" step — `signInWithOtp` creates the `auth.users` row
transparently on first use — so there is no "does this number already have an account" branch for
`/api/auth/send-otp` to leak in the first place; its success body is unconditionally `{ ok: true }`
(asserted in `auth-otp-routes.test.mjs`). What the anti-enumeration discipline actually buys here is
narrower and still real: `otp-http.ts` classifies every Supabase Auth error into one of four kinds
(`invalid_argument` / `invalid_code` / `rate_limited` / `unavailable`) and authors its own message
for each, the same D-30 rule `transition-http.ts` set for the M3 write path — GoTrue's raw error
text is never forwarded to the client.

### Rate limiting is honestly scoped, not fully built

D-8 assigns "≤10 OTP sends per IP per day" to **edge middleware, built in P2** — the same deferral
`0005_public_aggregates.sql`'s own header records ("a SQL function cannot see caller IPs"). This
slice does not build that. `lib/api/rate-limit.ts` is an in-memory, single-process, fixed-window
limiter: 5 sends/hour and 5 verify-attempts/hour per phone number (the D-8 number, applied to
verify), 10 sends/hour and 20 verify-attempts/hour per IP. It resets on every redeploy and does not
coordinate across instances — read as defence-in-depth on top of Supabase Auth's own per-number
limits and 60s resend cooldown (dashboard config, still D-8 `PENDING`), not as the durable control.
The module's own header says this in as many words, so a later session does not mistake it for the
P2 work.

### `set_home_spot(uuid)` — 0006, and why it waits on 0004 the same way 0005 did

`members.location_id` has carried no writer since 0001 ("`set_display_name` is the only
client-reachable write to members ... Note what it cannot touch: role and location_id"). `0006`
adds the other one: SECURITY DEFINER, `auth.uid()`-scoped, and it re-validates
`locations.is_active` itself rather than trusting the client only ever submits an id the picker
showed it — rev. 5.3 §8 M3's "only active locations ... can be selected as home" is enforced
server-side, not merely by the `<select>` options. Like 0005, it cannot mean anything until 0004
(`locations`) is applied — there is nothing to look up `is_active` on until then.

### The home-spot picker degrades the same way the dashboard's presence panel does

`locations` (0004) is unapplied everywhere, so `getActiveHomeSpotOptions()` (`lib/onboarding.ts`)
resolves to `[]` today rather than throwing — the same "unresolved is a first-class outcome"
discipline `lib/dashboard.ts` uses for the same table (D-33). The onboarding form's home-spot field
is **absent**, not merely empty, when the list is empty, and the field is optional either way: a
visitor completes onboarding with just a display name. Once 0004 is applied, the field appears with
no UI change, the same "turns live the moment the migration lands" property D-33 records for the
board.

### Where the session comes from

`verify-otp-route.ts` uses the cookie-bound server client (`lib/supabase/server.ts`), so a
successful `verifyOtp()` writes the session cookie through the same adapter every M3 write route's
`getUser()` reads from — there is no separate "log the member in" step distinct from verifying the
code. `/onboarding` requires that session (redirects to `/login` otherwise); `/login` and `/verify`
do not, and nothing before `/onboarding` in this flow requires one — rev. 5.3 §7.1 risk 9 ("OTP wall
in front of reading") stays satisfied because `/spots` and the aggregates were never behind this
gate to begin with.

### A pre-existing gap this slice closed in passing

`npm run test` was **red on this branch before this slice touched anything**:
`tests/sql-migration-harness.test.mjs`'s global "every `grant execute` targets `authenticated`
only" assertion was never updated when `0005_public_aggregates.sql` landed (`bfab2c6`), and that
migration deliberately grants its two functions to `anon` too (R10's own named exception). The
assertion now reads `ANON_CALLABLE_FUNCTIONS` — `sql-lint.mjs`'s own allowlist — instead of a
blanket `['authenticated']`, so the exception is checked rather than merely permitted. This is not
new scope; `npm run test` had to be green for this slice's own gate to mean anything, and the fix
is two lines against a list the analyser already exports.

**Status:** DONE for what a static harness and a preview-less database can prove. Not proven
against a live database.

---

## D-37 — Architecture doc cut to rev. 6, corrected in place, and renamed off its dated path

**Decision:** `Docs/2026-08-14-consolidated-architecture.md` becomes **`Docs/consolidated-architecture.md`**
at **rev. 6**, with the rev. 5.4 corrections folded into §3.4, §5 and §15 rather than carried as a
banner above them. Issue #6.

**The problem rev. 5.4 left behind.** It verified three claims against live infrastructure, found
all three false, and recorded that in a correction notice at the top — leaving the wrong text
standing underneath it. A document whose first section tells you not to trust three of its own
sections is annotated, not corrected, and every reader after that pays the cost of reconciling the
two. Rev. 6 rewrites the sections and deletes the notice. What replaces it is the single fact those
corrections all turned on: **the production database is empty.**

**What changed, section by section**, is in the document's own §18 changelog and is not duplicated
here. Two items are worth restating because they are decisions rather than edits:

1. **§5 reverses a second time.** Rev. 5.4 kept `Sluglines-AI`'s migration lineage as the schema
   ancestry; D-34 reverses that. §5 now retains the 2026-08-14 comparison table — explicitly dated
   — with a row-by-row account of what has since closed inside `sluglines`, because *that* is the
   reason the schema half reversed and it is not obvious from the table alone.
2. **§15 Q1 is narrowed, not just closed.** The genuinely open remainder — *absorb `Sluglines-AI`
   at all?* — is split out as **Q7**. Leaving it inside a question marked CLOSED is how it would
   have been lost.

### The one edit that needed permission from a rule

`supabase/migrations/0001_rebuild_foundation.sql` cited the old filename in a header comment, and
`0001` is `APPLIED: preview`. `supabase/migrations/README.md` says an applied migration is never
edited, because *"a file whose `APPLIED:` header names a database is a record of what that database
ran — editing it makes the record false without changing the database."*

That reasoning is about **statements**, and it holds. A comment carrying a path that no longer
resolves makes the record *less* usable, not more faithful, so the path was corrected and nothing
else in the file was touched — the same comment-only carve-out D-24 used when it added the
quarantine banner to `supabase/schema.sql`. The rule in the README is amended to say so explicitly,
so the exception is bounded rather than precedent for editing applied SQL in general. `sql:check`
reports the same 7 migrations / 173 statements / 0 violations before and after.

All 13 references to the dated path across seven files were updated in the same change, including
`tests/baseline-n.test.mjs`, which reads the header this document now owns — so a rename that missed
a reference would fail the suite rather than rot quietly.

**Not done:** the three cold-reader loops were not re-run, the same limit rev. 5.4 recorded. Rev. 6
consolidates verified decisions; it introduces no new design to certify.

**Status:** DONE.

---

## D-38 — `codex/phase-1` triaged: one document adopted, four issues filed, branch archived as a tag

**Decision:** the unreviewed `codex/phase-1` snapshot (`e7b0f49`, 116 files, committed 2026-08-20
purely to make its worktree removable) is triaged and retired. Issue #11.

**What it was.** A fourth parallel implementation, dated 2026-06-21 by its own plan documents:
email/password auth over Supabase Auth, a nine-table Phase 1 schema
(`supabase/migrations/202606210001..03`), `src/app/{auth,account,advisories,report,find,locations}`,
a Vitest + Playwright harness, and six documents. It predates every decision in this log from D-13
onward and was never reviewed.

### Adopted

**`Docs/asset-register.md`**, copied in verbatim under a provenance header. It is the only written
image-rights and image-privacy policy the project has, and issue #18 is migrating photographs from
`sluglines.com` right now. Two of its rules are directly load-bearing for that issue:

- *"Location pages: reserve a stable 4:3 media area, but show a neutral route graphic until a
  current approved photograph exists."* 18 of the 50 spots have no photograph and will not get one
  from migration. This is the designed no-image state, already specified, and it is the same
  discipline as D-31 (never guess a coordinate) and D-33 (`unavailable`, never a fabricated zero).
- *"Photos with commuters, readable plates, or incident details — do not publish without
  remediation"*, and *"never ship an image directly from the OneDrive archive path"*.

### Filed as issues rather than folded in

Outstanding work belongs in the tracker, not in a log entry nobody revisits.

| Issue | From | Why not now |
|---|---|---|
| **#33** — browser security headers | `Docs/security-review.md` listed CSP, frame denial, nosniff, referrer and permissions policy as **shipped** controls. This repo sets **none**: `next.config.js` defines no `headers()`. Recorded as §14 risk 15. | A CSP needs a report-only period against a real deployment. It is a behavioural change, not a config line, and does not belong in a content-cutover PR. |
| **#34** — commit-pin GitHub Actions | Same review recorded first-party actions as commit-pinned. All eleven `uses:` lines here are mutable tags, so the workflows that gate every merge are themselves unpinned. §14 risk 16. | Small and safe, but unrelated to the cutover. |
| **#35** — public-surface Playwright harness | The repo has no browser-level test at all. | See the decision below. |
| **#36** — content-provenance model | `Docs/content-sources.md`: source hierarchy plus four publication states (verified / community reported / needs review / historical). | A data-model and editorial-workflow change, not a cutover step. |

**On the Playwright harness — port the idea, not the files.** Two of its five spec files drive an
email/password auth journey this app does not have and will not have (identity is phone OTP, D-36),
and #24 disables the test-number ranges that would be the only way to drive OTP in CI. Copying them
in would be porting a harness for a different application. What transfers is the half needing no
session: console-error, accessibility, and public-surface specs. That is #35's scope.

### Discarded, with reasons

- **The auth layer** (`src/lib/auth/`, `src/app/auth/**`): email/password, superseded by phone OTP
  (D-36). Not a partial overlap — a different identity model.
- **The nine-table Phase 1 schema and `supabase/tests/phase1_rls.sql`**: a third competing lineage.
  D-34 settled that there is one, and it is `0001`–`0007`.
- **`Docs/phase-2-roadmap.md`**: its assistant design is superseded by §8 M8, and its "do not scrape
  WhatsApp groups" rule is already §12 constraint 4. Nothing novel survived.
- **`Docs/superpowers/{plans,specs}/2026-06-21-*`**: plan and design documents for the above.

### The branch itself

Deleted, after tagging the commit as **`archive/codex-phase-1`**. The tag is the point: the issue
asks for the branch to go so no folder becomes a backlog, and nothing here is worth destroying the
snapshot over — a tag keeps `e7b0f49` reachable permanently while removing it from the working set.
Every claim above is checkable against it.

**Status:** DONE. Four issues open; one document adopted; branch archived.

---

## D-39 — There are no per-location photographs to migrate. All 50 spots get the reserved no-photograph state

**Decision:** issue #18's infrastructure ships — an optional `image` field on `SpotLocation`, a
reserved 4:3 media area, `next/image` with explicit dimensions, and a test that refuses any image
not sourced from `sluglines.com/images/slugging_locations/` — and **zero images are migrated**,
because the legacy site has none of the kind the issue is about.

### What was actually found

All 27 distinct assets under `sluglines.com/images/slugging_locations/` were pulled and **visually
inspected** on 2026-08-22, not classified from filenames. All 42 legacy spot pages were reachable
and **no URL was dead**. The full classification is the appendix to `Docs/asset-register.md`.

| Kind | Count |
|---|---|
| Google satellite / aerial tile (several with a visible `Google` credit and `Map data ©2016 Google`) | 12 |
| Third-party transit or parking schematic (VDOT, VRE, WMATA, Fairfax County) | 8 |
| Annotated aerial route diagram, 2018–2019 change notices | 6 |
| Promotional flyer carrying a Facebook URL, a Twitter handle and an email address | 1 |
| **Photograph of a location** | **0** |

`Horner_Road.jpg` is a Google satellite tile with slug-line labels drawn on it and a `sluglines.com`
watermark. `Route17.jpg` is an unannotated satellite tile. `Bobs.jpg` is a bus-bay and parking
schematic. `Crystal_City_12th_St.jpg` and `Crystal_City_23rd_St.jpg` are the same WMATA station map.

### Why none of it ships

The instruction for this milestone is explicit that the spots without a photograph get a designed
no-image state — *"not a broken img, not stretched filler, **not a satellite tile posing as a
photograph**"*. The finding is that **every** candidate is one of those. Applying the rule to what
was actually there yields "migrate none"; migrating them anyway would be the exact failure the rule
names, applied to 25 spots instead of avoided on 18.

Three independent lines converge on the same answer, which is why this is not a close call:

1. **The satellite tiles are Google Maps imagery.** `Docs/asset-register.md` already says *"embedded
   map imagery has separate terms"*, and several files carry Google's credit inside the pixels.
2. **The route diagrams are already classified `Historical only`** by that register — *"Staffordboro
   and Pentagon route diagrams from 2018-2019 … operational directions may have changed"*. Two are
   dated 2018 in their own filenames. Publishing a 2018 traffic-change notice as a spot's current
   image tells a commuter something operational that may be years wrong.
3. **The transit schematics are third-party operator material**, which `Docs/content-sources.md`
   says to link to rather than copy.

This is the same discipline as D-31 (a `null` coordinate is never guessed, because a plausible guess
is indistinguishable from a surveyed one) and D-33 (`unavailable`, never a fabricated zero). An
aerial view of a car park in the slot labelled "photograph of this spot" is a fabricated answer to
the question the slot asks.

### The audit was wrong, in a specific and instructive way

Issue #18 records *"32 legacy spots with a photo, 10 without"*. The real figure is **25 with an
asset under `slugging_locations/`, 17 without** — and the seven-spot gap is made up entirely of the
assets the issue's own guidance excludes:

| Excluded | Spots | Why |
|---|---|---|
| Image at `sluglines.com/images/` rather than `…/slugging_locations/` | `franconia-springfield`, `landmark-mall`, `van-dorn-st` | Outside the one permitted path |
| Only image is an `lh5.googleusercontent.com` avatar | `mark-center`, `navy-yard`, `rosslyn` | A commenter's face — the trap the issue names |
| Only image is `direction.png` | `telegraph-rd` | A UI icon, used on 8 pages |

25 + 3 + 3 + 1 = 32. The audit counted the avatars it warned about.

One further correction: the live site now references an asset the 2026-07-11 snapshot missed —
`sydenstricker-rd` also loads `Saratoga.jpg`, the same schematic the `saratoga` page uses. Not a new
photograph.

### What ships instead

The reserved 4:3 media area from `Docs/asset-register.md` — *"reserve a stable 4:3 media area, but
show a neutral route graphic until a current approved photograph exists"* — rendered by
`src/components/SpotPhoto.tsx`. The box is reserved in **both** branches, so adding a photograph
later reflows nothing, and the empty branch is a drawn graphic and a sentence that says what it is
rather than implying a missing file.

`image` stays out of `SEED_COLUMNS`, so `0004_spot_locations_directory.sql` is byte-identical and
`sql:check` still reports 7 migrations / 173 statements / 0 violations. `locations` has no image
column and `LOCATION_COLUMNS` does not ask for one; both mappings in `public-location.ts` resolve
the field from the committed directory, so the table and the file still produce the same record.

**Consequence for #26:** its scope changes from *"source photographs for the 18 spots that have
none"* to **all 50**. Recorded as a comment on that issue.

**Filed, not built:** the diagrams and schematics are genuinely useful to a commuter — a lot layout
showing where the line forms is worth more than a photograph of tarmac. Publishing them **labelled
as maps**, with the third-party rights question answered, is issue #39. It is a different surface
from the one #18 asks for and is not smuggled into it.

**Status:** DONE. Field, media area, guard and audit shipped. Zero images migrated, with reasons.

---

## D-40 — Vercel environments split off production Supabase. **Closes D-7.**

**Decision:** the staging target is the **Supabase preview branch `phase-3-4-staging`
(`xqonrogwwytkmqfinszp`)**, and Vercel's non-production environments now point at it rather than at
the production project. Issue #27.

This closes **D-7**, which has carried *"staging environment: UNKNOWN / PENDING"* since Phase 0.
D-7 recorded rev. 5.3's default — *"Supabase preview branch of the production project; a second
project only if preview branches are unavailable on the plan"* — as proposed but unconfirmed,
because confirming it needed a plan fact nobody had read. The branch has existed and been healthy
since 2026-08-14 (D-28), which answers the plan question by demonstration: branching is available,
so the default holds and no second project is needed.

### State before, verified 2026-08-22 by `vercel env pull` per environment

| Environment | `NEXT_PUBLIC_SUPABASE_URL` |
|---|---|
| Production | `bwpguotjzczmieeepczf` |
| Preview | `bwpguotjzczmieeepczf` |
| Development | `bwpguotjzczmieeepczf` |

One variable record covering all three targets, so there was nothing to change — only something to
split.

### State after, verified the same way

| Environment | URL | Anon key |
|---|---|---|
| Production | `bwpguotjzczmieeepczf` | set |
| **Preview** | **unset** | **unset** |
| Development | `xqonrogwwytkmqfinszp` | set |

### Why Preview is unset rather than pointed at the branch, and why that is not a shortfall

Vercel CLI 50.44.0 in this environment cannot create an **all-preview-branches** variable without a
TTY. Seven forms — `--value … --yes`, `--force`, stdin pipe with and without `--yes`, `CI=1`, an
empty branch positional, and a `< file` redirect from bash — all return the same
`{"status":"action_required","reason":"git_branch_required"}`, whose own `next[]` hint is the
command that produced it. Production and Development were set by the same CLI in the same session,
so authorisation, scope and project link are all fine; only that one path is affected. Carried as
issue #41, with the dashboard steps.

**The purpose of #27 is met, and by a stricter route than it asked for.** The risk it names is that
after `0001`–`0007` reach production, *"every preview deployment — every PR branch, every
agent-authored change — reads and writes the live database through the same SECURITY DEFINER writers
the production site uses."* A preview deployment with **no credentials at all** has no write path
into production or anywhere else. Pointing it at the branch is a usability improvement over that,
not a safety one.

Both variables were removed from Preview, not just the URL. Leaving production's anon key there
under an unset URL would be a trap: the next person to set only the URL would silently pair it with
production's key.

**Build impact: none, and this is measured rather than assumed.** Every `next build` in this
session ran with no Supabase variables set at all and exited 0 — the app degrades to static content
and `unavailable` counts by design (D-33), rather than throwing on a missing variable.

**Precondition for #19, checked before starting it rather than after:** Vercel project `sluglines`
is `prj_Uvmtv5fVBVg9tw5CJUyMSD4UHmGS` and its **Production** environment points at
`bwpguotjzczmieeepczf`. So the migrations #19 applies land in the database the live site actually
reads, and the `unavailable` states will turn `live`.

**Status:** DONE. D-7 CLOSED. Preview credentials owed by #41.

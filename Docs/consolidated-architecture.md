# Sluglines — Consolidated Architecture & Product Plan

- **Status:** rev. 6 — IMPLEMENTED (~~Phase 0/1 complete~~ **Phase 0 complete; Phase 1 is not — corrected 2026-09-05, PR 1: the §8 route-group restructure to `app/(public)`/`app/(app)` was never performed, and `src/app/` remains flat**, 2026-08-14). §3.4, §5 and §15 Q1 are corrected **in place**; this document no longer carries a banner warning that its own body is wrong.
- **Baseline N:** 54 test files / 1,707 assertion call sites, all passing (recounted 2026-08-22, D-35; raised by `tests/scheduled-jobs.test.mjs` in D-46, the bypass assertions in D-47, `tests/security-headers.test.mjs` in D-48, `tests/workflow-pinning.test.mjs` in D-49, `tests/content-provenance.test.mjs` in D-54, the browser suite in D-55, the diagram-migration assertions in `tests/spot-photos.test.mjs` in D-58, `tests/public-surface-tokens.test.mjs` in D-62, its extension over the rest of the public surface in D-63 — which is `tests/e2e/*.spec.ts`, counted separately below — the rewritten `tests/supabase-server-client.test.mjs` in D-64, the seeded-location fixture guard added to `tests/live-rls.test.mjs` fixing #88, `tests/ai-agent-runtime.test.mjs` in D-65, `tests/durable-rate-limit.test.mjs` plus `tests/live-rate-limit.test.mjs` for the durable rate limiter in D-66 (issue #55), the `publicTransportation`/`externalLinks` assertions added to `tests/spot-locations-directory.test.mjs` in D-67 (issue #77), the new `tests/incidents-schema.test.mjs` plus the `incidents.get_active` assertions added to `tests/ai-agent-runtime.test.mjs` in D-68 (issue #90), the new `tests/lostfound-schema.test.mjs` plus the `lostfound.search` assertions added to `tests/ai-agent-runtime.test.mjs` in D-69 (issue #90), the new `tests/transit-stops-schema.test.mjs` plus the `transit.explain_alternatives` assertions added to `tests/ai-agent-runtime.test.mjs` in D-70 (issue #90), the new `tests/recurring-offers-schema.test.mjs` plus the `/api/recurring-offers/skip` wiring assertions added to `tests/api-routes.test.mjs` in D-71 (issue #90), the new `tests/waitlist-eta-noshow-schema.test.mjs` plus the `/api/offers/waitlist` wiring assertions added to `tests/api-routes.test.mjs` in D-72 (issue #90), the new `tests/leaderboard-dashboard-schema.test.mjs` for the ride-history/leaderboard/dashboard-summary slice in D-73 (closing issue #90), the new `tests/live-definer-grants.test.mjs` plus `tests/lock-down-definer-functions.test.mjs`, and the R12 negative fixtures added to `tests/sql-migration-harness.test.mjs`, in D-74 (the anon/authenticated-exec lockdown, `0025`), the new `tests/client-ip.test.mjs` plus `tests/signin-error-states.test.mjs`, with a status-code correction to the pre-existing `tests/phone-otp-validation.test.mjs`, for `fix/signin-error-states` (A7/A10/A11: honest sign-in error states, the trusted-proxy `clientIp` fix, and the OTP-send fail-closed service-client decision), and the new `tests/robots-guard.test.mjs` for the `X-Robots-Tag` non-canonical-host guard (`fix/noindex-non-primary-hosts`: `.com` stays canonical, `.org` is a temporary test surface that must not be indexed while it serves different content than `.com`), and the `rateLimiter` assertions added to `tests/health-endpoint.test.mjs` for `feat/health-service-client-check` (issue #117: `/api/health` now exercises the service-role client the durable OTP rate limiter depends on, which is how the missing `SUPABASE_SERVICE_ROLE_KEY` in production was detectable at all), and the `0026` coverage added to `tests/lock-down-definer-functions.test.mjs` plus the three R12 fixtures that replaced the single exemption fixture in `tests/sql-migration-harness.test.mjs`, for `security/definer-anon-revoke` (D-79: the 46 SECURITY DEFINER functions R12 exempted by construction), and the new `tests/observability.test.mjs` in D-93 (issue #144: unavailable outcomes logged, rate-limit eviction, one typed service-role error, the login reassurance)). This line is machine-checked — `tests/baseline-n.test.mjs` re-measures the repo and fails if it and this header disagree, so `N` cannot drift again without the change that moved it saying so. Supersedes D-25's "12 files / 99 assertions", which was stale by more than 2×.
- **Repo State (2026-08-22):** `main` is the only live branch and carries everything below — `codex/phase-3-4` was merged as PR #1 (`e2d922a`) and deleted. `codex/phase-1` survives as the unreviewed snapshot `e7b0f49` (issue #11). Migrations **`0001`–`0007` are applied to production `bwpguotjzczmieeepczf`** (2026-08-22, D-41), and to the preview branch `phase-3-4-staging`. The three legacy tables are gone.

- **Phase 0/1 implementation summary:**
  - Foundations: Security gates, architecture, decision logs, and cost caps (Commit `aa7b306`).
  - M3 Backend: Ride coordinator state machine with static verification harness (Commit `8d38f2d`).
  - M1 Directory: 50-spot directory, seed utility, and public aggregate wiring (Commit `417c7ac`).
  - M3 API Write Path: Full ride-coordinator HTTP write endpoints with hardened error contracts (Commit `165650d`).
  - Dashboard: Power-user view with realtime aggregates and presence panel (Commit `0bf9def`).
**Date:** August 14, 2026; corrected August 20, 2026 (rev. 5.4) and August 22, 2026 (rev. 6 — the 5.4 corrections folded into the sections themselves, the schema-ancestry decision reversed per `Docs/DECISIONS.md` D-34, and the file renamed off its dated path. rev. 5.3 was three cold-reader loops: 15, 8, then 6 forced assumptions; final 6 fixed unre-certified; rev. 5 applied the six-seat SME panel review, ~180 findings; changelogs in §18)
**Scope:** All Sluglines engineering and product effort, not one repo
**Supersedes:** rev. 4. This revision is self-contained: nothing normative lives only in an earlier revision.
**Inputs:** `sluglines.com` (live), the `sluglines` repo (`main` + `codex/phase-3-4`), `Sluglines-AI`, `SluglinesAgent`, two WhatsApp group exports (pattern review only), cross-repo knowledge graph at `C:\Users\kalai\Projects\graphify-out\`

**How to use this document:** §1–§7 are analysis and decisions. §8 is the module architecture. §9 the product plan, §10 the UI and identity spec, §11 the phased plan with gates, §12 the per-phase execution prompts, §13 metric definitions, §14 risks, §15 open questions, §16 change triggers, §17 the iteration protocol, §18 the rev. 5 changelog.

---

## The one fact that reshapes everything below

**The production database was empty, and that window has now been used.** `bwpguotjzczmieeepczf` held three legacy tables — `spot_status`, `profiles`, `commute_log` — with **zero rows** and no lineage applied, verified on 2026-08-20 and again on 2026-08-22. Consolidation was therefore a **code move, not a data migration**, which is the argument for doing the irreversible parts before the pilot rather than after. On **2026-08-22** migrations `0001`–`0007` were applied to it and the three legacy tables retired (`Docs/DECISIONS.md` **D-41**). It now carries nine tables, all RLS-enabled, zero write policies, zero grants to `anon`, and the 50-spot directory — and still zero member rows. Plans below that assume an empty database should be read as describing the state up to that date.

Three claims that were wrong in rev. 5.3 are corrected **in the sections themselves** as of rev. 6, not flagged here — §3.4 (`Sluglines-AI`'s "live-DB RLS suite"), §5 (which stack is canonical), and §15 Q1 (which repo name survives). §18 records what changed. If you are looking for the warning banner that used to sit here, its contents are now the text it was warning you about.

---

## 1. Summary

**This is not a greenfield build. It is a consolidation problem with a product-adoption problem stacked on top.**

Five separate efforts exist. The most complete — `Sluglines-AI` — is a security-conscious, deployed implementation of substantially the entire product: phone-OTP identity, an offer/reservation/confirmation state machine, presence check-ins, lost & found, incident reports, moderation, notifications, and an advisory AI layer behind a deterministic tool gate. Built in 11 days, 28 commits, 24 sequential migrations, with a live-database RLS test suite (approximately 98 tests; the exact count is recorded as the baseline `N` in `docs/DECISIONS.md` during Phase 0, and every later gate references that recorded `N`, not this approximation).

It is invisible to users: not reachable from `sluglines.com`, not merged with the content rebuild in the `sluglines` repo, its AI layer never executed against a live model, dormant since July 29.

The engineering work remaining is **consolidation, verification, and content migration**. The product work remaining is **liquidity**: no commuter may ever open the coordination surface during peak hours and find it empty. Both plans are here; neither works without the other.

**Product thesis (detail in §7):** the WhatsApp groups already clear the market daily. Broken: state scrolls away, stale offers, daily re-coordination, curbside no-shows. Preserved: zero friction, warmth, ubiquity. The product wins by fixing the failure modes without adding friction, and survives cold start by seeding recurring driver supply before inviting demand.

---

## 2. Method and evidence provenance

Claims in §3–§4 were checked on 2026-08-14 by these methods, **with the limits of each method stated**:

| Source | Method | What the method can and cannot establish |
|---|---|---|
| `sluglines.com` | Live browser navigation | Page content and structure as served that day |
| `sluglines` repo | `git log` / `git show` / `git diff`, all branches | Committed content only; not working-tree or deployment state |
| `Sluglines-AI` | Read-only repo exploration (delegated agent) | Code, migrations, tests, docs as committed. **Cannot verify:** that the Vercel deployment is live, that CI currently passes, or that no `ANTHROPIC_API_KEY` exists in Vercel's env config (only that none exists in the repo or local env). These three carry UNVERIFIED status until P0 checks them directly. |
| `SluglinesAgent` | Read-only repo exploration | File contents; absence of a git repo confirmed by directory listing |
| WhatsApp exports | Direct read of a bounded sample | Coordination *patterns* only. **No volume baseline was measured** — rides/week cleared by the groups today is unknown; P0 records one (aggregate count only, per §13 privacy rules) so pilot gates have a denominator. |

**Locations of every artifact this document references** (an implementation session must never have to guess these):

| Artifact | Location |
|---|---|
| **Host repo** (`sluglines`) — the target for all work | `github.com/cybersecurity-cell/sluglines`; local checkout `C:\Users\kalai\Projects\sluglines`; branches `main` (`97ca88f`), `codex/phase-3-4` (`8e1ed0d`, draft PR #1), `codex/phase-1` (`e7b0f49`, unreviewed snapshot) |
| **Module to absorb** (`Sluglines-AI`) | `github.com/cybersecurity-cell/Sluglines-AI`; local checkout `C:\Users\kalai\Projects\Sluglines-AI`; dormant since 2026-07-29 |
| ~~Supabase project (the only one)~~ **Supabase project (one of two — see below)** | ref `bwpguotjzczmieeepczf`, region `us-east-2`; preview branch `phase-3-4-staging` = ref `xqonrogwwytkmqfinszp`. **A second, unrelated project (`kejglwcmzudpehddqkhh`) exists in a different organization; D-50 corrected this "only one" claim in §3.4 and the ADR on 2026-08-22, but missed this table row until this correction (2026-09-05, PR 1). See D-50, issue #43.** |
| `SluglinesAgent` | `C:\Users\kalai\Projects\SluglinesAgent` — local directory only, no remote |
| Legacy content inventory | `codex/phase-3-4:Docs/sluglines-content-inventory.md` |
| This document | `Docs/consolidated-architecture.md` on `main`. Renamed off its dated path in rev. 6; the earlier `C:\Users\kalai\Projects\Temp\Sluglines\...` and `Docs/2026-08-14-...` paths are both obsolete. |
| ADR closing §15 Q1 | `codex/phase-3-4:Docs/2026-08-20-adr-sluglines-is-the-host-repo.md` |
| Issue tracker | `github.com/cybersecurity-cell/sluglines/issues` — 12 issues filed 2026-08-20 (#3–#14) |

**Knowledge graph.** A cross-repo knowledge graph over `Sluglines-AI` and `SluglinesAgent` (162 files, 991 nodes, 1,655 edges) lives at `C:\Users\kalai\Projects\graphify-out\`; queryable via `graphify query`. It surfaced risk 7 in §14. It does not cover the `sluglines` repo (access restriction) — useful for the canonical codebase, blind to the content site.

**Chat-export handling.** The exports were read for aggregate coordination patterns only. No content from them appears in this document, fixtures, or prompts. §4 describes structure, not messages. The Phase 0 volume baseline and the §13 parallel-run review record **aggregate integers only — never names, numbers, or message content.**

---

## 3. Current state (self-contained summary)

### 3.1 `sluglines.com` — live WordPress, stale, one active feature
165 routes, 43 spot pages, 2016-era news, placeholder copy in production. Forum dead **except Lost & Found** (116 topics, newest 2 days old). **Decision (rev. 3, confirmed):** legacy forum topics/comments are not migrated. This knowingly discards the only live legacy usage; the mitigation is that `/forum/**` 301s land on the new public Lost & Found board (§8 M5), a notice is posted on the legacy board during the overlap window (Phase 2), and WordPress stays read-only for ≥30 days after cutover so in-flight topics can conclude. Retained value: the domain and backlinks, the corridor/spot taxonomy, the informational pages.

### 3.2 `sluglines` repo, `main` — clean Next.js 14 content shell
Nine routes, two components, three tables; the "live board" is two integer counters per spot with an open anonymous-write RLS policy (`Anyone can update spot counts`). No offers, no identity, no tests. Superseded as an app; content and taxonomy are ported.

### 3.3 `sluglines` repo, `codex/phase-3-4` — draft PR #1, do not merge as written
Keep: `scripts/migrate-sluglines-content.mjs` (WP REST → JSON, working), spot directory/search libs, `community-channels.ts` (40+ spots mapped to corridor Facebook groups), the 165-route content inventory. Reject: `riders`/`drivers`/`alerts` tables whose RLS allows any anonymous client to update or delete any other user's row. The feature exists correctly in `Sluglines-AI` as `presence_checkins`.

### 3.4 `Sluglines-AI` — a dormant parallel build, not a deployed one

**Its 24 migrations have never been applied to the Sluglines *production* database.** (This sentence said "to any live Sluglines database" until 2026-08-22; that was too strong — a second project exists and does carry the schema. See D-50 and issue #43.) The production Supabase project (`bwpguotjzczmieeepczf`) records two applied migrations, both from July (`create_sluglines_ai_schema`, `drop_stray_sluglines_ai_schema`), and holds three empty legacy tables. Rev. 5.3 called this repo "the canonical build" and described its Vitest suite as running "against a live database"; §2 carried that as UNVERIFIED-until-P0. It was checked on 2026-08-20 and is **false**. Whatever the RLS suite ran against, it was not this project — and the likely answer was found on 2026-08-22: a **second, live** Supabase project, `sluglines-AI` (`kejglwcmzudpehddqkhh`), in a different organization, carrying all 26 tables with data. Its `~98`-test figure remains evidence about that instance and about nothing in production. See D-50 and issue #43.

Next.js 16 / React 19 / TS / Zod 4 / Tailwind 4 / Supabase (Postgres + Auth + Realtime + pg_cron) / web-push / Vitest against a database that is **not** the production project / `@anthropic-ai/sdk`. Repo evidence shows deployment config for `sluglines-ai.vercel.app` and a CI workflow on push (live status: still unconfirmed; the repo has been dormant since 2026-07-29). Security docs exist **in the `Sluglines-AI` repo** and are incorporated here by reference as normative: `docs/security/threat-model.md` (threats T1–T10 — the T-numbers cited in this document resolve there), `docs/security/authorization-matrix.md`, `docs/security/data-classification.md` (this is "the retention schedule" this document cites; P0 verifies it covers every table named in §8 and extends it where it does not). Known gaps: AI layer never run against a live model; SMS fallback is a stub; savings estimates are a flat constant; voice is browser-only Web Speech API.

**Whether this repo is absorbed at all, and on what timetable, is an open question** — see §5. Nothing in the content cutover depends on the answer.

### 3.5 `SluglinesAgent` — brand-ops utility, not the product
~60-line X posting script, human approval queue. No git repo; live OAuth credentials in plaintext. Rotate (verified, see P0), git init, keep out of product architecture.

---

## 4. Requirements ground truth (WhatsApp exports, patterns only)

1. Announcements carry role + origin + destination + **a time window** + seat count → `offers.window_start/window_end`.
2. Claims are conversational with no authoritative count → atomic `reserve_seat` with idempotency.
3. **Vehicle description is exchanged only after a match is agreed** → confirmed-participant visibility boundary.
4. Recurring daily pairs re-coordinate manually every day → recurring offer templates.
5. Noise is dominated by failure modes: unanswered requests, stale offers, late notices, curbside no-shows.
6. The community is polite — encode politeness (one-tap "running late", quiet waitlist renotify), never public shaming.
7. **Nobody closes loops ceremonially in the groups** — coordination ends at pickup, not at a "completed" ritual. Consequence (§13): ride-completion metrics must not depend on users advancing a state machine at the curb; gate metrics count `CONFIRMED`-or-later, and `COMPLETED` is treated as under-reported by design.

The structural problem: **state scrolls away.** No queryable answer to "who is driving to L'Enfant around 4?" exists in a chat transcript.

---

## 5. Decision: one repo, one Supabase project, one migration lineage

**`sluglines` is the host repo, and the schema is the one built inside it.** Rev. 5.3 said the opposite — *"adopt `Sluglines-AI` as the canonical application, schema, and Supabase project"* — and was reversed in two steps, both recorded:

| Decision | Where | Date |
|---|---|---|
| Host repo is `sluglines`; `Sluglines-AI` becomes a module | `Docs/2026-08-20-adr-sluglines-is-the-host-repo.md` | 2026-08-20 |
| Schema lineage is this repo's `supabase/migrations/0001`–`0007`, **not** `Sluglines-AI`'s 24 | `Docs/DECISIONS.md` **D-34** | 2026-08-22 |

The second reversal is the one that is easy to miss. The ADR kept `Sluglines-AI`'s migrations as the ancestry on the strength of the comparison below, but that contradicted D-13 (rebuild here, decided 2026-08-14) without revisiting it, and left the repo carrying two contradictory decisions and one implementation. D-34 resolves it toward the lineage that exists, is applied to a preview branch, and has 38 live RLS assertions behind it (D-28, D-30).

### The comparison that drove the original decision, and what is left of it

Retained because it is still the argument for taking `Sluglines-AI` seriously — and because it must not live only in a superseded revision. Read it as a description of **2026-08-14**, not of today.

| | `sluglines` repo, as of 2026-08-14 | `Sluglines-AI` |
|---|---|---|
| Identity | none / anonymous device ID | phone + SMS OTP |
| RLS posture | open write on `spot_status`; open write **and delete** on check-ins | default-deny on every table |
| Ride coordination | two integer counters | full state machine, atomic reservations |
| Tests | ~12 unit assertions | Vitest suite (~98) against a non-production database |
| Security docs | skill checklists only | threat model + authorization matrix + data classification |
| CI | none | lint + build + suite on every push |

**Every row of the left-hand column has since been closed inside `sluglines`**, which is why the schema half of the decision reversed: phone-OTP identity (`0006`, D-36), default-deny RLS with zero write policies on any table (`0001`–`0007`), the full M3 state machine with revision checks and idempotency keys (`0002`, `0003`, D-27), 28 test files including a live RLS suite (D-35), and CI that runs the suite and a build (issue #5). The security documents remain `Sluglines-AI`'s and remain normative by reference.

- **What `Sluglines-AI` still holds that this repo does not:** the AI/assistant layer with its deterministic tool gate, notifications, lost & found, incidents, and moderation. All are later-phase modules; none blocks the content cutover.
- **Dropped:** `riders`/`drivers`/`alerts`; the `spot_status` counter model; legacy forum content. `0007` retires the three legacy tables that survived in production.
- **Still open:** whether `Sluglines-AI` is absorbed at all. It is a repo-topology and upgrade question (Next 14→16, React 18→19, Tailwind 3→4 — the ADR's own note says it cannot be done incrementally), and it no longer gates applying a schema. Issue #3 rides on it.

---

## 6. Target architecture (system view)

```text
                      sluglines.com  (GoDaddy DNS -> Vercel)
                                  |
   +------------------------------+-------------------------------+
   |             One Next.js App Router deployment                |
   |                                                              |
   |  M1 DIRECTORY (public)            M3 RIDE COORDINATOR (auth) |
   |  M2 IDENTITY (phone OTP)          M4 PRESENCE (auth write;   |
   |  M5 LOST & FOUND (public read,        public AGGREGATE read) |
   |     auth to act)                  M6 INCIDENTS (auth write;  |
   |  M8 ASSISTANT (auth; tab hidden       public AGGREGATE read) |
   |     until AI gate passes)         M7 MODERATION (moderator)  |
   |                                   M10 ANALYTICS (internal)   |
   +---------+---------------------------------------+------------+
             |                                       |
             | M1..M7, M9, M10 call                  | M8 ONLY
             | lib/domain directly                   v
             |                        +------------------------------+
             |                        | Agent runtime -> Tool Gate   |
             |                        | (deterministic; R0/R1 live,  |
             |                        |  R2/R3 declared-refused)     |
             |                        +---------------+--------------+
             v                                        v
   +--------------------------------------------------------------+
   |  Domain services (lib/domain) - SECURITY DEFINER functions   |
   |  offers . reservations . presence . lostfound . incidents .  |
   |  moderation                                                  |
   +------------------------------+-------------------------------+
                                  |
   +------------------------------+-------------------------------+
   |  Supabase Postgres - RLS default-deny                        |
   |  audit_events (append-only)   notification_outbox            |
   |  agent_traces                 ai_kill_switches               |
   |  pg_cron sweeps (expiry, recurring, TTL)                     |
   +--------+---------------------------------+-------------------+
            | Realtime (committed)            | outbox drain (1/min)
            v                                 v
       live boards                     M9 NOTIFICATIONS
                                       push now, SMS Phase 5
```

Only M8 routes through the tool gate; M1–M7, M9, M10 call domain services directly. **Load-bearing principle: models propose; code and database transactions decide.** With the assistant off, the deterministic product is fully functional.

Identity invariant: **Supabase Auth is the only durable store of phone numbers; application tables hold opaque UUIDs.** Where a phone number must be *used* (SMS send, inbound-call matching), it is resolved from Supabase Auth at the moment of use and never persisted in application tables, logs, or telemetry (mechanics: §8 M9).

---

## 7. Product thesis

**Who:** NoVA HOV commuters on I-95/I-395 and I-66 — (a) recurring drivers (the scarce side), (b) recurring riders, (c) the uncoordinated majority who stand in the physical line.

**Why switch:** the app fixes WhatsApp's four failure modes while preserving zero-friction reading, warmth, reliability.

**Liquidity model:** the real market is a corridor pair in a ~30-minute window. The product lives or dies on whether a rider opening it at 3:50pm sees a live, non-empty answer.

1. **Read-only value before sign-up — precisely defined.** The *public* read surface is: aggregate live counts on the home page and spot pages (M1's aggregate functions), the public Lost & Found board (M5, read-only), public incident banners (aggregate), and coarse single-offer summaries reached via share links (§9.3). The **Board zone** (`/board`) — full offer cards, actions, presence panel — is the *authenticated coordination surface*. "Sign-in gates actions, never looking" means: everything above is visible signed-out; every state-changing action requires auth. These two sentences are the reconciliation of the wedge principle with the navigation model; earlier revisions stated them inconsistently.
2. **Seed supply before demand.** Recruit **3–5** recurring drivers from the Horner group as founding users; the Phase 3 gate requires **≥3 active** (not the 2 earlier drafts allowed).
3. **WhatsApp as distribution, not competitor.** No sync. One-tap share producing the message the community already writes, with a link back (§9.3).
4. **Politeness, not penalties.** One-tap "running late", quiet waitlist renotify, no public reputation.
5. **Voice as driver retention** — one tap-and-speak to post seats. (Not "hands-free": web push-to-talk requires a tap. True hands-free arrives only with the phone-call channel, and §8 M8 keeps that channel read-only pending an identity-binding design. The differentiator claim is scoped accordingly.)
6. **Non-goals:** payments; reputation scores; growth mechanics exposing individual activity; forums. The leaderboard's tension with this non-goal is now §15 Q6, and the leaderboard ships **hidden during the pilot**.

Litmus test for features (directional, not a gate): would the Horner regulars feel it made things warmer or colder?

---

## 8. Module architecture

One deployment; modules are hard boundaries. **M8 (Assistant) and M3 (Ride Coordinator) are distinct modules by explicit decision.**

**Dependency rule** (ESLint `no-restricted-imports`, first enforceable slice added in P0, completed in P1 when paths exist):

```
M1..M7, M9, M10 (UI + services)  --may import-->  lib/domain, lib/supabase   (never lib/ai)
M8 UI (app/(app)/assistant/**)   --may import-->  lib/ai, lib/supabase, React,
                                                  and M3 FORM COMPONENTS (for pre-fill)
lib/ai/**                        --may import-->  lib/supabase; reaches domain state ONLY
                                                  through tool-gate tool implementations
lib/domain/**                    --imports-->     lib/supabase only (never React, never lib/ai)
NOTHING outside M8 UI imports lib/ai/**
```

(The rev-4 rule "M8 may import lib/ai only" was unbuildable — a chat UI needs React and session code. The rule above is what the lint rule actually encodes.)

### M1 — Directory (public content)

| Route | Content |
|---|---|
| `/` | Hero + live corridor status strip (aggregate), what-is-slugging, corridor entries, CTA |
| `/spots`, `/spots/[slug]` | Directory by corridor/county/period; per-spot live aggregates, address/map, community links |
| `/how-it-works`, `/rules`, `/about` | Informational (rewritten) |
| `/lostfound` | Public read of the M5 board (M5 owns it; listed here because it is part of the public surface) |
| `/[...legacy]` | Redirect handler — see below |

**Public data functions** (SECURITY DEFINER, anonymous-callable, Phase 2): `get_public_spot_counts()` and `get_public_open_offer_counts()` return `(spot_slug, corridor, direction, waiting_count, driver_offer_count, rider_request_count)` — counts only, no member IDs, no time columns. `get_public_offer_summary(offer_id uuid)` returns one offer's coarse card for share links: origin/destination stop names, date, window rounded to the nearest 15 minutes, seats remaining, state — **no display name, no vehicle or pickup details**. Offer IDs are UUIDv4 (unguessable; share links carry the full UUID — no sequential short-link scheme), and the function is rate-limited per IP at the edge. Note on aggregate privacy: a count of 1 at a named spot approximates one person's presence; this is accepted for the pilot because standing at a public slug line is already publicly observable — the rationale is recorded, not hidden.

**Redirects** are implemented in the `/[...legacy]` catch-all route handler (not `next.config` — config redirects cannot emit 410s or the branded gone-page): 301 for retained slugs, **branded 410** (page with links to `/spots` and `/lostfound`) for `/forum/**` except the forum root and L&F forum URLs which 301 → `/lostfound`, and for `/blog/**`, `/news/**`. The redirect test covers **all 165 inventory routes** (the rev-4 "top 100" had no defined ranking; testing all of them removes the question).

### M2 — Identity
Phone + SMS OTP via Supabase Auth (sole phone store). Routes `/login`, `/verify`, `/onboarding`. `members(id, display_name, role member|moderator, location_id)`. **Moderator grant:** no RLS policy permits any client write to `role`; changes happen only via migration or operator SQL console and append an `audit_events` row. OTP abuse controls with concrete provisional values (tuned in P0, recorded in DECISIONS.md): resend cooldown 60s, ≤5 verify attempts per number per hour, ≤10 OTP sends per IP per day, Supabase CAPTCHA enabled on send, generic errors (anti-enumeration, threat T10 per the canonical threat model). The per-IP daily send cap is enforced in the `/api/auth/send-otp` route handler by the durable, cross-instance limiter (issue #55), not by edge middleware — **D-80** supersedes this section's earlier edge-middleware placement. Test phone ranges with deterministic OTPs **must be disabled in the production auth config** (P2 measurement). SMS-pumping spend risk is bounded by the caps above plus the M10 spend alarm (§13).

### M3 — Ride Coordinator

**State machine** (all transitions SECURITY DEFINER SQL functions with revision checks + idempotency keys):

```
DRAFT -> OPEN -> PARTIALLY_RESERVED -> RESERVED -> CONFIRMED
CONFIRMED -> ARRIVING -> PICKED_UP -> COMPLETED
OPEN | PARTIALLY_RESERVED | RESERVED -> CANCELLED
CONFIRMED | ARRIVING -> CANCELLED          (driver/rider bail-out; notifies confirmed
                                            participants + waitlist; SMS-critical event)
OPEN | PARTIALLY_RESERVED -> EXPIRED
RESERVED -> RELEASED -> OPEN
PARTIALLY_RESERVED -> RELEASED -> OPEN | PARTIALLY_RESERVED
                                           (a rider releasing one seat of several
                                            recomputes state from remaining count)
```

(The two transitions added in rev. 5 were depended on by M9's "cancel" SMS event, P4's waitlist renotify, and the R3 `ride.cancel_confirmed` tool, but were missing from the machine as drawn — three sections depended on an edge that didn't exist.)

**Offer visibility (`offers_visible_for_caller`) — semantics now stated:** an authenticated member sees offers in `OPEN`/`PARTIALLY_RESERVED` states for corridor pairs touching their active location set (home spot's corridors by default, adjustable), plus every offer they participate in regardless of state. Visible fields pre-confirmation: poster's display name, role, origin/destination, window, seats remaining, state. Vehicle description and pickup instructions (`offer_pickup_details`) are visible to confirmed participants only. All members are visible to each other only through offers — there is no member directory.

Tables and functions as in rev. 4 (offers, reservations with partial-unique ACTIVE constraint, `offer_pickup_details`, recurring templates + skips, waitlist/ETA/no-show, `completed_rides` + leaderboard views, `app_settings`), plus API routes `POST /api/offers/{advance,cancel,confirm,eta,waitlist}`, `/api/reservations{,/confirm,/no-show}`, `/api/recurring-offers/{cancel,pause,resume,skip}`. **Board scoping:** `/board` defaults to the member's home-spot corridor pair with a spot/corridor switcher; the home spot chosen at onboarding sets this default. During the pilot, the onboarding home-spot picker offers only *active* locations; inactive directory spots display as "organizing — join the founding group" and cannot be selected as home (this closes the empty-board-on-day-one path for a member who'd otherwise pick a dormant spot).

### M4 — Presence
`presence_checkins` (upsert one row per member, ~20-min read-time expiry). **Public read is the aggregate only** (via M1's functions); raw rows are RLS-protected — the §6 label "public AGGREGATE read" is normative, and no anonymous policy on the table itself exists.

### M5 — Lost & Found
Lifecycle `REPORTED → MATCHED → CLAIMED → REUNITED | EXPIRED | WITHDRAWN`; deterministic matching; in-app claim messaging; no contact fields in schema. **The board at `/lostfound` is publicly readable** (item cards: category, description, corridor, date, state — reporter identity hidden); reporting, claiming, and messaging require auth. This is the acquisition wedge and the landing target of the legacy forum 301s.

### M6 — Incidents
As rev. 4. Public surface = aggregate banner (corridor, type, state, age) on spot pages; free-text descriptions and reporter identity are member-visible only.

### M7 — Moderation
As rev. 4: `moderation_reports`, append-only `audit_events`, `/moderator` dashboard, member report/block UI in Phase 4. **Deletion vs. immutability, resolved:** `audit_events.actor_id` carries the opaque member UUID with **no FK constraint**; on account deletion the member row and auth user are deleted and audit rows are left untouched — the orphan UUID resolves to nothing, which achieves anonymization without ever updating an append-only table. The kill-switch operational surface lives here too: the `/moderator` dashboard shows AI kill-switch state and cron-liveness timestamps (last run of each pg_cron job and the outbox drain), and a moderator can flip kill switches from it — no direct SQL in the operational path.

### M8 — Assistant (separate module; never the front door)
As rev. 4 (model router, single-agent loop ≤6 steps/≤8 calls/≤60s, tool gate with risk tiers, 8 live R0/R1 tools, 9 declared-refused R2/R3 tools, service-role traces, `<member_message>` data tagging) with these rev-5 clarifications:
- **The Assistant tab does not exist in the UI until the AI verification gate passes** (Phase 5). Phases 2–4 ship four tabs; the fifth appears when the gate evidence is committed. (Rev 4 had intent-parsing "in Phase 3–4" — impossible, since the API key and gate arrive in Phase 5.)
- **"AI verification gate"** is this document's name for the checklist the canonical repo calls its "Phase 3 gate" (`.claude/skills/security-gates/SKILL.md`). The legacy repo's internal phase numbers are never used in this document — where §12 P5 says "AI gate," it means that checklist.
- **Phone-voice channel is read-only** (presence counts, open-offer summaries) in this document's scope. Caller-ID is spoofable, so R2 writes by voice are permitted only in an authenticated web push-to-talk session; an identity binding for phone-call writes is future work behind its own security review.
- Member free text enters model prompts **only** inside tagged data blocks; `agent_traces` (which contain member chat content) are covered by account deletion (deleted with the member).

### M9 — Notifications
`notification_outbox` with `dedup_key`, drained every minute by Vercel cron behind `CRON_SECRET`; web push (VAPID) with 410 cleanup. **Latency spec, made honest:** with a 1-minute drain, enqueue-to-send p95 is ~57s at best; the gate is therefore **p95 ≤90s from `outbox.created_at` to push-service accept (`sent_at`)** — measured from the outbox's own timestamps, which is the instrument. (Rev 4's "p95 <60s" was arithmetically impossible under this architecture; and "delivery to device" is unmeasurable without receipts, so the measured endpoint is push-service accept.) Push payloads are minimized: event type + deep link, no display names or pickup details in the payload (content is fetched after tap). **SMS fallback (Phase 5):** for confirmation-critical events (confirm, arriving, cancel) when a member has no live push subscription. The drainer resolves UUID→phone via the Supabase Auth admin API at send time; the number is never written to `notification_outbox`, logs, or telemetry. The resilience test exercises the direction that matters: **push undeliverable → SMS rescues** (plus the trivial Twilio-down → push-unaffected check).

### M10 — Analytics
`product_events(id, event, member_id uuid null, anon_id uuid null, entity_id uuid null, corridor_pair text null, created_at)`. The `event` CHECK list is exactly: `'board_view','spot_view','share_clicked','share_landed','signup_completed','offer_created','seat_reserved','ride_confirmed','checkin'`. `corridor_pair` is validated against a `corridor_pairs(slug text pk)` lookup table created in the same migration, seeded with `'horner-road__lenfant-plaza'` and `'lenfant-plaza__horner-road'` (format: `{origin-stop-slug}__{dest-stop-slug}`; P6 activations append rows). `entity_id` keys funnel events to an offer; `anon_id` is a first-party cookie UUID carried through sign-up (§13 wedge attribution, 7-day window). Insert via SECURITY DEFINER `log_product_event()`; select moderator-only. **Gate-critical metrics never come from this table** — rides, fill rate, time-to-match, and board-non-empty come from domain tables, which anonymous clients cannot write, so event poisoning cannot move a phase gate; `product_events` feeds funnel metrics only. Rate limiting of the public logger is **edge middleware, built in P2** (a SQL function cannot see caller IPs; P0 ships the migration only). A small `manual_metrics(week date, metric text CHECK (metric in ('group_rides','app_matched_rides','sms_sends','model_cost_cents')), value integer)` table (moderator-writable via the dashboard) stores the human-recorded and invoice-derived §13 numbers. **`metrics_weekly` is a plain SQL view with `security_invoker = true`** (without that option a default Postgres view owned by a privileged role bypasses RLS — the invoker option is what makes "the underlying tables' policies govern" actually true), not materialized, no refresh mechanism (computes at query time, satisfying P3's within-60s visibility for free), columns `(week, corridor_pair, metric, value)`; `manual_metrics`-sourced rows carry `corridor_pair = NULL` (they are pilot-wide, not per-pair). No third-party analytics; no free text in events.

---

## 9. Product plan

1. **Public wedge (Phase 2):** homepage + spot pages show live aggregates signed-out; the public Lost & Found board inherits the legacy forum's traffic. The 43 legacy spot URLs become 43 live landing pages — **all 43**, verified against the inventory list by slug (the earlier "≥40" tolerance silently permitted losing three).
2. **Founding cohort (Phase 0, human task):** recruit 3–5 recurring Horner drivers; supervised onboarding creates their recurring templates. Phase 3 gate: ≥3 active.
3. **Share-to-WhatsApp (Phase 3):** share action emits the community's own idiom ("Looking for 2 riders, Horner to L'Enfant, 4:15–4:30 — reserve: {link}") via Web Share API. The link target renders `get_public_offer_summary` signed-out (coarse card + sign-in-to-reserve CTA) — the mechanism exists in the spec now (§8 M1), where rev 4 required a public read the RLS gates forbade. If the offer has meanwhile filled/expired/cancelled, the landing state says so and offers the live board of the same corridor — including through the login-return path (the return lands on the offer's *current* state, never a stale card).
4. **Politeness mechanics (Phase 4):** one-tap "running late +5/10/15" available in `CONFIRMED` **and `ARRIVING`**; waitlist auto-renotify with a 10-minute soft hold (expiry via sweep: 10 min +0/−60s granularity, honestly stated); no-show recorded privately; the waiting rider's screen at a no-show gets a designed state — "mark no-show" appears after window_end + 10 min, with the corridor's live board proposed next.
5. **Voice (Phase 5):** tap-and-speak for the three driver utterances (offer seats, running late, cancel).
6. **Corridor-pair expansion discipline (Phase 6):** new spot only with a local founding cohort; a spot that misses the liquidity bar is set to "organizing", never left as a dead board.
7. **Non-goals:** unchanged (§7.6); leaderboard hidden during pilot pending §15 Q6.

---

## 10. UI specification

**Design system.** Tailwind 4 tokens; Geist Sans/Mono. Near-white ground `#FAFAF8`, ink `#17202A`, accent highway-green `#2E7D46`; semantic tokens `--driver` blue, `--rider` amber, `--urgent` red. **Color is never the only carrier:** state pills and role badges always pair color with a text label (WCAG 1.4.1). Dark theme via `prefers-color-scheme` plus an explicit toggle **in the public footer** (reachable signed-out); all colors defined as tokens on `:root` and redefined in dark; body paints its own background. WCAG 2.1 AA contrast in both themes — verified per §12 P2 by automated contrast checks on both themes' token sets plus Lighthouse a11y ≥95 on sampled pages; authenticated surfaces get a manual AA pass in P4 (an authenticated-Lighthouse CI harness is not specified — claiming "CI-enforced" for auth pages was rev-4 fiction).

**Navigation model — segment by intent at the curb.**

| Zone | Intent | Signed-out | Backing |
|---|---|---|---|
| **Spots** | "What's happening?" | full access (aggregates) | M1 (+M4/M6 strips) |
| **Board** | "Get me a ride / fill my car" | not visible (auth surface) | M3 (+M4/M6 context) |
| **Lost & Found** | "I lost/found something" | board readable; actions gated | M5 |
| **Assistant** | "Just tell me" | absent until AI gate passes (Phase 5) | M8 |
| **Me** | history, settings, account | — | M2/M3 |

Tab bar signed-in: Spots · Board · Lost & Found · (Assistant) · Me — Board default. The public read surface is exactly §7.1's list. Incidents and Presence are context strips, not destinations; Moderation is a role-gated surface with no tab. **Chat is never the front door** — the board is the source of truth; the assistant accelerates it and can be killed without loss.

**Screen-state matrix (normative).** Every zone implements these states; an implementation model must not invent them:

| State | Requirement |
|---|---|
| Loading | Skeletons, never spinners, on the board; static shells elsewhere |
| Empty | Always proposes the next action. Board: "No offers for this window yet — check in so drivers can see you, or post a request." Spot page with zero counts: "Quiet right now — morning peak is 5:30–9:30." L&F: "Nothing reported this week — lost something? Report it." History/leaderboard: one-line explainer + primary CTA. Moderator queue: "Nothing to review." Assistant first-run: three example utterances. |
| Error (action failed) | Inline, plain-language, retry affordance; reserve failure specifically distinguishes "seat just taken" (offer live view refreshes) from network failure (retry) |
| Offline | Board and spot pages show last-fetched data with a "stale since HH:MM" banner; actions queue nothing — they fail fast with the offline banner (curb use = flaky signal is the norm) |
| Denied push permission | Board shows a dismissible note: "Notifications are off — you'll need to check back for confirmations." SMS fallback (Phase 5) covers confirmation-critical events; no nagging re-prompt |
| Stale return | Any deep link or login-return to a changed offer lands on its current state with the change named ("This offer filled while you were signing in") + corridor board CTA |

**Push permission moment:** requested only after the user's first offer/reservation action, from an in-app explainer ("So your driver can reach you when they're arriving") — never on load.

**Identity UX — one flow.** No passwords, email, usernames, or separate registration. (1) Gated actions route to `/login` with return path; copy: "Other sluggers never see your number. We use it to sign you in — and, if you enable them, to send ride updates by text." (The rev-4 copy "only used to sign you in" would have become false the day SMS shipped.) (2) Phone → 6-digit OTP; resend with visible cooldown (60s); generic errors; **both OTP hard-failure states specified:** code-never-arrived → after 2 resends, show "SMS may be blocked by your carrier — try again later" terminal state; attempts exhausted → 1-hour lockout with plain copy and the lockout duration shown. (3) First verify forks to `/onboarding`: display name ("shown to other sluggers") + home spot (active locations only during pilot). (4) Sessions last weeks, silently refreshed; **OTP re-verification is required on next sign-in after**: logout, a new device, or a phone-number change; account deletion additionally requires a fresh OTP confirmation in-flow. (5) Me → account: session list with per-device revoke; **delete account** — confirmation screen states exactly what is deleted (profile, offers, reservations, check-ins, chat/assistant history, events) and what is retained (anonymized audit records, per §8 M7); immediate on confirm; retention authority is the canonical `data-classification.md` (§3.4), which P0 verifies covers `product_events` and `agent_traces`. (6) Security the user can see: pickup details only after mutual confirmation; no member directory; no phone numbers anywhere in the product surface. Omissions with reasons: no social login, no magic links; passkeys revisit post-pilot — noting the SIM-swap/number-recycling risk is about **physical-safety data** (pickup locations, vehicle descriptions, patterns), not money, which is why deletion, session revoke, and re-verification rules above are strict rather than cosmetic. Number-recycling ATO (carrier reassigns a dormant number) is accepted for the pilot with mitigations (re-verification events above; dormant-account sign-in lands on a "confirm your details" interstitial) and is listed in §14.

**The board is a status surface.** Window and seats first, then origin→destination, then state pill (with label). Presence strip pinned. Realtime via Supabase Realtime. Performance budgets: public LCP <2.0s throttled 4G, public JS <150KB gzip (both CI-enforced from Phase 2); board time-to-interactive <2.5s measured manually each phase until an authenticated CI harness exists.

**Copy voice:** plain, warm, curb-appropriate; errors say what to do next. (Copy quality is reviewed by a human before pilot invite — it is a review step, not a measurable gate, and is listed as such.)

---

## 11. Phased plan with gates

Measurements are tagged **[S]** session-verifiable (the implementing session produces the evidence), **[C]** calendar-scoped (elapsed real time), or **[H]** human-performed. A session prompt can only be exited on its [S] items; [C]/[H] items are tracked in the weekly review.

| Phase | Name | Duration | Status |
|---|---|---|---|
| 0 | Consolidation & foundations | 1–2 wk | new work |
| 1 | Module boundaries & content port | 2–3 wk | core exists |
| 2 | Public directory, ops readiness & cutover | 1–2 wk | new (M1) + DNS |
| 3 | Pilot at Horner Road | 2–4 wk | parallel run |
| 4 | Coordination completeness | 2–3 wk | politeness + moderation UI |
| 5 | AI verification & writes; voice; SMS | 3–4 wk | foundation exists |
| 6 | Multi-location expansion | ongoing | gated on 3 |

**Phase 0 — Consolidation & foundations.** Record the §5 decision in `docs/DECISIONS.md` (+ the exact test-suite count N; + the P0 verification of the three UNVERIFIED §2 items; + **the name of the staging environment** — a Supabase preview branch or second project used by later phases' staging tests; the "one project" rule means one *production* project). Close PR #1. Port assets from `codex/phase-3-4`: **code files (`community-channels.ts`, spot-directory/search libs, migration script) go to `lib/legacy/` and `scripts/` as a pre-restructure holding area; only the inventory *document* goes to `docs/legacy/`**. Update `AI/README.md` in the `sluglines` repo (its "implementation: not started" claim is false — update, don't delete: §11's deferred list cites a file inside that folder). CI scans (risk 7). `0025_product_events.sql` exactly per §8 M10 (the event list and `corridor_pairs` seed are fully enumerated there). First slice of the lint boundary rule: in the **current pre-P1 layout**, forbid `lib/ai/**` imports from everywhere except `app/**/assistant/**` and `lib/ai/**` itself (verify actual current paths at execution and record the allowlist in DECISIONS.md). `SluglinesAgent`: git init; rotation verified by artifact [H rotation, S artifact]. **Apply the §8 M2 OTP abuse controls** to the Supabase auth configuration where the platform exposes them (cooldown, attempt caps, CAPTCHA) and capture the config state as an artifact; the per-IP daily send cap is enforced in the route handler, not edge middleware (D-80). Create `docs/costs.md` (caps: model ≤$0.10/turn, ≤$50/month alarm; SMS alarm 500 sends/day; provisional). Record the WhatsApp **volume baseline** [H]: for each of the two groups, one integer per week — rides observed coordinated in that group (this is the pilot denominator; it is a different measurement from §13's parallel-run pair). Recruit founding drivers (starts now) [H].
**Phase 0 edge rules (so no verification outcome forces a guess):** if the baseline suite or CI is red for mechanical reasons (env, config), fixing it to green is in scope before recording N; if red for substantive reasons, stop and report — N cannot be recorded from a red suite. If the deployment check fails, record it and proceed (Phase 2 rebuilds the deployment path). If an `ANTHROPIC_API_KEY` is unexpectedly present in Vercel, record its presence and touch nothing — it matters only at P5. CAPTCHA enablement needs a provider credential (e.g. Turnstile keys) the operator may not have yet: if absent, that sub-item is reported [H] pending and does not fail the OTP-artifact gate item; the other OTP controls still apply. Staging: P0 *records the choice only* (default: Supabase preview branch of the production project; a second project only if preview branches are unavailable on the plan); provisioning happens in the first phase that uses it (P3). The volume-baseline template lives in DECISIONS.md: per group, one integer per week, **two observation weeks minimum, averaged** — Phase 3's "≥25% of baseline" compares against that average. The two groups are **Horner Rd ↔ L'Enfant/GSA** and **Horner Rd ↔ 18th St** (the two reviewed exports). Ported `lib/legacy/` files are **inert** — excluded from build and typecheck until the P1 restructure adapts them (they come from a Next.js 14 codebase; making them compile is P1's job, not P0's). **P0's migrations and live-suite runs target the production Supabase project — explicitly and intentionally**: staging does not exist until P3, the product has no users pre-cutover, and this sentence is the authorization an implementing session should otherwise have stopped to ask for; DECISIONS.md records it. Finally, P0 commits **this document** to `Docs/` in the host repo `sluglines` (all ports and holding areas in this phase target the host repo) — **done 2026-08-20**.
**Gate:** decisions + N + staging choice + baseline template recorded; this document committed to `docs/` [S]; the three new CI jobs (`audit`, `static-analysis` — a semantic scanner distinct from the existing ESLint job — and `secret-scan`) green alongside the pre-existing jobs [S]; suite result = **N baseline tests + the new P0 tests, all green** [S]; RLS tests for new tables [S]; boundary-rule violation demo [S]; OTP config artifact [S]; credential rotation: the artifact is required **when the human has rotated** — if rotation is still pending at session end, the phase exits with it reported pending [H], and the artifact becomes a Phase 1 entry criterion (this resolves the §11/§12 tension in §12's favor).

**Phase 1 — Module boundaries & content port.** Physical restructure to §8 (behavior-preserving; suite green before/after at count N). Seed migration for the **full 43-spot inventory** (idempotent; count asserted = inventory list length). Informational content rewritten. The `/[...legacy]` redirect handler with the **all-165-routes** test.
**Gate:** N tests green pre/post [S]; route-manifest diff empty for authenticated routes [S]; 43/43 spots [S]; 165/165 redirect statuses correct [S]; zero imports of `lib/ai/**` outside M8 [S].

**Phase 2 — Public directory, ops readiness & cutover.** Build M1 (public pages + the three public functions + status strip). UI spec §10 including the state matrix. Performance budgets in CI (public). **Ops readiness (this phase, because production traffic follows):** Supabase PITR confirmed enabled + one restore rehearsal into a scratch project, documented [S/H]; uptime monitoring — an external check hits `/` and a health endpoint reporting cron/outbox last-run timestamps every minute, alerting the operator [S]; **Sev-1 defined**: product unusable for members during a peak window (auth, board, or DB down) — this definition is what later gates reference; cron-liveness timestamps surfaced on `/moderator` [S]. Retire the legacy Supabase project's write paths [S]. DNS runbook (with rollback); **WordPress cancellation is a separate human-gated step no earlier than 30 days post-cutover, after §15 Q2 is answered** — the runbook marks it irreversible. Disable test-OTP ranges in production auth config [S]. STOP before DNS — human approval.
**Gate:** public-function tests (anon can call the three functions; anon select denied on `offers`, `reservations`, `members`, `presence_checkins`, `lostfound_messages`) [S]; Lighthouse budgets + a11y ≥95 on `/` and one spot page [S]; both-theme contrast check on token sets [S]; 165-route resolution on the preview domain pre-DNS, re-verified on production post-DNS [S]; restore rehearsal documented [S]; monitoring alert test-fired [S].

**Phase 3 — Pilot at Horner Road.** Founding templates live before invite (≥3 drivers) [H]. Share links (§9.3). Metrics wired per §13. Pilot invite page. Pilot scope — which groups are invited — is **§15 Q4, decided by the human before invite**; the gate denominators use whichever scope is chosen.
**Build gate [S]:** share text byte-exact for 3 fixtures; signed-out share-link render shows only the §8 M1 coarse fields (test asserts absence of display name/vehicle/pickup/exact window); stale-return states render; funnel events appear in `metrics_weekly` within 60s.
**Pilot exit gate [C], 2 consecutive weeks:** peak-window board-non-empty ≥90% (definition: §13); **rides reaching CONFIRMED-or-later ≥10/week** (from domain tables — see §4.7 for why not COMPLETED) *and* ≥25% of the recorded baseline (so the target has a denominator); median time-to-first-reservation <15 min for peak offers; seat fill ≥50%; wedge share ≥30% (§13 attribution); zero **safety incidents** — defined as any moderation report in the `safety` category or any physical-safety event reported through the pilot feedback channel; the definition plus the channel make the count falsifiable; notification p95 ≤90s per §8 M9's instrument.

**Phase 4 — Coordination completeness.** Running-late (CONFIRMED + ARRIVING); waitlist auto-renotify with sweep-granular hold expiry; no-show flow including the waiting rider's designed moment (§9.4); member report/block UI (block hides offers bidirectionally at RLS level); moderator triage queue; manual AA pass on authenticated surfaces.
**Gate [S]:** waitlist race ×20 → exactly one hold each time; hold expiry within sweep tolerance with injected clock; no-show privacy matrix (moderator sees; other members don't); block matrix ≥4 cases; report→resolve e2e with matching audit row and zero direct SQL. **No-show rate is a reported trend, not a hard gate** (rev 4's §11/P4 contradiction resolved in P4's favor: a rate gate on a manually-reported event would gate on reporting diligence, not behavior).

**Phase 5 — AI verification & writes; voice; SMS.** Precondition: `ANTHROPIC_API_KEY` provisioned [H]; verify presence, stop if absent. (1) Run the **AI verification gate** (§8 M8 terminology) against the live model: injection corpus ≥40 cases (direct + indirect via offer text, L&F descriptions, incident text) — **pass = zero unauthorized tool intents executed; intents emitted-but-blocked are recorded and reported, not failures** (the gate exists because models sometimes propose; blocking is the system working — rev 4's "0 reach the gate" graded model stochasticity, not the control); schema validity ≥99% over an eval run of ≥200 outputs (sample size now stated); kill-switch drill with a **named functional checklist** (board loads, offer create/reserve/confirm succeed, all four tabs render) rather than "fully functional"; per-turn cost within the `docs/costs.md` cap. Produce the results doc; STOP on failure. (2) R2 tools with read-back confirmation (single-use, intent- and revision-pinned; 10/10 misheard-confirmation rejections → zero writes). (3) R3 approval workflow fail-closed matrix 4/4. (4) Twilio SMS via the §8 M9 resolution path; the resilience test is **push-undeliverable → SMS rescues** [S]. (5) Server-side STT/TTS behind router classes; browser Web Speech remains for browsers that have it, mic hidden with an explanatory tooltip where absent, text chat always available; voice latency budget (P95 ≤1.5s read path) applies to the **server pipeline built in this step** and is measured at step 5, not step 1. Assistant tab ships at the end of this phase. **Post-enablement comparison [C]:** for ≥2 weeks after R2 goes live, compare agent-created vs form-created offers on reaching CONFIRMED; n≥20 agent-created offers required for the comparison to gate anything — below that it is reported as observational (rev 4 called this "shadow mode," which was self-contradictory: shadow offers can't complete).
**Gate:** the AI verification checklist with command output [S]; fail-closed matrices [S]; SMS rescue test [S]; latency evidence [S]; comparison per above [C].

**Phase 6 — Multi-location.** Per spot: founding cohort ≥3 committed [H] before activation; activate; corridor windows configured; share message prepared for human posting; metrics cohort from day 1. Week-4 evaluation against the **full Horner bar** — all four Phase 3 pilot-exit product conditions, not just board-non-empty (rev 4's P6 silently weakened the bar its own term named). Below bar → "organizing" state within one business day of the *weekly review that detects it* (the review is the instrument; the SLA runs from detection, not from the miss).

**Deferred (Phase 7+):** forecasting, wait estimates, AI L&F matching, reliability scoring, presence estimation — each behind its own privacy/fairness review. Un-deferral triggers for reserved components are now concrete: the FastAPI/LangGraph orchestrator service (reserved in the July 18 phased design, `AI/docs/specs/2026-07-18-sluglines-ai-phased-design.md`) is adopted only if tool count exceeds 30 or a workflow needs durable multi-step interrupts; passkeys revisit when SMS spend exceeds the §12 P0 cost-sheet alarm two months running or a confirmed SIM-swap/recycling incident occurs.

---

## 12. Execution prompts

Shared preamble — prepend to every prompt:

> You are implementing one phase of the Sluglines consolidation, specified in `Docs/consolidated-architecture.md` **(rev. 6 — verify the header says rev. 6 before starting; if the file is a different revision, stop and report)**. Constraints that override any convenience: (1) Models propose; code and database transactions decide — no AI in authoritative paths. (2) Every new/changed table ships default-deny RLS + positive and negative RLS tests in the same PR. (3) **PII rule, precise form:** no phone numbers, no contact-detail columns, and no PII-typed fields in application tables; user free text exists only in the fields §8 defines (pickup instructions, L&F descriptions and messages, incident descriptions), each confined to its §8 visibility scope; no member free text or identifiers in logs, telemetry, or metrics; member free text enters model prompts only inside tagged data blocks (§8 M8). (4) The WhatsApp chat exports are research inputs only — never fixtures, prompts, or test data. (5) Module boundaries per §8's dependency rule. (6) State transitions are SECURITY DEFINER SQL functions with revision checks and idempotency keys. (7) Run the full test suite (baseline count N per DECISIONS.md) before claiming completion; paste output. Work in the host repo `github.com/cybersecurity-cell/sluglines` (§15 Q1 closed 2026-08-20; `Sluglines-AI` is a module absorbed into it, not the target repo); all other artifact locations are in §2's location table — never guess a path. **Access preconditions — verify before starting, stop and report if any is missing:** GitHub auth covering both repos, Supabase credentials for the suite's configured target, and (P0/P5 only) access to the linked Vercel project; a CAPTCHA-provider credential is optional at P0 (its absence downgrades one sub-item to [H] pending, per §11 Phase 0's edge rules). Small, reviewable commits. Measurements tagged [S] are yours to evidence; [C] and [H] items are out of your scope — report them as pending, never as done. If a gate check fails, stop and report — do not waive it.

**P0 — Consolidation & foundations.** Execute Phase 0 of rev. 5.3 §11 — the phase text there is authoritative and now enumerates every destination, list, and configuration step; this prompt adds only sequencing. Tasks in order: (1) `docs/DECISIONS.md` per §11 Phase 0 (decision, N, staging name, three UNVERIFIED-check results — presence only, never secret values —, OTP values, cost caps, lint allowlist). (2) Close draft PR #1 (repo location: §2 table) with a decision reference; do not merge. (3) Port assets per §11's stated destinations. (4) Update `AI/README.md` per §11. (5) CI: the three new jobs per §11's gate, audit with the documented-exceptions file (advisory ID, reason, expiry). (6) `0025_product_events.sql` per §8 M10 (event list and corridor_pairs seed are enumerated there — nothing is left to invent) + `manual_metrics` + `metrics_weekly` computing the computable §13 subset (domain/outbox/events metrics; parallel-run and spend rows come from `manual_metrics`). (7) Lint first slice per §11's allowlist. (8) `SluglinesAgent` per §11. (9) Apply OTP config per §11; capture artifact. (10) `docs/costs.md`.
**Measurements [S]:** suite = N baseline + new P0 tests, all green, 0 failures; the 3 new CI jobs green; audit 0 unwaived high/critical; secret scan 0 findings; ≥4 RLS tests on `product_events` (anon insert denied; direct member insert denied; `log_product_event()` succeeds; non-moderator select denied) + `manual_metrics` moderator-only tests; boundary-violation commit fails lint (then reverted); `SluglinesAgent` has ≥1 commit and **zero tracked secret-bearing files of any name** — run the secret scanner over the working tree before the initial commit; the `.env*` check alone is insufficient if credentials sit in a differently named file; OTP config artifact captured; DECISIONS.md contains every §11-listed item. **[H] pending:** rotation itself, founding-driver recruiting, volume baseline.

**P1 — Module boundaries & content port.** Execute Phase 1 of rev. 5.3 §11. Tasks: (1) Restructure per §8: route groups `app/(public)`/`app/(app)`, domain under `lib/domain/*`, `lib/ai` isolated; no authenticated route URL changes. (2) `0026_full_spot_directory.sql`: all 43 inventory spots (idempotent upsert by slug; migration output prints inserted/updated counts; test asserts seeded count equals the inventory list length). (3) Informational content as typed constants/MDX — topic parity with the legacy pages (checklist of covered topics committed as the parity evidence; textual copying is prohibited). (4) The `/[...legacy]` catch-all redirect handler per §8 M1 (301 map / branded 410 / L&F forum 301s) — no `next.config` redirects. (5) Complete the ESLint boundary rule now that paths exist. (6) Update the five `.claude/skills/*` files (enumerated: `agent-runtime`, `ai-skill-contract`, `domain-state-machine`, `security-gates`, `voice-pipeline`) for any moved path.
**Measurements [S]:** N tests green pre- and post-restructure with only import-path edits in test files; authenticated route-manifest diff empty; 43/43 spots, idempotent (second run: 0 inserts); 165/165 inventory routes return exactly the mapped status and target; forum root and legacy L&F URLs 301 → `/lostfound`; grep: 0 `lib/ai` imports outside M8; boundary rule full-rule violation demo fails lint.

**P2 — Public directory, ops readiness & cutover prep.** Execute Phase 2 of rev. 5.3 §11 and UI spec §10 exactly. Tasks: (1) `0027_public_aggregates.sql`: the three §8 M1 functions with edge rate limits; RLS/read-surface tests. (2) M1 pages incl. the state matrix rows that apply to public surfaces; public L&F board read view. (3) Lighthouse CI (public budgets + a11y) and the both-themes token contrast check (script asserting every color token pair meets AA in both themes — the instrument is this script, committed). (4) Ops readiness per §11: PITR check + restore rehearsal doc; health endpoint exposing cron/outbox last-run timestamps; external uptime check + alert test-fire; `/moderator` liveness panel; Sev-1 definition into DECISIONS.md. (5) Retire legacy Supabase write paths (drop/disable the open-write policies and legacy tables per §5 "Dropped"). (6) Disable production test-OTP ranges; evidence: config state + a failed test-range login attempt. (7) DNS runbook with rollback and the WordPress-cancellation human gate ≥30 days out. STOP before DNS.
**Measurements [S]:** anon can call the 3 functions; anon select denied on the five §11-listed tables; `get_public_offer_summary` output contains no display name, vehicle, pickup, or sub-15-min window fields (asserted on fixtures); Lighthouse LCP <2.0s, JS <150KB, a11y ≥95 on `/` + one spot page; contrast script passes both themes; 165-route check green on preview; restore rehearsal documented with timestamps; uptime alert fired and received; legacy write-path test proves the old policies are gone; test-OTP ranges rejected in prod config.

**P3 — Pilot enablement.** Execute Phase 3 of rev. 5.3 §11. Tasks: (1) Share action per §9.3 (Web Share API + clipboard fallback; `share_clicked` with `entity_id`); share-link landing renders the coarse public summary signed-out, with filled/expired/cancelled and login-return current-state handling per §10's stale-return row. (2) Founding-driver onboarding runbook (`docs/runbooks/founding-driver.md`). (3) `metrics_weekly` per §13 wired to `/moderator` (board-non-empty from domain tables; wedge attribution via `anon_id`). (4) Notification copy pass flagged for human review. (5) `/welcome/horner` invite page. Pilot scope and invite timing are [H] per §15 Q4.
**Measurements [S]:** share text byte-exact on 3 fixtures; signed-out landing shows only coarse fields (absence-asserted); stale-return renders for all three changed-offer states; funnel events with `entity_id`/`anon_id` visible in `metrics_weekly` within 60s on staging (staging = the environment named in DECISIONS.md at P0). **[C]/[H] pending:** the two-week pilot-exit gate (§11), runbook execution with real drivers, copy review.

**P4 — Coordination completeness.** Execute Phase 4 of rev. 5.3 §11. Tasks per §9.4 and §11: running-late in CONFIRMED+ARRIVING; waitlist hold with sweep-granular expiry and injected-clock tests; no-show flow incl. the rider-side moment; report/block UI with bidirectional RLS hiding; moderator triage; manual AA pass on authenticated surfaces documented.
**Measurements [S]:** race ×20 → exactly 1 hold per run; injected-clock expiry within +0/−60s of 10 min and exactly one renotify (dedup asserted); no-show visibility matrix ≥3 cases; block matrix ≥4 cases incl. unblock restore; e2e report→resolve transcript with one matching `audit_events` row and zero direct SQL; ETA notify enqueue-to-send within the §8 M9 p95 budget on staging. No-show rate: reported, not gated.

**P5 — AI verification, writes, voice, SMS.** Execute Phase 5 of rev. 5.3 §11 in order; the phase's precondition and stop conditions are absolute. All terminology per §8 M8 ("AI verification gate"); all thresholds per §11 Phase 5 (injection corpus ≥40, zero *executed* unauthorized intents, schema validity ≥99% over ≥200 outputs, named kill-switch checklist, cost cap from `docs/costs.md`, misheard 10/10, R3 matrix 4/4, SMS rescue direction, server-pipeline latency at step 5, comparison rules incl. n≥20).
**Measurements:** as §11 Phase 5's gate, tagged there; produce `docs/ai-gate-results.md` with command output for every [S] item.

**P6 — Multi-location (repeatable per spot).** Execute one Phase 6 iteration of rev. 5.3 §11 for spot {SPOT}. Precondition [H]: ≥3 founding drivers with active recurring templates (verify runbook artifacts; stop if fewer). Tasks: activate location; configure corridor windows; update spot-page community links; prepare (do not send) the announcement; add to metrics cohort.
**Measurements:** activation visible on the public spot page [S]; metrics rows from day 1 [S]; week-4 evaluation against the full four-condition Horner bar [C]; below-bar → "organizing" within 1 business day of the detecting weekly review [C].

---

## 13. Metric definitions (single source of truth; `metrics_weekly` implements exactly these)

- **Peak windows (the denominator everywhere):** weekdays, 05:30–09:30 ET (morning, home→DC direction) and 15:00–19:00 ET (afternoon, DC→home), in 30-minute buckets, per active corridor pair. 16 buckets/day/pair.
- **Board-non-empty rate:** share of peak buckets in which ≥1 offer in OPEN or PARTIALLY_RESERVED overlapped the bucket for that corridor pair — computed retrospectively from `offers` rows (created_at, window, terminal-state timestamps persist; no snapshotting needed). Domain-table sourced; not poisonable via public events.
- **North-star & pilot volume:** rides reaching **CONFIRMED-or-later** per week per corridor pair, from `offers`/`reservations` (see §4.7). `COMPLETED` is additionally reported but never gated.
- **Time-to-first-reservation:** median, offer `created_at` → first ACTIVE reservation, peak-window offers only.
- **Seat fill rate:** seats with an ACTIVE-or-later reservation ÷ seats offered, peak offers.
- **Wedge share:** of gated-metric rides, the share where the reserving rider's `member_id` links (via the sign-up-carried `anon_id`, 7-day window) to a prior `share_clicked` or public `board_view`/`spot_view`. First-party cookie only; documented in the privacy note.
- **No-show rate (reported, not gated):** no-show-marked reservations ÷ CONFIRMED reservations; known under-reported (manual marking).
- **Notification p95:** `sent_at − created_at` over all outbox rows, weekly.
- **Parallel-run share [H]:** weekly human review records two integers into `manual_metrics` — `group_rides` (rides observed coordinated in the group chat) and `app_matched_rides` (those with an app-side CONFIRMED counterpart the reviewer personally knows of). No names, no message content; directional only. (Distinct from the P0 volume baseline, which is `group_rides` alone, recorded before the app exists to match against.)
- **Spend:** weekly `sms_sends` and `model_cost_cents` recorded into `manual_metrics` from provider dashboards/invoices, compared against the `docs/costs.md` caps; alarm rows on the moderator dashboard.

`metrics_weekly` implements the domain/outbox/events-computable metrics above; the two `manual_metrics`-sourced rows join in from that table. Nothing in §13 lacks a named storage location.

---

## 14. Risk register

| # | Severity | Finding | Action |
|---|---|---|---|
| 1 | **High** | PR #1's check-in tables allow any anonymous client to update/delete any row. | Never merge; superseded by `presence_checkins` (P0). |
| 2 | **High** | `SluglinesAgent` live credentials, no VCS. | Rotate with verification artifact + git init (P0). |
| 3 | **High** (product) | Cold start: an empty peak-hour board on first visit kills retention. | Founding cohort ≥3 before invite; recurring templates; onboarding restricted to active spots; P6 "organizing" state. |
| 4 | Medium | `spot_status` open write on `main`. | Removed at P2 legacy retirement. |
| 5 | Medium | Diverged duplicate plans (`AI/README.md` says "not started"). | Update/delete folder (P0). |
| 6 | Medium | AI layer never run live; three §2 items UNVERIFIED. | P0 verification checks; P5 AI gate. |
| 7 | Medium | Documented CI security control didn't exist (scans claimed, absent from `ci.yml`). Found by the knowledge graph. | P0 adds the scans + exception process. |
| 8 | Medium | Two live Supabase projects. | §5 + P2 write-path retirement with test evidence. |
| 9 | Medium (product) | Friction regression — OTP wall in front of *reading*. | §7.1's precise public surface is a P2 gate. |
| 10 | Medium (security) | Number-recycling / SIM-swap account takeover exposes physical-safety data (not money — pickup details, patterns). | Accepted for pilot with §10's re-verification events + dormant-account interstitial; passkey trigger in §11 deferred list; listed, not hidden. |
| 11 | Medium (security) | SMS-pumping cost abuse on the public OTP endpoint. | §8 M2 caps + CAPTCHA + §13 spend alarm. |
| 12 | Low | Draft PR #1 stale. | Close with reference (P0). |
| 13 | Low | Legacy URLs carry backlink value; L&F forum is live today. | 165-route redirect tests; L&F-forum 301s to the public board; 30-day read-only overlap + notice. |
| 14 | Low | Savings figures are a flat constant. | Labeled as estimate; real toll source deferred. |
| 15 | **Low** (security), was High | **Browser security headers.** `next.config.js` defined no `headers()`, so the app shipped with no CSP, no `X-Frame-Options`, no `X-Content-Type-Options`, no `Referrer-Policy` and no `Permissions-Policy`. Found by the issue #11 triage of `codex/phase-1`, whose own review listed this baseline as a shipped control. | **Largely closed (D-48, #33).** The four enforceable headers ship enforced; `frame-ancestors 'none'`, `base-uri`, `object-src` and `form-action` ship too. The CSP is **report-only** pending the inventory #33's second bullet requires, because `script-src` still needs `'unsafe-inline'` for Next's bootstrap. Residual risk is XSS-via-inline-script only; `tests/security-headers.test.mjs` prevents a second silent loss. |
| 16 | **Closed** (supply chain), was Medium | **GitHub Actions were pinned to mutable tags**, not commit SHAs. A tag is repointable by its owner, so the security workflows that gate every merge were themselves unpinned. Same source as risk 15. | **Closed (D-49, #34).** All 16 action refs across 5 workflows carry a full 40-character SHA with a `# vN.N.N` comment; `tests/workflow-pinning.test.mjs` fails on any tag ref, and was verified to fail. `.github/dependabot.yml` moves the pins weekly so freezing them does not become the next problem. |

---

## 15. Open questions for a human

1. ~~**Repo topology** — merge `sluglines` into `Sluglines-AI` or transplant to keep the `sluglines` name.~~ **CLOSED 2026-08-20: `sluglines` is the host repo** (`Docs/2026-08-20-adr-sluglines-is-the-host-repo.md`). The schema half of that ADR was reversed on 2026-08-22: the lineage is this repo's, not `Sluglines-AI`'s (`Docs/DECISIONS.md` D-34). **What remains open is narrower and is now Q7 below:** whether `Sluglines-AI` is absorbed at all.
2. **Legacy archive** — static read-only archive (e.g. `archive.sluglines.com`) or full 410 after the 30-day overlap. Gates WordPress cancellation.
3. **`SluglinesAgent`** — keep as brand-ops tooling after rotation, or retire.
4. **Pilot scope** — Horner ↔ L'Enfant only, or both exported groups from day one. Decides Phase 3 invite and gate denominators.
5. **Founding-driver thank-you** — any recognition that stays on the right side of the no-gamification principle.
6. **Leaderboard** — it exposes individual activity, which §7's non-goals prohibit; it ships hidden during the pilot. Keep (with specified masking + opt-in), or cut.
7. **Absorb `Sluglines-AI`, or leave it dormant?** Split out of Q1 on 2026-08-22. Now that the schema question is settled (D-34), what the module would bring is its *app layer*: the assistant and tool gate, notifications, lost & found, incidents, moderation. Absorbing it is also a Next 14→16 / React 18→19 / Tailwind 3→4 upgrade the ADR says cannot be done incrementally. Decides whether issue #3 (the per-tool kill switches, which do not currently work) is live work or moot.

---

## 16. What would change this design

A second metro area (extract services along domain lines); regulatory requirements on carpooling platforms; sustained scale beyond **10× pilot bounds (≳5,000 members or ≳2,000 offers/day** — 10× the original design's pilot envelope of ≤500 members / ≤200 offers/day); or agent workflows needing durable interrupts (adopt the reserved orchestrator per §11's deferred list). The single-deployment modular monolith stands; the rejected multi-agent topology stays rejected at the current **17-tool** catalog (8 live + 9 declared-refused) and is revisited above 30.

---

## 17. Iteration protocol

As rev. 4 (red-team pass, persona walkthroughs, gap sweeps, decision-log discipline, one-phase-one-session, same-PR doc amendments, independent review of each phase, knowledge-graph updates, escalation rule) — now with evidence it works: this revision *is* the output of the §17.1 red-team pass, run as a six-seat SME panel (~180 findings; §18). Remaining named sweeps not yet run: none — error/offline states, notification-permission UX, ops, and cost model were closed by the panel; accessibility flows remain partially open (manual AA pass scheduled in P4).

---

## 18. Changelog

**Rev. 6 (2026-08-22 — issue #6).** Rev. 5.4 established that three claims were wrong; it recorded the corrections in a banner at the top and left the wrong text standing underneath. A document that opens by telling you not to trust three of its own sections is not corrected, it is annotated. Rev. 6 folds them in:

1. **§3.4 rewritten.** `Sluglines-AI` is described as a dormant parallel build whose migrations have never reached a live Sluglines database — no longer as "the module to be absorbed", which presumed an answer to a question that is still open.
2. **§5 rewritten, and reversed a second time.** Rev. 5.4 kept `Sluglines-AI`'s migration lineage as the schema ancestry. `Docs/DECISIONS.md` **D-34** reverses that: the lineage is this repo's `0001`–`0007`. The comparison table is retained, explicitly dated to 2026-08-14, with a row-by-row account of what has since closed inside `sluglines` — which is *why* the schema half reversed.
3. **§15 Q1 narrowed rather than left ambiguous.** Q1 is closed; the genuinely open remainder — *absorb `Sluglines-AI` at all?* — is split out as **Q7** instead of hiding inside a closed question.
4. **The banner is gone.** What replaces it is the one fact that actually reshapes the plans: the production database is empty.
5. **Renamed to `Docs/consolidated-architecture.md`.** Rev. 5.4 identified the dated filename as the bug and declined to fix it. A date in the filename of a document on its sixth revision is the signal that a writer thought they were creating when they were continuing; the next session forks a dated sibling instead of editing this. All 13 references across the repo were updated, including a comment in the applied migration `0001` (comment-only — no statement changed; recorded in D-37).
6. **Header facts refreshed.** Baseline `N` is now 28 files / 872 assertion call sites and is **machine-checked** — `tests/baseline-n.test.mjs` fails if this header and the repo disagree (D-35, issue #7). Repo state re-stated against `main`, which is now the only live branch.

Not done, deliberately: the three cold-reader loops were not re-run. Rev. 6 is verification and consolidation of existing decisions, not new design, and re-certifying 500 lines was out of scope — the same limit rev. 5.4 recorded.

**Rev. 5.4 (2026-08-20 — consolidation review; the first revision driven by direct infrastructure verification rather than repo reading).** Four claims corrected, none of them cosmetic:

1. **§5 superseded.** The repo decision reversed: `sluglines` is the host, `Sluglines-AI` is a module absorbed into it. The *schema* half of §5 survives — `Sluglines-AI`'s lineage is still the ancestry — so §5's comparison table is retained but re-scoped to "which schema wins". Recorded in `Docs/2026-08-20-adr-sluglines-is-the-host-repo.md`.
2. **§3.4 corrected against the live database.** The claim that `Sluglines-AI` carries a live-DB RLS suite is false with respect to the **production** Sluglines Supabase project. ("the only" until 2026-08-22 — there are two; D-50.) That project (`bwpguotjzczmieeepczf`) records two applied migrations, both from July, and holds three empty legacy tables; `Sluglines-AI`'s 24 migrations were never applied to it. §2 had flagged this UNVERIFIED-until-P0 — it is now verified, and false.
3. **§15 Q1 closed** in favour of `sluglines`, with §5's and §12's dependent text updated rather than left to drift.
4. **Header facts refreshed:** baseline `N` corrected from "12 files / 99 assertions" to 26 files (all passing; assertion count still to be recomputed, issue #7), and the repo-state commit from `0bf9def` to `8e1ed0d`.

Two things this revision deliberately does **not** do. It does not re-run the three cold-reader loops — the corrections are verification results, not new design, and re-certifying 477 lines was out of scope. And it does not rename the file, though it should be renamed: a dated filename on a document at revision 5.4 is the known failure mode where a writer thinks they are creating when they are continuing (issue #6).

The material discovery behind all four items is that **the production database is empty**. Consolidation today is a code move; after the pilot's first write it becomes a data migration with a cutover window. Plans below that assume preserving existing state are over-built for the actual situation.

---

## 18.1 Rev. 5 changelog (panel resolutions)

Applied from the six-seat panel (architecture, security, design, testing, ops, skeptic; ~180 findings, deduped):

1. All §12 prompts re-pinned to rev. 5 with a self-check (was: rev. 3 — flagged by all six seats).
2. Notification gate corrected to p95 ≤90s enqueue→send with the outbox as instrument (was: <60s, arithmetically impossible under the 1-min drain — 4 seats).
3. "Peak window", board-non-empty, and every §13 metric given precise definitions and domain-table sources (was: uncomputable — 4 seats).
4. "Safety incident" and "Sev-1" defined with detection channels (was: unfalsifiable — 5 seats).
5. Share deep link reconciled with the privacy posture via `get_public_offer_summary` (coarse card, UUID links, rate-limited); public/authenticated read surface stated precisely in §7.1 (was: P2 and P3 contradictory — 3 seats).
6. PII constraint rewritten to its precise form (§12 preamble (3)); free-text fields enumerated with visibility scopes (was: self-contradicted by the schema — 3 seats).
7. State machine: added `CONFIRMED|ARRIVING → CANCELLED` and `PARTIALLY_RESERVED → RELEASED` (2 seats).
8. Assistant tab hidden until the AI gate passes; "AI verification gate" naming fixed; phone-voice channel read-only pending identity binding (2–3 seats).
9. UUID→phone resolved at send time via Auth admin API, never persisted; push payload minimization; SMS resilience test reversed to push-down→SMS-rescues (2 seats each).
10. §11/§12 P4 no-show contradiction resolved (trend, not gate); §11 Phase 4 aligned.
11. `product_events` schema extended (entity_id, anon_id, corridor_pair); gate metrics moved to domain tables (poisoning-proof); wedge attribution mechanism specified (3 seats).
12. Ops readiness added to Phase 2: PITR + restore rehearsal, uptime + cron-liveness monitoring, moderator liveness/kill-switch panel, WordPress cancellation human-gated ≥30 days, legacy Supabase retirement owned by P2 (ops seat HIGHs).
13. Cost model: `docs/costs.md` with named provisional caps; P5 budget gate now references an existing value; SMS-pumping caps + spend alarms (4 seats).
14. North star re-based on CONFIRMED-or-later with the §4.7 behavioral rationale; volume baseline recorded at P0 so pilot targets have a denominator (skeptic HIGH).
15. Identity UX: OTP failure states, login copy corrected for SMS future, deletion coverage (traces, events) + audit anonymization via orphan UUID, moderator grant path, dormant-account interstitial, test-OTP ranges disabled in prod (security seat).
16. Screen-state matrix added (§10): loading/empty/error/offline/denied-push/stale-return per zone (design seat HIGH).
17. Leaderboard → hidden during pilot + §15 Q6; founding cohort 3–5 recruited / ≥3 gated; 43/43 spots; 165/165 redirects; ±10s → sweep-granular; ≥98 → recorded N; "top 100" → all 165; §16 tool count 17; staging defined; evidence-limit caveats added to §2; §5 comparison restored inline (assorted seats).
18. Parked items (not acted on, for the owner): event-triggered outbox drain; k-threshold suppression on public counts; DPA/subprocessor documentation; privacy notice; CAPTCHA alternatives; carrier deactivation-list checks; authless found-item reporting; status page; synthetic end-to-end canary.

**Rev. 5.3 addendum (cold-reader loop 3, final — 6 residuals fixed, NOT re-certified):** loop 3's verdict was "yes, executable tomorrow" with six minor assumptions; all six are fixed in this revision (`lib/legacy/` declared inert until P1; P0's production-target explicitly authorized and recorded; `metrics_weekly` pinned to `security_invoker = true` with NULL corridor_pair for manual rows; the SluglinesAgent gate extended to any secret-bearing file; both WhatsApp groups named). Per the skill's three-loop cap, these fixes have **not** been verified by a fourth cold reader — they are the honest residual of the process, not certified-closed.

**Rev. 5.2 addendum (cold-reader loop 2, 8 remaining assumptions closed):** `metrics_weekly` defined as a plain view with columns and no refresh mechanism; the §11/§12 rotation-at-gate tension resolved in §12's favor with the artifact as a Phase 1 entry criterion; negative-verification edge rules added (red CI, dead deployment, unexpectedly present key); CAPTCHA-provider credential made an optional precondition with an [H]-pending downgrade path; staging = record-choice-only at P0, preview-branch default; volume-baseline template located in DECISIONS.md with a two-week averaged minimum; this document's own landing in `docs/` assigned to P0; port destinations pinned to the canonical repo.

**Rev. 5.1 addendum (cold-reader loop 1, 15 forced assumptions closed):** artifact-location table added to §2 (both repo URLs, SluglinesAgent path); operator-access preconditions added to the §12 preamble; staging environment named at P0, not P3; `product_events` event vocabulary and `corridor_pairs` seed fully enumerated in §8 M10; `manual_metrics` table gives the human-recorded §13 rows a storage location and `metrics_weekly` a precise scope; N redefined as pre-P0 baseline with exit = N + new tests; port destinations split (code → `lib/legacy/`, doc → `docs/legacy/`); "3 CI jobs" named and static-analysis distinguished from lint; `AI/README.md` update assigned to P0 (update, not delete); OTP values applied to auth config in P0 with artifact (per-IP cap → P2 edge middleware, stated); logger rate limiting assigned to P2; lint first-slice allowlist defined against the pre-P1 layout; volume-baseline template disambiguated from the parallel-run pair.

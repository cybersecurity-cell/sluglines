# Sluglines AI — Phased Execution Plan

**Status:** Proposed
**Date:** July 18, 2026
**Companion to:** `2026-07-18-sluglines-ai-final-architecture.md`
**Development skills:** each phase is driven by a Claude Code skill under `.claude/skills/` (see mapping per phase).

Every phase ends with a gate. A phase does not start until the previous gate passes. Each phase ships to the Horner Road pilot community only, behind reversible releases.

## Phase 0 — Security & product foundation (1–2 weeks)

Deliver: threat model, data classification + retention schedule, authorization matrix, prompt-injection analysis, incident-response process, synthetic-fixture policy (chat exports never copied; fixtures derived from patterns only), Phase 1 schema + migrations, state-transition spec, acceptance and abuse test lists.

**Gate:** security review approves data model and auth flow.
**Skill:** `security-gates`

## Phase 1 — Deterministic ride pilot (3–4 weeks)

Deliver: phone OTP onboarding; Horner membership; rider/driver offers with time *windows*; live offer board with deterministic complementary-match query ("2 drivers match your request"); atomic seat reservation (transaction + idempotency key + revision check); withdrawal; `pg_cron` expiry sweep; bilateral confirmation; pickup handshake (vehicle description + arrival pings, visible to confirmed participants only); notification outbox → push; report/block + manual moderation; audit logging.

**Gate:** concurrency test proves no double reservation under parallel accepts; RLS test suite proves no cross-user access; no phone numbers in app tables or telemetry; stale offers expire with all clients offline; two members complete a ride end-to-end without exchanging numbers.
**Skills:** `domain-state-machine`, `security-gates`

## Phase 2 — Complete deterministic coordination (3–4 weeks)

Deliver: recurring offers (the daily-pair pattern); waitlists; ETA updates; no-show handling (confirmation TTL + "still coming / release seat" prompt near pickup; unreleased no-shows logged for moderators); cancellation recovery (auto-notify waitlist); notification dedup; **SMS fallback for confirmation-critical events** (confirm, arriving, cancel); **presence check-ins + live counts**; **community incident reports with TTL and confirmations**; **Lost & Found deterministic lifecycle** (report, corridor+date+category search, in-app claim messaging); operational dashboard.

**Gate:** transitions idempotent under retry/outage tests; audit trail complete; moderators need no direct DB access; presence counts expire correctly; Lost & Found claims expose no contact info.
**Skill:** `domain-state-machine`

## Phase 3 — Advisory AI + web voice (shadow → live, 4 weeks)

Deliver: provider-neutral model router (model classes, not provider names); agent runtime (single agent, tool-use loop) wired to **R0/R1 tools only**; tool gate with schemas, allow-lists, budgets, kill switches; trace logging + replay; skill contracts + eval suites for `ride.parse-intent`, `ride.explain-match`, `transit.explain-alternatives`, `community.classify-post`, `lostfound.match-descriptions` (advisory), `admin.summarize-incident`; **web push-to-talk voice** (streaming STT → agent → TTS) for reads and drafts. AI cannot change ride state in this phase — parsed intents render as pre-filled forms the user submits.

**Gate:** every skill passes schema/accuracy/latency/cost/adversarial thresholds; injection suite (direct + indirect via offer text, lost-item descriptions, incident reports) shows zero unauthorized tool intents; voice read-path P95 ≤ 1.5 s; per-skill and global kill switches demonstrated.
**Skills:** `agent-runtime`, `ai-skill-contract`, `voice-pipeline`, `security-gates`

## Phase 4 — Agentic writes + phone voice (4 weeks)

Deliver: R2 tools enabled through the gate with voice read-back confirmation as the approval event; R3 approval workflow (single-use, expiring, revision-pinned approvals); safety evaluator on R2/R3 proposals; **inbound Twilio Voice channel** (caller-ID → Supabase Auth match; unknown callers read-only); deterministic moderation pipeline; LangGraph adopted **only if** a resumable multi-step investigation workflow is actually needed — otherwise stays on paper.

**Gate:** R3 tools fail closed without exact unexpired approval; misheard-confirmation tests (agent reads back wrong parse → user rejects → no write); voice E2E with real phone; emergency kill switches tested live; shadow-mode comparison shows agent-created offers ≥ parity with form-created on completion rate.
**Skills:** `agent-runtime`, `voice-pipeline`, `security-gates`

## Phase 5 — Multi-location + transit feeds (ongoing)

Deliver: verified locations, local moderator roles, demand notifications, official transit feeds (GTFS-RT/WMATA) merged with community incident reports, privacy-preserving aggregate analytics.

**Gate:** Horner pilot meets adoption/reliability/safety targets first.

## Phase 6 — Advanced intelligence (deferred)

Demand forecasts, wait estimates, AI Lost & Found photo matching, anomaly detection, optional presence estimation, reliability scoring — each behind separate privacy/fairness/appeal reviews.

## Cross-phase rules

1. Chat exports are research inputs only — never fixtures, prompts, or training data.
2. Every schema change ships with RLS tests in the same PR.
3. Prompt/policy/model changes run shadow mode before promotion; every generation records version metadata sufficient to reproduce and roll back.
4. Weekly pilot feedback review; any safety incident freezes the current phase pending postmortem.

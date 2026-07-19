# Sluglines AI Phased System Design

**Status:** Approved design, pending implementation plan  
**Date:** July 18, 2026  
**Scope:** Standalone application under `C:\Users\kalai\Projects\sluglines\AI`

## Purpose

Sluglines AI replaces fragile WhatsApp-based coordination with a private, structured, time-sensitive commuter application. Horner Road is the first pilot, paired initially with L'Enfant/GSA. Users can announce availability, reserve seats, confirm pickup, communicate limited ETA information, and close offers without exposing phone numbers.

The system is not initially an autonomous agent. Ride state, seat allocation, authorization, expiration, cancellation, and notification delivery are deterministic application functions. AI begins as an advisory layer and gains narrowly scoped tools only after quality and safety are demonstrated.

## Product principles

1. Coordination before intelligence.
2. Privacy and data minimization by default.
3. Models propose; code and database transactions decide.
4. Every offer has an explicit, visible state and expiration.
5. Release small, reversible increments to one community first.
6. Keep skills and contracts independent of model providers.
7. Require human approval for destructive, public, or reputation-affecting actions.

## Observed coordination needs

The supplied WhatsApp exports were reviewed only for aggregate patterns. Users repeatedly need to announce rider or driver availability; specify origin, destination, seats, and time; report current counts; ask whether an offer is current; reserve or release seats; communicate delays; identify a pickup point or vehicle after confirmation; schedule later rides; and recover from missed messages.

The source chats must never be imported, used for training, copied into prompts, or retained by the application. Derived test cases must be synthetic and contain no attributable personal information.

## Initial scope

Phase 1 includes phone-only SMS OTP authentication, a minimal profile, Horner Road membership, rider and driver offers, origin/destination/time/seats, a live active-offer board, atomic reservations, withdrawal, automatic expiration, bilateral confirmation, limited notifications, report/block controls, manual moderation, and audit logging.

Initially excluded are WhatsApp synchronization, passive GPS, inferred presence, autonomous moderation, automatic penalties, public user directories, phone-number sharing, forecasts, and general autonomous agents.

## Architecture

Start as a TypeScript modular monolith on Vercel with Supabase Auth and Postgres. Reserve a Python FastAPI/LangGraph service for a later phase; do not deploy it until a dynamic, resumable workflow is justified.

```text
AI/
├── apps/web/                    # Next.js App Router application
├── services/orchestrator/       # Future FastAPI + LangGraph service
├── packages/
│   ├── domain/                  # Offer states and business rules
│   ├── contracts/               # Zod and JSON Schema contracts
│   ├── auth/                    # Session and authorization boundary
│   ├── policy/                  # Tool and approval policies
│   ├── ai/                      # Provider-neutral model router
│   ├── observability/           # OpenTelemetry conventions
│   └── security/                # Shared security controls
├── skills/                      # Versioned AI capability contracts
├── prompts/                     # Versioned prompt registry
├── evals/                       # Regression and adversarial suites
├── supabase/                    # Migrations, functions, synthetic seeds
├── security/                    # Threat and operational policies
├── docs/                        # Architecture and decisions
└── tests/                       # Unit, integration, security, E2E
```

Next.js owns the user experience and authenticated APIs. Supabase Auth owns phone identity and sessions. Postgres is authoritative for offers, reservations, approvals, policies, and audit events. Realtime only reports committed changes. A notification worker delivers idempotent updates. Feature code calls a provider-neutral model router. LangGraph is limited to later ambiguous investigations and human-interrupt workflows.

## Phone-only identity

Users enter a phone number and verify a six-digit SMS OTP. A refresh session provides low-friction continuing use. Reverification is required after logout, session loss, phone change, suspicious activity, or a sensitive account action.

- Normalize phone numbers to E.164 at the authentication boundary.
- Configure CAPTCHA, resend cooldowns, attempt limits, and IP/device/number rate limits.
- Return generic errors that do not reveal account existence.
- Keep phone numbers in Supabase Auth only.
- Use opaque auth UUIDs in application tables.
- Prohibit phone numbers in analytics, traces, prompts, and model inputs.
- Support session listing, revocation, and account deletion.

## Deterministic coordination

```text
DRAFT -> OPEN -> PARTIALLY_RESERVED -> RESERVED -> CONFIRMED
CONFIRMED -> ARRIVING -> PICKED_UP -> COMPLETED
OPEN | PARTIALLY_RESERVED | RESERVED -> CANCELLED
OPEN | PARTIALLY_RESERVED -> EXPIRED
RESERVED -> RELEASED -> OPEN
```

Every transition is validated server-side. Seat reservation is a Postgres transaction with an idempotency key. The server expires stale offers even when clients disconnect.

Members may see role, route, approximate time, remaining seats, and state. Only confirmed participants may see pickup instructions and a limited vehicle description. Phone numbers, exact home/work addresses, full location history, and unrelated activity are never exposed.

## Delivery phases

### Phase 0: security and product foundation

Produce the threat model, data classification and retention schedule, authorization matrix, prompt-injection analysis, incident-response process, synthetic-fixture policy, Phase 1 schema, state-transition specification, and acceptance/abuse tests.

**Gate:** security review approves the data model and authentication flow.

### Phase 1: private Horner Road pilot

Deliver phone onboarding, member-only offers, reservations, expiration, confirmation, notifications, and manual moderation.

**Gate:** concurrency tests prevent double reservation; RLS prevents cross-user access; phone numbers are absent from application storage and telemetry; stale offers expire server-side; participants coordinate without exchanging phone numbers.

### Phase 2: complete deterministic coordination

Add recurring offers, waitlists, ETA updates, cancellation recovery, notification deduplication, transit fallback, and operational dashboards.

**Gate:** transitions are idempotent; outage/retry tests pass; audit trails are complete; moderators need no direct database access.

### Phase 3: advisory AI in shadow mode

Introduce provider-neutral skills for intent extraction, destination normalization, spam classification, incident summaries, notification drafts, and transit explanations. AI cannot change ride state.

**Gate:** every skill meets schema, accuracy, latency, cost, and adversarial thresholds; corrections and overrides are measured; fallback model pairs are independently evaluated.

### Phase 4: controlled community operations

Add deterministic moderation pipelines and use LangGraph only for ambiguous, resumable investigations. High-impact tools remain approval-gated.

**Gate:** destructive tools require an exact, unexpired approval; emergency tool and AI kill switches are tested.

### Phase 5: multi-location rollout

Add verified locations, local moderators, demand notifications, and privacy-preserving aggregate analytics only after the Horner pilot meets adoption, reliability, and safety targets.

### Phase 6: advanced intelligence

Evaluate demand forecasts, wait estimates, lost-and-found matching, anomaly detection, and optional presence estimation. Reliability scoring and passive sensing require separate privacy, fairness, and appeal reviews.

## AI skills and routing

Every skill declares its purpose, prohibited use, schemas, permitted/prohibited tools, model class, allowed fallbacks, context policy, risk level, approval policy, budgets, evaluation suite, and deterministic fallback.

Initial advisory skills are `ride.parse-intent`, `ride.explain-match`, `transit.explain-alternatives`, `community.classify-post`, `community.draft-response`, and `admin.summarize-incident`. Broad skills such as `manage-community` and `coordinate-ride` are prohibited.

Feature code requests a model class—filter, standard, reasoning, vision, or embedding—not a provider model name. Routing considers skill version, risk, latency, quality, cost, residency, and provider health. A provider fallback is allowed only after that pair passes the skill evaluation suite.

## Tools and approvals

Tools are categorized as `read.*`, `recommend.*`, `draft.*`, `write.*`, `publish.*`, `restrict.*`, or `delete.*`. Every tool uses a strict Zod or Pydantic schema. Implementations independently verify authentication, authorization, resource revision, legal transition, approval, idempotency, and rate limits.

- **R0 read-only:** automatic.
- **R1 advisory:** automatic and logged.
- **R2 reversible write:** deterministic validation and sampled review.
- **R3 high impact:** explicit human approval and execution-time revalidation.

R3 includes deleting content, blocking users, changing reputation data, publishing platform announcements, or modifying active rides through an AI-proposed action. Approval authorizes exactly one operation against one resource revision and expires after a short period.

## State and memory

- Domain state belongs in authoritative Postgres tables.
- Workflow state belongs in explicit workflow/checkpoint records.
- Conversation state is stored separately and remains user-controlled.
- Long-term knowledge consists of curated, versioned documents with sources and visibility.
- Vector indexes are retrieval aids, never authoritative memory.

Only the smallest relevant context slice is sent to a model. LangGraph checkpoints may support resume and debugging but do not replace domain state.

## Prompt-injection protection

All user messages, posts, files, retrieved documents, and external pages are untrusted data.

- Never concatenate untrusted content into system instructions.
- Separate instructions from data fields.
- Give content-reading models no write tools.
- Validate every model output against a strict schema.
- Screen proposed actions against original user intent.
- Reauthorize and revalidate every tool call in deterministic code.
- Sanitize generated Markdown, HTML, and URLs.
- Prevent arbitrary outbound network access.
- Require approval for R3 operations.
- Maintain direct and indirect injection test suites.
- Provide per-skill and global AI kill switches.

Model-based guardrails supplement these controls but cannot replace them.

## Privacy and security requirements

- Default-deny RLS on every user-accessible table.
- Server-only service-role credentials.
- Administrator privileges stored in a protected authorization table.
- Minimal collection and explicit retention periods.
- No precise GPS in the MVP.
- Immutable sensitive-action audit events.
- Tested deletion, session revocation, backup restoration, and incident escalation.
- Dependency, static-analysis, and secret scans in CI.
- No AI in authoritative coordination paths during the pilot.

## Observability

Use OpenTelemetry across TypeScript and Python. Propagate trace, workflow, skill, prompt, policy, model route, tool call, and approval identifiers. Sensitive evidence is separately controlled and referenced by ID. Phone numbers, OTPs, tokens, raw GPS, and private messages are prohibited in telemetry.

Monitor workflow success, abandonment, expiration, reservation conflicts, notification delay/duplication, model cost/latency/schema failures, provider fallback, tool rejection, unauthorized attempts, approval wait time, reviewer overrides, prompt-injection detection, and authorization denials. High-cardinality IDs belong in traces/logs, not metric labels.

## Evaluation and release policy

Each skill has versioned normal, ambiguous, missing-context, adversarial, injection, policy-conflict, and fallback cases. Measure task accuracy, schema validity, false approval/rejection, escalation recall, tool selection, unsupported claims, cost, latency, and reviewer overrides.

Prompt, policy, model, and provider changes run in shadow mode before promotion. Every production generation records enough version metadata to reproduce its configuration and roll it back.

## Implementation boundary

The first implementation plan covers Phase 0 and Phase 1 only. It must not add LangGraph, a Python service, reliability scoring, passive sensing, or autonomous moderation. It must specify migrations, RLS tests, API contracts, state-transition tests, OTP abuse controls, observability fields, privacy verification, and pilot rollback procedures.

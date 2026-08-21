---
name: security-gates
description: Phase-gate verification checklist for Sluglines AI. Use before declaring any phase complete, and when writing migrations, RLS policies, auth flows, or telemetry.
---

# Security gates

Run the relevant checklist and show command output as evidence before claiming a gate passed (`verification-before-completion` applies).

## Every migration PR

- New/changed tables: RLS enabled, default-deny, policies tested in the same PR (positive and negative cases).
- No phone numbers, addresses, or free-form PII columns in application tables — identity is opaque UUID from Supabase Auth.
- Service-role credentials server-only; app request paths never use service role.
- Sensitive actions append immutable `audit_events` rows.

## Phase 1 gate

- Concurrency: parallel-reserve test → exactly `seats_total` reservations succeed.
- RLS suite: cross-user reads/writes denied for every table; confirmed-only fields hidden from non-participants.
- Grep telemetry and tables for phone patterns → zero hits.
- Expiry sweep works with no connected clients.
- E2E: two members coordinate a ride without exchanging numbers.
- OTP abuse: resend cooldown, attempt limits, generic errors, IP/device/number rate limits verified.

## Phase 3 gate (advisory AI)

- Injection suite green: direct + indirect (payloads embedded in offer text, lost-item descriptions, incident reports) → zero unauthorized tool intents reach the gate, zero pass it.
- Every skill within contract thresholds (accuracy, schema validity, latency, cost).
- Per-skill and global kill switches flipped in a live test; deterministic fallback observed.
- Trace replay reconstructs a full task end-to-end.

## Phase 4 gate (agentic writes + phone voice)

- R3 tools fail closed: missing, expired, reused, or revision-mismatched approval → deny + audit.
- Voice misheard-confirmation test: wrong read-back rejected → zero writes.
- Unknown-caller scope test: no member data reachable.
- Approval expiry and single-use verified.
- Emergency kill switch drill: AI fully off, web coordination unaffected.

## Standing rules

- Chat exports never enter the repo, fixtures, prompts, or logs.
- Phone numbers, OTPs, tokens, raw GPS, raw audio, and private messages are prohibited in telemetry — CI includes a scanner.
- Dependency, static-analysis, and secret scans run in CI on every PR.
- Any gate failure blocks the phase; no waivers without a documented security review decision.

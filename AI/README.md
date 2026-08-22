# Sluglines AI

Sluglines AI is a standalone application program for structured commuter coordination. It is intentionally isolated from the existing Sluglines content website and its implementation phases.

The initial product replaces recurring WhatsApp coordination patterns with private, time-bounded rider and driver offers. AI capabilities are introduced only after the deterministic coordination system is operating reliably.

## Current status

> **Corrected 2026-08-14.** This section previously read "Application implementation: not started",
> which was false. See `Docs/DECISIONS.md` (D-17) and `Docs/consolidated-architecture.md`
> (rev. 5.3, §14 risk 5).

- Architecture and phased rollout: superseded as the governing plan — see
  `Docs/consolidated-architecture.md` (rev. 5.3), which is now the authoritative
  architecture for all Sluglines effort. The specs in `docs/specs/` remain valid as inputs and
  are still referenced by rev. 5.3's deferred list.
- Application implementation: **substantially built**, in the separate `Sluglines-AI` repo
  (`github.com/cybersecurity-cell/Sluglines-AI`) — phone-OTP identity, offer/reservation state
  machine, presence check-ins, lost & found, incidents, moderation, notifications, and an advisory
  AI layer behind a deterministic tool gate. Dormant since 2026-07-29 and not reachable from
  `sluglines.com`. Its AI layer has never been run against a live model.
- Canonical repo: **`sluglines`** (this repo), per `Docs/DECISIONS.md` D-2. Whether
  `Sluglines-AI`'s application core is transplanted here is still open — `Docs/DECISIONS.md` D-13.
- Pilot location: Horner Road, with L'Enfant/GSA as the initial paired destination
- Identity: phone-only authentication using SMS OTP
- Source chat exports: research inputs only; never production or training data

## Documentation

- [Final architecture v2](docs/specs/2026-07-18-sluglines-ai-final-architecture.md) — current authoritative design
- [Execution plan](docs/specs/2026-07-18-execution-plan.md) — phases, gates, and skill mapping
- [Phased system design](docs/specs/2026-07-18-sluglines-ai-phased-design.md) — extended by the final architecture

Development skills live in `.claude/skills/` (domain-state-machine, agent-runtime, voice-pipeline, ai-skill-contract, security-gates).

## Isolation rule

Work within this directory must not modify or reinterpret the existing Sluglines application unless an integration is explicitly approved. Shared infrastructure must be introduced through a documented interface and architecture decision.

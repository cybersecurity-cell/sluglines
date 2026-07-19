# Sluglines AI

Sluglines AI is a standalone application program for structured commuter coordination. It is intentionally isolated from the existing Sluglines content website and its implementation phases.

The initial product replaces recurring WhatsApp coordination patterns with private, time-bounded rider and driver offers. AI capabilities are introduced only after the deterministic coordination system is operating reliably.

## Current status

- Architecture and phased rollout: approved for documentation
- Application implementation: not started
- Pilot location: Horner Road, with L'Enfant/GSA as the initial paired destination
- Identity: phone-only authentication using SMS OTP
- Source chat exports: research inputs only; never production or training data

## Documentation

- [Phased system design](docs/specs/2026-07-18-sluglines-ai-phased-design.md)

## Isolation rule

Work within this directory must not modify or reinterpret the existing Sluglines application unless an integration is explicitly approved. Shared infrastructure must be introduced through a documented interface and architecture decision.

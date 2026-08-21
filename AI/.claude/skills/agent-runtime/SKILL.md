---
name: agent-runtime
description: Rules for building the single-agent runtime, tool gate, and agent tools. Use when implementing anything the AI agent can see, say, or call.
---

# Agent runtime rules

Authoritative spec: `docs/specs/2026-07-18-sluglines-ai-final-architecture.md` §4–§6.

## Topology

One tool-calling agent (Claude tool-use loop). No planner/executor split, no sub-agents. All tool intents pass through the **Tool Gate** — deterministic TypeScript, no model involvement.

## Tool Gate checklist (every tool, no exceptions)

1. Zod schema parse — reject on any failure, no coercion of free text.
2. Per-tool allow-list: is this tool enabled for this channel, user role, and phase?
3. Independent authN/authZ re-check (never trust the agent's claim of who the user is — identity comes from the session envelope).
4. Resource `revision` check for writes.
5. Legal-transition check via `packages/domain` (the gate calls domain services; it never writes SQL).
6. Risk tier enforcement: R0 auto · R1 auto+logged · R2 requires user confirmation event (form submit or voice read-back) · R3 requires exact, unexpired, single-use approval pinned to a resource revision.
7. Idempotency key, rate limit, per-task step/cost/timeout budgets.
8. Kill switches: per-skill and global flags checked on every call.

## Prompt-injection defense (structural, not string matching)

- All user messages, offer text, item descriptions, and incident reports enter prompts as **tagged data fields**, never concatenated into instructions.
- Skills that read community content get **zero write tools**.
- Every model output is schema-validated; screened against the original user intent before the gate executes anything.
- Do NOT add "ignore previous instructions" blocklists as a primary control — they are decoration; the gate is the control.

## Memory

- Ephemeral task memory: per conversation, TTL-cleared, never promoted automatically.
- Long-term memory: only via `memory.save` tool (R2) with validation; eligible facts are stable and non-sensitive (usual corridor, usual windows, vehicle description). Phone numbers, addresses, location history are never memory-eligible.
- Vector indexes are retrieval aids, never authoritative.

## Tracing

Every turn logs: sanitized prompt, model output, tool intents, gate decisions (allow/deny + reason), tool results, correlation IDs (trace, session, skill, prompt version, model route). Must be replayable. No phone numbers, OTPs, tokens, or raw audio in traces.

## Definition of done for a new tool

Schema + gate registration + tier assignment + rate limit + idempotency + trace fields + adversarial eval cases (direct and indirect injection attempting this tool) + kill-switch coverage.

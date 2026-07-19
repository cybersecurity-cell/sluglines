# Sluglines AI — Final Architecture (v2)

**Status:** Proposed final architecture
**Date:** July 18, 2026
**Supersedes:** `Sluglines AI System Design Document.docx` (v1.0 blueprint) and extends `2026-07-18-sluglines-ai-phased-design.md`
**Inputs considered:** WhatsApp chat exports (patterns only), `Docs/Architecture.txt`, `Docs/Design pattern overview.txt`, Facebook-group usage for Lost & Found and traffic reports

## 1. Product scope

Four coordination domains, replacing WhatsApp groups and Facebook groups:

1. **Ride coordination** — rider/driver offers, atomic seat reservation, bilateral confirmation, pickup handshake, recurring rides.
2. **Presence** — self-reported one-tap check-ins per slug line ("3 waiting at Horner"), aggregate counts only. No passive sensing, no ML presence model.
3. **Lost & Found** — item lifecycle: reported → matched → claimed → reunited/expired. Matching is deterministic on route + date + item category first; AI text/photo matching is a later advisory skill.
4. **Traffic & incidents** — community-reported disruptions per corridor (HOV closure, accident, weather) with TTL, plus transit-fallback suggestions when a corridor is degraded.

The **uncoordinated peak-hour commuter** is served by the presence board and demand view: they see live counts and open offers without posting, lowering the barrier to first participation.

## 2. Core principle (unchanged)

**Models propose; code and database transactions decide.** All ride state, seat allocation, item claims, and incident lifecycle are deterministic Postgres transactions. The agentic AI layer — including voice — is an *interface* to those transactions, never an authority over them.

## 3. System architecture

```text
 Channels
 ┌───────────────┐ ┌────────────────┐ ┌───────────────────┐
 │ Next.js web/  │ │ Voice: web PTT │ │ Phone call (Twilio│
 │ PWA (primary) │ │ (browser mic)  │ │ Voice, hands-free)│
 └───────┬───────┘ └───────┬────────┘ └────────┬──────────┘
         │                 │  STT (streaming)  │
         │                 ▼                   ▼
         │        ┌─────────────────────────────────┐
         │        │ Agent Runtime (single agent)    │
         │        │ Claude tool-use loop            │
         │        │ - intent envelope (user, sess,  │
         │        │   channel, risk)                │
         │        │ - untrusted content tagged data │
         │        └───────────┬─────────────────────┘
         │                    │ typed tool intents (Zod)
         ▼                    ▼
 ┌─────────────────────────────────────────────────┐
 │ Tool Gate (deterministic, code only)            │
 │ - schema validation, per-tool allow-list        │
 │ - authZ re-check, resource revision check       │
 │ - risk tiers R0-R3, R3 => human approval        │
 │ - idempotency keys, rate limits, kill switches  │
 │ - max steps / cost / timeout per task           │
 └───────────────────────┬─────────────────────────┘
                         ▼
 ┌─────────────────────────────────────────────────┐
 │ Domain Services (packages/domain)               │
 │ offers · reservations · presence · lostfound    │
 │ incidents · memberships · moderation            │
 └───────────────────────┬─────────────────────────┘
                         ▼
 ┌─────────────────────────────────────────────────┐
 │ Postgres (Supabase) — authoritative, RLS deny   │
 │ + notification_outbox, audit_events, approvals  │
 │ + pg_cron: expiry sweeps, outbox drain          │
 └──────┬──────────────────────────┬───────────────┘
        │ Realtime (committed)     │ outbox
        ▼                          ▼
   live boards              Notification worker
   (offers, presence,       push · SMS fallback · TTS callback
    incidents)
```

Supabase Auth (phone + SMS OTP) is the only store of phone numbers; application tables use opaque UUIDs. Identical to the approved phased design.

## 4. Agentic AI design — adopted vs rejected from the blueprint docs

**Adopted:**
- **Guarded Orchestrator → Tool Gate.** Agents never call tools directly; they emit typed intents that deterministic code validates and executes. This is the load-bearing safety pattern.
- **Policy gate / risk tiers.** R0 read, R1 advisory, R2 reversible write (sampled review), R3 high-impact (human approval, single-use, expiring, revision-pinned).
- **Tiered memory.** Ephemeral task memory (per conversation, TTL-cleared); long-term user memory limited to stable non-sensitive facts (usual corridor, usual windows, vehicle description) written only via a validated `memory.save` tool; read-only knowledge base (corridor stops, community rules, transit info). Phone numbers, addresses, and location history are never memory-eligible.
- **Trace logging + replay.** Every agent turn logs sanitized prompt, model output, tool intents, gate decisions, and results under correlation IDs. Replayable for incident analysis and regression.
- **Safety evaluator** only for R2/R3 proposals and outbound user-visible drafts — rules first, model-graded second.

**Rejected (with reasons):**
- **Multi-agent Coordinator/Planner/Executor.** The domain has ~15 tools. A single agent + tool gate provides the same guarantee (validated intents only) with far less latency, cost, and eval surface. Revisit only if tool count or workflow depth demands decomposition.
- **String-matching injection filters** ("ignore previous instructions" blocklists). Trivially bypassed. Injection defense stays structural: untrusted content in data fields, no write tools for content-reading skills, schema-validated outputs, gate-side reauthorization, intent-screening against original user request.
- **Separate PII classifier pipeline.** Data minimization at the source is stronger: the system simply never stores or transmits PII outside Supabase Auth, so there is little to classify. A redaction check on telemetry and model inputs remains as a tripwire, not a primary control.

## 5. Voice architecture

Voice matters most for **drivers (hands-free)** and is the primary agentic surface.

- **Web push-to-talk (Phase 3):** browser mic → streaming STT → agent → TTS reply. Ships inside the PWA; no new identity surface.
- **Inbound phone call (Phase 4):** Twilio Voice → streaming STT ↔ agent ↔ TTS. Caller identity = verified phone number matched to Supabase Auth; unknown numbers get a read-only experience (presence counts, open-offer summary) and are invited to register.
- **Conversation contract:** the agent always *reads back* a structured summary before any R2 write ("Offering 3 seats, Horner to L'Enfant, 4:15 to 4:30 today — confirm?"). Verbal confirmation is captured as the approval event for that single intent. Ambiguity (destination, time window) triggers a clarifying question, never a guess.
- **Latency budget:** ≤ 1.5 s speech-end → first audio for reads; ≤ 3 s for confirmed writes. STT/TTS providers behind the model router; no provider names in feature code.
- Voice sessions produce transcripts stored as conversation state (user-controlled, deletable); raw audio is not retained beyond transcription.

Example turns the agent must handle (derived from observed chat patterns, synthetic fixtures only): "I've got two seats to L'Enfant leaving at 4:15" → `ride.create_offer`; "anyone at Horner right now?" → `presence.get_counts`; "I'm running ten minutes late" → `ride.update_eta`; "I left a black umbrella in a gray Odyssey Tuesday afternoon" → `lostfound.report_item`; "is the HOV backed up?" → `incidents.get_active` + `transit.explain_alternatives`.

## 6. Tool catalog (initial)

| Tool | Tier | Notes |
|---|---|---|
| `presence.get_counts`, `ride.list_offers`, `ride.get_offer`, `incidents.get_active`, `lostfound.search` | R0 | automatic |
| `ride.explain_match`, `transit.explain_alternatives`, `community.draft_response` | R1 | advisory, logged |
| `ride.create_offer`, `ride.reserve_seat`, `ride.release_seat`, `ride.update_eta`, `ride.confirm_pickup`, `presence.check_in`, `lostfound.report_item`, `incidents.report` | R2 | reversible; voice read-back confirmation; idempotent |
| `ride.cancel_confirmed`, `lostfound.confirm_reunite`, `moderation.restrict_user`, `announce.publish` | R3 | explicit approval, single-use, revision-pinned |

Every tool: Zod schema, independent authN/authZ, legal-transition check, idempotency key, rate limit. Broad tools (`coordinate-ride`, `manage-community`) remain prohibited.

## 7. Data model additions (over the approved design)

- `presence_checkins (id, member_id, location_id, direction, party_size, created_at, expires_at)` — counts are `SUM(party_size)` over unexpired rows; auto-expire ~20 min.
- `lostfound_items (id, reporter_id, kind found|lost, category, description, corridor_id, ride_date, state, photo_ref, expires_at, revision)` with `lostfound_matches` and claim messaging that never exposes phone numbers.
- `incidents (id, reporter_id, corridor_id, type, description, state, confirmations_count, created_at, expires_at)` — community-confirmed; N confirmations promote visibility; TTL by type.
- `agent_sessions`, `agent_traces`, `approvals` — per §4 memory/trace/approval design.

All under default-deny RLS; moderation via authorization table, not service role in app paths.

## 8. Non-functional targets

Pilot scale: one lot, ≤ 500 members, ≤ 200 offers/day, ≤ 3k agent turns/day — one Postgres handles this with large headroom. Availability target 99.5% during commute windows (5–10 am, 3–7 pm ET); degrade gracefully: if the agent or a model provider is down, the deterministic web UI is fully sufficient (AI kill switch is a routine control, not an emergency). Cost guardrail: per-turn model budget enforced by the gate; monthly cap alarms.

## 9. Trade-offs

- **Single agent vs multi-agent:** chosen for latency/cost/eval simplicity; the tool gate makes the safety argument independent of agent topology. Revisit at >30 tools or resumable multi-step workflows (then LangGraph, per the phased design's Phase 4 reservation).
- **Self-reported presence vs ML detection:** chosen for privacy and zero training pipeline; revisit only with community consent and a separate privacy review (Phase 6).
- **Voice read-back confirmation vs frictionless voice writes:** deliberate friction; a misheard cancellation strands a rider. Confirmation is skippable only for R0 reads.
- **Community incident reports vs transit-authority feeds:** community first (matches Facebook-group behavior, zero integration cost); official GTFS-RT/WMATA feeds are additive in Phase 5.

## 10. What would change this design

A second metro area (service extraction along domain lines), regulatory requirements on carpooling apps, sustained >10x pilot scale, or agent workflows requiring durable interrupts (adopt the reserved LangGraph service).

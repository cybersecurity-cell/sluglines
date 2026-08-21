---
name: voice-pipeline
description: Rules for building the voice channels (web push-to-talk, Twilio phone). Use when implementing STT, TTS, voice sessions, or voice confirmation flows.
---

# Voice pipeline rules

Authoritative spec: `docs/specs/2026-07-18-sluglines-ai-final-architecture.md` §5.

## Channels

- **Phase 3:** web push-to-talk in the PWA. Browser mic → streaming STT → agent → TTS. Reads and drafts only.
- **Phase 4:** inbound Twilio Voice. Caller ID → E.164 normalize → Supabase Auth lookup. Unknown numbers: read-only experience (presence counts, open-offer summary) + registration invite. Never create accounts from a call.

## Confirmation contract (non-negotiable)

Before ANY R2 write initiated by voice, the agent reads back a structured summary of the exact parsed intent ("Offering 3 seats, Horner to L'Enfant, 4:15 to 4:30 today — confirm?"). The user's affirmative is recorded as the confirmation event for that single intent, pinned to those parameters. Changed parameters → new read-back. R0 reads skip confirmation. R3 never executes by voice alone.

Ambiguity (destination alias, time window, party size) → clarifying question. The agent never guesses and never defaults silently.

## Latency budgets

- Speech-end → first audio: P95 ≤ 1.5 s (reads), ≤ 3 s (confirmed writes).
- Use streaming STT and streaming TTS; start TTS on first sentence.

## Provider neutrality

STT/TTS behind the model router as model classes (`stt`, `tts`). No provider SDK imports in feature code. Fallback pairs must pass the voice eval suite before enabling.

## Privacy

- Raw audio is not retained after transcription.
- Transcripts are conversation state: user-visible, user-deletable, excluded from telemetry.
- No phone numbers in transcripts, traces, or prompts (caller identity travels as opaque UUID in the envelope).

## Required tests

- Misheard-parse test: read-back wrong → user says no → zero writes, trace shows rejection.
- Barge-in and silence-timeout handling.
- Unknown-caller scope test: no member data reachable.
- Degradation: STT provider down → graceful message directing to app; deterministic web UI unaffected.

---
name: domain-state-machine
description: Rules for implementing or modifying any Sluglines domain state (offers, reservations, presence, lost & found, incidents). Use whenever writing code that creates, transitions, or expires domain records.
---

# Domain state machine rules

Authoritative spec: `docs/specs/2026-07-18-sluglines-ai-final-architecture.md` §7 and the phased design's transition diagram.

## Offer lifecycle

```text
DRAFT -> OPEN -> PARTIALLY_RESERVED -> RESERVED -> CONFIRMED
CONFIRMED -> ARRIVING -> PICKED_UP -> COMPLETED
OPEN | PARTIALLY_RESERVED | RESERVED -> CANCELLED
OPEN | PARTIALLY_RESERVED -> EXPIRED
RESERVED -> RELEASED -> OPEN
```

## Invariants (never violate)

1. **Every transition is a server-side Postgres transaction.** Client state is a cache, never authority.
2. **Seat reservation** = single transaction: `SELECT ... FOR UPDATE` on the offer row, seat-count check, insert reservation, bump `revision`. Requires an idempotency key; replaying the key returns the original result.
3. **Optimistic concurrency everywhere:** writes carry the expected `revision`; mismatch → 409, client refetches. Never last-write-wins.
4. PARTIALLY_RESERVED / RESERVED are **derived** from reservation counts vs `seats_total` — verify derivation matches stored state in tests; prefer computing over storing where practical.
5. **Expiry is server-driven** (`pg_cron` sweep) and must work with zero connected clients.
6. Time is stored UTC; offers use `window_start`/`window_end` (windows, not points). Matching = same corridor, opposite role, overlapping window.
7. **Visibility:** members see role/route/approximate time/seats/state. Vehicle description and pickup instructions are visible **only** to confirmed participants. Phone numbers appear nowhere in application tables.
8. Lost & Found and incidents follow the same pattern: explicit states, TTL expiry via sweep, revision column, RLS default-deny.

## Required tests for any state change PR

- Legal-transition matrix test (every illegal transition rejected).
- Concurrency test: N parallel reserves against M seats → exactly M succeed.
- Idempotency replay test.
- Expiry-with-no-clients test.
- RLS test: non-participant cannot read confirmed-only fields.

## TDD

Write transition tests from the spec before implementation (`test-driven-development` skill applies). Fixtures must be synthetic — never derived verbatim from chat exports.

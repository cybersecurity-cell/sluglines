# Cost caps — Sluglines

**Status:** PROVISIONAL. Every number here is a starting value taken from rev. 5.3 §11 Phase 0,
not a measured or negotiated budget. They exist so that later phases reference an existing
value instead of inventing one at the moment a gate is evaluated.

**Source:** `Docs/consolidated-architecture.md` (rev. 5.3), §11 Phase 0 and §13.
**Recorded:** 2026-08-14, during the P0-adapted slice.
**Repo:** `sluglines` (canonical per the override recorded in `Docs/DECISIONS.md`).

---

## Caps

| # | Cap | Value | Kind | Referenced by |
|---|---|---|---|---|
| C1 | Model spend per assistant turn | **≤ $0.10 / turn** | Alarm threshold | rev. 5.3 §11 Phase 5 — the AI verification gate checks per-turn cost against this file |
| C2 | Model spend per month | **≤ $50 / month** | Alarm threshold | rev. 5.3 §13 "Spend"; surfaced as an alarm row on the moderator dashboard |
| C3 | SMS sends per day | **500 sends / day** | Alarm threshold | rev. 5.3 §8 M2 / §13; bounds SMS-pumping abuse (risk 11) |
| C4 | Model spend per assistant turn, hard stop | **≤ $0.15 / turn** | **Hard cap (enforced)** | issue #56; `src/lib/ai/cost.ts` `PER_TURN_COST_CEILING_USD`, checked mid-loop by `src/lib/ai/agent.ts` |
| C5 | Assistant turns per member per day | **40 turns/member/day** | **Hard cap (enforced)** | issue #56; `0011`'s `ai_member_turn_count_today()`, checked before any model call |
| C6 | Assistant turns, globally, per day | **2,000 turns/day** | **Hard cap (enforced)** | issue #56; `0011`'s `ai_global_turn_count_today()`, checked before any model call |

### Notes on each

- **C1 (≤$0.10/turn)** was recorded as a *gate* by the original P0 slice, before the AI runtime
  existed to enforce anything. It is corrected here to what it has always actually been able to be
  without an instrument: an **alarm** — rev. 5.3 §11 Phase 5's "per-turn cost within the cost-sheet
  cap" check is a human-reviewed pass/fail, not something the running agent stops itself against.
  **C4 is the number the runtime actually enforces**, and it is deliberately set *above* C1: a turn
  is allowed to approach the C1 alarm threshold without being cut off mid-sentence, and is only
  forcibly stopped if it keeps spending well past it. Reconciling the two as one number would have
  meant either lowering the hard stop to $0.10 (cutting off ordinary turns that legitimately near the
  alarm) or raising the alarm to $0.15 (making it fire only exactly when the hard stop also does,
  which defeats the point of having a review threshold below the stop threshold). Docs/DECISIONS.md
  D-65 records this choice.
- **C2 (≤$50/month)** is an *alarm*: it triggers review, not an automatic shutdown. rev. 5.3 §11's
  deferred list additionally uses it as a trigger — passkeys are revisited if SMS spend exceeds this
  cost-sheet alarm **two months running**.
- **C3 (500 sends/day)** pairs with the §8 M2 OTP abuse controls (resend cooldown, verify-attempt
  caps, per-IP daily send cap, CAPTCHA). The caps bound the abuse; this alarm detects when the
  bound is being tested.
- **C4/C5/C6** are new pilot defaults recorded by issue #56 (Docs/DECISIONS.md D-65), the first caps
  in this table with an actual instrument behind them (see "Measurement" below). The two volume caps
  (C5, C6) are read from `agent_traces` via two SECURITY DEFINER functions in `0011`, checked before
  any model call — a turn that would exceed either is refused deterministically, with no model spend
  and its own trace row, rather than allowed through and only reported on after the fact. C4 is
  checked mid-loop, between model calls, against actual token usage; a turn already over the ceiling
  does not get to make another model call, though the single call that crossed it is allowed to
  finish (there is no way to cancel a response already in flight). None of the three numbers is
  claimed to be empirically tuned — the pilot has no invoiced spend or usage history yet (see
  "Measurement" below) — they are conservative starting points chosen so a single runaway turn or a
  single member's malfunctioning client cannot meaningfully affect the $50/month C2 alarm, and are
  expected to move once real usage exists.

---

## Measurement — not yet wired

| Cap | Intended instrument (rev. 5.3) | Status in `sluglines` today |
|---|---|---|
| C1 | Per-turn cost recorded by the agent runtime / `agent_traces` | **RECORDED, not gated** — `agent_traces.estimated_cost_usd` (`0011`) is populated by every turn; nothing reviews it against C1 automatically yet, which is the human half of "alarm" |
| C2 | `manual_metrics.model_cost_cents`, recorded weekly from the provider invoice | **PENDING** — `manual_metrics` table not created (deferred, see `Docs/DECISIONS.md` D-11) |
| C3 | `manual_metrics.sms_sends`, recorded weekly from the provider dashboard | **PENDING** — no SMS provider integrated; SMS is Phase 5 |
| C4 | Per-turn cost, enforced mid-loop | **ENFORCED** — `src/lib/ai/agent.ts`, from `response.usage` against `src/lib/ai/cost.ts`'s rate table |
| C5 | Per-member daily turn count | **ENFORCED** — `0011`'s `ai_member_turn_count_today()` |
| C6 | Global daily turn count | **ENFORCED** — `0011`'s `ai_global_turn_count_today()` |

C1/C2/C3 remain recorded-not-enforced as this file originally stated. C4/C5/C6 are the first caps in
this table with a live instrument, added by issue #56 (Docs/DECISIONS.md D-65) — stated here rather
than implied, so "written down" and "enforced" stay distinguishable per cap rather than as one
repo-wide claim.

`src/lib/ai/cost.ts`'s per-token USD rates are a **placeholder estimate**, not a billed rate — this
pilot has no provider invoice to reconcile against yet (C2 is still PENDING for the same reason). The
rate is deliberately set high rather than measured, so C4 trips before a real overspend rather than
after one; see that file's own comment for the replacement instruction once an invoice exists.

---

## Changing these numbers

These are provisional and expected to change once real usage data exists. When a value changes:

1. Update the table above **and** state the evidence for the new value.
2. Add a dated line to the changelog below.
3. Check whether any gate that references this file (rev. 5.3 §11 Phase 5) needs re-running.

## Changelog

| Date | Change | Source |
|---|---|---|
| 2026-08-14 | Initial provisional caps C1–C3 recorded. | rev. 5.3 §11 Phase 0 |
| 2026-09-02 | C1 corrected from "hard cap" to "alarm threshold" (it never had an instrument to be a hard cap with). Added C4 (≤$0.15/turn hard stop), C5 (40 turns/member/day) and C6 (2,000 turns/day), all enforced by the AI runtime transplant. | issue #56, Docs/DECISIONS.md D-65 |

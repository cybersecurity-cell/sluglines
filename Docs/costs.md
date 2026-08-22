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
| C1 | Model spend per assistant turn | **≤ $0.10 / turn** | Hard cap (gate) | rev. 5.3 §11 Phase 5 — the AI verification gate checks per-turn cost against this file |
| C2 | Model spend per month | **≤ $50 / month** | Alarm threshold | rev. 5.3 §13 "Spend"; surfaced as an alarm row on the moderator dashboard |
| C3 | SMS sends per day | **500 sends / day** | Alarm threshold | rev. 5.3 §8 M2 / §13; bounds SMS-pumping abuse (risk 11) |

### Notes on each

- **C1 (≤$0.10/turn)** is a *gate*, not an alarm: rev. 5.3 §11 Phase 5 makes "per-turn cost within
  the `docs/costs.md` cap" a pass/fail item of the AI verification gate. A turn that exceeds it is
  a gate failure, not a notification.
- **C2 (≤$50/month)** is an *alarm*: it triggers review, not an automatic shutdown. rev. 5.3 §11's
  deferred list additionally uses it as a trigger — passkeys are revisited if SMS spend exceeds this
  cost-sheet alarm **two months running**.
- **C3 (500 sends/day)** pairs with the §8 M2 OTP abuse controls (resend cooldown, verify-attempt
  caps, per-IP daily send cap, CAPTCHA). The caps bound the abuse; this alarm detects when the
  bound is being tested.

---

## Measurement — not yet wired

None of these caps is currently measured, because the mechanisms that would measure them do not
exist in this repo yet:

| Cap | Intended instrument (rev. 5.3) | Status in `sluglines` today |
|---|---|---|
| C1 | Per-turn cost recorded by the agent runtime / `agent_traces` | **PENDING** — no `lib/ai`, no agent runtime, no `agent_traces` table in this repo |
| C2 | `manual_metrics.model_cost_cents`, recorded weekly from the provider invoice | **PENDING** — `manual_metrics` table not created (deferred, see `Docs/DECISIONS.md` D-11) |
| C3 | `manual_metrics.sms_sends`, recorded weekly from the provider dashboard | **PENDING** — no SMS provider integrated; SMS is Phase 5 |

Until those exist, these are recorded values with no enforcement. That gap is stated here rather
than implied, so a later phase does not mistake "written down" for "enforced".

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

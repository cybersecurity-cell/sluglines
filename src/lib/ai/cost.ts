/**
 * issue #56 — bounding AI spend. This file is the pricing half; `agent.ts` is
 * the enforcement half (the daily turn caps live in `0011`'s two SQL counters
 * instead, per Docs/DECISIONS.md D-65).
 *
 * Docs/costs.md C1 records "model spend per assistant turn ≤ $0.10" as an
 * *alarm* — something a human reviews, not something that stops a turn.
 * `PER_TURN_COST_CEILING_USD` below is a distinct, stricter number: a *hard*
 * cap the runtime enforces mid-loop so one runaway turn cannot spend an
 * unbounded amount while the alarm is still working its way to a human. The
 * two are reconciled, not contradictory — see Docs/costs.md's changelog entry
 * for this file.
 */

export interface ModelRateUsd {
  /** USD per 1,000,000 input tokens. */
  inputPerMillionTokens: number
  /** USD per 1,000,000 output tokens. */
  outputPerMillionTokens: number
}

/**
 * Per-model USD rates, keyed by the concrete model id `model-router.ts`
 * resolves to. PLACEHOLDER VALUES: this pilot has no invoiced spend yet
 * (Docs/costs.md, "Measurement — not yet wired"), so these are a conservative
 * upper-bound estimate rather than a billed rate — high enough that the $0.15
 * ceiling trips *before* a real overspend, not after. Replace with the actual
 * published per-token price for `claude-opus-5` the first time this pilot has
 * an invoice to reconcile against, and record that replacement in
 * Docs/costs.md's changelog the same way a cap change is recorded there.
 */
const MODEL_RATES: Record<string, ModelRateUsd> = {
  'claude-opus-5': { inputPerMillionTokens: 15, outputPerMillionTokens: 75 },
}

/** Used for any model id not in the table above, on the same "estimate high" principle. */
const DEFAULT_RATE: ModelRateUsd = { inputPerMillionTokens: 15, outputPerMillionTokens: 75 }

export function rateForModel(model: string): ModelRateUsd {
  return MODEL_RATES[model] ?? DEFAULT_RATE
}

/** Rounded to the cent-thousandth — enough precision to compare against the ceiling without implying invoice-grade accuracy. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = rateForModel(model)
  const cost =
    (Math.max(0, inputTokens) / 1_000_000) * rate.inputPerMillionTokens +
    (Math.max(0, outputTokens) / 1_000_000) * rate.outputPerMillionTokens
  return Math.round(cost * 1_000_000) / 1_000_000
}

/**
 * issue #56's hard per-turn ceiling. Docs/costs.md C1 (≤$0.10/turn) is the
 * alarm threshold recorded there; this is set deliberately higher, as the
 * *stop* rather than the *notice* — a turn is allowed to approach C1 without
 * being cut off mid-sentence, and is only forcibly stopped if it keeps going
 * past a wider margin. See Docs/costs.md for the full reconciliation.
 */
export const PER_TURN_COST_CEILING_USD = 0.15

/** src/lib/ai/agent.ts's pilot defaults for issue #56's volume caps. */
export const MEMBER_DAILY_TURN_CAP = 40
export const GLOBAL_DAILY_TURN_CAP = 2000

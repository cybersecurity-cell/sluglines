---
name: ai-skill-contract
description: Template and rules for authoring model-skill contracts (ride.parse-intent, lostfound.match-descriptions, etc.) and their eval suites. Use when adding or changing any AI capability.
---

# AI skill contract rules

Every AI capability ships as a versioned contract in `skills/<name>/` with an eval suite in `evals/<name>/`. No contract, no capability.

## Contract file (`skills/<name>/contract.yaml`)

Required fields:

```yaml
name: ride.parse-intent
version: 1.0.0
purpose: >-        # one paragraph, narrow
prohibited_use: [] # explicit list
input_schema:      # Zod-mirrored JSON Schema; untrusted text in data fields
output_schema:     # strict; no free-form fields the gate would trust
model_class: standard   # filter | standard | reasoning | vision | embedding | stt | tts
fallback_pairs: []      # only pairs that passed this skill's eval suite
tools_permitted: []     # usually empty; content-readers get zero write tools
risk_tier: R1
approval_policy: none | confirmation | explicit-approval
context_policy: >-      # smallest relevant slice; what may NOT be included
budgets: { latency_p95_ms: , cost_per_call_usd: }
deterministic_fallback: >-  # what happens when the skill is killed/failing
kill_switch: skills.<name>.enabled
```

Broad skills (`coordinate-ride`, `manage-community`) are prohibited — reject any contract whose purpose spans multiple domains.

## Eval suite (`evals/<name>/`)

Case categories, all required: normal, ambiguous, missing-context, adversarial, direct-injection, indirect-injection (malicious content inside offer text / item descriptions / incident reports), policy-conflict, fallback-model parity.

Metrics: task accuracy, schema validity rate, false approval/rejection, escalation recall, unsupported-claim rate, latency, cost. Thresholds live in the contract; CI fails the skill if any threshold regresses.

All fixtures are **synthetic**. Pattern-inspired by the chat exports is fine; verbatim or attributable content is not.

## Change management

- Prompt, policy, model, or provider change → shadow mode first, promotion only on eval parity.
- Every production generation records skill version, prompt version, model route, and policy version — enough to reproduce and roll back.
- Adding a fallback provider pair requires a full eval run on that pair, not inherited results.

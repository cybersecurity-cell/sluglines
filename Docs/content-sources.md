# Content sources and freshness

Adopted 2026-08-22 for issue #36 (`Docs/DECISIONS.md` D-54). Salvaged from the `codex/phase-1`
snapshot (`e7b0f49`) during the #11 triage, which is also where `Docs/asset-register.md` — the
image-rights half of the same review — came from.

This document governs **operational claims about locations**: peak hours, parking, which lines run
from and to a spot, and the prose description. It does not govern measured values (live counts,
presence) which come from the database and carry their own honesty rules.

---

## The problem it exists to solve

`src/lib/domain/locations.ts` publishes those facts for 50 spots, sourced from a WordPress site whose
own content is years stale. The application rendered all of it with the same authority. A commuter
reading *"peak hours 5:30–9:00"* could not tell whether that was confirmed last month or scraped from
a 2018 post.

This repo already refuses that pattern everywhere else: null coordinates are never guessed (D-31), and
counts render `unavailable` rather than a fabricated zero (D-33). Directory facts were the remaining
surface with no honesty mechanism.

---

## Publication states

Every record in the directory carries exactly one, in `SpotLocation.provenance`.

| State | Meaning | Renders a qualifier? |
|---|---|---|
| **`verified`** | Confirmed against a current primary source, or a dated on-site review by an editor. **Requires `checkedAt`.** | No |
| **`community-reported`** | Recently reported by the community, not yet corroborated by a primary source. | Yes |
| **`needs-review`** | Useful orientation whose current operation has not been confirmed. The honest state for anything inherited. | Yes |
| **`historical`** | Retained for context. Never presented as current instructions. | Yes |

`verified` is the only state that renders nothing. That asymmetry is deliberate: a badge on every
state is decoration and a reader learns to skip it, so **silence is the signal that a fact was
confirmed**.

**An import is not a check.** `checkedAt` is the date a human compared the record to its source. It
stays absent until that happens, and back-filling it with a migration date — which would make an
untouched record look attended to — fails `tests/content-provenance.test.mjs`.

---

## Source hierarchy

Strongest first. A claim inherits the state its strongest supporting source can justify.

1. **Government and transit-operator pages** — VDOT, WMATA, VRE, Fairfax County, PRTC. Sufficient for
   `verified`.
2. **Current on-site signage, confirmed by an editor** on a stated date. Sufficient for `verified`.
3. **Corroborated community reports** — two or more independent reports, or one plus a consistent
   secondary signal. Sufficient for `community-reported`; never for `verified` on its own.
4. **Legacy Sluglines material** — the WordPress export. Background and discovery only. **Never
   sufficient for `verified` on its own**, at any age.

### Link, do not copy

Where a fact belongs to an operator, link to the operator's page rather than reproducing it. Their
copy changes without telling us, and a stale duplicate is worse than a link. This is also the rule
that governs the legacy lot schematics and route diagrams — see #39, where the rights question for
VDOT / VRE / WMATA / Fairfax County material and for Google Maps tiles is still open.

---

## Current state of the directory

**All 50 spots are `needs-review`.** Nothing has been checked against a primary source: the 42 legacy
spots came from the WordPress export, and the 8 I-66 spots were added to the directory with no
primary source recorded.

That is not a gap in the model — it is the model reporting the truth, and it will keep saying so on
every spot page until someone does the checking. `tests/content-provenance.test.mjs` pins the count,
so the change that verifies a spot is the change that updates it.

---

## How to verify a spot

1. Find the strongest source in the hierarchy that covers the claim.
2. Compare every operational fact on the record to it.
3. Set `provenance` to the state that source justifies, `source` to a description naming it, and
   `checkedAt` to today.
4. Update the count assertion in `tests/content-provenance.test.mjs` in the same change.

# Intent — apply migrations 0011–0025 to production

Living while the apply is pending. Records the decision state from `Docs/DECISIONS.md`
D-41, D-74 and D-75 so that a session does not have to re-derive it. When production
carries `0025`, this file becomes a dated record.

## Why

Production (`bwpguotjzczmieeepczf`) carries `0001`–`0010`. Migrations `0011`–`0025` are
applied and verified on the preview branch `phase-3-4-staging` (D-75, 2026-09-02), and
`0025` is a **security fix**: before it, `anon` and `authenticated` could execute all 18
internal SECURITY DEFINER functions (D-74). Production remains exposed until `0025` is
applied there. The live suites (`tests/live-rls.test.mjs`, `tests/live-definer-grants.test.mjs`)
already prove the fix on preview; production is the only target where it is unproven.

## Decisions

| Decision | Rejected | Where |
|---|---|---|
| Nothing in the repo applies migrations; applying is a by-hand, owner-authorised act against a named ref | `supabase db push` in a script | `supabase/migrations/README.md`, D-21 |
| Preview first, then production, same files, same order | Production-only hotfix for `0025` | D-41 pattern, D-75 |
| The apply script refuses any connection string not naming the intended ref | Trusting the operator to paste the right URL | D-75 |
| `0011`–`0025` go together and **must include `0025`** | Applying the feature migrations without the lockdown | D-75 |

## Invariants

- Migration headers change only in comments (`APPLIED:` and `TARGET:` lines); `sql-lint`'s
  statement count stays at 489 and `tests/sql-migration-harness.test.mjs` stays green.
- Monotonic rank: everything applied to production is also applied to preview, never the
  reverse.
- After the apply, anon/authenticated `execute` on the 18 D-74 functions reads 0 of 18 on
  production, probed the way D-75 probed preview.

## Definition of done

Production has `0011`–`0025` applied, the post-apply probe reads 0 of 18, the headers
read `APPLIED: production` with the date, `tests/live-definer-grants.test.mjs` has been run
against production credentials once and is green, and D-76 records all of it.

## Open questions

- When the owner authorises the production apply (owner action; the guarded script from
  D-75 is ready).
- Whether `Temp/Sluglines/SECURITY-FINDING-definer-anon-grants.md` should be copied into
  `Docs/` as a dated record before the apply, so the finding survives outside one machine.

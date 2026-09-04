# Record — migrations 0011–0025 applied to production

**Record.** Written as `Docs/intent/production-schema-apply.md` on 2026-09-03 while the apply
was pending; converted to a dated record on 2026-09-04 after D-76 and D-77 closed it. One
amendment the same day: the two leftovers below were filed as #108 and #109 and the links added.
Not updated again. The intent as written is preserved below the outcome.

## Outcome

The apply happened on 2026-09-03, in two owner-authorised steps recorded in `Docs/DECISIONS.md`:

| Step | Decision | What it did | Evidence |
|---|---|---|---|
| 1 | D-76 | The 7 SECURITY DEFINER functions that D-74 named **and** that already existed in production (from `0001`–`0003`) were revoked from `anon` and `authenticated`, using statements byte-identical to `0025`, in one transaction | Read-only probes before (7/7 executable) and after (0/7); the 13 client entry points still `authenticated = true` |
| 2 | D-77 | The full batch `0011`–`0025` applied in ascending ordinal, one file per transaction, with PITR confirmed enabled first | 17/17 new tables present, RLS on 17/17; **0/18** internal definer functions executable by anon or authenticated; 11/11 sampled client entry points intact; seeds match D-69/D-70 |

Headers `0011`–`0025` flipped to `APPLIED: production` with dated `TARGET` lines
([#106](https://github.com/cybersecurity-cell/sluglines/pull/106), merged 2026-09-04); the two
`APPLIED:` test assertions relaxed in D-75 now accept `production`, and the monotonic-rank rule
holds with the whole sequence `0001`–`0025` on production.

### Definition of done, as scored

| Condition from the intent | Met | Note |
|---|---|---|
| Production has `0011`–`0025` applied | Yes | D-77 |
| Post-apply probe reads 0 of 18 | Yes | D-77 |
| Headers read `APPLIED: production` with the date | Yes | #106 |
| `tests/live-definer-grants.test.mjs` run once against production credentials and green | **Not recorded** | D-77 verified with read-only probes rather than the live suite. Either run it once, or note in a later decision that the probe is the accepted evidence |
| D-76 records all of it | Yes, as D-76 + D-77 | The subset apply and the full apply are two entries |

### Open questions, as resolved

- **When the owner authorises the apply** — authorised and executed 2026-09-03.
- **Whether the session-local security finding is copied into `Docs/` as a record** — still not
  done: `Temp/Sluglines/SECURITY-FINDING-definer-anon-grants.md` remains on one machine and the
  `0025` header still points at it. Filed as
  [#108](https://github.com/cybersecurity-cell/sluglines/issues/108); a dated
  `Docs/2026-09-02-security-finding-definer-anon-grants.md` closes it.

### What this apply did not do (D-77, "still deferred")

Scheduling the five new sweep functions (`instantiate_recurring_offers`,
`expire_stale_incidents`, `expire_stale_lostfound_items`, `promote_waitlist_sweep`,
`record_completed_rides_sweep`) is a separate ops step under `supabase/operations/`, per the
0008/D-46 precedent. Until it runs, those features exist but their time-driven behaviour does
not fire. That is the next action for the pilot, filed as
[#109](https://github.com/cybersecurity-cell/sluglines/issues/109).

---

## The intent, as written on 2026-09-03

### Why

Production (`bwpguotjzczmieeepczf`) carried `0001`–`0010`. Migrations `0011`–`0025` were applied
and verified on the preview branch `phase-3-4-staging` (D-75, 2026-09-02), and `0025` is a
**security fix**: before it, `anon` and `authenticated` could execute all 18 internal SECURITY
DEFINER functions (D-74). Production remained exposed until `0025` was applied there. The live
suites (`tests/live-rls.test.mjs`, `tests/live-definer-grants.test.mjs`) already proved the fix on
preview; production was the only target where it was unproven.

### Decisions

| Decision | Rejected | Where |
|---|---|---|
| Nothing in the repo applies migrations; applying is a by-hand, owner-authorised act against a named ref | `supabase db push` in a script | `supabase/migrations/README.md`, D-21 |
| Preview first, then production, same files, same order | Production-only hotfix for `0025` | D-41 pattern, D-75 |
| The apply script refuses any connection string not naming the intended ref | Trusting the operator to paste the right URL | D-75 |
| `0011`–`0025` go together and **must include `0025`** | Applying the feature migrations without the lockdown | D-75 |

### Invariants

- Migration headers change only in comments (`APPLIED:` and `TARGET:` lines); `sql-lint`'s
  statement count stays at 489 and `tests/sql-migration-harness.test.mjs` stays green.
- Monotonic rank: everything applied to production is also applied to preview, never the reverse.
- After the apply, anon/authenticated `execute` on the 18 D-74 functions reads 0 of 18 on
  production, probed the way D-75 probed preview.

### Definition of done

Production has `0011`–`0025` applied, the post-apply probe reads 0 of 18, the headers read
`APPLIED: production` with the date, `tests/live-definer-grants.test.mjs` has been run against
production credentials once and is green, and D-76 records all of it.

### Open questions

- When the owner authorises the production apply (owner action; the guarded script from D-75 is ready).
- Whether `Temp/Sluglines/SECURITY-FINDING-definer-anon-grants.md` should be copied into `Docs/`
  as a dated record before the apply, so the finding survives outside one machine.

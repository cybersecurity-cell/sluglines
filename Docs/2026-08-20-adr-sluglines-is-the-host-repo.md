# ADR — `sluglines` is the host repo; `Sluglines-AI`'s schema is the ancestry

- **Date:** 2026-08-20
- **Status:** Accepted, with the schema-ancestry decision **superseded 2026-08-22** — see `Docs/DECISIONS.md` **D-34**
- **Supersedes:** §5 of `Docs/consolidated-architecture.md` (rev. 5.3), which adopted `Sluglines-AI` as the canonical repo
- **Closes:** §15 Q1 (which repo name survives)

> **Superseded in part.** The three bullets below that pick `Sluglines-AI`'s migrations as the
> schema ancestry — *"Schema ancestry"*, *"Squash, don't reconcile"*, and *"`codex/phase-3-4` is
> demoted to a content contribution"* — were reversed on 2026-08-22 by `Docs/DECISIONS.md` D-34.
> They contradicted D-13, which was never revisited, and the lineage they superseded is the one
> that has live RLS evidence behind it and production authorisation. **Everything else in this ADR
> stands**, including the host-repo decision this document exists to record. Left unedited below as
> the record of what was decided on 2026-08-20.

## Context

Five efforts existed in parallel. Four of them contain an implementation of the same product:

| Effort | Location | State on 2026-08-20 |
|---|---|---|
| `sluglines` `main` | `github.com/cybersecurity-cell/sluglines` | Next.js 14 content shell, 9 routes |
| `sluglines` `codex/phase-3-4` | same repo, PR #1 (draft) | 25 commits: identity/OTP, offer state machine, migrations `0001`–`0006` |
| `sluglines` `codex/phase-1` | same repo | 116-file snapshot, preserved 2026-08-20 as commit `e7b0f49`, never reviewed |
| `Sluglines-AI` | `github.com/cybersecurity-cell/Sluglines-AI` | Next.js 16, `apps/web/**`, 24 migrations, 11 RLS test files, dormant since 2026-07-29 |

Rev. 5.3 §5 resolved this by adopting `Sluglines-AI` as the canonical application and treating `sluglines` as a content donor. That direction was reversed by the project owner on 2026-08-20: `sluglines` is the host, and `Sluglines-AI` becomes a module inside it.

Two facts discovered during the 2026-08-20 review make the reversal cheap, and both contradict rev. 5.3:

1. ~~**There is exactly one Sluglines Supabase project** (`bwpguotjzczmieeepczf`). No separate `Sluglines-AI` project exists.~~ **FALSE — corrected 2026-08-22 (D-50, issue #43).** There are two. `sluglines-AI` (`kejglwcmzudpehddqkhh`) is live, ACTIVE_HEALTHY, and holds the full 26-table `Sluglines-AI` schema with data. It sits in a **different organization** (`xcpawiqzzjvuzhmzuooo`, not `ydegktkqxhabaprtofie`), which is why a project list scoped to one organization — as this review's was — did not show it. **The ADR's conclusion is unaffected:** the lineage decision rests on which schema this repository builds on, not on how many databases exist, and `kejglwcmzudpehddqkhh` was never a candidate host. See D-50.
2. **It holds no data.** Three tables (`spot_status`, `profiles`, `commute_log`), all zero rows. Its migration history has two entries, both from July: `create_sluglines_ai_schema` and `drop_stray_sluglines_ai_schema`. Neither `Sluglines-AI`'s 24 migrations nor `codex/phase-3-4`'s six were ever applied.

Consequently §3.4's description of `Sluglines-AI` as carrying a live-database RLS suite cannot refer to this project. §2 listed that claim as UNVERIFIED pending Phase 0; it is now verified and false as written.

## Decision

**One app, one Supabase project, one migration lineage.**

- **Host repo:** `sluglines`. `Sluglines-AI`'s `apps/web/**` flattens into `sluglines/src/**` under a route group. Not a monorepo, not a workspace package.
- **Schema ancestry:** `Sluglines-AI`'s. Its 24 migrations carry default-deny RLS on every table, a threat model, an authorization matrix, and a data-classification doc. `codex/phase-3-4`'s six migrations are newer but thinner.
- **Squash, don't reconcile.** Because the database is empty, the two competing `0001` lineages collapse into one fresh lineage. No backfill, no cutover window, no dual-write period.
- **`codex/phase-3-4` is demoted to a content contribution:** the WP migration script, the 43-spot directory, spot search, `community-channels.ts`, and the 165-route inventory. Its identity/OTP and offer-state-machine work is superseded rather than merged.

## Consequences

**Accepted costs**

- 25 commits of recent work lose their app layer. Only the content and directory portions survive.
- The host repo is two major versions behind the module being absorbed (Next.js 14 vs 16, React 18 vs 19, Tailwind 3 vs 4). The absorption is therefore also an upgrade, and cannot be done incrementally file-by-file.
- `Sluglines-AI`'s history stops being the trunk. Its commits are not replayed into `sluglines`; the code arrives as a transplant.

**Gained**

- The security review that justifies adopting `Sluglines-AI` at all comes with it: default-deny RLS, restricted-field masking on `offers_visible`, the confirmed-participant visibility boundary, and the deterministic tool gate.
- The domain name, backlinks, spot taxonomy, and informational content stay where they already are.
- Done now, this is a code move. Once the database holds real commuter rows, the same decision becomes a migration with a cutover window.

**Reversal cost**

High once migrations are applied and members exist. Effectively free today. This is the argument for doing it before the pilot, not after.

## Notes

- The per-tool kill switches in `Sluglines-AI` do not currently work — the gate looks up `skills.<tool_name>` while `0024` seeds `skills.<tool-name>`, and six of eight live tools have no switch row at all. This must be fixed as part of the transplant, not after it. Tracked as issue #3.
- The `codex/phase-1` snapshot (`e7b0f49`) was committed unreviewed purely to make its worktree removable. It is not part of this decision and should be triaged or deleted on its own merits. Tracked as issue #11.

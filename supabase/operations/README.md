# `supabase/operations/` — database operations that are not migrations

`supabase/migrations/` is an append-only schema sequence: it describes **what the database
contains**. This directory holds the other half — SQL that changes **how a specific database
behaves**, which is not the same thing and does not belong in the sequence.

Read `supabase/migrations/README.md` first. The rules there about authorisation and about the
`APPLIED:` header apply here too.

## What belongs here

Operations that are **target-specific** rather than schema. The test is simple: if running the file
against a preview branch would be wrong rather than merely redundant, it is an operation, not a
migration.

The founding case is scheduling. `0001` and `0002` each create a sweep function and each say, in a
comment, that scheduling it "is a database operation, not a migration concern, and is not done
here." That is right, and the migration sequence's own workflow is why: every file in it is
rehearsed against an ephemeral preview branch before production. A migration carrying
`create extension pg_cron` plus `cron.schedule` would fail wherever the extension is unavailable,
and would schedule production's sweeps onto every preview branch that ran the sequence.

## What does not

Anything that creates or alters a schema object. `0008_scheduled_job_health.sql` is the counterpart
of the scheduling file in this directory, and it is a migration rather than an operation because a
function is schema — every environment should have the reader, even the ones with no scheduler for
it to read.

## Rules

- **Not linted.** `scripts/sql-lint.mjs` scans `supabase/migrations` only. Nothing here may grant a
  client role a table write or an `execute` that R4/R7/R10 would have rejected; there is no analyser
  standing behind that, so it is a review obligation.
- **Idempotent.** These files are re-run by hand, sometimes twice. Write them so a second run is a
  no-op or a retune, never a duplicate.
- **Headed and dated.** Same `APPLIED:` / `TARGET:` convention as a migration, and the same
  requirement to record the apply in `Docs/DECISIONS.md`.
- **Named `YYYY-MM-DD-description.sql`.** These are events, not an ordered sequence; there is no
  contiguity rule to enforce and no ordinal to collide with.

## Applied

| File | Target | Date |
|---|---|---|
| `2026-08-22-schedule-sweeps.sql` | production `bwpguotjzczmieeepczf` | 2026-08-22 (D-46) |

# Migrations — `sluglines` rebuild

This directory is the **migration harness for the rebuild** decided in `Docs/DECISIONS.md` **D-13**.
Before D-13 this repo had no migrations directory at all: its only schema artefact was the single
hand-maintained `supabase/schema.sql`, applied by pasting it into the Supabase SQL editor.

Read this file before adding SQL.

---

## What this harness is, and what it deliberately is not

| | |
|---|---|
| **Is** | A numbered, append-only sequence of SQL files, plus a static analyser (`scripts/sql-lint.mjs`) that enforces the rev. 5.3 security posture at commit time, run by `npm run test` and `npm run sql:check`. |
| **Is not** | A runner. Nothing in this repo applies these files to a database. There is no `supabase db push` wired into any script, no connection string, and no live-database test suite. |

That split is intentional. rev. 5.3 §12's standing constraint is *"every new/changed table ships
default-deny RLS + positive and negative RLS tests in the same PR"*. Positive/negative RLS tests
need a live Postgres; a static analyser cannot prove a policy *behaves* correctly. So the harness
proves the weaker property it can actually prove — **the SQL never grants an anonymous or
authenticated client a direct table write** — and the live suite is added when a target database
exists (see `Docs/DECISIONS.md` D-23).

**Do not read a green `sql:check` as "RLS verified".** It means "the SQL contains no shape that
could permit a direct client write". Those are different claims, and conflating them is exactly
the failure `supabase/schema.sql` represents.

---

## File naming

```
NNNN_snake_case_name.sql
```

- `NNNN` is a zero-padded 4-digit ordinal, **starting at `0001`**, unique and contiguous.
- Lower-case, `snake_case`, `.sql` extension.

`scripts/sql-lint.mjs` enforces all of the above.

### Why the sequence restarts at 0001

rev. 5.3 §11/§12 P0 names a file `0025_product_events.sql`. That ordinal belongs to
**`Sluglines-AI`'s** 24-migration sequence. Under D-13 this repo grows its own core, so it grows
its own sequence, and it starts at `0001`. Read every rev. 5.3 migration filename as a *content*
specification, not a filename to reproduce; the mapping table is in `Docs/DECISIONS.md` D-22.

---

## Rules the analyser enforces

Every rule below traces to a specific rev. 5.3 clause, and every one of them is violated by the
legacy `supabase/schema.sql` (`Docs/DECISIONS.md` D-24).

| # | Rule | Source |
|---|---|---|
| R1 | Filename matches `NNNN_snake_case.sql` | harness convention |
| R2 | Ordinals unique and contiguous from `0001` | harness convention |
| R3 | Every created table enables row level security | §12 constraint 2 |
| R4 | **No** `insert` / `update` / `delete` / `all` policy on any new table, for any role | §6 — writes are SECURITY DEFINER functions only |
| R5 | Every policy names its roles explicitly with `to <role>`, and never `anon` or `public` | §8 M4 "no anonymous policy on the table itself exists" |
| R6 | No `using (true)` or `with check (true)` | §14 risks 1 and 4 |
| R7 | No `grant` of a write privilege on a table to any role | §6 |
| R8 | Every `security definer` function pins `search_path` | search-path hijack hardening |
| R9 | Every created function has an explicit `revoke ... on function ... from public` | Postgres grants `execute` to `PUBLIC` by default — without this, R4/R7 are bypassable through the function |
| R10 | No `grant execute on function ... to anon` or `to public` | §8 M1 — anonymous-callable functions arrive in P2 with their own review |
| R11 | Every created table is explicitly revoked from `anon` | defence in depth behind RLS |

R9 is the non-obvious one and the reason this analyser is worth having: a migration can satisfy
every RLS rule and still hand anonymous clients a write path, because `CREATE FUNCTION` grants
`EXECUTE` to `PUBLIC` unless you say otherwise.

### Known limits of the analyser

Stated so a later session does not over-trust it:

- **Overload-blind.** R9 matches functions by qualified name, ignoring the argument list. Two
  overloads of the same name are treated as one.
- **Shape, not semantics.** It cannot tell a correct `using` predicate from an incorrect one. It
  only rejects the unconditional `true`.
- **No cross-schema reasoning.** It analyses statement text, not a catalogue.
- **Rules are additive.** A new attack shape needs a new rule; absence of a rule is not proof of
  absence of a risk.

---

## Adding a migration

1. Create `supabase/migrations/NNNN_name.sql` with the next ordinal.
2. Route every client write through a `security definer` function; give the table no write policy.
3. `revoke all on table ... from anon, authenticated;` then grant back only what is needed.
4. `revoke all on function ...(...) from public;` then `grant execute ... to authenticated;`.
5. Run `npm run sql:check` (or `npm run test`).
6. Record the migration and its rationale in `Docs/DECISIONS.md`.

## Applying a migration

**Not in scope for any session that has not been explicitly authorised for it.** No migration in
this directory has been applied to Supabase project `bwpguotjzczmieeepczf`. Every file here carries
an `APPLIED: no` header line; that line is the record, and it is only changed by the session that
actually applies the file, alongside a `Docs/DECISIONS.md` entry naming the target and the date.

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
| **Is not** | A runner. Nothing in this repo applies these files to a database automatically. There is no `supabase db push` wired into any script and no connection string committed; applying is a deliberate, authorised act performed by hand against a named target. |

That split is intentional. rev. 5.3 §12's standing constraint is *"every new/changed table ships
default-deny RLS + positive and negative RLS tests in the same PR"*. Positive/negative RLS tests
need a live Postgres; a static analyser cannot prove a policy *behaves* correctly. So the harness
proves the weaker property it can actually prove — **the SQL never grants an anonymous or
authenticated client a direct table write**.

**The live suite now exists** (`Docs/DECISIONS.md` D-28). `tests/live-rls.test.mjs` runs positive and
negative RLS tests with real JWTs over PostgREST against the preview branch named in
`supabase/config.toml`. It skips silently when `.env.preview.local` is absent, so a checkout with no
database still runs green, and it refuses outright to run against the production project ref. To
point it at a branch:

```
supabase branches get <branch> --project-ref <parent-ref> -o env > .env.preview.local
npm run test
```

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
| R12 | Every `security definer` function not granted to `authenticated` is explicitly revoked from **both** `anon` and `authenticated`; one granted to `authenticated` must carry **either** an explicit revoke from `anon` **or** a detected `auth.uid()` call in its body — somewhere in the migration sequence | Supabase default privileges (`Docs/DECISIONS.md`, the `0025` entry and the D-79 entry) — R9 alone is not enough, and a grant to `authenticated` is not proof of anything by itself |

R9 is the non-obvious one and the reason this analyser is worth having: a migration can satisfy
every RLS rule and still hand anonymous clients a write path, because `CREATE FUNCTION` grants
`EXECUTE` to `PUBLIC` unless you say otherwise.

R12 exists because R9 turned out not to be enough. On a Supabase project `anon` and `authenticated`
are not the `PUBLIC` pseudo-role — Supabase configures its own default privileges that grant them
`EXECUTE` directly on every new function created in the `public` schema, independent of whatever
`PUBLIC` holds. `revoke ... from public` (R9) never removes that grant, so a `security definer`
function meant to be called by nobody (an internal helper or scheduler sweep) or by `service_role`
only stayed reachable by `anon`/`authenticated` the whole time — the defect `0025` fixes and
`Docs/DECISIONS.md` records. R12 is evaluated across the **whole sequence**, not just the file that
creates the function, so a later migration (like `0025` or `0026`) can close a gap an earlier one
left open without editing that earlier file — append-only migrations, but the property still gets
proven for the whole tree.

A function that *is* granted to `authenticated` **used to be exempt from R12 outright**, on the
premise that it is the legitimate client entry point and RLS/actor checks live inside it. That
premise is about the function's *body*, and R12 never looked at the body — only the grant. It was
false for `public.get_leaderboard` (`0023`): shipped with `grant execute ... to authenticated` and
no `auth.uid()` reference, no null check, nothing, and R12 called the tree clean anyway
(`Docs/DECISIONS.md`, the D-79 entry — 46 functions across the tree carried the identical
unverified-exemption shape). So R12 no longer takes a grant to `authenticated` as sufficient by
itself: such a function must carry **either** an explicit `revoke ... from anon`, closing the
Supabase default-grant gap directly, **or** a detected `auth.uid()` call in its most recent body,
proof it does not skip the authorization question — one narrow, named allowlist aside
(`ANON_CALLABLE_FUNCTIONS` in `scripts/sql-lint.mjs`, R10's own carve-out for the handful of
functions deliberately callable by `anon`).

### Known limits of the analyser

Stated so a later session does not over-trust it:

- **Overload-blind.** R9, R10 and R12 all match functions by qualified name, ignoring the argument
  list. Two overloads of the same name are treated as one function — a `revoke`/`grant` naming the
  wrong argument list silently no-ops instead of erroring (see "Correcting a migration" below), and
  the analyser has no way to notice, because its own model of "this function" never carried argument
  types either. No overload of any function in this tree exists today, so this is a latent gap, not
  a known-exploited one; fixing it means keying every one of R9/R10/R12's internal maps by the full
  signature, not the name, which is a larger change than any single rule fix.
- **R12's `auth.uid()` guard is a text match, not control-flow analysis.** It proves the literal
  string `auth.uid(` appears in the function's own body — it does not prove that call gates
  anything, and it does not see through a call to a *helper* that itself checks `auth.uid()` (e.g.
  `get_dashboard_summary` calling `caller_is_moderator()`, which does check `auth.uid()`, just not in
  `get_dashboard_summary`'s own body). A function like that still passes R12, but only via the
  explicit-anon-revoke branch, never the guard branch — which is the correct outcome, just not for
  the reason a quick read of "guarded" might suggest.
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
4. `revoke all on function ...(...) from public;` then `grant execute ... to authenticated;` for a
   client entry point — and either `revoke all on function ...(...) from anon;` explicitly, too, or
   have the function itself call `auth.uid()` and reject a null result (R12; see above for why the
   grant to `authenticated` is not by itself enough). For an internal function nobody or only
   `service_role` should call, there is no step 4 grant — instead
   `revoke all on function ...(...) from anon, authenticated;` explicitly (R12). `revoke ... from
   public` alone is not enough on Supabase; see R12 above.
5. Run `npm run sql:check` (or `npm run test`).
6. Record the migration and its rationale in `Docs/DECISIONS.md`.

### Correcting a migration that has already been applied

Never edit it. The sequence is append-only, and a file whose `APPLIED:` header names a database is a
record of what that database ran — editing it makes the record false without changing the database.

**One bounded exception: a comment that has gone stale may be corrected, and nothing else.** The rule
above is about *statements*; a header comment citing a path or a decision number that no longer
resolves makes the record less usable rather than more faithful. Such an edit must change no
statement, must leave `sql:check`'s statement count unmoved, and must be recorded in
`Docs/DECISIONS.md` — `0001`'s architecture-doc path was corrected this way in D-37, and D-24 used
the same carve-out to add the quarantine banner to `supabase/schema.sql`. This is not licence to
edit applied SQL.
A correction is a **new ordinal** that re-creates the affected objects, and `create or replace` keys
on the argument type list, so the new definition must carry the old signature **exactly**: change one
parameter name or type and Postgres adds an overload while the defect stays live. `0003` corrects
`0002` this way (D-30), and `tests/offer-state-machine.test.mjs` asserts both halves — that the
signatures match, and that the effective definition read by the tests is the *last* one in the
sequence rather than the first.

## Operations that are not migrations

Scheduling, extension installs, and anything else that is target-specific rather than schema live in
`supabase/operations/`, which has its own README. The split exists because every file in *this*
directory is rehearsed on an ephemeral preview branch before production: a migration carrying
`create extension pg_cron` plus `cron.schedule` would fail wherever the extension is unavailable and
would schedule production's sweeps onto every preview branch that ran the sequence. `0008` is the
counterpart — it ships the *reader* of that schedule, because a function is schema and every
environment should have it, including the ones with no scheduler for it to read.

## Applying a migration

**Not in scope for any session that has not been explicitly authorised for it.**

Every file carries an `APPLIED:` header line of `no`, `preview` or `production`. That line is the
record. It is only changed by the session that actually applies the file, alongside a
`Docs/DECISIONS.md` entry naming the target and the date, and — for anything other than `no` — a
`TARGET:` line naming the database. `tests/sql-migration-harness.test.mjs` enforces the vocabulary
and refuses any committed migration that claims `production`.

Current state:

| Target | Status |
|---|---|
| Preview branch `phase-3-4-staging` (`xqonrogwwytkmqfinszp`) | `0001`–`0003` applied 2026-08-14 (D-28, D-30); `0004`–`0008` applied 2026-08-22, each as the rehearsal for its production apply |
| **Production `bwpguotjzczmieeepczf`** | **`0001`–`0010` applied** — `0001`–`0007` on 2026-08-22 under the owner's authorisation of 2026-08-21 (D-41); `0008` on 2026-08-22 (D-46). `tests/live-public-surface.test.mjs` verifies the anonymous surface against it |

`tests/sql-migration-harness.test.mjs` no longer refuses `APPLIED: production` — that tripwire was
relaxed by the session that earned it, visibly, in the same diff as the apply. What it enforces now
is stricter in the direction that matters: a file claiming a target must name the ref **and the
date**, and **no ordinal may claim a target its predecessors have not reached**. A sequence where
`0006` is applied over an unapplied `0004` describes a database no file in this directory describes,
and the blanket ban could never have caught it.

Applying to a preview branch, for reference — note the explicit `--db-url`, which is what keeps an
unqualified command from resolving to the parent project:

```
supabase branches create <name> --project-ref <parent-ref> --region <region> --size micro
supabase branches get <name> --project-ref <parent-ref> -o env > .env.preview.local
supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
npm run test          # includes tests/live-rls.test.mjs
```

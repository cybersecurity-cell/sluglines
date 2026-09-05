# Sluglines Project Rules

HOV-3 carpool coordination for Northern Virginia. Next.js 16 App Router on Vercel, Supabase (Postgres, Auth, Realtime), Tailwind. This repo is the canonical implementation repo (`Docs/DECISIONS.md` D-2). The M1–M4 core — directory, identity, the ride-coordinator state machine, and presence — is **rebuilt here from the rev. 6 specification, not transplanted**, from `Sluglines-AI` (D-13, decided by the human 2026-08-14, **narrowed to this scope by D-78**). The AI runtime and six further schema slices (incidents, lost & found, transit stops, recurring offers, waitlist/ETA/no-show, ride history/leaderboard/dashboard) **were** transplanted from `Sluglines-AI`, adapted rather than copied verbatim, under a verbal directive that was never itself recorded as a decision until D-78 reconciled it (D-65, D-68–D-73). `CLAUDE.md` is a one-line import of this file so that Claude Code, Codex and Hermes read the same rules.

## Gates

Run as six independent gates, never one `&&` chain:

```
npm run test        # node scripts/run-tests.mjs — unit + schema harness; live-* suites skip without .env.preview.local
npm run lint
npm run typecheck
npm run build
npm run sql:check   # scripts/sql-lint.mjs + seed-locations --check
npm run e2e         # Playwright, desktop + mobile Chromium
```

CI runs `ci`, `audit`, `secret-scan`, `static-analysis`, `e2e` and `lighthouse` on every PR (`.github/workflows/`). `Docs/consolidated-architecture.md`'s header carries the baseline test count `N`, and `tests/baseline-n.test.mjs` fails if the repo and the header disagree — a change that adds or removes tests updates the header in the same PR.

## Hard constraints

- **Migrations are append-only and nothing here applies them.** Read `supabase/migrations/README.md` before writing SQL. `sql-lint` enforces R1–R12 (default-deny RLS, no client write policies, `search_path` pinned, explicit revokes). Applying a migration is a deliberate, owner-authorised act against a named target; a file marked `APPLIED: production` is never edited except its header comments.
- **Never point anything at the production project ref** (`bwpguotjzczmieeepczf`) from a session. Live suites refuse it by design; keep it that way.
- **`Docs/DECISIONS.md` is append-only.** Each entry states the decision, its evidence and a status of `ADOPTED`, `DONE`, `PENDING` or `BLOCKED`. Nothing is inferred; an unverifiable fact is recorded as `PENDING` with what would close it.
- **Content preservation.** The 400+ built routes, the legacy redirect inventory and `src/lib/{spot-directory,legacy-content,site-content,...}.ts` survive every restructure unchanged in behaviour; no slice may reduce the passing test set to satisfy a restructure (D-13).
- **Public surface tokens.** The §10 palette is enforced by `tests/public-surface-tokens.test.mjs`; no `sky-*` or `slate-950` on a public page. Authenticated surfaces (`/login`, `/verify`, `/onboarding`, `/dashboard`, `FastBoard`) are not yet migrated — see `Docs/2026-09-01-handoff-public-surface-rest.md` for why.
- **`AI/` is isolated.** Work under `AI/` must not modify or reinterpret the existing site unless an integration is explicitly approved through a decision entry. `Sluglines-AI` (separate repo) is reference and documentation only.
- Source chat exports are research inputs only; never production or training data.

## Definition of done

An item closes when the change has been **seen working at the deployed URL** by a person — the production deployment on Vercel, or the preview the PR names — and the evidence (URL, timestamp, what was observed) is on the issue. Green CI closes nothing: `sluglines.com` is still the WordPress site until DNS cuts over (#25) and Vercel Authentication blocks every preview (#47), so everything built here has been unreachable from the public URL. Where only the owner can perform the check, say so on the issue and leave it open.

## Divergence

If the work cannot be done as the issue or brief states, stop. Write what was found and why the stated scope does not hold — the executor notes in `Docs/2026-09-01-handoff-public-surface-rest.md` are the model — hand it back, and do not improvise a different scope.

## Where things live

| What | Where |
|---|---|
| Open work | **GitHub Issues**, and nowhere else. A dated handoff or "shipped" record names issues; it never carries a task list |
| Architecture and product plan | `Docs/consolidated-architecture.md` (rev. 6). §8 modules, §10 UI and identity, §11 phased plan, §12 execution prompts |
| Decisions | `Docs/DECISIONS.md`, D-1 onward |
| Feature intent | `Docs/intent/<feature>.md`, one per feature in flight: why, decisions with rejected alternatives, invariants, done |
| Design direction | `Docs/consolidated-architecture.md` §10, enforced by `tests/public-surface-tokens.test.mjs` |
| Dated records | `Docs/<date>-<slug>.md`: handoffs, shipped-on-a-day summaries, ADRs, scoping prompts. Written once, never edited |
| Assets, content sources, costs | `Docs/asset-register.md`, `Docs/content-sources.md`, `Docs/costs.md` — living, edited in place |
| AI module specs and skills | `AI/docs/specs/`, `AI/.claude/skills/` (loaded only for a session rooted in `AI/`) |

The docs contract is: a file that will be updated again has a fixed, undated name and exactly one copy; a file that will not is dated and never edited. A dated name on a living file is the bug.

## Sessions and branches

One local session per repo at a time; parallel work goes to cloud sessions, each in its own clone. Cut every branch from `origin/main`, one branch per issue, and delete the branch when the PR merges. `.claude/settings.json` is committed and portable: permissions only, no absolute paths, no hooks. Per-machine hooks go in the gitignored `.claude/settings.local.json`.

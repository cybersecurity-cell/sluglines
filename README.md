# Sluglines

> Slug lines and HOV-3 carpools in Northern Virginia — the directory, the rules, and a coordination board for one pilot corridor.

Slugging is casual carpooling: at designated lots on I-95, I-395 and I-66, drivers pick up strangers to meet the HOV-3 requirement, and riders get a free commute. No money changes hands. It has worked for decades on nothing but a queue and a destination called out of a window. This repository is the rebuild of `sluglines.com`, the community's site since 2016.

## What is here

- **The spot directory** — 50 pickup locations across three corridors, with directions, peak hours, parking and the lines each lot runs to and from, served at `/spots` and `/slug_pickup`. Public, no account needed.
- **Public counts** — aggregate rider and driver counts per spot on the home page and every spot page, read through SECURITY DEFINER functions so no member row is ever exposed.
- **How slugging works and the rules** — the community's etiquette, migrated from the legacy site.
- **The archive** — every page and post from the WordPress site, served at its original URL or redirected, with a branded 410 for the forum paths that are gone for good.
- **Sign-in by phone code**, a display name and a home spot — the only identity a member has. Other members never see a phone number.
- **Check-in** — a member at a spot can say so from the spot page; drivers see the count, not the name.
- **The board** for one pilot corridor, Horner Rd ↔ L'Enfant Plaza: post a seat, reserve one, cancel or release your own. Offers move through a revision-checked, idempotent state machine in SQL.

## What is not here (yet)

- No mobile app. The `/app` page is preserved from the 2018 site with a note saying so.
- No live updates. The board re-renders on a 30-second poll while the tab is open; there is no Supabase Realtime subscription in this code.
- No SMS provider wired in, so sign-in cannot yet send a code in production (issue #52).
- Every migration after `0026` is written and not applied; see `supabase/migrations/README.md` for what "applied" means here and who may do it.

Open work lives in [GitHub Issues](https://github.com/cybersecurity-cell/sluglines/issues), and nowhere else.

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Data | Supabase — Postgres with row-level security and SECURITY DEFINER writers, Supabase Auth (phone OTP) |
| Hosting | Vercel |
| Tests | Node built-ins (`node:assert`), Playwright, axe, Lighthouse budgets, a SQL analyser (`scripts/sql-lint.mjs`) |

## Working in this repository

Read [`AGENTS.md`](AGENTS.md) first. It is the contract every contributor and every agent works to: six independent gates, append-only migrations that nothing here applies, an append-only decision log, content preservation for the 400+ legacy routes, and a definition of done that requires a person to have seen the change working at the deployed URL.

```bash
npm ci
npm run test        # unit + schema harness; live-* suites skip without .env.preview.local
npm run lint
npm run typecheck
npm run build
npm run sql:check   # the SQL analyser + the seed generator's byte-for-byte check
npm run e2e         # Playwright, desktop + mobile Chromium
```

Run them as six commands, never one `&&` chain: a gate that stops the others from running hides what they would have said.

To run the app locally, copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key of a **preview branch** — never the production project. The live test suites refuse the production ref by design; keep it that way.

## Where things live

| What | Where |
|---|---|
| Architecture and product plan | `Docs/consolidated-architecture.md` |
| Decisions, D-1 onward | `Docs/DECISIONS.md` |
| Feature intent | `Docs/intent/<feature>.md` |
| Migrations and their posture | `supabase/migrations/`, starting with its `README.md` |
| Dated records (handoffs, ADRs) | `Docs/<date>-<slug>.md` |
| The legacy site's content | `src/data/legacy-site-content.json`, served by `src/lib/legacy-content.ts` |

## License

MIT.

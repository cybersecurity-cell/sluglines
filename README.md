# Sluglines

Sluglines is an information-first guide to Northern Virginia informal carpooling. It publishes source-labelled pickup locations, destinations, advisories, safety guidance, and community resources. Registered commuters can save locations, store private preferences, and submit corrections for review.

Phase 1 intentionally does not promise live commuter counts, automated social-group ingestion, a mobile app, a chatbot, or a voice agent.

## Stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Supabase Auth and PostgreSQL with row-level security
- Vitest, Testing Library, axe-core, and Playwright
- GitHub Actions and Vercel

## Local setup

Requirements: Node.js 22+, npm, Supabase CLI, and Docker for the local database tests.

```bash
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Set these public application variables in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never place a service-role key in a browser-visible variable or commit any credential.

## Verification

```bash
npm run check
npm run build
npm run test:e2e
```

`npm run check` runs strict TypeScript, ESLint, unit/component tests, focused Node tests, accessibility checks included in Vitest, and the static RLS policy audit. SQL behavior tests live in `supabase/tests/phase1_rls.sql` and run against a local or linked test database.

## Database changes

All schema changes are forward migrations in `supabase/migrations`. Review them before applying:

```bash
npx supabase migration list
npx supabase db push
```

The Phase 1 migration enables RLS for every public table. Public users can read only published operational content; profiles, saved locations, preferences, and correction reports remain owner-scoped.

## Content and assets

- [Content sources](Docs/content-sources.md) records provenance and publishing decisions.
- [Asset register](Docs/asset-register.md) records rights and privacy review.
- [Security review](Docs/security-review.md) records trust boundaries and release gates.
- [Phase 2 roadmap](Docs/phase-2-roadmap.md) covers a cited chatbot and consent-based community intake.
- Operational records carry a source, verification status, and last-reviewed date.

Do not publish identifiable commuters, visible license plates, personal exports, private group messages, or archive material with unclear rights.

## Deployment

Pull requests to `main` or `staging` run `.github/workflows/ci.yml`. A successful push CI run deploys the exact built artifact through `.github/workflows/deploy.yml` when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are configured. `main` promotes through Vercel production; `staging` receives the `staging.sluglines.com` alias. Supabase migrations are applied separately and verified before production promotion.

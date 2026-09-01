# Notes for the orchestrator — `ui/public-surface-rest`

Executor slice: finish the §10 palette migration across the rest of the PUBLIC surface, make the
gates green, leave it ready for a PR. No push, no PR opened.

This continues `ui/public-redesign` (#86, D-62), which did `/` and the chrome. Item 2 of that
slice's notes — "the rest of the public surface still wears the sky-blue palette" — is what this
branch closes. Recorded as **D-63**.

## Done

Eleven files plus three `globals.css` component classes onto §10. `tests/public-surface-tokens.test.mjs`
now walks **20** files rather than 8, so the no-`sky-*`/no-`slate-950` scan covers the whole public
surface. Contrast pairs 42 → 49. Baseline N 1,089 → 1,111 assertion call sites (38 files, unchanged).

After this branch, **no public page carries the retired sky palette.** Every remaining `sky-*` in
`src/` is on an authenticated surface or on `FastBoard` (below).

## Deliberately NOT done, and why

### 1. `FastBoard` — named in the brief as public, but it is not

The brief listed `FastBoard` under "public components used by those pages". It is not used by any of
them: `src/components/FastBoard.tsx` renders **only** on `/dashboard`, which the same brief lists as
a hard-stop authenticated surface. Its sibling on that page, `CheckInStatusPanel`, is in the
exclusion list.

Migrating it in isolation would have left `/dashboard` visibly half-done — a §10 green board under a
`text-sky-700` eyebrow and a `slate-950` heading, beside a sky-blue `CheckInStatusPanel`. Finishing
it properly means editing `src/app/dashboard/page.tsx` and `CheckInStatusPanel.tsx`, both explicit
hard stops. The brief's own rule for that case is to stop and write it here, so that is what this
is.

`FastBoard` keeps its sky palette, including `--driver` as `sky-900`, which is the one §10 semantic
mismatch knowingly left in the tree. **It should move with the authenticated surface, not before
it.**

Note that `tests/public-surface-tokens.test.mjs` already asserts FastBoard's peak-window copy (it is
one of the three components that print `5:30–9:30`), and that assertion is untouched and still
passing — so the file is partly governed by the public gate while not being on the public surface.
Worth resolving when the dashboard is migrated.

### 2. §10's `:root` tokenisation and the public-footer dark toggle — still deferred

Unchanged from D-62, and this slice made it *easier* rather than harder: `/how-it-works` was the last
public page painting onto the dark `:root` shell, and it is now light like the rest. Every public
page is now uniformly light-pinned, which is the precondition for flipping the token set in one
coordinated change.

The dark shell token set itself is untouched; all 11 of its contrast pairs still pass.

**Recommended follow-up (unchanged):** one issue covering tokenisation + the footer toggle across
every page shell at once — now including `/how-it-works`.

### 3. The authenticated surfaces are untouched, as instructed

`/login`, `/verify`, `/onboarding`, `/dashboard`, and `LoginForm`, `VerifyForm`, `OnboardingForm`,
`CheckInStatusPanel` all keep their sky-blue exactly as it was.

One thing to know before that slice starts: `.btn-primary`, `.btn-secondary` and `.section-label` in
`globals.css` are now painted for the **light** §10 surface. They have exactly one consumer
(`/how-it-works`), and the gate asserts that by name against the login/verify/onboarding/dashboard
files. If an authenticated screen wants one of them, the class has to be **split**, not shared — the
gate will fail rather than let a dark screen silently inherit a light-ground palette.

### 4. Lighthouse LCP still not measured here

Unchanged from D-62. The JS half of the §10 budget is verified from the build (below); LCP needs the
Lighthouse CI job.

### 5. The legacy archive summaries are still duplicated title text

Unchanged from D-62 item 4. `PostIndexPage` still calls `summarizeLegacyPost`, and on `/blog` and
`/news` that summary still leads with the post title, because the fix belongs in the legacy scrape
(`src/lib/legacy-content.ts`). Only `RecentPostsSection` on `/` dropped the column. Not touched here
— it is a data-pipeline fix, not a palette one.

## Copy/data honesty bugs fixed (all on `/how-it-works`)

1. **Peak windows, both halves.** "6 AM to 9 AM" / "4 PM to 7 PM" → the canonical 5:30–9:30 and
   3:00–7:00 (05:30–09:30 / 15:00–19:00 ET, §12). D-62 fixed the hero's morning window; this page
   was still disagreeing with the four components that print it, and was the only source anywhere
   for the afternoon numbers.
2. **"...with an excellent safety record."** Nothing in this repo measures a safety record. The 1975
   start date IS sourced (legacy About Slugging page, first I-395 HOV lanes) and was kept.
3. **"check live wait times."** There are no wait times — live counts are `unavailable`, and even
   switched on they are rider/driver counts, not waits.

All three are pinned in the gate in the direction that fails if someone restores them.

## Gate results (from the worktree root)

| Gate | Result |
|---|---|
| `npm run test` | **PASS** — 38/38, 0 fail |
| `npm run lint` | **PASS** — 0 errors, 0 warnings |
| `npm run typecheck` | **PASS** — clean |
| `npm run build` | **PASS** — 422 pages |
| `npm run sql:check` | **PASS** — 10 migrations, 181 statements, 0 violations (no SQL changed) |
| `npm run e2e` | **PASS** — 34/34, desktop + mobile Chromium |

Known skips, all expected and reported `ok`: `live-rls.test.mjs` (no `.env.preview.local`),
`live-public-surface.test.mjs` (no public credentials), `supabase-server-client.test.mjs`
(`@supabase/ssr` not installed here).

First-load JS, §10 budget < 150 kB: `/spots` and `/slug_pickup` 116 kB; `/spots/[slug]` 101 kB;
`/how-it-works`, `/lostfound`, `/blog`, `/news`, `/about-us`, `/about-slugging`, `/app` and
`/[...legacyPath]` 96.2 kB; `/slugging-rules` and `/slugging-rules-and-etiquette` 87.4 kB. `/` is
unchanged at 101 kB.

## Environment notes

- The Playwright script is **`npm run e2e`** (there is no `test:e2e`).
- Chromium was already present in this worktree; `npx playwright install chromium` was a no-op.
- No `.shots/` directory was created by this slice.

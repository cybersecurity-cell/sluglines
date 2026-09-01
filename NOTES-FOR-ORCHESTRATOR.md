# Notes for the orchestrator — `ui/public-redesign`

Executor slice: finish the §10 public UI redesign, make the gates green, leave it ready for a PR.
No push, no PR opened.

## Deliberately NOT done, and why

### 1. §10's `:root` colour tokens and the public-footer dark-theme toggle

§10 asks for the whole palette as custom properties on `:root`, redefined under
`prefers-color-scheme`, plus an explicit dark-theme toggle reachable signed-out in the public
footer. This slice does **not** implement either.

The reason is blast radius, not difficulty. Today `globals.css` `:root` holds the *dark shell*
(`--bg: #080d17`) that the footer and the app chrome paint from, and every public page pins itself
light with a hard `bg-white text-slate-950` wrapper. Turning the §10 colours into
`prefers-color-scheme`-responsive tokens flips the redesigned sections dark for dark-mode users
while every page still wearing that wrapper — `/spots`, `/slug_pickup`, `/lostfound`,
`/slugging-rules`, `/login`, `/verify`, `/onboarding`, `/dashboard`, `LegacyContentPage`,
`PostIndexPage` — stays white. That is a worse state than what is here now, and fixing it properly
means touching auth and dashboard surfaces this slice is scoped out of.

What this slice does instead: pins the §10 colours as data in `scripts/contrast-check.mjs`, the same
way the existing light palette is pinned, so the AA gate actually covers them. The dark shell token
set is untouched and all 11 of its pairs still pass.

**Recommended follow-up:** one issue covering tokenisation + the footer toggle across every page
shell at once.

### 2. The rest of the public surface still wears the sky-blue palette

The redesign's eight files are fully migrated and a test now enforces that. But
`SpotDirectorySection` is shared with `/spots` and `/slug_pickup`, and those two pages still have a
`text-sky-700` eyebrow and a `slate-950` heading above a §10-token directory. Same for
`/lostfound`, `/slugging-rules`, `LegacyContentPage`, `PostIndexPage`, `SpotDetailLayout`,
`CommunityLinksCard`, `SpotQuickFacts`, `SpotSearch`, and the `.btn-primary` / `.btn-secondary` /
`.section-label` component classes in `globals.css` that `/how-it-works` uses.

Migrating them is mechanical and low-risk, but it is a much larger diff across files this slice was
told not to refactor. Flagging it because "the public surface is redesigned" is not yet true —
**the homepage is.**

### 3. Fonts are Syne / Outfit / JetBrains Mono, not Geist

§10 names Geist Sans/Mono. The repo loads Syne (display), Outfit (body) and JetBrains Mono, and
`src/app/layout.tsx` carries a long comment explaining that the `display: 'optional'` setup on those
three faces is what brought homepage LCP from 2.6s under the 2.0s budget (issue #20). Swapping the
font stack risks that measurement, and re-measuring needs the Lighthouse CI job, not this
environment. Left alone as a deliberate call.

What *was* fixed: `font-mono` did not resolve to the loaded JetBrains Mono at all — Tailwind's
default mono stack won, so the redesign's mono eyebrows and numerals rendered in system monospace
while a preloaded font went unused. `tailwind.config.ts` now maps it.

### 4. The legacy archive summaries are duplicated title text

`summarizeLegacyPost` returns the head of `bodyText`, and every migrated WordPress page's `bodyText`
opens with its own H1, then the "Home" breadcrumb, then the H1 again. The real fix is stripping
breadcrumb chrome at scrape time in the legacy content pipeline (`src/lib/legacy-content.ts` +
`tests/legacy-content.test.mjs`), which is outside this slice. `RecentPostsSection` now shows title
and date only, and `tests/public-surface-tokens.test.mjs` proves the duplication from the data — so
that assertion starts failing (usefully) the day the pipeline is fixed and the summary column can
come back.

### 5. Lighthouse LCP was not measured here

§10's `LCP < 2.0s throttled 4G` is a Lighthouse CI measurement (`lighthouserc.json`). It is not
runnable in this environment. The JS half of the budget **is** verified: `/` builds to 101 kB first
load against a 150 kB gzip budget.

## Environment notes

- `package.json` has no `test:e2e` script. The Playwright script is **`npm run e2e`**.
- Playwright's Chromium was not installed on this machine; `npx playwright install chromium` fetched
  it, and the full 34-test suite then passed. CI already does this.
- `live-rls.test.mjs` and `live-public-surface.test.mjs` both SKIP here (no `.env.preview.local`,
  no public credentials). They report `ok`, not failure — the stale-seed FK failure described in the
  brief did not occur, because the credentials that would trigger it are absent.
- `.shots/` holds two throwaway screenshots used to eyeball the rendered page. Delete it before the
  PR if it is not wanted; it is untracked.

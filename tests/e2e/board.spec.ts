import { test, expect } from '@playwright/test'

/**
 * `/board` — PR 5 "thin coordination loop", browser coverage for the empty
 * state rev. 5.3 §10 requires.
 *
 * WHAT THIS COVERS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * There is no OTP test-number harness in this CI (`playwright.config.ts`'s own
 * header explains why: #24 disabled the ranges that would let a browser test
 * drive phone-OTP sign-in), so a Playwright run here is always signed out. §10's
 * nav table lists the Board zone as "not visible (auth surface)" signed-out,
 * and this page renders that explicitly rather than redirecting away — see
 * `app/board/page.tsx`'s own comment for why.
 *
 * TWO HONEST OUTCOMES, NOT ONE
 * ---------------------------------------------------------------------------
 * This environment also has no `NEXT_PUBLIC_SUPABASE_*` credentials (the PR
 * description says so). `getCorridorBoardOffers()` cannot even construct a
 * Supabase client without them, so it never reaches its own "no session"
 * check — it fails *earlier*, into the `unavailable` branch, before "signed
 * out" is ever decided. `tests/e2e/console.spec.ts` already tolerates the same
 * root cause (its `IGNORED` list names `supabaseUrl is required` explicitly).
 * A real deployment with credentials configured would show "Sign in to see
 * the board" here instead — that branch is exercised without a browser, in
 * `tests/corridor-board.test.mjs`'s IO-layer assertions and by inspection of
 * `getCorridorBoardOffers()`'s auth-first control flow. What this test can
 * assert in *either* environment, and does, is the property that actually
 * matters for "not visible": no offer data — no reserve button, no post-a-seat
 * form — ever reaches the page signed out, regardless of which of the two
 * honest failure branches produced that.
 *
 * The true rev. 5.3 §10 empty-state copy ("No offers for this window yet —
 * check in so drivers can see you, or post a request") requires a session and
 * zero corridor offers; it is covered without a browser in
 * `tests/corridor-board.test.mjs` (`buildCorridorBoard([], ...)`) instead. This
 * is the same split `tests/dashboard-fast-board.test.mjs` and this file's
 * sibling specs already accept for every other authenticated surface.
 */

test('the board shows no offer data signed out', async ({ page }) => {
  const response = await page.goto('/board')

  expect(response?.status()).toBeLessThan(400)

  const heading = (await page.locator('h1').first().innerText()).toLowerCase()
  expect(
    heading.includes('sign in') || heading.includes('unavailable'),
    `expected the signed-out or unavailable heading, got "${heading}"`
  ).toBe(true)

  // Not visible means no offer data reaches the page at all: no post-a-seat
  // form, no reserve control, whichever of the two honest branches rendered.
  // Scoped to these two controls rather than every `<form>` on the page —
  // `layout.tsx` ships an unrelated footer search form on every route.
  await expect(page.getByLabel('Direction')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /reserve/i })).toHaveCount(0)
})

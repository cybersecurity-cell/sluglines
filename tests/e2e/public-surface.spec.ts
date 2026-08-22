import { test, expect } from '@playwright/test'
import { classifyLegacyPath } from '../../src/lib/legacy-redirects'

/**
 * Example paths are RESOLVED FROM THE POLICY, not written down here. A browser
 * test carrying its own copy of the redirect map drifts alongside the thing it is
 * checking and agrees with itself forever — the same failure
 * `tests/legacy-route-verifier.test.mjs` exists to prevent in the script.
 */
const GONE_EXAMPLE = '/wp-login.php'
const REDIRECT_EXAMPLE = '/slug_pickup/14th-st-and-constitution-ave/'

/**
 * The public surface renders, and the legacy URL policy holds at the served edge
 * — issue #35.
 *
 * OVERLAP WITH #23, RESOLVED RATHER THAN DUPLICATED
 * ---------------------------------------------------------------------------
 * `scripts/verify-legacy-routes.mjs` checks all 165 legacy routes against a real
 * deployment. This does NOT re-implement that: it takes a handful of
 * representative paths and checks them through a real browser, which is a
 * different question — the script asks "does the edge return 301 to the right
 * place", this asks "does a person following an old bookmark land on a page that
 * renders". #35 says whichever lands first should not re-implement the other.
 */

test('homepage renders its own name and the corridor surface', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/slug/i)
  await expect(page.locator('h1').first()).toBeVisible()
})

test('the spot directory lists spots and links into them', async ({ page }) => {
  await page.goto('/spots')

  const links = page.locator('a[href^="/spots/"]')
  // 50 seeded, 41 active; asserting a floor rather than an exact number keeps
  // this from failing on an editorial change it has no opinion about.
  expect(await links.count()).toBeGreaterThan(10)

  await expect(page.locator('h1').first()).toBeVisible()
})

test('a spot detail page renders its facts', async ({ page }) => {
  await page.goto('/spots/Horner-Rd')

  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page.getByText('Quick facts')).toBeVisible()

  // The #36 freshness qualifier: every spot is `needs-review` today, so it must
  // be on the page. If a spot is ever verified this assertion is the reminder to
  // decide what the page should say instead.
  await expect(page.getByText(/have not been confirmed against a current source/i)).toBeVisible()
})

test('a retired URL answers 410 and keeps its address', async ({ page }) => {
  // Guard the example against the policy, so this fails loudly if the
  // disposition ever changes rather than silently testing nothing.
  expect(classifyLegacyPath(GONE_EXAMPLE).kind).toBe('gone')

  // A rewrite, not a redirect: the dead URL stays in the address bar and in the
  // crawler's log. A 302-to-a-410 would be two lies in a row.
  const response = await page.goto(GONE_EXAMPLE, { waitUntil: 'domcontentloaded' })

  expect(response?.status()).toBe(410)
  expect(new URL(page.url()).pathname).toBe(GONE_EXAMPLE)
})

test('a legacy spot URL redirects to the retained page', async ({ page }) => {
  const disposition = classifyLegacyPath(REDIRECT_EXAMPLE)
  expect(disposition.kind).toBe('redirect')

  const response = await page.goto(REDIRECT_EXAMPLE)

  // Followed here on purpose — this test is about where a person ends up, which
  // is the half a status-code checker cannot answer. The landing path comes from
  // the policy, so a changed target updates this test automatically.
  expect(response?.status()).toBeLessThan(400)
  expect(new URL(page.url()).pathname).toBe(
    disposition.kind === 'redirect' ? disposition.target : ''
  )
  await expect(page.locator('h1').first()).toBeVisible()
})

test('the public surface renders no phone number', async ({ page }) => {
  // A backstop for the §6 invariant: no phone numbers anywhere in the product
  // surface. It matches a rendered NUMBER, not the words "phone number" — the
  // site legitimately explains in copy how a number is used at sign-in, and an
  // assertion that forbids the phrase forbids the explanation rather than the
  // leak.
  await page.goto('/spots/Horner-Rd')
  const body = await page.locator('body').innerText()

  expect(body).not.toMatch(/\+1[\s.-]*\d{3}[\s.-]*\d{3}[\s.-]*\d{4}/)
  expect(body).not.toMatch(/\(\d{3}\)\s*\d{3}[\s.-]*\d{4}/)
})

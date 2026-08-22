import { test, expect, type ConsoleMessage } from '@playwright/test'

/**
 * Zero browser console errors across the public routes — issue #35's headline
 * item, and the one nothing else in the repo would notice.
 *
 * A hydration mismatch does not fail a build, does not fail `tsc`, and does not
 * fail any Node assertion in `tests/`. It shows up as a console error and as a
 * page that silently re-renders differently than it was served. This is the only
 * instrument in the repo that can see it.
 */

const PUBLIC_ROUTES = [
  '/',
  '/spots',
  '/spots/Horner-Rd',
  '/how-it-works',
  '/slugging-rules',
  '/login',
]

/**
 * Errors that are about the environment rather than the page.
 *
 * Kept deliberately short and specific. A permissive ignore list is how a
 * console-error gate becomes decorative — every entry here has to name a cause
 * that is genuinely not the application's, and a bare "favicon" or "network"
 * substring would swallow real failures.
 */
const IGNORED = [
  // No Supabase credentials in a local/CI run: the public pages are designed to
  // degrade to static content, and D-33's `unavailable` render is the intended
  // result rather than a fault. A *failure to degrade* still shows up here as a
  // React error, which is the case worth catching.
  /Failed to load resource: the server responded with a status of 401/,
  /supabaseUrl is required/,
]

/**
 * The site ships no favicon — there is no `public/` directory and no icon in the
 * root layout — so every page load 404s on `/favicon.ico`. That is a real gap,
 * recorded in D-55 rather than papered over, but it is a missing asset and not a
 * broken page, and left unfiltered it would fail this gate on every route
 * forever, which is how a console-error gate gets deleted.
 *
 * Filtered by PATH, not by status: a bare "404" ignore would swallow a genuinely
 * missing script or stylesheet, which is exactly what this gate is for.
 */
function isMissingFavicon(message: ConsoleMessage): boolean {
  if (!/status of 404/.test(message.text())) return false
  // Chrome reports the failing resource's URL as the message location for
  // network errors, which is what lets this stay path-scoped.
  return /favicon/i.test(message.location().url ?? '')
}

function isIgnorable(message: ConsoleMessage): boolean {
  return IGNORED.some((pattern) => pattern.test(message.text())) || isMissingFavicon(message)
}

for (const route of PUBLIC_ROUTES) {
  test(`no console errors on ${route}`, async ({ page }) => {
    const errors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error' && !isIgnorable(message)) {
        errors.push(message.text())
      }
    })
    // An uncaught exception never reaches `console`, so it needs its own hook —
    // and it is strictly worse than a logged error.
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

    const response = await page.goto(route, { waitUntil: 'networkidle' })
    expect(response?.status(), `${route} must render`).toBeLessThan(400)

    expect(errors, `${route} logged browser errors:\n${errors.join('\n')}`).toEqual([])
  })
}

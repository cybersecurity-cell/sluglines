import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Browser-level tests for the public surface — issue #35.
 *
 * WHAT THIS IS, AND WHAT WAS DELIBERATELY NOT PORTED
 * ---------------------------------------------------------------------------
 * The `codex/phase-1` snapshot carried five spec files. Two of them drive an
 * email/password auth journey this application does not have and will not have —
 * identity is phone OTP (D-36) — and #24 disabled the test-number ranges that
 * would have been the only way to drive OTP in CI. Porting those would have been
 * porting a harness for a different application, so #11 decided: port the idea,
 * not the files. What remains is the half that needs no session.
 *
 * WHY IT RUNS AGAINST A BUILT APP
 * ---------------------------------------------------------------------------
 * `next start`, not `next dev`. Hydration errors, the `dynamic`/`revalidate`
 * settings on the API routes, and the middleware matcher all behave differently
 * in dev, and the whole point of a browser test here is to see what a commuter
 * sees. The `webServer` block builds first unless a server is already listening.
 *
 * WHY NOT AGAINST A DEPLOYMENT
 * ---------------------------------------------------------------------------
 * There is no publicly reachable URL (#47): every `.vercel.app` alias requires a
 * Vercel login. Running locally is not a workaround here so much as the only
 * option, and it is also the faster gate. `scripts/verify-legacy-routes.mjs`
 * remains the instrument that checks the real edge (#23).
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3210)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`

/**
 * Some sandboxes ship a pinned Chromium whose build number does not match the
 * one this `@playwright/test` expects, and cannot run `playwright install`. Point
 * at the preinstalled binary when it is there; otherwise leave `executablePath`
 * unset so Playwright resolves its own download, which is what CI does after
 * `npx playwright install --with-deps chromium`.
 *
 * Resolved by globbing rather than hard-coding a build number, so a rebuilt image
 * with a different one keeps working.
 */
function preinstalledChromium(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (!root || !fs.existsSync(root)) return undefined

  const candidate = fs
    .readdirSync(root)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse()
    .map((name) => `${root}/${name}/chrome-linux/chrome`)
    .find((binary) => fs.existsSync(binary))

  return candidate
}

const executablePath = preinstalledChromium()

export default defineConfig({
  testDir: './tests/e2e',
  // The suite makes assertions about console output and about what rendered; a
  // retry would mask a genuine hydration error as a flake.
  retries: 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    // A redirect under test must be observed, not chased — the same discipline
    // as verify-legacy-routes.mjs. Specs that follow a link opt in explicitly.
    ignoreHTTPSErrors: false,
  },

  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    // §10's budget is a phone on throttled 4G in a parking lot, so the mobile
    // viewport is not a nice-to-have second opinion — it is the primary one.
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
  ],

  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})

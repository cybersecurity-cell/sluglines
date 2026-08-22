import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The §10 WCAG AA pass, which rev. 6 §17 still records as "partially open"
 * (issue #35).
 *
 * WHAT THIS ADDS THAT THE EXISTING GATES DO NOT
 * ---------------------------------------------------------------------------
 * `tests/theme-contrast.test.mjs` checks 22 token pairs in both palettes, and
 * the Lighthouse job scores a11y ≥95 on two routes. Both are real, and neither
 * looks at the rendered accessibility tree: contrast tokens can all pass while a
 * `dl` is malformed, a control has no accessible name, or a heading level is
 * skipped. That last class is exactly what bit `SpotQuickFacts` before — it
 * scored `definition-list` and `dlitem` failures with perfectly good contrast.
 *
 * Scoped to `wcag2a` + `wcag2aa`, which is what §10 actually commits to. Running
 * the full ruleset would fail on best-practice findings the spec does not claim,
 * and a gate that fails for reasons nobody agreed to is a gate that gets
 * disabled.
 */

const ROUTES = ['/', '/spots', '/spots/Horner-Rd', '/how-it-works', '/login']

for (const route of ROUTES) {
  test(`${route} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Named in the failure rather than just counted: "3 violations" sends the
    // reader to a report they have to go and find, which is how a11y failures
    // get triaged into never.
    const summary = results.violations
      .map((v) => `${v.id} (${v.impact}) — ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
      .join('\n')

    expect(results.violations, `${route} has accessibility violations:\n${summary}`).toEqual([])
  })
}

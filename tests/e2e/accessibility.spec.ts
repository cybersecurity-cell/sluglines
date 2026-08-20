import { createRequire } from 'node:module'

import { expect, test } from '@playwright/test'

const axePath = createRequire(__filename).resolve('axe-core/axe.min.js')

for (const path of ['/', '/find', '/auth/sign-up', '/slugging-rules']) {
  test(`${path} has no browser axe violations`, async ({ page }) => {
    await page.goto(path)
    await page.addScriptTag({ path: axePath })
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run(): Promise<{ violations: unknown[] }> } }).axe
      return (await axe.run()).violations
    })
    expect(violations).toEqual([])
  })
}

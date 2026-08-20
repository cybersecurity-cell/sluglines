import { expect, test } from '@playwright/test'

for (const path of ['/', '/find', '/locations', '/advisories', '/how-it-works', '/slugging-rules', '/community', '/auth/sign-in', '/auth/sign-up', '/report']) {
  test(`${path} loads without browser errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`))

    const response = await page.goto(path)
    expect(response?.ok()).toBeTruthy()
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
}

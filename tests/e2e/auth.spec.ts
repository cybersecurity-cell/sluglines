import { expect, test } from '@playwright/test'

test('sign-up and sign-in forms expose safe browser hints', async ({ page }) => {
  await page.goto('/auth/sign-up')
  await expect(page.getByLabel('Display name')).toHaveAttribute('autocomplete', 'name')
  await expect(page.getByLabel('Email address')).toHaveAttribute('autocomplete', 'email')
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'new-password')
  await page.goto('/auth/sign-in')
  await expect(page.getByRole('link', { name: /forgot your password/i })).toBeVisible()
})

test('private pages send anonymous visitors to sign in', async ({ page }) => {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=/)
  await page.goto('/report')
  await expect(page.locator('#main-content').getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('invalid verification callbacks fail closed', async ({ page }) => {
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/auth\/sign-in\?message=/)
  await expect(page.locator('p[role="alert"]')).toContainText(/invalid or expired/i)
})

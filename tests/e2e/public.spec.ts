import { expect, test } from '@playwright/test'

test('homepage presents the information-first journey', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /plan your slugging commute/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Find a line', exact: true }).first()).toBeVisible()
  await expect(page.getByText(/live rider/i)).toHaveCount(0)
  await expect(page.getByText(/mobile app/i)).toHaveCount(0)
})

test('location finder is labelled and keyboard usable', async ({ page }) => {
  await page.goto('/find')
  await page.getByLabel('Pickup area or destination').fill('Pentagon')
  await page.getByLabel('Corridor').selectOption('I-95/I-395')
  await page.getByRole('button', { name: 'Find locations' }).press('Enter')
  await expect(page).toHaveURL(/\/locations\?/) 
})

test('safety guidance exposes emergency boundaries', async ({ page }) => {
  await page.goto('/slugging-rules')
  await expect(page.getByText(/You can decline any ride/)).toBeVisible()
  await expect(page.getByText(/call 911/)).toBeVisible()
})

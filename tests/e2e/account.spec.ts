import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('registration gating, login, preferences, saves, corrections, logout, and reset', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'The stateful account journey runs once.')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!supabaseUrl || !serviceKey, 'A local Supabase service role is required.')

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const email = `commuter-${suffix}@example.test`
  const password = `Correct-horse-${suffix}!`

  await page.goto('/auth/sign-up')
  await page.getByLabel('Display name').fill('Test Commuter')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/auth\/verify/)
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  await page.goto('/auth/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')

  const headers = { apikey: serviceKey!, authorization: `Bearer ${serviceKey}` }
  let userId = ''
  await expect(async () => {
    const response = await request.get(`${supabaseUrl}/auth/v1/admin/users`, { headers })
    expect(response.ok()).toBeTruthy()
    const payload = await response.json() as { users: Array<{ id: string; email?: string }> }
    userId = payload.users.find((user) => user.email === email)?.id ?? ''
    expect(userId).not.toBe('')
  }).toPass({ timeout: 10_000 })

  const confirmation = await request.put(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers,
    data: { email_confirm: true },
  })
  expect(confirmation.ok()).toBeTruthy()

  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account/)
  await expect(page.getByRole('heading', { name: 'Your Sluglines' })).toBeVisible()

  await page.getByLabel('Home pickup location').selectOption({ label: 'Horner Road' })
  await page.getByLabel('Preferred destination').selectOption({ label: 'Pentagon' })
  await page.getByLabel(/Email me about published advisories/).check()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByRole('status')).toContainText('Commute preferences saved.')

  await page.goto('/locations/horner-road')
  await page.getByRole('button', { name: 'Save to my locations' }).click()
  await expect(page).toHaveURL(/\/account/)
  await expect(page.getByRole('link', { name: 'Horner Road' })).toBeVisible()

  await page.goto('/report')
  await page.getByLabel('Location, if applicable').selectOption({ label: 'Horner Road' })
  await page.getByLabel('What needs correction?').selectOption('parking')
  await page.getByLabel('Short summary').fill('Parking sign needs a current review')
  await page.getByLabel('What changed, and how can it be checked?').fill('A current on-site sign should be checked by an editor before this detail is changed.')
  await page.getByRole('button', { name: 'Report a correction' }).click()
  await expect(page.getByRole('status')).toContainText('submitted for review')

  await page.goto('/account')
  await expect(page.getByText('Parking sign needs a current review')).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/auth/forgot-password')
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('alert')).toContainText('If that address has an account')

  const admin = createClient(supabaseUrl!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  const callback = 'http://127.0.0.1:3000/auth/callback?next=%2Fauth%2Freset-password'
  const { data: recovery, error: recoveryError } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: callback } })
  expect(recoveryError).toBeNull()
  const actionLink = recovery.properties?.action_link
  expect(actionLink).toBeTruthy()
  await page.goto(actionLink!)
  await expect(page).toHaveURL(/\/auth\/reset-password/)
  const newPassword = `New-correct-horse-${suffix}!`
  await page.getByLabel('Password').fill(newPassword)
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByRole('alert')).toContainText('Your password has been updated.')

  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(newPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account/)
})

import { test as base, expect } from '@playwright/test'

// E2E tests run against the real Supabase auth (PKCE) used by the app.
// Provide a test advisor account via environment variables:
//   E2E_EMAIL, E2E_PASSWORD
// Without them, authenticated tests are skipped with a clear reason.

export const E2E_EMAIL = process.env.E2E_EMAIL
export const E2E_PASSWORD = process.env.E2E_PASSWORD

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  page: async ({ page }, use, testInfo) => {
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      testInfo.skip(true, 'E2E_EMAIL / E2E_PASSWORD not set — provide a test advisor account')
    }
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(E2E_EMAIL!)
    await page.getByLabel(/wachtwoord/i).fill(E2E_PASSWORD!)
    await page.getByRole('button', { name: /log in|inloggen/i }).click()
    await expect(page).toHaveURL(/assistants|command-center/, { timeout: 30_000 })
    await use(page)
  },
})

export { expect }
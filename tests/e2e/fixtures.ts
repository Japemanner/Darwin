/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture `use` is a callback argument, not a React hook */
import { test as base, expect } from '@playwright/test'

// E2E tests run against the real Supabase auth (PKCE) used by the app.
// Provide test accounts via environment variables:
//   E2E_EMAIL, E2E_PASSWORD                — beheerder (role=admin), default page fixture
//   E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD  — adviseur (role=member), memberPage fixture
// Without them, the matching tests are skipped with a clear reason.

export const E2E_EMAIL = process.env.E2E_EMAIL
export const E2E_PASSWORD = process.env.E2E_PASSWORD
export const E2E_MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL
export const E2E_MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.getByLabel(/wachtwoord/i).fill(password)
  await page.getByRole('button', { name: /log in|inloggen/i }).click()
  await expect(page).toHaveURL(/assistants|command-center/, { timeout: 30_000 })
}

// memberPage is defined on a separate extend chain so it resolves against the
// pristine `page` fixture — the admin override below must not run (and require
// E2E_EMAIL/E2E_PASSWORD) for member tests.
const memberBase = base.extend({
  memberPage: async ({ page }, use, testInfo) => {
    if (!E2E_MEMBER_EMAIL || !E2E_MEMBER_PASSWORD) {
      testInfo.skip(true, 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — provide a test member account (profiles.role = member)')
    }
    await login(page, E2E_MEMBER_EMAIL!, E2E_MEMBER_PASSWORD!)
    await use(page)
  },
})

export const test = memberBase.extend({
  page: async ({ page }, use, testInfo) => {
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      testInfo.skip(true, 'E2E_EMAIL / E2E_PASSWORD not set — provide a test admin account')
    }
    await login(page, E2E_EMAIL!, E2E_PASSWORD!)
    await use(page)
  },
})

export { expect }
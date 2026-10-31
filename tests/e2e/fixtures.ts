/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture `use` is a callback argument, not a React hook */
import { test as base, expect } from '@playwright/test'

// E2E tests run against the real Supabase auth (PKCE) used by the app.
// Provide test accounts via environment variables:
//   E2E_EMAIL, E2E_PASSWORD                — beheerder (role=admin), default page fixture
//   E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD  — adviseur (role=member), memberPage fixture
//   E2E_PLATFORM_ADMIN_EMAIL/PASSWORD     — platformbeheerder, platformAdminPage fixture
//   E2E_TEST_ORG_NAME                     — organisatie voor schakeltests
// Without them, the matching tests are skipped with a clear reason.

export const E2E_EMAIL = process.env.E2E_EMAIL
export const E2E_PASSWORD = process.env.E2E_PASSWORD
export const E2E_MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL
export const E2E_MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD
export const E2E_PLATFORM_ADMIN_EMAIL = process.env.E2E_PLATFORM_ADMIN_EMAIL
export const E2E_PLATFORM_ADMIN_PASSWORD = process.env.E2E_PLATFORM_ADMIN_PASSWORD
export const E2E_TEST_ORG_NAME = process.env.E2E_TEST_ORG_NAME

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.getByLabel(/wachtwoord/i).fill(password)
  await page.getByRole('button', { name: /log in|inloggen/i }).click()
  await expect(page).toHaveURL(/assistants|command-center/, { timeout: 30_000 })
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      testInfo.skip(true, 'E2E_EMAIL / E2E_PASSWORD not set — provide a test admin account')
    }
    await login(page, E2E_EMAIL!, E2E_PASSWORD!)
    await use(page)
  },
  // memberPage opens its own tab on the default context instead of depending on
  // `page`: the admin override above must not run (and require E2E_EMAIL) for
  // member tests. The default context still carries the file-level `test.use`
  // options, such as `permissions: ['notifications']`.
  memberPage: async ({ context }, use, testInfo) => {
    if (!E2E_MEMBER_EMAIL || !E2E_MEMBER_PASSWORD) {
      testInfo.skip(
        true,
        'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — provide a test member account (profiles.role = member)',
      )
    }
    const page = await context.newPage()
    await login(page, E2E_MEMBER_EMAIL!, E2E_MEMBER_PASSWORD!)
    await use(page)
  },
  // platformAdminPage is a separate tab so platform-admin tests do not depend
  // on the office-admin credentials above.
  platformAdminPage: async ({ context }, use, testInfo) => {
    if (!E2E_PLATFORM_ADMIN_EMAIL || !E2E_PLATFORM_ADMIN_PASSWORD) {
      testInfo.skip(
        true,
        'E2E_PLATFORM_ADMIN_EMAIL / E2E_PLATFORM_ADMIN_PASSWORD not set — provide a platform administrator account',
      )
    }
    const page = await context.newPage()
    await login(page, E2E_PLATFORM_ADMIN_EMAIL!, E2E_PLATFORM_ADMIN_PASSWORD!)
    await use(page)
  },
})

export { expect }

import type { Locator, Page } from '@playwright/test'
import { test, expect, E2E_PLATFORM_ADMIN_EMAIL, E2E_TEST_ORG_NAME } from './fixtures'

// Feature 019 — platform management (specs/019-platform-assistant-catalog).
// Login and data are real; only the office-admin modal test mocks REST
// responses so it does not depend on production catalog content.
// Every switch test restores the original state in a finally block.

const SAME_ACCOUNT_AS_PLATFORM_ADMIN =
  !!E2E_PLATFORM_ADMIN_EMAIL && E2E_PLATFORM_ADMIN_EMAIL === process.env.E2E_EMAIL

const ORG_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'
const CATALOG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const ORG_ASSISTANT = {
  id: '55555555-5555-4555-8555-555555555555',
  organization_id: ORG_ID,
  catalog_id: CATALOG_ID,
  name: 'Actieve Klantenservice',
  description: null,
  system_prompt: 'GEHEIM-SYSTEEMPROMPT-123',
  icon: '💬',
  type: 'chat',
  n8n_webhook_url: null,
  example_questions: [] as string[],
  is_active: true,
  created_by: USER_ID,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

async function openTestOrganization(page: Page, name: string) {
  await page.goto('/settings')
  await page.getByRole('button', { name }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('switch').first()).toBeVisible()
}

async function setSwitchState(sw: Locator, target: 'true' | 'false') {
  await expect(sw).toBeEnabled()
  if ((await sw.getAttribute('aria-checked')) !== target) {
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', target)
    await expect(sw).toBeEnabled()
  }
}

test.describe('platform-admin — toegang', () => {
  test('kantoorbeheerder ziet Instellingen niet en krijgt Geen toegang', async ({ page }) => {
    test.skip(
      SAME_ACCOUNT_AS_PLATFORM_ADMIN,
      'E2E_EMAIL is the platform admin account — use a separate office-admin account',
    )

    await page.goto('/assistants')
    await expect(page.getByRole('link', { name: /^instellingen$/i })).toHaveCount(0)

    await page.goto('/settings')
    await expect(page.getByText('Geen toegang')).toBeVisible()
  })
})

test.describe('platform-admin — koppelingen', () => {
  test('de dialoog Koppelingen toont het secret nooit', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/settings')
    await platformAdminPage.getByRole('button', { name: 'Koppelingen' }).click()

    await expect(platformAdminPage.getByRole('heading', { name: 'Koppelingen' })).toBeVisible()
    await expect(platformAdminPage.getByText('Deze instellingen gelden voor alle organisaties.')).toBeVisible()

    // The secret field is always empty: the stored token is never sent back.
    const secret = platformAdminPage.getByLabel('Secret')
    await expect(secret).toHaveValue('')
    await expect(secret).toHaveAttribute(
      'placeholder',
      /Secret is ingesteld; laat leeg om te behouden|Voer het secret in/,
    )
  })
})

test.describe('platform-admin — schakelaar', () => {
  test('de schakelaar is met Tab en Spatie te bedienen', async ({ platformAdminPage }) => {
    test.skip(!E2E_TEST_ORG_NAME, 'E2E_TEST_ORG_NAME not set')

    await openTestOrganization(platformAdminPage, E2E_TEST_ORG_NAME!)

    // Start at the back button; the first focusable element after it is the
    // first assistant switch (the tile text is not focusable).
    await platformAdminPage.getByRole('button', { name: /terug naar organisaties/i }).focus()
    await platformAdminPage.keyboard.press('Tab')
    const firstSwitch = platformAdminPage.getByRole('switch').first()
    await expect(firstSwitch).toBeFocused()

    const label = (await firstSwitch.getAttribute('aria-label')) ?? ''
    expect(label).toContain(`voor ${E2E_TEST_ORG_NAME}`)
    const original = ((await firstSwitch.getAttribute('aria-checked')) ?? 'true') as 'true' | 'false'

    try {
      await platformAdminPage.keyboard.press('Space')
      await expect(firstSwitch).toHaveAttribute(
        'aria-checked',
        original === 'true' ? 'false' : 'true',
      )
    } finally {
      const sw = platformAdminPage.getByRole('switch', { name: label, exact: true })
      await setSwitchState(sw, original)
    }
  })

  test('uitzetten verbergt de assistent voor een lid van de organisatie', async ({ platformAdminPage, memberPage }) => {
    test.skip(!E2E_TEST_ORG_NAME, 'E2E_TEST_ORG_NAME not set')

    await openTestOrganization(platformAdminPage, E2E_TEST_ORG_NAME!)

    const enabledSwitch = platformAdminPage.getByRole('switch', { checked: true }).first()
    if ((await enabledSwitch.count()) === 0) {
      test.skip(true, `No enabled assistant for ${E2E_TEST_ORG_NAME}`)
    }

    const label = (await enabledSwitch.getAttribute('aria-label')) ?? ''
    const assistantName = label.split(' voor ')[0]
    expect(assistantName).toBeTruthy()

    try {
      await enabledSwitch.click()
      await expect(enabledSwitch).toHaveAttribute('aria-checked', 'false')
      await expect(enabledSwitch).toBeEnabled()

      await memberPage.goto('/assistants')
      await expect(memberPage.getByText(assistantName, { exact: true })).toHaveCount(0)
    } finally {
      const sw = platformAdminPage.getByRole('switch', { name: label, exact: true })
      await setSwitchState(sw, 'true')
    }
  })
})

test.describe('platform-admin — kantoorbeheerder-modal', () => {
  test('kantoorbeheerder ziet in de assistentmodal alleen kennisbronnen', async ({ page }) => {
    test.skip(
      SAME_ACCOUNT_AS_PLATFORM_ADMIN,
      'E2E_EMAIL is the platform admin account — use a separate office-admin account',
    )

    await page.route('**/rest/v1/rpc/is_platform_admin', (route) =>
      route.fulfill({ json: false }),
    )
    await page.route('**/rest/v1/ai_assistants*', (route) =>
      route.fulfill({ json: [ORG_ASSISTANT] }),
    )
    await page.route('**/rest/v1/assistant_knowledge_bases*', (route) =>
      route.fulfill({ json: [] }),
    )
    await page.route('**/rest/v1/knowledge_bases*', (route) =>
      route.fulfill({ json: [] }),
    )

    await page.goto('/assistants')
    await expect(page.getByText(ORG_ASSISTANT.name)).toBeVisible()
    await expect(page.getByRole('button', { name: /nieuwe assistent/i })).toHaveCount(0)

    await page.locator('button:has(svg.lucide-pencil)').first().click()

    await expect(
      page.getByRole('heading', { name: `Kennisbronnen voor ${ORG_ASSISTANT.name}` }),
    ).toBeVisible()
    await expect(page.getByText('Wijzigingen gelden voor alle organisaties.')).toHaveCount(0)
    await expect(page.getByLabel(/n8n webhook url/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /verwijderen/i })).toHaveCount(0)
    await expect(page.getByText('Actief', { exact: true })).toHaveCount(0)
  })
})

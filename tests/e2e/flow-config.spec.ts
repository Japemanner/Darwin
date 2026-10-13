import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 009 — flow-config edge function (write-only webhook token).
// All flow-config calls are mocked; no real configuration is written.

const GET_WITH_TOKEN = {
  flow_type: 'rag_chat',
  webhook_url: 'https://n8n.example.com/webhook/rag-chat',
  webhook_auth_header: 'X-Webhook-Token',
  has_token: true,
}

const GET_EMPTY = {
  flow_type: 'rag_chat',
  webhook_url: '',
  webhook_auth_header: 'X-Webhook-Token',
  has_token: false,
}

interface CapturedRequest {
  action?: string
  flow_type?: string
  webhook_url?: string
  webhook_token?: string
  [key: string]: unknown
}

async function mockFlowConfig(page: Page, responses: {
  get: unknown
  save?: unknown
  test?: unknown
}, captured: { save?: CapturedRequest; test?: CapturedRequest }) {
  await page.route('**/functions/v1/flow-config', async (route) => {
    const body = route.request().postDataJSON() as CapturedRequest
    if (body.action === 'get') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses.get) })
    } else if (body.action === 'save') {
      captured.save = body
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses.save ?? { ok: true, has_token: true }) })
    } else if (body.action === 'test') {
      captured.test = body
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses.test ?? { ok: true, status: 200, message: 'Verbinding geslaagd! De webhook is bereikbaar en accepteert verzoeken.' }) })
    } else {
      await route.fulfill({ status: 400, body: '' })
    }
  })
}

test.describe('flow-config — get (write-only token)', () => {
  test('shows "Token is ingesteld" placeholder and never a token value', async ({ page }) => {
    await mockFlowConfig(page, { get: GET_WITH_TOKEN }, {})
    await page.goto('/settings')

    const tokenField = page.getByLabel(/webhook token/i).first()
    await expect(tokenField).toHaveValue('')
    await expect(tokenField).toHaveAttribute('placeholder', /token is ingesteld/i)
  })

  test('shows an empty form when no configuration exists yet', async ({ page }) => {
    await mockFlowConfig(page, { get: GET_EMPTY }, {})
    await page.goto('/settings')

    await expect(page.getByRole('button', { name: /configuratie aanmaken/i }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByLabel(/webhook url/i).first()).toHaveValue('')
  })
})

test.describe('flow-config — save', () => {
  test('empty token field means the body carries no webhook_token', async ({ page }) => {
    const captured: { save?: CapturedRequest } = {}
    await mockFlowConfig(page, { get: GET_WITH_TOKEN }, captured)
    await page.goto('/settings')

    await expect(page.getByLabel(/webhook url/i).first()).toHaveValue(GET_WITH_TOKEN.webhook_url)
    await page.getByRole('button', { name: /bijwerken/i }).first().click()

    await expect(page.getByText(/succesvol opgeslagen/i)).toBeVisible({ timeout: 15_000 })
    expect(captured.save).toBeTruthy()
    expect(captured.save!.action).toBe('save')
    expect(captured.save!.flow_type).toBe('rag_chat')
    expect('webhook_token' in captured.save!).toBe(false)
  })

  test('typed token is sent as plaintext over HTTPS', async ({ page }) => {
    const captured: { save?: CapturedRequest } = {}
    await mockFlowConfig(page, { get: GET_WITH_TOKEN }, captured)
    await page.goto('/settings')

    await page.getByLabel(/webhook token/i).first().fill('n8n-token-123')
    await page.getByRole('button', { name: /bijwerken/i }).first().click()

    await expect(page.getByText(/succesvol opgeslagen/i)).toBeVisible({ timeout: 15_000 })
    expect(captured.save!.webhook_token).toBe('n8n-token-123')
  })
})

test.describe('flow-config — test', () => {
  test('shows the Dutch test result in the result box', async ({ page }) => {
    const captured: { test?: CapturedRequest } = {}
    await mockFlowConfig(page, {
      get: GET_WITH_TOKEN,
      test: { ok: false, status: 401, message: 'Authenticatiefout (401). Controleer of het token en de header naam overeenkomen met de n8n webhook instellingen.' },
    }, captured)
    await page.goto('/settings')

    await expect(page.getByLabel(/webhook url/i).first()).toHaveValue(GET_WITH_TOKEN.webhook_url)
    await page.getByRole('button', { name: /verbinding testen/i }).first().click()

    await expect(page.getByText(/authenticatiefout \(401\)/i)).toBeVisible({ timeout: 15_000 })
    expect(captured.test!.action).toBe('test')
  })

  test('refuses an n8n test-URL with the Dutch explanation', async ({ page }) => {
    await mockFlowConfig(page, {
      get: GET_WITH_TOKEN,
      test: { ok: false, status: 0, message: 'Dit is een n8n test-URL (/webhook-test/). Gebruik de productie-URL (/webhook/) voor live assistenten.' },
    }, {})
    await page.goto('/settings')

    await page.getByLabel(/webhook url/i).first().fill('https://n8n.example.com/webhook-test/rag-chat')
    await page.getByRole('button', { name: /verbinding testen/i }).first().click()

    await expect(page.getByText(/dit is een n8n test-url/i)).toBeVisible({ timeout: 15_000 })
  })

  test('refuses a different URL with an empty token field (no token exfiltration)', async ({ page }) => {
    await mockFlowConfig(page, {
      get: GET_WITH_TOKEN,
      test: { ok: false, status: 0, message: 'Voer het token in om een andere URL te testen.' },
    }, {})
    await page.goto('/settings')

    await page.getByLabel(/webhook url/i).first().fill('https://n8n.attacker.example.com/webhook/rag-chat')
    await page.getByRole('button', { name: /verbinding testen/i }).first().click()

    await expect(page.getByText(/voer het token in om een andere url te testen/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.skip('members do not see the config form (admin-only UI gate)', async () => {
  // Requires a member test account (E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD,
  // planned in verbeterplan feature B). Expected behavior: the Webhooks tab
  // shows the "Geen toegang" card instead of the FlowConfigCard for
  // profile.role !== 'admin'.
})
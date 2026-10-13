import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 009 — rag-chat edge function proxy.
// All calls to the rag-chat edge function and to the conversations/messages
// REST endpoints are mocked so no test data is written to production Supabase.
// Requires a chat-type assistant for the E2E account.

const CONV_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'e2e-user',
  assistant_id: 'e2e-assistant',
  title: 'Chat met E2E',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const RAG_SUCCESS = {
  answer: 'Ja, parttime medewerkers krijgen vakantiedagen naar rato van hun contracturen.',
  sources: [
    { knowledge_item_id: 'kb-item-1', title: 'Personeelshandboek', excerpt: 'Vakantiedagen naar rato…', score: 0.92 },
  ],
  verification: { grounded: true, confidence: 0.9, issues: [] },
  rewritten_query: 'vakantiedagen parttime regeling',
}

interface RagChatRequestBody {
  assistant_id?: string
  conversation_id?: string
  message?: string
  [key: string]: unknown
}

async function mockChatRest(page: Page) {
  await page.route('**/rest/v1/conversations**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([CONV_ROW]) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
  })
  await page.route('**/rest/v1/messages**', async (route) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([]) })
  })
}

async function openChatAndAsk(page: Page, question: string) {
  await page.goto('/assistants')
  await page.getByRole('button', { name: /^chat$/i }).first().click()
  const input = page.getByPlaceholder('Typ je bericht...')
  await input.fill(question)
  await input.press('Enter')
}

function mockRagChat(page: Page, status: number, body: unknown) {
  return page.route('**/functions/v1/rag-chat', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('rag-chat — happy path', () => {
  test('renders answer and sources via the edge function only', async ({ page }) => {
    await mockChatRest(page)
    let edgeBody: RagChatRequestBody | null = null
    const hosts = new Set<string>()
    page.on('request', (req) => hosts.add(new URL(req.url()).host))

    await page.route('**/functions/v1/rag-chat', async (route) => {
      edgeBody = route.request().postDataJSON() as RagChatRequestBody
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAG_SUCCESS) })
    })

    await openChatAndAsk(page, 'Geldt dat ook voor parttime medewerkers?')

    await expect(page.getByText(RAG_SUCCESS.answer)).toBeVisible({ timeout: 15_000 })

    // Sources still render including the score badge (unchanged UI)
    await page.getByRole('button', { name: /bronnen \(1\)/i }).click()
    await expect(page.getByText('Personeelshandboek')).toBeVisible()
    await expect(page.getByText('92%')).toBeVisible()

    // Request body contains only ids + message (FR-002: no tenant decisions in the browser)
    expect(edgeBody).not.toBeNull()
    expect(Object.keys(edgeBody!).sort()).toEqual(['assistant_id', 'conversation_id', 'message'])
    expect(edgeBody!.message).toBe('Geldt dat ook voor parttime medewerkers?')

    // SC-002: no request left the browser for an n8n/webhook host
    for (const host of hosts) {
      expect(host, `unexpected external host: ${host}`).toMatch(/supabase\.co|localhost|127\.0\.0\.1|posthog/i)
    }
  })
})

test.describe('rag-chat — Dutch error messages per code', () => {
  const cases: Array<{ code: string; status: number; title: RegExp; description: RegExp }> = [
    { code: 'UNAUTHORIZED', status: 401, title: /authenticatiefout/i, description: /sessie is verlopen/i },
    { code: 'FORBIDDEN', status: 403, title: /geen toegang/i, description: /geen toegang tot deze assistent/i },
    { code: 'NOT_CONFIGURED', status: 400, title: /configuratie ontbreekt/i, description: /geen koppeling geconfigureerd/i },
    { code: 'UPSTREAM_AUTH', status: 502, title: /verbindingsfout/i, description: /weigert de verbinding/i },
    { code: 'UPSTREAM_TIMEOUT', status: 502, title: /verbindingsfout/i, description: /niet binnen de toegestane tijd/i },
    { code: 'UPSTREAM_ERROR', status: 502, title: /verbindingsfout/i, description: /gaf een fout/i },
    { code: 'UPSTREAM_UNREACHABLE', status: 502, title: /verbindingsfout/i, description: /kon geen verbinding maken/i },
  ]

  for (const { code, status, title, description } of cases) {
    test(`shows Dutch toast for ${code}`, async ({ page }) => {
      await mockChatRest(page)
      await mockRagChat(page, status, { code, message: `Servertekst voor ${code}` })

      await openChatAndAsk(page, 'Testvraag')

      await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(description)).toBeVisible()
    })
  }

  test('shows a typed message for an invalid response body (no silent empty answer)', async ({ page }) => {
    await mockChatRest(page)
    await mockRagChat(page, 200, { unexpected: 'shape' })

    await openChatAndAsk(page, 'Testvraag')

    await expect(page.getByText(/fout bij versturen/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/ging iets mis bij het verwerken van het antwoord/i)).toBeVisible()
  })
})
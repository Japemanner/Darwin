import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 011 — rag-chat v2 edge function proxy via the chat page
// (specs/011-resumable-chat-page/contracts/rag-chat.md). All calls to the
// rag-chat edge function and to the Supabase REST endpoints are mocked so no
// test data is written to production Supabase. The messages mock mirrors the
// v2 server behavior (question persisted before the fetch, answer after
// upstream success). Without E2E_EMAIL/E2E_PASSWORD every test skips.

const ORG_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'
const ASSISTANT_ID = '55555555-5555-4555-8555-555555555555'
const CONV_ID = '11111111-1111-4111-8111-111111111111'
const USER_MSG_ID = '990e8400-e29b-41d4-a716-446655440009'
const ASSISTANT_MSG_ID = 'aa0e8400-e29b-41d4-a716-446655440010'

const ASSISTANT = {
  id: ASSISTANT_ID,
  organization_id: ORG_ID,
  name: 'E2E Assistent',
  description: 'Beantwoordt vragen over personeelsbeleid',
  system_prompt: '',
  icon: '🤖',
  type: 'chat',
  n8n_webhook_url: null,
  example_questions: [] as string[],
  is_active: true,
  created_by: USER_ID,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CONV_ROW = {
  id: CONV_ID,
  user_id: USER_ID,
  assistant_id: ASSISTANT_ID,
  title: 'Geldt dat ook voor parttime medewerkers?',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ai_assistants: {
    id: ASSISTANT_ID,
    name: ASSISTANT.name,
    icon: ASSISTANT.icon,
    description: ASSISTANT.description,
    example_questions: [] as string[],
    is_active: true,
    type: 'chat',
  },
}

const RAG_SUCCESS = {
  conversation_id: CONV_ID,
  user_message_id: USER_MSG_ID,
  assistant_message: {
    id: ASSISTANT_MSG_ID,
    content: 'Ja, parttime medewerkers krijgen vakantiedagen naar rato van hun contracturen.',
    sources: [
      { knowledge_item_id: 'kb-item-1', title: 'Personeelshandboek', excerpt: 'Vakantiedagen naar rato…', score: 0.92 },
    ],
    created_at: '2026-01-01T00:00:01Z',
  },
  verification: { grounded: true, confidence: 0.9, issues: [] },
  rewritten_query: 'vakantiedagen parttime regeling',
}

interface RagChatRequestBody {
  assistant_id?: string
  conversation_id?: string
  message_id?: string
  message?: string
  [key: string]: unknown
}

interface ChatServerState {
  question: string | null
  answer: string | null
}

async function mockChatRest(page: Page, server: ChatServerState) {
  await page.route('**/rest/v1/ai_assistants**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    const single = accept.includes('vnd.pgrst.object+json')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? ASSISTANT : [ASSISTANT]),
    })
  })
  await page.route('**/rest/v1/conversations**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    const single = accept.includes('vnd.pgrst.object+json')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? CONV_ROW : [CONV_ROW]),
    })
  })
  await page.route('**/rest/v1/messages**', async (route) => {
    const rows = [
      ...(server.question !== null
        ? [{ id: USER_MSG_ID, conversation_id: CONV_ID, role: 'user', content: server.question, sources: null, created_at: '2026-01-01T00:00:00Z' }]
        : []),
      ...(server.answer !== null
        ? [{ id: ASSISTANT_MSG_ID, conversation_id: CONV_ID, role: 'assistant', content: server.answer, sources: RAG_SUCCESS.assistant_message.sources, created_at: '2026-01-01T00:00:01Z' }]
        : []),
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await page.route('**/rest/v1/feedback_interactions**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
}

async function openNewChatAndAsk(page: Page, server: ChatServerState, question: string) {
  await mockChatRest(page, server)
  await page.goto(`/chat/new/${ASSISTANT_ID}`)
  const composer = page.getByLabel('Bericht')
  await composer.fill(question)
  await composer.press('Enter')
}

function mockRagChat(page: Page, server: ChatServerState, status: number, body: unknown) {
  return page.route('**/functions/v1/rag-chat', async (route) => {
    const requestBody = route.request().postDataJSON() as RagChatRequestBody
    server.question = requestBody?.message ?? null
    if (status === 200) {
      const parsed = body as typeof RAG_SUCCESS
      server.answer = parsed.assistant_message?.content ?? null
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('rag-chat — happy path', () => {
  test('renders answer and sources via the edge function only', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    let edgeBody: RagChatRequestBody | null = null
    const hosts = new Set<string>()
    page.on('request', (req) => hosts.add(new URL(req.url()).host))

    await page.route('**/functions/v1/rag-chat', async (route) => {
      edgeBody = route.request().postDataJSON() as RagChatRequestBody
      server.question = edgeBody?.message ?? null
      server.answer = RAG_SUCCESS.assistant_message.content
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAG_SUCCESS) })
    })

    await openNewChatAndAsk(page, server, 'Geldt dat ook voor parttime medewerkers?')

    await expect(page.getByText(RAG_SUCCESS.assistant_message.content)).toBeVisible({ timeout: 15_000 })

    // The conversation got its permanent address.
    await expect(page).toHaveURL(new RegExp(`/chat/${CONV_ID}$`))

    // Sources still render including the score badge (unchanged UI)
    await page.getByRole('button', { name: /bronnen \(1\)/i }).click()
    await expect(page.getByText('Personeelshandboek')).toBeVisible()
    await expect(page.getByText('92%')).toBeVisible()

    // Request body contains only ids + message (constitution III: no tenant
    // decisions in the browser, no client-generated conversation).
    expect(edgeBody).not.toBeNull()
    expect(Object.keys(edgeBody!).sort()).toEqual(['assistant_id', 'message', 'message_id'])
    expect(edgeBody!.message).toBe('Geldt dat ook voor parttime medewerkers?')

    // SC-002: no request left the browser for an n8n/webhook host
    for (const host of hosts) {
      expect(host, `unexpected external host: ${host}`).toMatch(/supabase\.co|localhost|127\.0\.0\.1|posthog/i)
    }
  })
})

test.describe('rag-chat — Dutch inline errors per code', () => {
  const cases: Array<{ code: string; status: number; text: RegExp }> = [
    { code: 'UNAUTHORIZED', status: 401, text: /sessie is verlopen/i },
    { code: 'FORBIDDEN', status: 403, text: /geen toegang tot deze assistent/i },
    { code: 'NOT_CONFIGURED', status: 400, text: /geen koppeling geconfigureerd/i },
    { code: 'UPSTREAM_AUTH', status: 502, text: /weigert de verbinding/i },
    { code: 'UPSTREAM_TIMEOUT', status: 502, text: /niet binnen de toegestane tijd/i },
    { code: 'UPSTREAM_ERROR', status: 502, text: /gaf een fout/i },
    { code: 'UPSTREAM_UNREACHABLE', status: 502, text: /kon geen verbinding maken/i },
  ]

  for (const { code, status, text } of cases) {
    test(`shows inline error with retry for ${code}`, async ({ page }) => {
      const server: ChatServerState = { question: null, answer: null }
      await mockRagChat(page, server, status, { code })
      await openNewChatAndAsk(page, server, 'Testvraag')

      await expect(page.getByRole('alert')).toContainText(text, { timeout: 15_000 })
      await expect(page.getByRole('button', { name: 'Opnieuw proberen' })).toBeVisible()
      // The question stays visible at the error (FR-008).
      await expect(page.getByText('Testvraag')).toBeVisible()
    })
  }

  test('shows a typed message for an invalid response body (no silent empty answer)', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await mockRagChat(page, server, 200, { unexpected: 'shape' })
    await openNewChatAndAsk(page, server, 'Testvraag')

    await expect(page.getByRole('alert')).toContainText(/ging iets mis bij het verwerken van het antwoord/i, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Opnieuw proberen' })).toBeVisible()
  })
})
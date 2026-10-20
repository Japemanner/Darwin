import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 011 — chat page with resumable conversations (v2 rag-chat contract,
// specs/011-resumable-chat-page/contracts/rag-chat.md). All Supabase REST
// routes and the rag-chat edge function are mocked via page.route, so no test
// data is written to production Supabase. The messages mock mirrors the v2
// server behavior: after a successful (or failed-but-persisted) turn the
// question, and after a successful answer the answer, are persisted.
// Without E2E_EMAIL/E2E_PASSWORD every test skips with a reason.

const ORG_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'
const ASSISTANT_ID = '55555555-5555-4555-8555-555555555555'
const CONV_ID = '11111111-1111-4111-8111-111111111111'
const USER_MSG_ID = '990e8400-e29b-41d4-a716-446655440009'
const ASSISTANT_MSG_ID = 'aa0e8400-e29b-41d4-a716-446655440010'

const ASSISTANT = {
  id: ASSISTANT_ID,
  organization_id: ORG_ID,
  name: 'Klantenservice',
  description: 'Beantwoordt vragen over polissen en schade',
  system_prompt: '',
  icon: '💬',
  type: 'chat',
  n8n_webhook_url: null,
  example_questions: ['Wat dekt mijn polis?', 'Hoe meld ik schade?'],
  is_active: true,
  created_by: USER_ID,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
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
    example_questions: ASSISTANT.example_questions,
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
    sources: [],
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

// Minimal server simulation shared by the rag-chat and messages mocks: the
// question is persisted before the answer is fetched (contract v2), the
// answer only after upstream success.
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
        ? [{ id: ASSISTANT_MSG_ID, conversation_id: CONV_ID, role: 'assistant', content: server.answer, sources: [], created_at: '2026-01-01T00:00:01Z' }]
        : []),
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await page.route('**/rest/v1/feedback_interactions**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
}

async function openNewChat(page: Page, server: ChatServerState) {
  await mockChatRest(page, server)
  await page.goto(`/chat/new/${ASSISTANT_ID}`)
}

async function ask(page: Page, question: string) {
  const composer = page.getByLabel('Bericht')
  await composer.fill(question)
  await composer.press('Enter')
}

test.describe('chat-page — permanent address and composer', () => {
  test('a new conversation gets the URL /chat/<uuid> after the first question', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    let edgeBody: RagChatRequestBody | null = null
    await page.route('**/functions/v1/rag-chat', async (route) => {
      edgeBody = route.request().postDataJSON() as RagChatRequestBody
      server.question = edgeBody?.message ?? null
      server.answer = RAG_SUCCESS.assistant_message.content
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAG_SUCCESS) })
    })

    await openNewChat(page, server)
    await ask(page, 'Geldt dat ook voor parttime medewerkers?')

    await expect(page.getByText(RAG_SUCCESS.assistant_message.content)).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(new RegExp(`/chat/${CONV_ID}$`))

    // First send has no conversation_id; ids only (constitution III).
    expect(edgeBody).not.toBeNull()
    expect(Object.keys(edgeBody!).sort()).toEqual(['assistant_id', 'message', 'message_id'])
    expect(edgeBody!.conversation_id).toBeUndefined()
    expect(edgeBody!.message).toBe('Geldt dat ook voor parttime medewerkers?')
  })

  test('Shift+Enter makes a new line, Enter sends', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await page.route('**/functions/v1/rag-chat', async (route) => {
      const body = route.request().postDataJSON() as RagChatRequestBody
      server.question = body?.message ?? null
      server.answer = RAG_SUCCESS.assistant_message.content
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAG_SUCCESS) })
    })

    await openNewChat(page, server)
    const composer = page.getByLabel('Bericht')
    await composer.fill('Eerste regel')
    await composer.press('Shift+Enter')
    await composer.type('Tweede regel')
    await expect(composer).toHaveValue('Eerste regel\nTweede regel')

    await composer.press('Enter')
    await expect(page.getByText(RAG_SUCCESS.assistant_message.content)).toBeVisible({ timeout: 15_000 })
    // The multi-line question is fully visible in the conversation.
    await expect(page.getByText('Tweede regel')).toBeVisible()
    // Focus returns to the composer after sending.
    await expect(composer).toBeFocused()
  })
})

test.describe('chat-page — failed answers and retry', () => {
  test('error → inline message → retry → answer appears with exactly one user message', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    const bodies: RagChatRequestBody[] = []
    let calls = 0
    await page.route('**/functions/v1/rag-chat', async (route) => {
      calls += 1
      const body = route.request().postDataJSON() as RagChatRequestBody
      bodies.push(body)
      server.question = body?.message ?? null
      if (calls === 1) {
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ code: 'UPSTREAM_ERROR' }) })
      } else {
        server.answer = RAG_SUCCESS.assistant_message.content
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAG_SUCCESS) })
      }
    })

    await openNewChat(page, server)
    await ask(page, 'Testvraag mislukt')

    // Inline error at the question with retry button — not a toast.
    await expect(page.getByRole('alert')).toContainText(/assistent-service gaf een fout/i, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Opnieuw proberen' })).toBeVisible()
    // The question stays visible.
    await expect(page.getByText('Testvraag mislukt')).toBeVisible()

    await page.getByRole('button', { name: 'Opnieuw proberen' }).click()

    await expect(page.getByText(RAG_SUCCESS.assistant_message.content)).toBeVisible({ timeout: 15_000 })
    // Exactly one user message in the conversation.
    await expect(page.getByText('Testvraag mislukt')).toHaveCount(1)
    // The retry reused the same message_id (and still no conversation_id).
    expect(bodies).toHaveLength(2)
    expect(bodies[1].message_id).toBe(bodies[0].message_id)
    expect(bodies[1].conversation_id).toBeUndefined()
  })
})

test.describe('chat-page — example questions', () => {
  test('clicking an example question sends it directly', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    let edgeBody: RagChatRequestBody | null = null
    await page.route('**/functions/v1/rag-chat', async (route) => {
      edgeBody = route.request().postDataJSON() as RagChatRequestBody
      server.question = edgeBody?.message ?? null
      server.answer = RAG_SUCCESS.assistant_message.content
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAG_SUCCESS) })
    })

    await openNewChat(page, server)

    await expect(page.getByRole('button', { name: ASSISTANT.example_questions[0] })).toBeVisible()
    await page.getByRole('button', { name: ASSISTANT.example_questions[0] }).click()

    await expect(page.getByText(RAG_SUCCESS.assistant_message.content)).toBeVisible({ timeout: 15_000 })
    expect(edgeBody).not.toBeNull()
    expect(edgeBody!.message).toBe(ASSISTANT.example_questions[0])
  })
})
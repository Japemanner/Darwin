import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 013 — readable, verifiable answers with CONCEPT label
// (specs/013-readable-verifiable-answers/spec.md). All Supabase REST routes
// and the rag-chat edge function are mocked via page.route, so no test data
// is written to production Supabase. Without E2E_EMAIL/E2E_PASSWORD every
// test skips with a reason.

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

// Markdown answer fixture: bold, list and table (no % — the source-buttons
// scenario asserts that no percentage appears anywhere in the chat).
const MARKDOWN_CONTENT =
  '**Kernpunten:**\n\n- Eerste punt\n- Tweede punt\n\n| Dekking | Bedrag |\n|---|---|\n| WIA | 500 euro |'

const XSS_PAYLOAD = '<img src=x onerror="window.__xssExecuted=1">'

interface RagChatRequestBody {
  assistant_id?: string
  conversation_id?: string
  message_id?: string
  message?: string
  [key: string]: unknown
}

// Mirrors the v2 server behavior: the question is persisted before the
// answer is fetched, the answer (with sources and verification) only after
// upstream success.
interface ChatServerState {
  question: string | null
  answer: string | null
  answerSources?: unknown[]
  answerVerification?: unknown
  // Explicit message rows for reload scenarios (verification jsonb on rows).
  rows?: unknown[]
}

function ragSuccess(overrides?: { content?: string; sources?: unknown[]; verification?: unknown }) {
  return {
    conversation_id: CONV_ID,
    user_message_id: USER_MSG_ID,
    assistant_message: {
      id: ASSISTANT_MSG_ID,
      content: overrides?.content ?? MARKDOWN_CONTENT,
      sources: overrides?.sources ?? [],
      created_at: '2026-01-01T00:00:01Z',
    },
    verification: overrides?.verification ?? { grounded: true, confidence: 0.9, issues: [] },
    rewritten_query: null,
  }
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
    const rows =
      server.rows ??
      [
        ...(server.question !== null
          ? [{ id: USER_MSG_ID, conversation_id: CONV_ID, role: 'user', content: server.question, sources: null, verification: null, created_at: '2026-01-01T00:00:00Z' }]
          : []),
        ...(server.answer !== null
          ? [{ id: ASSISTANT_MSG_ID, conversation_id: CONV_ID, role: 'assistant', content: server.answer, sources: server.answerSources ?? null, verification: server.answerVerification ?? null, created_at: '2026-01-01T00:00:01Z' }]
          : []),
      ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await page.route('**/rest/v1/feedback_interactions**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
}

function mockRagChat(page: Page, server: ChatServerState, body: unknown) {
  return page.route('**/functions/v1/rag-chat', async (route) => {
    const requestBody = route.request().postDataJSON() as RagChatRequestBody
    server.question = requestBody?.message ?? null
    const parsed = body as { assistant_message?: { content?: string } }
    server.answer = parsed.assistant_message?.content ?? null
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function openNewChatAndAsk(page: Page, server: ChatServerState, question: string) {
  await mockChatRest(page, server)
  await page.goto(`/chat/new/${ASSISTANT_ID}`)
  const composer = page.getByLabel('Bericht')
  await composer.fill(question)
  await composer.press('Enter')
}

test.describe('answer-presentation — markdown rendering (US1)', () => {
  test('renders markdown lists, bold and tables as formatted content', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await mockRagChat(page, server, ragSuccess())

    await openNewChatAndAsk(page, server, 'Geldt dat ook voor parttime medewerkers?')

    await expect(page.getByText('Eerste punt')).toBeVisible({ timeout: 15_000 })
    // Markdown renders as real elements: a list, bold text and table cells.
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await expect(page.getByText('Kernpunten:')).toBeVisible()
    await expect(page.getByText('**Kernpunten:**')).toHaveCount(0)
    await expect(page.getByText('Dekking')).toBeVisible()
    await expect(page.getByText('WIA')).toBeVisible()
  })

  test('does not execute injected HTML in the answer', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await mockRagChat(page, server, ragSuccess({ content: `Alstublieft. ${XSS_PAYLOAD}` }))

    await openNewChatAndAsk(page, server, 'Testvraag')

    await expect(page.getByText('Alstublieft.')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('img')).toHaveCount(0)
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).__xssExecuted),
    ).toBeUndefined()
  })
})

test.describe('answer-presentation — CONCEPT label (US2)', () => {
  test('shows the CONCEPT label under each answer', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await mockRagChat(page, server, ragSuccess())

    await openNewChatAndAsk(page, server, 'Geldt dat ook voor parttime medewerkers?')

    await expect(page.getByText('Eerste punt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('CONCEPT, door adviseur te accorderen')).toBeVisible()
  })
})

test.describe('answer-presentation — verification verdict (US3)', () => {
  test('shows a warning with issues when the answer is not grounded', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await mockRagChat(
      page,
      server,
      ragSuccess({
        verification: {
          grounded: false,
          confidence: 0.9,
          issues: ['De genoemde termijn komt niet in de bronnen voor'],
        },
      }),
    )

    await openNewChatAndAsk(page, server, 'Geldt dat ook voor parttime medewerkers?')

    await expect(
      page.getByText('Dit antwoord is niet volledig onderbouwd door de bronnen.'),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('De genoemde termijn komt niet in de bronnen voor')).toBeVisible()
    await expect(page.getByText('Gecontroleerd tegen de bronnen')).toHaveCount(0)
  })

  test('shows a warning when confidence is below the threshold', async ({ page }) => {
    const server: ChatServerState = { question: null, answer: null }
    await mockRagChat(
      page,
      server,
      ragSuccess({ verification: { grounded: true, confidence: 0.5, issues: [] } }),
    )

    await openNewChatAndAsk(page, server, 'Geldt dat ook voor parttime medewerkers?')

    await expect(
      page.getByText('Dit antwoord is niet volledig onderbouwd door de bronnen.'),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Gecontroleerd tegen de bronnen')).toHaveCount(0)
  })

  test('shows the verdict for reloaded answers and nothing for old ones', async ({ page }) => {
    const server: ChatServerState = {
      question: null,
      answer: null,
      rows: [
        { id: USER_MSG_ID, conversation_id: CONV_ID, role: 'user', content: 'Vraag één', sources: null, verification: null, created_at: '2026-01-01T00:00:00Z' },
        { id: ASSISTANT_MSG_ID, conversation_id: CONV_ID, role: 'assistant', content: MARKDOWN_CONTENT, sources: null, verification: { grounded: true, confidence: 0.9, issues: [] }, created_at: '2026-01-01T00:00:01Z' },
        { id: 'bb0e8400-e29b-41d4-a716-446655440020', conversation_id: CONV_ID, role: 'user', content: 'Vraag twee', sources: null, verification: null, created_at: '2026-01-01T00:00:02Z' },
        { id: 'cc0e8400-e29b-41d4-a716-446655440030', conversation_id: CONV_ID, role: 'assistant', content: 'Oud antwoord zonder verificatie.', sources: null, verification: null, created_at: '2026-01-01T00:00:03Z' },
      ],
    }
    await mockChatRest(page, server)
    await page.goto(`/chat/${CONV_ID}`)

    await expect(page.getByText('Eerste punt')).toBeVisible({ timeout: 15_000 })
    // One verdict line: only for the answer with stored verification.
    await expect(page.getByText('Gecontroleerd tegen de bronnen')).toHaveCount(1)
    await expect(page.getByText('Oud antwoord zonder verificatie.')).toBeVisible()
    // No error for messages without verification data (FR-007).
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 010 — admin-only management (specs/010-admin-only-management,
// contract: contracts/permissions-matrix.md §3 — SC-003/SC-005/SC-006).
// Only the REST data routes are mocked via page.route; the Supabase login
// from tests/e2e/fixtures.ts is real. Without E2E_EMAIL/E2E_PASSWORD (admin)
// or E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD (member) every test skips.

const ORG_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'

const MEMBER_PROFILE = {
  id: USER_ID,
  organization_id: ORG_ID,
  full_name: 'E2E Member',
  avatar_url: null,
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const ADMIN_PROFILE = { ...MEMBER_PROFILE, full_name: 'E2E Admin', role: 'admin' }

const ACTIVE_ASSISTANT = {
  id: '55555555-5555-4555-8555-555555555555',
  organization_id: ORG_ID,
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

const INACTIVE_ASSISTANT = {
  id: '66666666-6666-4666-8666-666666666666',
  organization_id: ORG_ID,
  name: 'Verborgen Risico Robot',
  description: 'Oude risico-analyseerbot',
  system_prompt: 'Je bent een risico-analyseur.',
  icon: '📋',
  type: 'risico_analyse',
  n8n_webhook_url: null,
  example_questions: [] as string[],
  is_active: false,
  created_by: USER_ID,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const KB_ROW = {
  id: '77777777-7777-4777-8777-777777777777',
  organization_id: ORG_ID,
  name: 'Polisvoorwaarden 2026',
  description: 'Alle geldige polisvoorwaarden',
  vector_collection_id: null,
  processing_mode: 'vectorized',
  created_by: USER_ID,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const READY_DOC = {
  id: '88888888-8888-4888-8888-888888888888',
  knowledge_base_id: KB_ROW.id,
  organization_id: ORG_ID,
  name: 'polis-klaar.pdf',
  file_path: `${ORG_ID}/${KB_ROW.id}/klaar.pdf`,
  file_type: 'pdf',
  file_size: 2048,
  status: 'ready',
  created_by: USER_ID,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const PROCESSING_DOC = {
  id: '99999999-9999-4999-8999-999999999999',
  knowledge_base_id: KB_ROW.id,
  organization_id: ORG_ID,
  name: 'polis-bezig.docx',
  file_path: `${ORG_ID}/${KB_ROW.id}/bezig.docx`,
  file_type: 'docx',
  file_size: 4096,
  status: 'processing',
  created_by: USER_ID,
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
}

const CONV_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: USER_ID,
  assistant_id: ACTIVE_ASSISTANT.id,
  title: 'Chat met Actieve Klantenservice',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const RAG_ANSWER = {
  conversation_id: CONV_ROW.id,
  user_message_id: '990e8400-e29b-41d4-a716-446655440009',
  assistant_message: {
    id: 'aa0e8400-e29b-41d4-a716-446655440010',
    content: 'Ja, volgens de polisvoorwaarden geldt dat.',
    sources: [] as unknown[],
    created_at: '2026-01-02T00:00:00Z',
  },
  verification: { grounded: true, confidence: 0.9, issues: [] },
  rewritten_query: 'polisvoorwaarden',
}

async function restful(page: Page, pattern: string, rows: unknown) {
  await page.route(pattern, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
}

async function mockRest(page: Page, opts: {
  profile: Record<string, unknown>
  assistants: unknown[]
  knowledgeBases: unknown[]
  documents?: unknown[]
  items?: unknown[]
}) {
  await page.route('**/rest/v1/profiles**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    const single = accept.includes('vnd.pgrst.object+json')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? opts.profile : [opts.profile]),
    })
  })
  // ai_assistants: list queries get the array, detail queries (.maybeSingle,
  // e.g. the chat page) get a single row matched on the requested id.
  await page.route('**/rest/v1/ai_assistants**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    const single = accept.includes('vnd.pgrst.object+json')
    if (single) {
      const url = new URL(route.request().url())
      const id = url.searchParams.get('id')?.replace('eq.', '')
      const row = opts.assistants.find((a) => (a as Record<string, unknown>).id === id) ?? null
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.assistants) })
    }
  })
  await restful(page, '**/rest/v1/knowledge_bases**', opts.knowledgeBases)
  await restful(page, '**/rest/v1/knowledge_base_documents**', opts.documents ?? [])
  await restful(page, '**/rest/v1/knowledge_items**', opts.items ?? [])
  await restful(page, '**/rest/v1/assistant_knowledge_bases**', [])
}

async function mockChat(page: Page) {
  // The v2 chat flow persists server-side; the browser only reads.
  await page.route('**/rest/v1/conversations**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    const single = accept.includes('vnd.pgrst.object+json')
    const detailRow = {
      ...CONV_ROW,
      ai_assistants: { id: ACTIVE_ASSISTANT.id, name: ACTIVE_ASSISTANT.name, icon: ACTIVE_ASSISTANT.icon, description: null, example_questions: [] as string[], is_active: true, type: 'chat' },
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? detailRow : [CONV_ROW]),
    })
  })
  await restful(page, '**/rest/v1/messages**', [])
  await restful(page, '**/rest/v1/feedback_interactions**', null)
  await restful(page, '**/functions/v1/rag-chat**', RAG_ANSWER)
}

async function mockMemberAssistants(page: Page) {
  await mockRest(page, {
    profile: MEMBER_PROFILE,
    assistants: [ACTIVE_ASSISTANT, INACTIVE_ASSISTANT],
    knowledgeBases: [],
  })
}

async function mockMemberKnowledge(page: Page) {
  await mockRest(page, {
    profile: MEMBER_PROFILE,
    assistants: [ACTIVE_ASSISTANT],
    knowledgeBases: [KB_ROW],
    documents: [READY_DOC, PROCESSING_DOC],
  })
}

async function mockAdminData(page: Page) {
  await mockRest(page, {
    profile: ADMIN_PROFILE,
    assistants: [ACTIVE_ASSISTANT, INACTIVE_ASSISTANT],
    knowledgeBases: [KB_ROW],
    documents: [READY_DOC, PROCESSING_DOC],
  })
}

interface FocusInfo {
  text: string
  hasPencil: boolean
  hasTrash: boolean
}

function isManagementControl(el: FocusInfo): boolean {
  return (
    /nieuwe assistent|nieuwe kennisbron|maak assistent|maak kennisbron|bewerken|verwijderen|toevoegen/i.test(el.text) ||
    el.hasPencil ||
    el.hasTrash
  )
}

test.describe('admin-only-management — US1 member assistants view', () => {
  test('shows only active assistants in the member view', async ({ memberPage }) => {
    await mockMemberAssistants(memberPage)
    await memberPage.goto('/assistants')

    await expect(memberPage.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()
    await expect(memberPage.getByText('Start een gesprek met een assistent')).toBeVisible()
    await expect(memberPage.getByText(INACTIVE_ASSISTANT.name)).toHaveCount(0)
    await expect(memberPage.getByText('Inactief')).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: /risico-analyse starten/i })).toHaveCount(0)
  })

  test('shows the readable type label instead of the raw type code', async ({ memberPage }) => {
    await mockMemberAssistants(memberPage)
    await memberPage.goto('/assistants')

    await expect(memberPage.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()
    await expect(memberPage.getByText('Chat', { exact: true }).first()).toBeVisible()
    await expect(memberPage.getByText('chat', { exact: true })).toHaveCount(0)
  })

  test('renders no management controls or dialog in the DOM', async ({ memberPage }) => {
    await mockMemberAssistants(memberPage)
    await memberPage.goto('/assistants')

    await expect(memberPage.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()
    await expect(memberPage.getByRole('button', { name: /nieuwe assistent/i })).toHaveCount(0)
    await expect(memberPage.locator('button:has(svg.lucide-pencil)')).toHaveCount(0)
    await expect(memberPage.getByRole('dialog')).toHaveCount(0)
    await expect(memberPage.getByText('Assistent bewerken')).toHaveCount(0)
    await expect(memberPage.getByLabel(/n8n webhook url/i)).toHaveCount(0)
  })

  test('keeps management controls out of the keyboard tab order', async ({ memberPage }) => {
    await mockMemberAssistants(memberPage)
    await memberPage.goto('/assistants')
    await expect(memberPage.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()

    const focusable = await memberPage.evaluate(() => {
      const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => ({
          text: (el.textContent ?? '').trim(),
          hasPencil: !!el.querySelector('svg.lucide-pencil'),
          hasTrash: !!el.querySelector('svg.lucide-trash2'),
        }))
    })
    expect(focusable.filter(isManagementControl)).toEqual([])

    for (let i = 0; i < 10; i++) {
      await memberPage.keyboard.press('Tab')
      const focused = await memberPage.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        return {
          text: (el.textContent ?? '').trim(),
          hasPencil: !!el.querySelector('svg.lucide-pencil'),
          hasTrash: !!el.querySelector('svg.lucide-trash2'),
        }
      })
      if (focused) {
        expect(isManagementControl(focused), `tab focus landed on: ${focused.text}`).toBe(false)
      }
    }
  })

  test('can still start a chat with the active assistant', async ({ memberPage }) => {
    await mockMemberAssistants(memberPage)
    await mockChat(memberPage)
    await memberPage.goto('/assistants')

    await memberPage.getByRole('button', { name: /^chat$/i }).first().click()

    await expect(memberPage).toHaveURL(new RegExp(`/chat/new/${ACTIVE_ASSISTANT.id}$`))
    await expect(memberPage.getByPlaceholder('Typ uw bericht…')).toBeVisible()
    await expect(memberPage.getByRole('heading', { level: 1, name: ACTIVE_ASSISTANT.name })).toBeVisible()
  })

  test('never shows the system prompt as the card description', async ({ memberPage }) => {
    await mockMemberAssistants(memberPage)
    await memberPage.goto('/assistants')

    await expect(memberPage.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()
    await expect(memberPage.getByText('GEHEIM-SYSTEEMPROMPT-123')).toHaveCount(0)
  })

  test('shows a member empty state without the admin call-to-action', async ({ memberPage }) => {
    await mockRest(memberPage, {
      profile: MEMBER_PROFILE,
      assistants: [],
      knowledgeBases: [],
    })
    await memberPage.goto('/assistants')

    await expect(memberPage.getByText('Er zijn nog geen actieve assistenten beschikbaar')).toBeVisible()
    await expect(memberPage.getByRole('button', { name: /maak assistent/i })).toHaveCount(0)
  })
})

test.describe('admin-only-management — US2 member knowledge view', () => {
  test('opens the read-only detail view on card click', async ({ memberPage }) => {
    await mockMemberKnowledge(memberPage)
    await memberPage.goto('/knowledge')

    await expect(memberPage.getByRole('heading', { name: KB_ROW.name })).toBeVisible()
    await memberPage.locator('.grid .cursor-pointer').first().click()

    await expect(memberPage.getByRole('heading', { level: 2, name: KB_ROW.name })).toBeVisible()
  })

  test('shows readable document status badges in the detail view', async ({ memberPage }) => {
    await mockMemberKnowledge(memberPage)
    await memberPage.goto('/knowledge')
    await memberPage.locator('.grid .cursor-pointer').first().click()

    await expect(memberPage.getByText(READY_DOC.name)).toBeVisible()
    await expect(memberPage.getByText(PROCESSING_DOC.name)).toBeVisible()
    await expect(memberPage.getByText('Klaar', { exact: true })).toBeVisible()
    await expect(memberPage.getByText('Verwerken...', { exact: true })).toBeVisible()
  })

  test('renders no create or edit buttons', async ({ memberPage }) => {
    await mockMemberKnowledge(memberPage)
    await memberPage.goto('/knowledge')

    await expect(memberPage.getByRole('heading', { name: KB_ROW.name })).toBeVisible()
    await expect(memberPage.getByRole('button', { name: /nieuwe kennisbron/i })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: /^bewerken$/i })).toHaveCount(0)
  })

  test('keeps the detail view fully read-only with working tabs', async ({ memberPage }) => {
    await mockMemberKnowledge(memberPage)
    await memberPage.goto('/knowledge')
    await memberPage.locator('.grid .cursor-pointer').first().click()
    await expect(memberPage.getByRole('heading', { level: 2, name: KB_ROW.name })).toBeVisible()

    await expect(memberPage.getByText('Klik om te uploaden')).toHaveCount(0)
    await expect(memberPage.locator('input[type="file"]')).toHaveCount(0)
    await expect(memberPage.locator('button:has(svg.lucide-trash2)')).toHaveCount(0)

    await expect(memberPage.getByRole('button', { name: /kennisitems/i })).toHaveCount(0)
    await expect(memberPage.getByPlaceholder('Titel van het kennisitem')).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: /^toevoegen$/i })).toHaveCount(0)

    await memberPage.getByRole('button', { name: /gekoppeld/i }).click()
    await expect(memberPage.getByText('Nog geen assistenten gekoppeld')).toBeVisible()

    await memberPage.getByRole('button', { name: /documenten/i }).click()
    await expect(memberPage.getByText(READY_DOC.name)).toBeVisible()
  })
})

test.describe('admin-only-management — US3 admin parity', () => {
  test('keeps the full assistant management view', async ({ page }) => {
    await mockAdminData(page)
    await page.goto('/assistants')

    await expect(page.locator('aside').getByText('Beheerder', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /nieuwe assistent/i })).toBeVisible()
    await expect(page.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()
    await expect(page.getByText(INACTIVE_ASSISTANT.name)).toBeVisible()

    const inactiveCard = page.locator('.grid .opacity-60')
    await expect(inactiveCard).toHaveCount(1)
    await expect(inactiveCard.getByText('Inactief')).toBeVisible()
    await expect(inactiveCard.getByText('Risico-analyse', { exact: true })).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-pencil)')).toHaveCount(2)
    await expect(page.getByText('GEHEIM-SYSTEEMPROMPT-123')).toHaveCount(0)
  })

  test('keeps the knowledge base management controls', async ({ page }) => {
    await mockAdminData(page)
    await page.goto('/knowledge')

    await expect(page.getByRole('heading', { name: KB_ROW.name })).toBeVisible()
    await expect(page.getByRole('button', { name: /nieuwe kennisbron/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^bewerken$/i })).toBeVisible()
  })

  test('keeps the upload zone and delete buttons in the detail view', async ({ page }) => {
    await mockAdminData(page)
    await page.goto('/knowledge')
    await page.locator('.grid .cursor-pointer').first().click()

    await expect(page.getByRole('heading', { level: 2, name: KB_ROW.name })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bestanden toevoegen' })).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-trash2)')).toHaveCount(2)

    await expect(page.getByRole('button', { name: /kennisitems/i })).toHaveCount(0)
  })

  test('keeps the webhook URL field in the assistant edit modal', async ({ page }) => {
    await mockAdminData(page)
    await page.goto('/assistants')

    await expect(page.getByText(ACTIVE_ASSISTANT.name)).toBeVisible()
    await page.locator('button:has(svg.lucide-pencil)').first().click()

    await expect(page.getByRole('heading', { name: 'Assistent bewerken' })).toBeVisible()
    await expect(page.getByLabel('N8N Webhook URL')).toBeVisible()
  })
})
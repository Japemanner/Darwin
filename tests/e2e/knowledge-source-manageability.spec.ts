import { Page, Route } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 016 - knowledge source manageability.
// Supabase REST, Storage and the document-webhook edge function are mocked via
// page.route; only the Supabase login from tests/e2e/fixtures.ts is real.
// Without E2E_EMAIL/E2E_PASSWORD (admin) or E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD
// (member) the matching tests skip.

const ORG_ID = '33333333-3333-4333-8333-333333333333'
const KB_ID = '77777777-7777-4777-8777-777777777777'
const EMPTY_KB_ID = '77777777-7777-4777-8777-777777777778'

const KB = {
  id: KB_ID,
  organization_id: ORG_ID,
  name: 'Polisvoorwaarden 2026',
  description: 'Alle geldige polisvoorwaarden',
  vector_collection_id: null,
  processing_mode: 'vectorized',
  created_by: '44444444-4444-4444-8444-444444444444',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const EMPTY_KB = {
  ...KB,
  id: EMPTY_KB_ID,
  name: 'Lege kennisbron',
  description: null,
}

const READY_DOC = {
  id: '88888888-8888-4888-8888-888888888888',
  knowledge_base_id: KB_ID,
  organization_id: ORG_ID,
  name: 'polis-klaar.pdf',
  file_path: `${ORG_ID}/${KB_ID}/klaar.pdf`,
  file_type: 'pdf',
  file_size: 2048,
  status: 'ready',
  error_message: null,
  created_by: KB.created_by,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const PROCESSING_DOC = {
  ...READY_DOC,
  id: '99999999-9999-4999-8999-999999999999',
  name: 'polis-bezig.docx',
  file_type: 'docx',
  status: 'processing',
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
}

const ERROR_DOC = {
  ...READY_DOC,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'kapotte-polis.pdf',
  status: 'error',
  error_message: 'De PDF is beschadigd.',
  created_at: '2026-01-04T00:00:00Z',
  updated_at: '2026-01-04T00:00:00Z',
}

const STATS = {
  knowledge_base_id: KB_ID,
  organization_id: ORG_ID,
  document_count: 3,
  error_count: 1,
  last_updated_at: '2026-10-30T09:12:00Z',
}

const EMPTY_STATS = {
  knowledge_base_id: EMPTY_KB_ID,
  organization_id: ORG_ID,
  document_count: 0,
  error_count: 0,
  last_updated_at: '2026-10-01T09:12:00Z',
}

interface EdgeBody {
  document_id?: string
  action?: string
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockBase(
  page: Page,
  opts: { knowledgeBases?: unknown[]; stats?: unknown[] } = {},
) {
  await page.route('**/rest/v1/knowledge_bases**', (route) =>
    json(route, opts.knowledgeBases ?? [KB]),
  )
  await page.route('**/rest/v1/knowledge_base_stats**', (route) =>
    json(route, opts.stats ?? [STATS]),
  )
  await page.route('**/rest/v1/knowledge_items**', (route) => json(route, []))
  await page.route('**/rest/v1/assistant_knowledge_bases**', (route) => json(route, []))
}

async function mockDocuments(page: Page, documents: unknown[]) {
  await page.route('**/rest/v1/knowledge_base_documents**', (route) =>
    json(route, documents),
  )
}

async function mockDocumentWebhook(page: Page, onCall?: (body: EdgeBody) => void) {
  await page.route('**/functions/v1/document-webhook', async (route) => {
    const body = route.request().postDataJSON() as EdgeBody
    onCall?.(body)
    await json(route, { ok: true })
  })
}

async function openKnowledgeBase(page: Page) {
  await page.goto('/knowledge')
  await expect(page.getByText(KB.name).first()).toBeVisible()
  await page.locator('.grid .cursor-pointer').first().click()
}

test.describe('knowledge source manageability', () => {
  test('cards show document count, error count and last update', async ({ page }) => {
    await mockBase(page, {
      knowledgeBases: [KB, EMPTY_KB],
      stats: [STATS, EMPTY_STATS],
    })

    await page.goto('/knowledge')

    await expect(page.getByText('3 documenten')).toBeVisible()
    await expect(page.getByText('1 fout', { exact: true })).toBeVisible()
    await expect(page.getByText(/Laatst bijgewerkt:/).first()).toBeVisible()
    await expect(page.getByText('Nog geen documenten')).toBeVisible()
    await expect(page.getByText('0 fouten')).toBeVisible()
  })

  test('document status refreshes and stops when nothing is processing', async ({ page }) => {
    await mockBase(page)
    let documentCalls = 0
    await page.route('**/rest/v1/knowledge_base_documents**', async (route) => {
      if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' })
      documentCalls += 1
      await json(route, documentCalls === 1 ? [PROCESSING_DOC] : [READY_DOC])
    })

    await openKnowledgeBase(page)

    await expect(page.getByText('Verwerken...')).toBeVisible()
    await expect(page.getByText('Klaar')).toBeVisible({ timeout: 12_000 })

    const callsAfterReady = documentCalls
    await new Promise((resolve) => setTimeout(resolve, 6_000))
    expect(documentCalls).toBe(callsAfterReady)
  })

  test('error document shows its reason and retry uses the server route', async ({ page }) => {
    await mockBase(page)
    await mockDocuments(page, [ERROR_DOC])
    let edgeBody: EdgeBody | null = null
    await mockDocumentWebhook(page, (body) => { edgeBody = body })

    await openKnowledgeBase(page)

    await expect(page.getByText('Fout')).toBeVisible()
    await expect(page.getByText(ERROR_DOC.error_message)).toBeVisible()
    await page.getByRole('button', { name: 'Opnieuw verwerken' }).click()

    await expect.poll(() => edgeBody).toEqual({
      document_id: ERROR_DOC.id,
      action: 'index',
    })
  })

  test('deleting a document asks for confirmation with its name', async ({ page }) => {
    await mockBase(page)
    await mockDocumentWebhook(page)
    await page.route('**/storage/v1/object/knowledge-documents/**', (route) => json(route, []))
    let deleteCalled = false
    await page.route('**/rest/v1/knowledge_base_documents**', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        return route.fulfill({ status: 204, body: '' })
      }
      await json(route, [READY_DOC])
    })

    await openKnowledgeBase(page)
    await page.getByRole('button', { name: `Verwijder ${READY_DOC.name}` }).click()

    const confirmText = page.locator('p:has-text("Weet u zeker dat u")')
    await expect(confirmText).toContainText(READY_DOC.name)
    await page.getByRole('button', { name: 'Annuleren' }).click()
    expect(deleteCalled).toBe(false)

    await page.getByRole('button', { name: `Verwijder ${READY_DOC.name}` }).click()
    await page.getByRole('button', { name: 'Verwijderen', exact: true }).click()
    await expect.poll(() => deleteCalled).toBe(true)
  })

  test('name is locked when the knowledge source has documents', async ({ page }) => {
    await mockBase(page)
    await mockDocuments(page, [READY_DOC])

    await page.goto('/knowledge')
    await page.getByRole('button', { name: 'Bewerken' }).click()

    await expect(page.getByLabel('Naam')).toBeDisabled()
    await expect(
      page.getByText('De naam kan niet worden gewijzigd zolang er documenten in deze kennisbron staan, omdat de zoekfunctie de naam gebruikt.'),
    ).toBeVisible()
  })

  test('multiple files upload sequentially with a status per file', async ({ page }) => {
    await mockBase(page)
    let postCount = 0
    let edgeCalls = 0
    await page.route('**/rest/v1/knowledge_base_documents**', async (route) => {
      if (route.request().method() === 'POST') {
        postCount += 1
        const body = route.request().postDataJSON() as {
          name: string
          file_type: string
          file_size: number
        }
        return json(route, {
          ...READY_DOC,
          id: `doc-${postCount}`,
          name: body.name,
          file_type: body.file_type,
          file_size: body.file_size,
          status: 'processing',
        }, 201)
      }
      await json(route, [])
    })
    await page.route('**/storage/v1/object/knowledge-documents/**', (route) =>
      json(route, { Key: 'test' }),
    )
    await mockDocumentWebhook(page, () => { edgeCalls += 1 })

    await openKnowledgeBase(page)
    await expect(page.getByRole('button', { name: 'Bestanden toevoegen' })).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles([
      { name: 'een.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(16) },
      { name: 'twee.txt', mimeType: 'text/plain', buffer: Buffer.alloc(16) },
      { name: 'drie.exe', mimeType: 'application/octet-stream', buffer: Buffer.alloc(16) },
    ])

    await expect(page.getByText('Klaar')).toHaveCount(2)
    await expect(page.getByText('Toegestane typen: PDF, TXT, DOCX').first()).toBeVisible()
    await expect.poll(() => edgeCalls).toBe(2)
  })

  test('Vector Collection ID and the Kennisitems tab are gone from the UI', async ({ page }) => {
    await mockBase(page)
    await mockDocuments(page, [READY_DOC])

    await openKnowledgeBase(page)
    await expect(page.getByText('Kennisitems')).toHaveCount(0)

    await page.getByRole('button', { name: 'Sluiten' }).click()
    await page.getByRole('button', { name: 'Bewerken' }).click()
    await expect(page.getByText('Vector Collection ID')).toHaveCount(0)
    await expect(page.getByText(/Pinecone/)).toHaveCount(0)
  })

  test('member sees statistics but no management actions', async ({ memberPage }) => {
    await mockBase(memberPage)
    await mockDocuments(memberPage, [ERROR_DOC])

    await memberPage.goto('/knowledge')

    await expect(memberPage.getByText('1 fout', { exact: true })).toBeVisible()
    await expect(memberPage.getByRole('button', { name: 'Bewerken' })).toHaveCount(0)

    await memberPage.locator('.grid .cursor-pointer').first().click()
    await expect(memberPage.getByText('Opnieuw verwerken')).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: 'Bestanden toevoegen' })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: `Verwijder ${ERROR_DOC.name}` })).toHaveCount(0)
  })
})

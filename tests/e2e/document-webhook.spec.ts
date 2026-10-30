import { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 009 — document-webhook edge function proxy.
// Upload and delete are mocked end-to-end (edge function, storage and
// knowledge_base_documents REST) so no test data is written to production
// Supabase. Requires at least one knowledge base for the E2E account.

const DOC_ROW = {
  id: '22222222-2222-4222-8222-222222222222',
  knowledge_base_id: 'kb-e2e',
  organization_id: 'org-e2e',
  name: 'polisvoorwaarden.pdf',
  file_path: 'org-e2e/kb-e2e/test.pdf',
  file_type: 'pdf',
  file_size: 1024,
  status: 'processing',
}

interface EdgeBody {
  document_id?: string
  action?: string
}

async function mockDocumentRest(page: Page, docs: unknown[], state: { restDeleteCalled: boolean }) {
  await page.route('**/rest/v1/knowledge_base_documents**', async (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([DOC_ROW]) })
    } else if (method === 'DELETE') {
      state.restDeleteCalled = true
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(docs) })
    }
  })
  await page.route('**/storage/v1/object/knowledge-documents/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
}

function mockDocumentWebhook(page: Page, status: number, body: unknown) {
  return page.route('**/functions/v1/document-webhook', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function openFirstKnowledgeBase(page: Page) {
  await page.goto('/knowledge')
  await page.locator('.grid .cursor-pointer').first().click()
}

test.describe('document-webhook — upload', () => {
  test('notifies n8n via the edge function with document_id and action only', async ({ page }) => {
    const state = { restDeleteCalled: false }
    await mockDocumentRest(page, [], state)
    let edgeBody: EdgeBody | null = null
    await page.route('**/functions/v1/document-webhook', async (route) => {
      edgeBody = route.request().postDataJSON() as EdgeBody
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await openFirstKnowledgeBase(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'polisvoorwaarden.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024),
    })

    await expect(page.getByText('Document toegevoegd')).toBeVisible({ timeout: 15_000 })
    expect(edgeBody).toEqual({ document_id: DOC_ROW.id, action: 'index' })
  })

  test('failed notify shows a Dutch error and keeps the document', async ({ page }) => {
    const state = { restDeleteCalled: false }
    await mockDocumentRest(page, [], state)
    await mockDocumentWebhook(page, 502, {
      code: 'UPSTREAM_UNREACHABLE',
      message: 'Kon geen verbinding maken met de documentverwerking.',
    })

    await openFirstKnowledgeBase(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'polisvoorwaarden.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024),
    })

    await expect(page.getByText('Toevoegen mislukt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/kon geen verbinding maken met de documentverwerking/i)).toBeVisible()
  })
})

test.describe('document-webhook — delete', () => {
  test('successful delete invokes the edge function with action delete', async ({ page }) => {
    const state = { restDeleteCalled: false }
    await mockDocumentRest(page, [DOC_ROW], state)
    let edgeBody: EdgeBody | null = null
    await page.route('**/functions/v1/document-webhook', async (route) => {
      edgeBody = route.request().postDataJSON() as EdgeBody
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await openFirstKnowledgeBase(page)
    await expect(page.getByText(DOC_ROW.name)).toBeVisible()

    await page.locator('button:has(svg.lucide-trash2)').first().click()
    await page.getByRole('button', { name: 'Verwijderen', exact: true }).click()

    await expect(page.getByText('Document verwijderd')).toBeVisible({ timeout: 15_000 })
    expect(edgeBody).toEqual({ document_id: DOC_ROW.id, action: 'delete' })
    expect(state.restDeleteCalled).toBe(true)
  })

  test('failed delete shows the Dutch error and keeps the document (no local delete)', async ({ page }) => {
    const state = { restDeleteCalled: false }
    await mockDocumentRest(page, [DOC_ROW], state)
    await mockDocumentWebhook(page, 502, {
      code: 'UPSTREAM_UNREACHABLE',
      message: 'Kon geen verbinding maken met de documentverwerking.',
    })

    await openFirstKnowledgeBase(page)
    await expect(page.getByText(DOC_ROW.name)).toBeVisible()

    await page.locator('button:has(svg.lucide-trash2)').first().click()
    await page.getByRole('button', { name: 'Verwijderen', exact: true }).click()

    await expect(page.getByText('Fout bij verwijderen')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/kon geen verbinding maken met de documentverwerking/i)).toBeVisible()
    // Spec US2 scenario 3: the document stays stored — no local delete ran.
    expect(state.restDeleteCalled).toBe(false)
    await expect(page.getByText(DOC_ROW.name)).toBeVisible()
  })
})
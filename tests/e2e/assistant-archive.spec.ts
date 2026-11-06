import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Feature 023 — deleting an assistant archives it and offers a restore path.
// The UI flows are tested at the Supabase boundary with mocked REST and Edge
// Function responses, so the suite never hides a real assistant. The real
// migration, RLS and authorization paths are verified manually (quickstart §5-7).

const ORG_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'
const ASSISTANT_ID = '55555555-5555-4555-8555-555555555555'
const CATALOG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = '2026-11-06T09:15:00.000Z'

const ACTIVE_ASSISTANT = {
  id: ASSISTANT_ID,
  organization_id: ORG_ID,
  catalog_id: CATALOG_ID,
  name: 'Schade',
  description: 'Behandelt schadevragen',
  system_prompt: '',
  icon: '🧾',
  type: 'chat',
  n8n_webhook_url: null,
  example_questions: [] as string[],
  is_active: true,
  archived_at: null,
  created_by: USER_ID,
  created_at: NOW,
  updated_at: NOW,
}

const ARCHIVED_ASSISTANT = {
  catalog_id: CATALOG_ID,
  name: 'Schade',
  icon: '🧾',
  type: 'chat',
  archived_at: NOW,
}

type ArchiveMode = 'ok' | 'server-error'
type RestoreMode = 'ok' | 'server-error'

interface MockOptions {
  platformAdmin?: boolean
  archived?: boolean
  archiveMode?: ArchiveMode
  restoreMode?: RestoreMode
}

async function installMocks(page: Page, opts: MockOptions = {}) {
  let archived = opts.archived ?? false
  let archiveCalls = 0
  const calls: Array<Record<string, unknown>> = []
  const assistantUrls: string[] = []

  await page.route('**/rest/v1/rpc/is_platform_admin', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: opts.platformAdmin === false ? 'false' : 'true',
    }),
  )

  // List queries get an array; detail queries (.maybeSingle, e.g. chat and
  // analysis) get a single row matched on the requested id. PostgREST detail
  // reads do not always carry vnd.pgrst.object+json, so an id=eq. filter is
  // treated as a detail query too.
  await page.route('**/rest/v1/ai_assistants**', async (route) => {
    const url = new URL(route.request().url())
    assistantUrls.push(url.toString())
    const accept = route.request().headers()['accept'] ?? ''
    const id = url.searchParams.get('id')?.replace('eq.', '')
    const single = accept.includes('vnd.pgrst.object+json') || Boolean(id)
    const rows = archived ? [] : [ACTIVE_ASSISTANT]
    const body = single
      ? JSON.stringify(id === ASSISTANT_ID && !archived ? ACTIVE_ASSISTANT : null)
      : JSON.stringify(rows)
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })

  await page.route('**/rest/v1/knowledge_bases**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/rest/v1/assistant_knowledge_bases**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/rest/v1/analysis_runs**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await page.route('**/functions/v1/platform-admin', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    calls.push(body)

    if (body.action === 'list_archived_assistants') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(archived ? [ARCHIVED_ASSISTANT] : []),
      })
    }

    if (body.action === 'archive_catalog_assistant') {
      archiveCalls += 1
      if (opts.archiveMode === 'server-error' && archiveCalls === 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'INTERNAL_ERROR',
            message: 'Er ging iets mis. Probeer het opnieuw.',
          }),
        })
      }
      if (opts.archiveMode === 'server-error') {
        // Simulate another administrator who archived it in the meantime:
        // the next list refetch reflects the server state.
        archived = true
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'VALIDATION',
            message: 'Deze assistent is al verwijderd.',
          }),
        })
      }
      archived = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }

    if (body.action === 'restore_catalog_assistant') {
      if (opts.restoreMode === 'server-error') {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'INTERNAL_ERROR',
            message: 'Er ging iets mis. Probeer het opnieuw.',
          }),
        })
      }
      archived = false
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }

    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'VALIDATION', message: 'Onbekende actie.' }),
    })
  })

  return { calls, assistantUrls }
}

test.describe('assistenten verwijderen — bevestiging', () => {
  test('annuleren laat de kaart staan; bevestigen verwijdert hem en verplaatst de focus', async ({ platformAdminPage }) => {
    const { calls } = await installMocks(platformAdminPage)
    await platformAdminPage.goto('/assistants')

    const deleteButton = platformAdminPage.getByRole('button', { name: 'Schade verwijderen' })
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    const dialog = platformAdminPage.getByRole('dialog', { name: 'Assistent verwijderen' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Deze actie geldt voor alle organisaties.')).toBeVisible()
    await expect(dialog.getByText(/gesprekken en analyses blijven leesbaar/i)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Annuleren' })).toBeFocused()

    await dialog.getByRole('button', { name: 'Annuleren' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await dialog.getByRole('button', { name: 'Verwijderen', exact: true }).click()

    await expect(platformAdminPage.getByText('Assistent verwijderd', { exact: true })).toBeVisible()
    await expect(platformAdminPage.getByText('Schade', { exact: true })).toHaveCount(0)
    await expect(platformAdminPage.getByRole('button', { name: 'Archief' })).toBeFocused()
    expect(calls).toContainEqual({
      action: 'archive_catalog_assistant',
      catalog_id: CATALOG_ID,
    })
  })
})

test.describe('assistenten verwijderen — archief en herstellen', () => {
  test('het archief toont de verwijderde assistent en herstelt hem', async ({ platformAdminPage }) => {
    const { calls } = await installMocks(platformAdminPage, { archived: true })
    await platformAdminPage.goto('/assistants')
    await expect(platformAdminPage.getByText('Nog geen assistenten', { exact: true })).toBeVisible()

    await platformAdminPage.getByRole('button', { name: 'Archief' }).click()
    const dialog = platformAdminPage.getByRole('dialog', { name: 'Archief' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Schade', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/Verwijderd op/)).toBeVisible()

    await dialog.getByRole('button', { name: 'Schade herstellen' }).click()
    await expect(platformAdminPage.getByText('Assistent hersteld', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Geen verwijderde assistenten', { exact: true })).toBeVisible()
    expect(calls).toContainEqual({
      action: 'restore_catalog_assistant',
      catalog_id: CATALOG_ID,
    })

    await dialog.getByRole('button', { name: 'Sluiten' }).click()
    await expect(platformAdminPage.getByText('Schade', { exact: true })).toBeVisible()
  })
})

test.describe('assistenten verwijderen — zichtbaarheid en rollen', () => {
  test('de lijst en directe links vragen alleen niet-gearchiveerde assistenten op', async ({ platformAdminPage }) => {
    const { assistantUrls } = await installMocks(platformAdminPage, { archived: true })

    await platformAdminPage.goto('/assistants')
    await expect(platformAdminPage.getByText('Nog geen assistenten', { exact: true })).toBeVisible()
    expect(assistantUrls.some((url) => url.includes('archived_at=is.null'))).toBe(true)

    await platformAdminPage.goto(`/chat/new/${ASSISTANT_ID}`)
    await expect(platformAdminPage.getByText('Assistent niet gevonden', { exact: true })).toBeVisible()
    expect(
      assistantUrls.some(
        (url) => url.includes(`id=eq.${ASSISTANT_ID}`) && url.includes('archived_at=is.null'),
      ),
    ).toBe(true)

    await platformAdminPage.goto(`/analyse/new/${ASSISTANT_ID}`)
    await expect(platformAdminPage.getByText('Assistent niet gevonden', { exact: true })).toBeVisible()
  })

  test('een kantoorbeheerder ziet geen verwijder- of archiefbesturing', async ({ page }) => {
    await installMocks(page, { platformAdmin: false })
    await page.goto('/assistants')

    await expect(page.getByText('Schade', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schade verwijderen' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Archief' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /nieuwe assistent/i })).toHaveCount(0)
  })
})

test.describe('assistenten verwijderen — fouten', () => {
  test('een mislukte of botsende verwijdering laat de kaart staan', async ({ platformAdminPage }) => {
    await installMocks(platformAdminPage, { archiveMode: 'server-error' })
    await platformAdminPage.goto('/assistants')

    await platformAdminPage.getByRole('button', { name: 'Schade verwijderen' }).click()
    const dialog = platformAdminPage.getByRole('dialog', { name: 'Assistent verwijderen' })

    await dialog.getByRole('button', { name: 'Verwijderen', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Verwijderen…' })).toBeDisabled()
    await expect(platformAdminPage.getByText('Verwijderen mislukt', { exact: true })).toBeVisible()
    await expect(
      platformAdminPage.getByText('Er ging iets mis. Probeer het opnieuw.', { exact: true }),
    ).toBeVisible()
    // The transient failure keeps the dialog and the card in place.
    await expect(dialog).toBeVisible()
    await expect(platformAdminPage.getByRole('button', { name: 'Schade verwijderen' })).toBeVisible()

    // Second attempt: the server reports the assistant was already archived.
    // The list refreshes and the dialog closes because the card is gone.
    await dialog.getByRole('button', { name: 'Verwijderen', exact: true }).click()
    await expect(
      platformAdminPage.getByText('Deze assistent is al verwijderd.', { exact: true }),
    ).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect(platformAdminPage.getByRole('button', { name: 'Schade verwijderen' })).toHaveCount(0)
    await expect(platformAdminPage.getByRole('button', { name: 'Archief' })).toBeFocused()
  })

  test('een mislukte herstelactie laat de assistent gearchiveerd', async ({ platformAdminPage }) => {
    await installMocks(platformAdminPage, { archived: true, restoreMode: 'server-error' })
    await platformAdminPage.goto('/assistants')
    await platformAdminPage.getByRole('button', { name: 'Archief' }).click()

    const dialog = platformAdminPage.getByRole('dialog', { name: 'Archief' })
    await dialog.getByRole('button', { name: 'Schade herstellen' }).click()

    await expect(platformAdminPage.getByText('Herstellen mislukt', { exact: true })).toBeVisible()
    await expect(
      platformAdminPage.getByText('Er ging iets mis. Probeer het opnieuw.', { exact: true }),
    ).toBeVisible()
    await expect(dialog.getByText('Schade', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Schade herstellen' })).toBeEnabled()
  })
})

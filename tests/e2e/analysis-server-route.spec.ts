import { test, expect } from './fixtures'
import { fillMinimalAnalysisForm, installAnalysisMock } from './analysis-fixtures'

// Feature 021 — the three server-route scenarios from the technical route.
// These are UI/contract tests at the Supabase boundary. Real RLS and callback
// enforcement are verified manually (quickstart §5.2) and with rls-verify.

const ORG_ID = '00000000-0000-4000-8000-0000000000cc'
const ASSISTANT_ID = '11111111-1111-4111-8111-111111111111'
const KB_ID = '22222222-2222-4222-8222-222222222222'
const FOREIGN_RUN_ID = '33333333-3333-4333-8333-333333333333'
const NOW = new Date().toISOString()

function makeAssistant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ASSISTANT_ID,
    organization_id: ORG_ID,
    catalog_id: '44444444-4444-4444-8444-444444444444',
    name: 'Risico analyse',
    description: null,
    system_prompt: '',
    icon: '🤖',
    type: 'risico_analyse',
    n8n_webhook_url: null,
    example_questions: [],
    is_active: true,
    created_by: '55555555-5555-4555-8555-555555555555',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function makeKnowledgeBase(): Record<string, unknown> {
  return {
    id: KB_ID,
    organization_id: ORG_ID,
    name: 'Kennisbank acceptatie',
    description: null,
    vector_collection_id: null,
    processing_mode: 'vectorized',
    created_by: '55555555-5555-4555-8555-555555555555',
    created_at: NOW,
    updated_at: NOW,
  }
}

test.describe('Server route — assistant and coupling checks', () => {
  test('a disabled assistant shows the Dutch not-available message', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      assistant: makeAssistant({ is_active: false }),
    })

    await page.goto(`/analyse/new/${ASSISTANT_ID}`)

    await expect(page.getByText('Assistent niet gevonden')).toBeVisible()
    await expect(
      page.getByText('Deze assistent bestaat niet of is niet beschikbaar voor een analyse.'),
    ).toBeVisible()
    // No form and no submit: the server would reject it too.
    await expect(page.getByRole('button', { name: /start analyse/i })).toHaveCount(0)
    expect(mock.submitCount).toBe(0)
  })

  test('a missing production URL shows the NOT_CONFIGURED message', async ({ page }) => {
    const message = 'Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.'
    const mock = await installAnalysisMock(page, {
      assistant: makeAssistant(),
      knowledgeBases: [makeKnowledgeBase()],
      submitError: { status: 400, code: 'NOT_CONFIGURED', message },
    })

    await page.goto(`/analyse/new/${ASSISTANT_ID}`)
    await fillMinimalAnalysisForm(page, 'KL-2026-NOTCONF', 'Vraagstuk zonder koppeling')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/analyse\/new\//)
    expect(mock.submitCount).toBe(1)
  })
})

test.describe('Server route — run ownership', () => {
  test("another advisor's run is not visible", async ({ page }) => {
    await installAnalysisMock(page, { runNotFound: true })

    await page.goto(`/analyse/${FOREIGN_RUN_ID}`)

    await expect(page.getByText('Analyse niet gevonden')).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText('Deze analyse bestaat niet of u heeft er geen toegang toe.'),
    ).toBeVisible()
    // No result content of the other advisor.
    await expect(page.getByText(/ontbrekende informatie voor het gesprek/i)).toHaveCount(0)
  })
})

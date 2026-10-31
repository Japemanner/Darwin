import { test, expect } from './fixtures'
import {
  ERROR_CODE,
  fillMinimalAnalysisForm,
  installAnalysisMock,
  openAnalysisForm,
  type AnalysisMock,
} from './analysis-fixtures'

// Feature 021: status/result live on /analyse/:runId, the recent list on
// /analyse/new/:assistantId. The Supabase analysis endpoints are mocked; no
// mock analysis server is used anymore.

async function startAnalysis(
  page: import('@playwright/test').Page,
  mock: AnalysisMock,
  clientReference: string,
  question = 'Vraagstuk',
): Promise<void> {
  const assistantId = await openAnalysisForm(page)
  mock.setAssistantId(assistantId)
  await fillMinimalAnalysisForm(page, clientReference, question)
  await page.getByRole('button', { name: /start analyse/i }).click()
}

test.describe('Run status — transitions and recent runs', () => {
  test('shows status with elapsed time and survives navigation', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      initialStatus: 'running',
      finalStatus: 'running',
      durationMs: 0,
      clientReference: 'KL-2026-003',
    })

    const assistantId = await openAnalysisForm(page)
    mock.setAssistantId(assistantId)
    const listUrl = page.url()

    await fillMinimalAnalysisForm(page, 'KL-2026-003')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/in wachtrij|bezig/i).first()).toBeVisible({ timeout: 15_000 })
    const runUrl = page.url()

    // Navigating away loses nothing: the run keeps its permanent address (US1).
    await page.goto('/knowledge')
    await page.goto(runUrl)
    await expect(page.getByText(/bezig/i).first()).toBeVisible({ timeout: 15_000 })

    // The recent list on the analysis page shows the run with its reference.
    await page.goto(listUrl)
    await expect(page.getByText(/KL-2026-003/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/bezig/i).first()).toBeVisible()
  })
})

test.describe('Result view — sections and source panel', () => {
  test('renders all sections from the rich fixture', async ({ page }) => {
    const mock = await installAnalysisMock(page)
    await startAnalysis(page, mock, 'KL-2026-004')

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/ontbrekende informatie voor het gesprek/i)).toBeVisible()
    await expect(page.getByText(/risico/i).first()).toBeVisible()
    await expect(page.getByText(/dekking en restgat/i)).toBeVisible()
    await expect(page.getByText(/draagkracht/i)).toBeVisible()
    await expect(page.getByText(/opties met voor en tegen/i)).toBeVisible()
    await expect(page.getByText(/intern, speculatief/i)).toBeVisible()
    await expect(page.getByText(/concept, door adviseur te accorderen/i).first()).toBeVisible()
    // No raw HTML rendered inside the analysis result (sanitizer active).
    await expect(
      page.locator('[data-testid^="result-"]').locator('script, iframe, [onclick]'),
    ).toHaveCount(0)
  })

  test('resolves every source reference via side panel', async ({ page }) => {
    const mock = await installAnalysisMock(page)
    await startAnalysis(page, mock, 'KL-2026-004')

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('link', { name: 'K1' }).first().click()
    await expect(page.getByText(/polisvoorwaarden woonhuis/i)).toBeVisible()
    await expect(page.getByText(/artikel 4.2, pagina 12/i)).toBeVisible()
    await expect(page.getByText(/dekking geldt uitsluitend voor schade aan de constructie/i)).toBeVisible()
  })

  test('copy button places internal text on clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const mock = await installAnalysisMock(page)
    await startAnalysis(page, mock, 'KL-2026-004')

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: /kopieer interne tekst/i }).click()
    await expect(page.getByText(/staat op het klembord/i)).toBeVisible()
  })

  test('downloads the dossier through a short-lived signed URL (US4)', async ({ page }) => {
    const mock = await installAnalysisMock(page)
    await startAnalysis(page, mock, 'KL-2026-004')

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 30_000 })

    const signRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/storage/v1/object/sign/analysis-dossiers/') &&
        request.method() === 'POST',
      { timeout: 10_000 },
    )
    await page.getByRole('button', { name: /dossier opslaan/i }).click()
    await signRequest
    // The signed URL is created at click time and the button stays usable.
    await expect(page.getByRole('button', { name: /dossier opslaan/i })).toBeEnabled()
    await expect(page.getByText('Het dossier is niet meer beschikbaar.')).toHaveCount(0)
  })
})

test.describe('Recent runs — availability deadline (US6)', () => {
  test('shows the retention deadline for a succeeded run', async ({ page }) => {
    const mock = await installAnalysisMock(page, { clientReference: 'KL-2026-VERVAL' })

    const assistantId = await openAnalysisForm(page)
    mock.setAssistantId(assistantId)
    const listUrl = page.url()

    await fillMinimalAnalysisForm(page, 'KL-2026-VERVAL', 'Vraagstuk voor vervaldatum')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 30_000 })

    const expected = new Date()
    expected.setDate(expected.getDate() + 7)
    const expectedDate = expected.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    await page.goto(listUrl)
    await expect(page.getByText(`beschikbaar tot ${expectedDate}`).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/KL-2026-VERVAL/i).first()).toBeVisible()
  })
})

test.describe('Error handling — retry with prefilled form', () => {
  test('shows Dutch error with code and prefills form on retry', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      finalStatus: 'failed',
      errorCode: ERROR_CODE,
      clientReference: 'KL-2026-006',
    })
    await startAnalysis(page, mock, 'KL-2026-006', 'Vraagstuk voor foutscenario')

    await expect(page.getByText(/mislukt/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(new RegExp(ERROR_CODE))).toBeVisible()

    await page.getByRole('button', { name: /opnieuw/i }).click()
    await expect(page).toHaveURL(/\/analyse\/new\//)
    await expect(page.getByLabel(/verzekeringsvraagstuk/i)).toHaveValue(/vraagstuk voor foutscenario/i)
    await expect(page.getByLabel(/klantreferentie/i)).toHaveValue(/KL-2026-006/i)
  })

  test('retry shows the attachments notice when the failed attempt had files (US5)', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      finalStatus: 'failed',
      errorCode: ERROR_CODE,
      clientReference: 'KL-2026-BIJL',
    })

    const assistantId = await openAnalysisForm(page)
    mock.setAssistantId(assistantId)
    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk met bijlagen')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('Situatie')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-BIJL')
    await page.locator('#bestanden').setInputFiles({
      name: 'polis.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(512),
    })
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/mislukt/i).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: /opnieuw/i }).click()

    await expect(page.getByText('Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe.')).toBeVisible()
    await expect(page.getByText(/polis\.pdf/i)).toHaveCount(0)
  })

  test('retry without attachments shows no notice (US5)', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      finalStatus: 'failed',
      errorCode: ERROR_CODE,
      clientReference: 'KL-2026-GEEN',
    })
    await startAnalysis(page, mock, 'KL-2026-GEEN', 'Vraagstuk zonder bijlagen')

    await expect(page.getByText(/mislukt/i).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: /opnieuw/i }).click()

    await expect(page).toHaveURL(/\/analyse\/new\//)
    await expect(page.getByText('Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe.')).toHaveCount(0)
  })
})

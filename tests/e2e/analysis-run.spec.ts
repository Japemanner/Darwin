import { test, expect } from './fixtures'

// Requires mock server: node scripts/mock-analysis-server.mjs
// Scenario per run via MOCK_SCENARIO env; these specs need a seeded run.
// Feature 014: status/result live on /analyse/:runId; the recent list on
// /analyse/new/:assistantId.

test.describe('Run status — transitions and recent runs', () => {
  test('shows status with elapsed time and survives navigation', async ({ page }) => {
    test.skip(process.env.MOCK_SCENARIO !== 'slow', 'slow scenario only')

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
    await expect(page).toHaveURL(/\/analyse\/new\//)
    const listUrl = page.url()

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('Karige situatie')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-003')
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
  test.beforeEach(async ({ page }) => {
    if (process.env.MOCK_SCENARIO === 'error') test.skip(true, 'not for error scenario')
    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('Situatie')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-004')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 60_000 })
  })

  test('renders all sections from rich fixture', async ({ page }) => {
    await expect(page.getByText(/ontbrekende informatie voor het gesprek/i)).toBeVisible()
    await expect(page.getByText(/risico/i).first()).toBeVisible()
    await expect(page.getByText(/dekking en restgat/i)).toBeVisible()
    await expect(page.getByText(/draagkracht/i)).toBeVisible()
    await expect(page.getByText(/opties met voor en tegen/i)).toBeVisible()
    await expect(page.getByText(/intern, speculatief/i)).toBeVisible()
    await expect(page.getByText(/concept, door adviseur te accorderen/i).first()).toBeVisible()
    // No raw HTML rendered (sanitizer active)
    await expect(page.locator('script, iframe, [onclick]')).toHaveCount(0)
  })

  test('resolves every source reference via side panel', async ({ page }) => {
    await page.getByRole('link', { name: 'K1' }).first().click()
    await expect(page.getByText(/polisvoorwaarden woonhuis/i)).toBeVisible()
    await expect(page.getByText(/artikel 4.2, pagina 12/i)).toBeVisible()
    await expect(page.getByText(/dekking geldt uitsluitend voor schade aan de constructie/i)).toBeVisible()
  })

  test('copy button places internal text on clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: /kopieer interne tekst/i }).click()
    await expect(page.getByText(/staat op het klembord/i)).toBeVisible()
  })
})

test.describe('Recent runs — availability deadline (US6)', () => {
  test('shows the retention deadline for a succeeded run', async ({ page }) => {
    if (process.env.MOCK_SCENARIO === 'error') test.skip(true, 'not for error scenario')

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
    await expect(page).toHaveURL(/\/analyse\/new\//)
    const listUrl = page.url()

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk voor vervaldatum')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('Situatie')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-VERVAL')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 60_000 })

    // The mock sets expires_at to started_at + 7 days (retention period).
    const expected = new Date()
    expected.setDate(expected.getDate() + 7)
    const expectedDate = expected.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    await page.goto(listUrl)
    await expect(page.getByText(`beschikbaar tot ${expectedDate}`).first()).toBeVisible({ timeout: 15_000 })
    // The row of the just-finished run shows it next to its reference.
    await expect(page.getByText(/KL-2026-VERVAL/i).first()).toBeVisible()
  })
})

test.describe('Error handling — retry with prefilled form', () => {
  test('shows Dutch error with code and prefills form on retry', async ({ page }) => {
    test.skip(process.env.MOCK_SCENARIO !== 'error', 'error scenario only')

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk voor foutscenario')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('Situatie')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-006')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/mislukt/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/N8N_WORKFLOW_ERROR/i)).toBeVisible()

    await page.getByRole('button', { name: /opnieuw/i }).click()
    // Retry navigates to the start page with the prefill (US1).
    await expect(page).toHaveURL(/\/analyse\/new\//)
    await expect(page.getByLabel(/verzekeringsvraagstuk/i)).toHaveValue(/vraagstuk voor foutscenario/i)
    await expect(page.getByLabel(/klantreferentie/i)).toHaveValue(/KL-2026-006/i)
  })

  test('retry shows the attachments notice when the failed attempt had files (US5)', async ({ page }) => {
    test.skip(process.env.MOCK_SCENARIO !== 'error', 'error scenario only')

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
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

    // The notice appears and the file list is indeed empty again (US5).
    await expect(page.getByText('Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe.')).toBeVisible()
    await expect(page.getByText(/polis\.pdf/i)).toHaveCount(0)
  })

  test('retry without attachments shows no notice (US5)', async ({ page }) => {
    test.skip(process.env.MOCK_SCENARIO !== 'error', 'error scenario only')

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk zonder bijlagen')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('Situatie')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-GEEN')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/mislukt/i).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: /opnieuw/i }).click()

    await expect(page).toHaveURL(/\/analyse\/new\//)
    await expect(page.getByText('Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe.')).toHaveCount(0)
  })
})
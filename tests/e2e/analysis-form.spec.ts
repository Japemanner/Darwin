import { test, expect, type Page } from './fixtures'

// Risico-analyse UI — markdown sanitizing: no raw HTML may render.
// Requires mock server with rich scenario: node scripts/mock-analysis-server.mjs
// Feature 014: the assistant card navigates to /analyse/new/:assistantId.

const GROUP_VALIDATION_MSG = /minimaal één van klantsituatie, bestanden of url/i
const HTTPS_MSG = /https/i

async function openAnalysisForm(page: Page) {
  await page.goto('/assistants')
  await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
  await expect(page).toHaveURL(/\/analyse\/new\//)
}

test.describe('Analysis form — group validation', () => {
  test('shows inline message when Klantsituatie, Bestanden and URL\u2019s are all empty', async ({ page }) => {
    await openAnalysisForm(page)

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Overweging inkomensverzekering')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-001')
    await page.getByRole('checkbox').first().check()

    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(GROUP_VALIDATION_MSG)).toBeVisible()
    // The form is its own page now — validation stays on the analysis page.
    await expect(page).toHaveURL(/\/analyse\/new\//)
  })

  test('rejects non-https URLs with inline error', async ({ page }) => {
    await openAnalysisForm(page)

    await page.getByLabel(/url/i).fill('http://onveilig.example.com')
    await page.getByRole('button', { name: /toevoegen/i }).click()

    await expect(page.getByText(HTTPS_MSG).first()).toBeVisible()
  })

  test('rejects files with invalid type before upload', async ({ page }) => {
    await openAnalysisForm(page)

    const invalidFile = {
      name: 'overzicht.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024),
    }
    await page.locator('#bestanden').setInputFiles(invalidFile)

    await expect(page.getByText(/alleen pdf, docx, txt/i)).toBeVisible()
  })
})

test.describe('Analysis form — order and advisor (US3)', () => {
  test('Klantreferentie is the first field and the advisor is fixed text in the header', async ({ page }) => {
    await openAnalysisForm(page)

    // Klantreferentie stands at the top of the form (US3).
    await expect(page.locator('form label').first()).toHaveText('Klantreferentie')
    // The Adviseur input field is gone; the name is fixed text in the header.
    await expect(page.getByLabel('Adviseur', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Adviseur', { exact: true })).toBeVisible()
  })
})

test.describe('Analysis form — knowledge sources default (US4)', () => {
  test('all knowledge sources are checked by default and can be unchecked', async ({ page }) => {
    await openAnalysisForm(page)

    await expect(
      page.getByText('Standaard zijn alle kennisbronnen van deze assistent geselecteerd.'),
    ).toBeVisible()

    const checkboxes = page.getByRole('checkbox')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(0)
    for (let index = 0; index < count; index++) {
      await expect(checkboxes.nth(index)).toBeChecked()
    }

    // Unchecking one source is possible (US4).
    await checkboxes.first().uncheck()
    await expect(checkboxes.first()).not.toBeChecked()
  })
})

test.describe('Analysis form — drag and drop + placeholder (US7)', () => {
  test('accepts a file dropped on the upload box with the same validation', async ({ page }) => {
    await openAnalysisForm(page)

    // Drop a valid file via an in-page DataTransfer (Playwright recipe).
    const validFile = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      dt.items.add(new File(['polisinformatie'], 'situatie.pdf', { type: 'application/pdf' }))
      return dt
    })
    const uploadZone = page.locator('label[for="bestanden"]')
    await uploadZone.dispatchEvent('dragover', { dataTransfer: validFile })
    await uploadZone.dispatchEvent('drop', { dataTransfer: validFile })
    await expect(page.getByText('situatie.pdf')).toBeVisible()

    // Dropped files run through the same validation as the button path (US7).
    const invalidFile = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      dt.items.add(new File(['risky'], 'tool.exe', { type: 'application/octet-stream' }))
      return dt
    })
    await uploadZone.dispatchEvent('dragover', { dataTransfer: invalidFile })
    await uploadZone.dispatchEvent('drop', { dataTransfer: invalidFile })
    await expect(page.getByText(/alleen pdf, docx, txt/i)).toBeVisible()
    await expect(page.getByText('tool.exe')).toHaveCount(0)

    // The button remains the keyboard alternative (acceptance criterion).
    await page.locator('#bestanden').setInputFiles({
      name: 'toeslag.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(128),
    })
    await expect(page.getByText('toeslag.txt')).toBeVisible()
  })

  test('shows the example text in the empty Verzekeringsvraagstuk field', async ({ page }) => {
    await openAnalysisForm(page)

    await expect(page.getByLabel(/verzekeringsvraagstuk/i)).toHaveAttribute(
      'placeholder',
      'Bijvoorbeeld: de klant twijfelt of een aansprakelijkheidsverzekering voor zijn eenmanszaak nodig is.',
    )
  })
})

test.describe('Analysis form — happy path submit', () => {
  test('submits valid minimal input and shows run card in wachtrij/bezig', async ({ page }) => {
    await openAnalysisForm(page)

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Overweging inkomensverzekering voor zelfstandige')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('41-jarige ondernemer, gezin met twee kinderen.')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-002')

    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/in wachtrij/i).or(page.getByText(/bezig/i))).toBeVisible({ timeout: 15_000 })
    // Every analysis has a permanent id-only address (US1)
    await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}/)
    // No client content in URL (SC-004)
    await expect(page).not.toHaveURL(/KL-2026/)
  })
})
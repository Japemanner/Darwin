import { test, expect } from './fixtures'

// Risico-analyse UI — markdown sanitizing: no raw HTML may render.
// Requires mock server with rich scenario: node scripts/mock-analysis-server.mjs

const GROUP_VALIDATION_MSG = /minimaal één van klantsituatie, bestanden of url/i
const HTTPS_MSG = /https/i

async function startAnalysis(page: { goto(url: string): Promise<unknown>; getByRole(role: unknown, opts?: unknown): { name(opts: unknown): { first(): { click(): Promise<unknown> } } }; getByLabel(label: unknown): { fill(value: string): Promise<unknown>; check(): Promise<unknown> } }) {
  await page.goto('/assistants')
  await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
}

test.describe('Analysis form — group validation', () => {
  test('shows inline message when Klantsituatie, Bestanden and URL\u2019s are all empty', async ({ page }) => {
    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Overweging inkomensverzekering')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-001')
    await page.getByRole('checkbox').first().check()

    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(GROUP_VALIDATION_MSG)).toBeVisible()
    await expect(page).toHaveURL(/\/assistants/)
  })

  test('rejects non-https URLs with inline error', async ({ page }) => {
    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()

    await page.getByLabel(/url/i).fill('http://onveilig.example.com')
    await page.getByRole('button', { name: /toevoegen/i }).click()

    await expect(page.getByText(HTTPS_MSG).first()).toBeVisible()
  })

  test('rejects files with invalid type before upload', async ({ page }) => {
    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()

    const invalidFile = {
      name: 'overzicht.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024),
    }
    await page.locator('#bestanden').setInputFiles(invalidFile)

    await expect(page.getByText(/alleen pdf, docx, txt/i)).toBeVisible()
  })
})

test.describe('Analysis form — happy path submit', () => {
  test('submits valid minimal input and shows run card in wachtrij/bezig', async ({ page }) => {
    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Overweging inkomensverzekering voor zelfstandige')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('41-jarige ondernemer, gezin met twee kinderen.')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-002')

    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/in wachtrij/i).or(page.getByText(/bezig/i))).toBeVisible({ timeout: 15_000 })
    // No client content in URL (SC-004)
    await expect(page).not.toHaveURL(/KL-2026/)
  })
})
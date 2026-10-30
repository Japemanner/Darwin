import { test, expect } from './fixtures'

// Feature 009 — the risk-analysis client must send the session JWT on every
// call (contracts specs/008-risico-analyse-ui/contracts/n8n-submit.md and
// run-status.md). Requests pass through to the real mock server on :4010;
// only the Authorization headers are inspected.

const BEARER = /^Bearer .+/

test.describe('analysis client — session JWT on every call', () => {
  test('submit, status and recent-runs carry an Authorization header', async ({ page }) => {
    const captured: { post?: string; status?: string; recent?: string } = {}

    await page.route('**/analysis-runs**', async (route) => {
      const method = route.request().method()
      const auth = route.request().headers()['authorization']
      if (method === 'POST') {
        captured.post = auth
      } else if (route.request().url().includes('/analysis-runs?')) {
        captured.recent = auth
      } else {
        captured.status = auth
      }
      await route.continue()
    })

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()

    // The recent-runs list is fetched when the analysis page mounts (and since
    // feature 014 also by the AppShell notifications hook on every page)
    await expect.poll(() => captured.recent ?? '').toMatch(BEARER)

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Inkomensverzekering zelfstandige — JWT-test')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('41-jarige ondernemer met gezin.')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-JWT')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/in wachtrij/i).or(page.getByText(/bezig/i))).toBeVisible({ timeout: 15_000 })

    expect(captured.post ?? '').toMatch(BEARER)
    // At least one status poll happened to render the run card
    expect(captured.status ?? '').toMatch(BEARER)
    // No client content in the URL (constitution III)
    await expect(page).not.toHaveURL(/KL-2026-JWT/)
  })

  test('a 401 from the backend shows the Dutch session-expired message', async ({ page }) => {
    await page.route('**/analysis-runs**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid token' }) })
      } else {
        await route.continue()
      }
    })

    await page.goto('/assistants')
    await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()

    await page.getByLabel(/verzekeringsvraagstuk/i).fill('Inkomensverzekering zelfstandige — 401-test')
    await page.getByRole('checkbox').first().check()
    await page.getByLabel(/klantsituatie/i).fill('41-jarige ondernemer met gezin.')
    await page.getByLabel(/klantreferentie/i).fill('KL-2026-401')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/uw sessie is verlopen\. log opnieuw in\./i)).toBeVisible({ timeout: 15_000 })
  })
})
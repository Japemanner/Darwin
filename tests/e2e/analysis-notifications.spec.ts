import { test, expect, type Page } from './fixtures'

// Feature 014 — sidebar badge + document title for finished-unseen analyses
// (US2). Requires the mock server (rich scenario): runs complete in ±10 s.
// A fresh browser context initializes the "seen" set with everything already
// finished, so the badge deterministically counts exactly the new completion.

async function startAnalysis(page: Page) {
  await page.goto('/assistants')
  await page.getByRole('button', { name: /risico-analyse starten/i }).first().click()
  await expect(page).toHaveURL(/\/analyse\/new\//)
  await page.getByLabel(/verzekeringsvraagstuk/i).fill('Vraagstuk voor melding')
  await page.getByRole('checkbox').first().check()
  await page.getByLabel(/klantsituatie/i).fill('Situatie')
  await page.getByLabel(/klantreferentie/i).fill('KL-2026-MELD')
  await page.getByRole('button', { name: /start analyse/i }).click()
  await expect(page.getByText(/in wachtrij|bezig/i)).toBeVisible({ timeout: 15_000 })
}

test.describe('analysis notifications — badge and tab title (US2)', () => {
  test('shows the badge and title after a completed run, clears after opening', async ({ page }) => {
    // No badge before any unseen completion.
    await page.goto('/assistants')
    await expect(page.getByRole('link', { name: /assistenten/i })).not.toContainText(/sinds uw laatste bezoek/i)

    await startAnalysis(page)
    const runUrl = page.url()

    // Away from the analysis pages while the mock run completes (±10 s).
    await page.goto('/knowledge')
    const assistentLink = page.getByRole('link', { name: /assistenten/i }).first()
    await expect(assistentLink).toContainText(/sinds uw laatste bezoek:\s*1/, { timeout: 30_000 })
    await expect(page).toHaveTitle('(1) Darwin')

    // Opening the run marks it seen: badge gone, title back to the base.
    await page.goto(runUrl)
    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(assistentLink).not.toContainText(/sinds uw laatste bezoek/i)
    await expect(page).toHaveTitle('Darwin - AI Platform')
  })
})
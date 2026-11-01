import { test, expect } from './fixtures'
import { fillMinimalAnalysisForm, installAnalysisMock, openAnalysisForm } from './analysis-fixtures'

// Feature 014 — sidebar badge + document title for finished-unseen analyses.
// Feature 021: the run completes through the mocked Supabase boundary instead
// of the mock analysis server. A fresh context initializes the "seen" set with
// everything already finished, so the badge counts exactly the new completion.

test.describe('analysis notifications — badge and tab title (US2)', () => {
  test('shows the badge and title after a completed run, clears after opening', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      initialStatus: 'queued',
      finalStatus: 'succeeded',
      durationMs: 4_000,
      clientReference: 'KL-2026-MELD',
    })

    // No badge before any unseen completion.
    await page.goto('/assistants')
    const baseTitle = await page.title()
    await expect(page.getByRole('link', { name: /assistenten/i })).not.toContainText(/sinds uw laatste bezoek/i)

    const assistantId = await openAnalysisForm(page)
    mock.setAssistantId(assistantId)
    await fillMinimalAnalysisForm(page, 'KL-2026-MELD', 'Vraagstuk voor melding')
    await page.getByRole('button', { name: /start analyse/i }).click()
    await expect(page.getByText(/in wachtrij|bezig/i)).toBeVisible({ timeout: 15_000 })
    const runUrl = page.url()

    // Away from the analysis pages while the mocked run completes (±4 s).
    await page.goto('/knowledge')
    const assistentLink = page.getByRole('link', { name: /assistenten/i }).first()
    await expect(assistentLink).toContainText(/sinds uw laatste bezoek:\s*1/, { timeout: 30_000 })
    await expect(page).toHaveTitle('(1) Darwin')

    // Opening the run marks it seen: badge gone, title back to the base.
    await page.goto(runUrl)
    await expect(page.getByText(/klaar/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(assistentLink).not.toContainText(/sinds uw laatste bezoek/i)
    await expect(page).toHaveTitle(baseTitle)
  })
})

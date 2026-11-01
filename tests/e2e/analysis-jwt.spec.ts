import { test, expect } from './fixtures'
import { fillMinimalAnalysisForm, installAnalysisMock, openAnalysisForm } from './analysis-fixtures'

// Feature 021 — every browser call to Supabase carries the session JWT:
// functions.invoke for the submit and PostgREST for status/recent runs.
// The Edge Function and the REST reads are intercepted at the Supabase boundary.

const BEARER = /^Bearer .+/

test.describe('analysis client — session JWT on every call', () => {
  test('submit and recent-runs carry an Authorization header', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      initialStatus: 'queued',
      finalStatus: 'running',
      durationMs: 0,
    })

    const assistantId = await openAnalysisForm(page)
    mock.setAssistantId(assistantId)

    // The recent-runs list is fetched when the page mounts (and by the
    // AppShell notifications hook on every page).
    await expect.poll(() => mock.restAuthorizations.length).toBeGreaterThan(0)

    await fillMinimalAnalysisForm(page, 'KL-2026-JWT', 'Inkomensverzekering zelfstandige — JWT-test')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/in wachtrij|bezig/i).first()).toBeVisible({ timeout: 15_000 })

    expect(mock.submitAuthorizations[0] ?? '').toMatch(BEARER)
    expect(mock.restAuthorizations.some((header) => !!header && BEARER.test(header))).toBe(true)
    // No client content in the URL (constitution III)
    await expect(page).not.toHaveURL(/KL-2026-JWT/)
  })

  test('a 401 from the backend shows the Dutch session-expired message', async ({ page }) => {
    const mock = await installAnalysisMock(page, {
      submitError: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Uw sessie is verlopen. Log opnieuw in.',
      },
    })

    await openAnalysisForm(page)
    await fillMinimalAnalysisForm(page, 'KL-2026-401', 'Inkomensverzekering zelfstandige — 401-test')
    await page.getByRole('button', { name: /start analyse/i }).click()

    await expect(page.getByText(/uw sessie is verlopen\. log opnieuw in\./i)).toBeVisible({ timeout: 15_000 })
    expect(mock.submitCount).toBe(1)
  })
})

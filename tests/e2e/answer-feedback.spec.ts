// IMPORTANT: import './feedback-seed' BEFORE './fixtures' — it loads
// .env.local at module level so the fixtures see E2E_EMAIL/E2E_PASSWORD
// (they read those at module level, and static imports evaluate in order).
import {
  createSeedClient,
  deleteConversation,
  findActiveAssistantId,
  getFeedbackRows,
  seedConversation,
  sweepLeftovers,
  type SeedClient,
  type SeededConversation,
} from './feedback-seed'
import { test, expect } from './fixtures'

// Feature 012 — per-answer feedback (specs/012-per-answer-feedback/).
// Unlike the mocked specs (chat-page.spec.ts), this spec runs against the
// REAL Supabase project (explicit route instruction): the test account seeds
// a conversation with messages via its own Supabase client (rag-chat is not
// involved) and the browser — logged in as the same account via the
// fixtures' PKCE login — performs the rating actions through the app UI.
// Every test sweeps leftovers first and deletes its conversation afterwards
// (one DELETE cascades messages and feedback rows, research.md #12).
// Without E2E_EMAIL/E2E_PASSWORD every test skips with a reason.

interface TestContext {
  seed: SeedClient
  seeded: SeededConversation
}

// Shared scaffold: sweep, seed one assistant + conversation (two answer
// pairs), cleanup in afterEach. Returns null when the environment is not
// configured (caller skips).
async function setup(page: import('@playwright/test').Page): Promise<TestContext | null> {
  const seed = await createSeedClient()
  if (!seed) return null
  await sweepLeftovers(seed)
  const assistantId = await findActiveAssistantId(seed)
  if (!assistantId) return null
  const seeded = await seedConversation(seed, assistantId)
  await page.goto(`/chat/${seeded.conversationId}`)
  return { seed, seeded }
}

const SKIP_REASON = 'E2E_EMAIL / E2E_PASSWORD (and VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) not set in .env.local — seeding requires the test account'

test.describe('answer-feedback — thumbs up per answer', () => {
  test('rating answer 1 with thumbs up leaves answer 2 unrated', async ({ page }) => {
    const ctx = await setup(page)
    test.skip(!ctx, SKIP_REASON)
    if (!ctx) return
    const { seed, seeded } = ctx

    try {
      // Both answers are visible in the conversation.
      await expect(page.getByText('E2E antwoord 1 — de polis dekt schade aan eigendommen.')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('E2E antwoord 2 — u meldt schade via het formulier.')).toBeVisible()

      // Each answer has a thumbs-up and a thumbs-down button (aria-pressed false).
      const upButtons = page.getByRole('button', { name: 'Antwoord is nuttig' })
      await expect(upButtons).toHaveCount(2)
      await expect(upButtons.first()).toHaveAttribute('aria-pressed', 'false')

      // Rate answer 1 with thumbs up — one click, direct save (FR-002).
      await upButtons.first().click()

      // The rated thumb reflects the stored rating; the other answers stay
      // unrated (FR-005, FR-006).
      await expect(upButtons.first()).toHaveAttribute('aria-pressed', 'true')
      await expect(upButtons.nth(1)).toHaveAttribute('aria-pressed', 'false')

      // Database check: exactly one row, for answer 1, positive (FR-004).
      await expect.poll(async () => (await getFeedbackRows(seed, seeded.conversationId)).length).toBe(1)
      const rows = await getFeedbackRows(seed, seeded.conversationId)
      expect(rows[0].message_id).toBe(seeded.answer1Id)
      expect(rows[0].thumbs_up).toBe(true)
      expect(rows[0].reason).toBeNull()
      expect(rows[0].feedback).toBeNull()
    } finally {
      await deleteConversation(seed, seeded.conversationId)
    }
  })
})

test.describe('answer-feedback — reason form on thumbs down', () => {
  test('thumbs down with a reason and no comment saves reason=incomplete; cancel saves nothing', async ({ page }) => {
    const ctx = await setup(page)
    test.skip(!ctx, SKIP_REASON)
    if (!ctx) return
    const { seed, seeded } = ctx

    try {
      await expect(page.getByText('E2E antwoord 1 — de polis dekt schade aan eigendommen.')).toBeVisible({ timeout: 15_000 })

      // Thumbs down opens the reason form at the answer (FR-003).
      const downButtons = page.getByRole('button', { name: 'Antwoord is niet nuttig' })
      await downButtons.first().click()
      await expect(page.getByText('Wat ging er mis?')).toBeVisible()
      await expect(page.getByRole('radio', { name: 'Onvolledig' })).toBeVisible()

      // Versturen is blocked without a reason (FR-003).
      const submit = page.getByRole('button', { name: 'Versturen' })
      await expect(submit).toBeDisabled()

      // Choose a reason, leave the comment empty, submit (US2: no mandatory text).
      await page.getByRole('radio', { name: 'Onvolledig' }).check()
      await expect(submit).toBeEnabled()
      await submit.click()

      // Database check: one negative row with the reason and no comment (FR-004).
      await expect.poll(async () => (await getFeedbackRows(seed, seeded.conversationId)).length).toBe(1)
      const rows = await getFeedbackRows(seed, seeded.conversationId)
      expect(rows[0].message_id).toBe(seeded.answer1Id)
      expect(rows[0].thumbs_up).toBe(false)
      expect(rows[0].reason).toBe('incomplete')
      expect(rows[0].feedback).toBeNull()

      // The down button reflects the stored rating.
      await expect(downButtons.first()).toHaveAttribute('aria-pressed', 'true')

      // Cancel path on answer 2: nothing is saved, the old state stays.
      await downButtons.nth(1).click()
      await page.getByRole('radio', { name: 'Onjuist' }).check()
      await page.getByRole('button', { name: 'Annuleren' }).click()
      await expect(page.getByText('Wat ging er mis?')).toBeHidden()
      expect(await getFeedbackRows(seed, seeded.conversationId)).toHaveLength(1)
    } finally {
      await deleteConversation(seed, seeded.conversationId)
    }
  })
})
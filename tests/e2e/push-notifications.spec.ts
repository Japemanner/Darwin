import { test, expect, E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD } from './fixtures'
import {
  installPushStub,
  stubDeniedPermission,
  stubUnsupportedPush,
} from './push-stubs'

// Feature 018 — Web Push notifications for finished risk analyses.
// Contract: specs/018-push-notifications/contracts/push-payload.md
//
// The notification permission is granted through Playwright; the Push API is
// stubbed because real delivery needs a push service (research R8). The
// push_subscriptions round-trip is real, so this suite needs migration 019.

test.use({ permissions: ['notifications'] })

test.describe('push notifications — enable and disable (US1)', () => {
  test('enables notifications for this device and remembers it after a reload', async ({
    memberPage,
  }) => {
    await memberPage.addInitScript(installPushStub)
    await memberPage.goto('/assistants')

    await expect(memberPage.getByText('Meldingen staan uit op dit apparaat.')).toBeVisible()

    await memberPage.getByRole('button', { name: 'Meldingen aanzetten' }).click()
    await expect(memberPage.getByText('Meldingen staan aan op dit apparaat.')).toBeVisible()

    // A reload proves the row in push_subscriptions, not just local state.
    await memberPage.reload()
    await expect(memberPage.getByText('Meldingen staan aan op dit apparaat.')).toBeVisible()
  })

  test('disables notifications for this device again', async ({ memberPage }) => {
    await memberPage.addInitScript(installPushStub)
    await memberPage.goto('/assistants')

    await memberPage.getByRole('button', { name: 'Meldingen aanzetten' }).click()
    await expect(memberPage.getByText('Meldingen staan aan op dit apparaat.')).toBeVisible()

    await memberPage.getByRole('button', { name: 'Meldingen uitzetten' }).click()
    await expect(memberPage.getByText('Meldingen staan uit op dit apparaat.')).toBeVisible()

    await memberPage.reload()
    await expect(memberPage.getByText('Meldingen staan uit op dit apparaat.')).toBeVisible()
  })
})

test.describe('push notifications — denied and unsupported (US3)', () => {
  test('shows a Dutch explanation when the browser blocks notifications', async ({
    memberPage,
  }) => {
    await memberPage.addInitScript(installPushStub)
    await memberPage.addInitScript(stubDeniedPermission)
    await memberPage.goto('/assistants')

    await expect(
      memberPage.getByText(/Uw browser blokkeert meldingen/i),
    ).toBeVisible()
    await expect(
      memberPage.getByRole('button', { name: 'Meldingen aanzetten' }),
    ).toHaveCount(0)
  })

  test('shows a Dutch explanation when the browser has no Push API', async ({
    memberPage,
  }) => {
    await memberPage.addInitScript(installPushStub)
    await memberPage.addInitScript(stubUnsupportedPush)
    await memberPage.goto('/assistants')

    await expect(
      memberPage.getByText(/Deze browser ondersteunt geen meldingen/i),
    ).toBeVisible()
    await expect(
      memberPage.getByRole('button', { name: /Meldingen (aan|uit)zetten/ }),
    ).toHaveCount(0)
  })
})

test.describe('push notifications — logout (US4)', () => {
  test('stops notifications for this device when logging out', async ({ memberPage }) => {
    test.skip(
      !E2E_MEMBER_EMAIL || !E2E_MEMBER_PASSWORD,
      'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set',
    )

    await memberPage.addInitScript(installPushStub)
    await memberPage.goto('/assistants')

    await memberPage.getByRole('button', { name: 'Meldingen aanzetten' }).click()
    await expect(memberPage.getByText('Meldingen staan aan op dit apparaat.')).toBeVisible()

    await memberPage.getByRole('button', { name: 'Uitloggen' }).click()
    await expect(memberPage).toHaveURL(/login/)

    await memberPage.getByLabel(/e-mail/i).fill(E2E_MEMBER_EMAIL!)
    await memberPage.getByLabel(/wachtwoord/i).fill(E2E_MEMBER_PASSWORD!)
    await memberPage.getByRole('button', { name: /log in|inloggen/i }).click()
    await expect(memberPage).toHaveURL(/assistants|command-center/, { timeout: 30_000 })

    await memberPage.goto('/assistants')
    await expect(memberPage.getByText('Meldingen staan uit op dit apparaat.')).toBeVisible()
  })
})

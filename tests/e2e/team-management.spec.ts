import type { Page } from '@playwright/test'
import {
  test,
  expect,
  E2E_EMAIL,
  E2E_MEMBER_EMAIL,
  E2E_PLATFORM_ADMIN_EMAIL,
  E2E_TEST_ORG_NAME,
  E2E_BLOCK_TARGET_EMAIL,
  E2E_BLOCK_TARGET_PASSWORD,
  E2E_INVITE_EMAIL_BASE,
} from './fixtures'

// Feature 020 — team management (specs/020-team-management).
// Real login/data; the invitation test sends a real mail to a plus-address from
// E2E_INVITE_EMAIL_BASE and always revokes it. The block target is always
// unblocked in the test's finally block.
//
// Direct-call checks use the Vite dev server module. They are skipped when the
// suite runs against a non-local base URL (e.g. a Netlify preview), where
// /src/lib/supabase.ts is not served.

const BLOCKED_OR_ORPHANED =
  'Uw account is geblokkeerd of niet gekoppeld aan een organisatie. Neem contact op met uw beheerder.'
const GENERIC_LOGIN =
  'Inloggen mislukt. Controleer uw e-mailadres en wachtwoord.'
const EXPIRED_INVITE =
  'Deze uitnodigingslink is verlopen of al gebruikt. Vraag uw beheerder om een nieuwe uitnodiging.'

const IS_LOCAL = !process.env.E2E_BASE_URL || process.env.E2E_BASE_URL.includes('localhost')

let inviteEmail: string | null = null

interface SelfProfile {
  id: string
  organization_id: string
  full_name: string
  email: string
  role: 'admin' | 'member'
  status: 'invited' | 'active' | 'blocked'
}

async function getSelfProfile(page: Page): Promise<SelfProfile | null> {
  return page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.ts')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('profiles')
      .select('id, organization_id, full_name, email, role, status')
      .eq('id', user.id)
      .maybeSingle()
    return (data as SelfProfile | null) ?? null
  })
}

interface TeamAdminResult {
  status: number
  body: { code?: string; message?: string } | null
}

async function invokeTeamAdmin(
  page: Page,
  body: Record<string, unknown>,
): Promise<TeamAdminResult> {
  return page.evaluate(async (payload) => {
    const { supabase } = await import('/src/lib/supabase.ts')
    const { data, error } = await supabase.functions.invoke('team-admin', { body: payload })
    if (!error) return { status: 200, body: data as { code?: string; message?: string } }
    const context = (error as { context?: Response }).context
    if (!context) return { status: 0, body: null }
    const parsed = await context.json().catch(() => null) as { code?: string; message?: string } | null
    return { status: context.status, body: parsed }
  }, body)
}

function uniqueInviteEmail(): string {
  const base = E2E_INVITE_EMAIL_BASE!
  const [local, domain] = base.split('@')
  const prefix = local.split('+')[0]
  return `${prefix}+e2e-${Date.now()}@${domain}`
}

async function openTeam(page: Page) {
  await page.goto('/team')
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible()
}

async function inviteFromUi(page: Page, email: string) {
  await page.getByRole('button', { name: /nodig uit/i }).first().click()
  await page.getByLabel('Naam').fill('E2E Teamlid')
  await page.getByLabel('E-mailadres').fill(email)
  await page.getByLabel('Rol', { exact: true }).selectOption('member')
  await page.getByRole('button', { name: /^uitnodigen$/i }).click()
  await expect(page.getByText('Uitnodiging verzonden')).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
}

test.describe('team-management — toegang', () => {
  test('een adviseur ziet Team niet en krijgt Geen toegang', async ({ memberPage }) => {
    await memberPage.goto('/assistants')
    await expect(memberPage.getByRole('link', { name: /^team$/i })).toHaveCount(0)

    await memberPage.goto('/team')
    await expect(memberPage.getByText('Geen toegang')).toBeVisible()
  })

  test('de eigen rij heeft geen acties', async ({ page }) => {
    test.skip(!E2E_EMAIL, 'E2E_EMAIL not set')
    await openTeam(page)
    const row = page.getByRole('row').filter({ hasText: E2E_EMAIL! })
    await expect(row).toBeVisible()
    await expect(row.getByRole('button')).toHaveCount(0)
    await expect(row.getByRole('combobox')).toBeDisabled()
  })
})

test.describe('team-management — uitnodigen', () => {
  test('nodigt uit, ziet Uitgenodigd, verstuurt opnieuw en trekt in', async ({ page }) => {
    test.skip(!E2E_INVITE_EMAIL_BASE, 'E2E_INVITE_EMAIL_BASE not set')
    inviteEmail = uniqueInviteEmail()

    try {
      await openTeam(page)
      await inviteFromUi(page, inviteEmail)

      const row = page.getByRole('row').filter({ hasText: inviteEmail })
      await expect(row.getByText('Uitgenodigd')).toBeVisible()

      await row.getByRole('button', { name: /opnieuw versturen/i }).click()
      await expect(page.getByText('Uitnodiging opnieuw verstuurd')).toBeVisible()

      await row.getByRole('button', { name: /intrekken/i }).click()
      await expect(page.getByText(`Uitnodiging voor ${inviteEmail} intrekken?`)).toBeVisible()
      await page.getByRole('button', { name: /^intrekken$/i }).click()
      await expect(page.getByText('Uitnodiging ingetrokken')).toBeVisible()
      await expect(page.getByText(inviteEmail)).toHaveCount(0)
      inviteEmail = null
    } finally {
      if (inviteEmail) {
        // Best-effort cleanup if the test failed before the revoke.
        await page.goto('/team')
        const row = page.getByRole('row').filter({ hasText: inviteEmail })
        if (await row.count()) {
          await row.getByRole('button', { name: /intrekken/i }).click()
          await page.getByRole('button', { name: /^intrekken$/i }).click().catch(() => {})
        }
        inviteEmail = null
      }
    }
  })

  test('een dubbel e-mailadres geeft de Nederlandse melding', async ({ page }) => {
    test.skip(!E2E_EMAIL, 'E2E_EMAIL not set')
    await openTeam(page)
    await page.getByRole('button', { name: /nodig uit/i }).first().click()
    await page.getByLabel('Naam').fill('Dubbel Teamlid')
    await page.getByLabel('E-mailadres').fill(E2E_EMAIL!)
    await page.getByLabel('Rol', { exact: true }).selectOption('member')
    await page.getByRole('button', { name: /^uitnodigen$/i }).click()
    await expect(page.getByText('Deze persoon staat al in het team.')).toBeVisible()
  })
})

test.describe('team-management — laatste beheerder', () => {
  test('de eigen rolselect is uitgeschakeld en een directe degradatie geeft 409', async ({
    page,
    platformAdminPage,
  }) => {
    test.skip(!IS_LOCAL, 'direct-call test requires the Vite dev server')
    test.skip(!E2E_EMAIL || !E2E_PLATFORM_ADMIN_EMAIL, 'admin/platform-admin accounts not set')

    await openTeam(page)
    const selfProfile = await getSelfProfile(page)
    test.skip(!selfProfile, 'could not read the office-admin profile')
    if (!selfProfile) return

    const row = page.getByRole('row').filter({ hasText: E2E_EMAIL! })
    await expect(row.getByRole('combobox')).toBeDisabled()

    // The platform admin lists the org; only run the direct 409 when the office
    // admin is the only active admin, so the test can never actually demote.
    const listed = await invokeTeamAdmin(platformAdminPage, {
      action: 'list_members',
      organization_id: selfProfile.organization_id,
    })
    test.skip(listed.status !== 200, `list_members returned ${listed.status}`)
    const members = (listed.body as unknown as Array<{ id: string; role: string; status: string }>) ?? []
    const activeAdmins = members.filter((member) => member.role === 'admin' && member.status === 'active')
    test.skip(activeAdmins.length !== 1 || activeAdmins[0].id !== selfProfile.id, 'office admin is not the only active admin')

    const result = await invokeTeamAdmin(platformAdminPage, {
      action: 'set_role',
      organization_id: selfProfile.organization_id,
      user_id: selfProfile.id,
      role: 'member',
    })
    expect(result.status).toBe(409)
    expect(result.body?.message).toBe('Een organisatie heeft minimaal één actieve beheerder nodig.')
  })
})

test.describe('team-management — platformbeheerder', () => {
  test('kiest in Instellingen → Team de testorganisatie en ziet de lijst', async ({
    platformAdminPage,
  }) => {
    test.skip(!E2E_TEST_ORG_NAME, 'E2E_TEST_ORG_NAME not set')
    await platformAdminPage.goto('/settings')
    await platformAdminPage.getByRole('tab', { name: /^team$/i }).click()
    await expect(platformAdminPage.getByLabel('Organisatie')).toBeVisible()
    await platformAdminPage.getByLabel('Organisatie').selectOption({ label: E2E_TEST_ORG_NAME! })
    await expect(platformAdminPage).toHaveURL(/org=/)
    await expect(platformAdminPage.getByText('Teamleden')).toBeVisible()
    if (E2E_MEMBER_EMAIL) {
      await expect(platformAdminPage.getByText(E2E_MEMBER_EMAIL)).toBeVisible()
    }
    await platformAdminPage.reload()
    await expect(platformAdminPage.getByRole('tab', { name: /^team$/i })).toHaveAttribute('aria-selected', 'true')
    await expect(platformAdminPage.getByText('Teamleden')).toBeVisible()
  })
})

test.describe('team-management — blokkeren en deblokkeren', () => {
  test('een open sessie verliest data, inloggen faalt en deblokkeren herstelt', async ({
    page,
    blockTargetPage,
  }) => {
    test.skip(!E2E_BLOCK_TARGET_EMAIL || !E2E_BLOCK_TARGET_PASSWORD, 'block target not set')
    test.skip(!E2E_EMAIL, 'E2E_EMAIL not set')

    await openTeam(page)
    const row = page.getByRole('row').filter({ hasText: E2E_BLOCK_TARGET_EMAIL! })
    test.skip((await row.count()) === 0, 'block target is not in the office-admin organization')

    let blocked = false
    try {
      await blockTargetPage.goto('/assistants')
      await expect(blockTargetPage).not.toHaveURL(/\/login/)

      const memberName = (await row.locator('td').first().locator('span.font-medium').last().innerText()).trim()
      await row.getByRole('button', { name: /blokkeren/i }).click()
      await expect(page.getByText(`${memberName} blokkeren?`)).toBeVisible()
      await page.getByRole('button', { name: /^blokkeren$/i }).click()
      blocked = true
      await expect(page.getByText('Teamlid geblokkeerd')).toBeVisible()
      await expect(row.getByText('Geblokkeerd')).toBeVisible()

      // The open session loses its profile on the next load and is sent to
      // /login with the store message.
      await blockTargetPage.reload()
      await expect(blockTargetPage).toHaveURL(/\/login/)
      await expect(blockTargetPage.getByText(BLOCKED_OR_ORPHANED)).toBeVisible()

      // GoTrue checks the ban before the password; the login keeps the generic
      // message (no user_banned branch).
      await blockTargetPage.getByLabel(/e-mail/i).fill(E2E_BLOCK_TARGET_EMAIL!)
      await blockTargetPage.getByLabel(/wachtwoord/i).fill(E2E_BLOCK_TARGET_PASSWORD!)
      await blockTargetPage.getByRole('button', { name: /log in|inloggen/i }).click()
      await expect(blockTargetPage.getByText(GENERIC_LOGIN)).toBeVisible()
      await expect(blockTargetPage).toHaveURL(/\/login/)
    } finally {
      if (blocked) {
        await page.goto('/team')
        const blockedRow = page.getByRole('row').filter({ hasText: E2E_BLOCK_TARGET_EMAIL! })
        const unblock = blockedRow.getByRole('button', { name: /deblokkeren/i })
        if (await unblock.count()) {
          await unblock.click()
          await expect(page.getByText('Teamlid gedeblokkeerd')).toBeVisible()
        }
      }
    }

    // After unblock, the existing password and data work again.
    await blockTargetPage.getByLabel(/e-mail/i).fill(E2E_BLOCK_TARGET_EMAIL!)
    await blockTargetPage.getByLabel(/wachtwoord/i).fill(E2E_BLOCK_TARGET_PASSWORD!)
    await blockTargetPage.getByRole('button', { name: /log in|inloggen/i }).click()
    await expect(blockTargetPage).toHaveURL(/assistants|command-center/, { timeout: 30_000 })
  })
})

test.describe('team-management — auth/confirm', () => {
  test('een ongeldige token toont de voorgeschreven melding en verdwijnt uit de URL', async ({ browser }) => {
    const page = await browser.newPage({
      baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    })
    try {
      await page.goto('/auth/confirm?token_hash=invalid&type=invite')
      await expect(page.getByText(EXPIRED_INVITE)).toBeVisible()
      await expect(page).not.toHaveURL(/token_hash/)
      await expect(page.getByRole('link', { name: /naar inloggen/i })).toBeVisible()
    } finally {
      await page.close()
    }
  })
})

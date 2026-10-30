import { test, expect } from './fixtures'

// Feature 017 — Dutch UI copy and sidebar navigation (specs/017-dutch-ui-language,
// US3 / FR-007–FR-009 / SC-003–SC-004). One test: the user block shows the Dutch
// role name and hosts the ideas entry, while Roadmap is gone from the main menu.
// The login is real (memberPage fixture); without E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD
// the test skips with a reason.

test('sidebar shows Dutch labels and the ideas entry in the user block', async ({ memberPage }) => {
  const sidebar = memberPage.locator('aside').first()
  await expect(sidebar).toBeVisible()

  // The role is displayed in Dutch, never as the stored value.
  await expect(sidebar.getByText('Adviseur', { exact: true })).toBeVisible()
  await expect(sidebar.getByText('member', { exact: true })).toHaveCount(0)

  // Main navigation: Roadmap is gone; the work pages keep their Dutch labels.
  const nav = sidebar.locator('nav')
  await expect(nav.getByRole('link', { name: 'Overzicht' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Assistenten' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Kennisbronnen' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Geschiedenis' })).toBeVisible()
  await expect(nav.getByRole('link', { name: /roadmap/i })).toHaveCount(0)

  // "Ideeën en wensen" lives in the user block, not in the main navigation.
  const ideas = sidebar.getByRole('link', { name: 'Ideeën en wensen' })
  await expect(ideas).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Ideeën en wensen' })).toHaveCount(0)

  await ideas.click()
  await expect(memberPage).toHaveURL(/\/roadmap$/)
  await expect(memberPage.getByRole('heading', { level: 1, name: 'Ideeën en wensen' })).toBeVisible()
})

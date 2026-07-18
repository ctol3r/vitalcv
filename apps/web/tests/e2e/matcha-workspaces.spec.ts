import { expect, test, type Page } from '@playwright/test'

/**
 * MATCHA Interested / Passed workspace interaction spec (J7).
 *
 * Drives the fixture-backed harness at /dev/matcha-workspaces (enabled for the
 * e2e web server via MATCHA_DECK_PREVIEW=1) so the auth-gated workspace surfaces
 * get real-browser verification: priority ordering, the compare view, the
 * changed/unavailable listing states, and the restore/apply affordances. The
 * signed-in surfaces at /holder/opportunities/{interested,passed} render the
 * identical components behind the Clerk gate.
 */

const INTERESTED = '/dev/matcha-workspaces'
const PASSED = '/dev/matcha-workspaces?view=passed'

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  // The workspace surfaces render synchronously, so their controls exist in the
  // SSR HTML before React attaches handlers — clicking too early is a no-op.
  // Wait for the post-hydration marker so interactions are real. Generous room
  // for the local dev:e2e cold compile; instant on CI's prebuilt server.
  await expect(page.locator('[data-mdk-ws-ready="true"]')).toBeVisible({ timeout: 45_000 })
}

test.describe('MATCHA Interested workspace', () => {
  test('renders the queue priority-first with an apply and remove affordance', async ({ page }) => {
    await open(page, INTERESTED)
    const cards = page.locator('.mdk-ws-card')
    await expect(cards.first()).toBeVisible()

    // The priority role sorts to the top.
    await expect(cards.first()).toHaveAttribute('data-decision', 'priority')

    // Every card offers a private remove and a handoff link to the opportunity
    // detail (the consented flow) — sample listings show "Review what's needed"
    // since they are not applyable, but both route to the same detail surface,
    // never a direct submit.
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible()
    const handoff = page
      .getByRole('link', { name: /Begin application|Review what’s needed/ })
      .first()
    await expect(handoff).toBeVisible()
    await expect(handoff).toHaveAttribute('href', /\/holder\/opportunities\//)
  })

  test('flags a listing that changed since it was saved, and keeps unavailable roles as history', async ({
    page,
  }) => {
    await open(page, INTERESTED)
    await expect(page.getByText('Changed since you saved it')).toBeVisible()
    // A decided role no longer in the feed is kept, labeled, never swapped.
    await expect(page.getByText('No longer in your matches')).toBeVisible()
    await expect(page.locator('.mdk-ws-card[data-status="unavailable"]')).toBeVisible()
  })

  test('compare lays the saved roles side by side across honest dimensions', async ({ page }) => {
    await open(page, INTERESTED)
    // Wait for the queue to settle, then open the comparison.
    await expect(page.locator('.mdk-ws-card').first()).toBeVisible()
    await page.getByRole('button', { name: /Compare \d+ roles/ }).click()
    // The toggle flips the control label — confirm it before reading the table.
    await expect(page.getByRole('button', { name: 'Hide comparison' })).toBeVisible()

    const table = page.locator('.mdk-compare')
    await expect(table).toBeVisible()
    // Dimension rows the directive requires appear as row headers, with unknowns
    // rendered as unknown in the cells.
    const rowHeaders = await table.locator('th[scope="row"]').allTextContents()
    for (const dim of ['Compensation', 'Location', 'Needs review', 'Unknowns', 'Listing freshness']) {
      expect(rowHeaders).toContain(dim)
    }
    await expect(table.getByText('Not provided').first()).toBeVisible()
  })
})

test.describe('MATCHA Passed workspace', () => {
  test('keeps passed roles restorable to the deck', async ({ page }) => {
    await open(page, PASSED)
    await expect(page.getByRole('heading', { level: 1, name: 'Passed' })).toBeVisible()
    await expect(page.locator('.mdk-ws-card').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restore to deck' }).first()).toBeVisible()
  })
})

test.describe('MATCHA workspaces — reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('render fully with reduced motion, controls intact', async ({ page }) => {
    await open(page, INTERESTED)
    await expect(page.locator('.mdk-ws-card').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible()
  })
})

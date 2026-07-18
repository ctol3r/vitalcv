import { expect, test, type Page } from '@playwright/test'

/**
 * MATCHA pass-reason prompt (J6b) — real-browser behavior on the fixture deck.
 *
 * The optional reason is progressive: never on the first pass, offered after the
 * next few, and always dismissable. The exact prompt cadence is pinned without
 * timing dependence in __tests__/matcha-pass-reasons.test.ts; this verifies the
 * non-blocking bar actually appears, collects a reason, and closes.
 */

const HARNESS = '/dev/matcha-deck'
const bar = (page: Page) => page.locator('[data-mdk-passreason]')

async function open(page: Page) {
  await page.goto(HARNESS, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-mdk-loaded]')).toBeVisible({ timeout: 15_000 })
}

async function passOnce(page: Page) {
  await page.getByRole('button', { name: 'Pass', exact: true }).click()
  // Let the exit flight and the resulting decision settle before the next act.
  await expect(page.locator('.mdk-card--active')).toBeVisible()
}

test('the first pass is never interrupted; a later pass offers an optional reason', async ({ page }) => {
  await open(page)

  await passOnce(page)
  await expect(bar(page)).toHaveCount(0)

  await passOnce(page)
  await expect(bar(page)).toBeVisible({ timeout: 3000 })
  await expect(bar(page)).toContainText('Optional')
  // A representative set of the private reason chips.
  for (const label of ['Compensation', 'Schedule', 'Too far']) {
    await expect(bar(page).getByRole('button', { name: label, exact: true })).toBeVisible()
  }
})

test('choosing a reason dismisses the prompt', async ({ page }) => {
  await open(page)
  await passOnce(page)
  await passOnce(page)
  await expect(bar(page)).toBeVisible({ timeout: 3000 })

  await bar(page).getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(bar(page)).toHaveCount(0)
})

test('skip dismisses without a reason', async ({ page }) => {
  await open(page)
  await passOnce(page)
  await passOnce(page)
  await expect(bar(page)).toBeVisible({ timeout: 3000 })

  await bar(page).getByRole('button', { name: /Skip/ }).click()
  await expect(bar(page)).toHaveCount(0)
})

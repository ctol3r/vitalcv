import { expect, test } from '@playwright/test'

/**
 * PageStack shell e2e (G2).
 *
 * Drives the harness at /dev/page-stack (PAGE_STACK_PREVIEW=1 on the e2e
 * server) with real navigation. Proves what unit tests cannot: opening a pane
 * writes the URL, browser Back/Forward walk the stack, and a refresh restores
 * it — i.e. the stack genuinely lives in the URL, not in client memory.
 */

const HARNESS = '/dev/page-stack'

test.describe('PageStack — spatial navigation lives in the URL', () => {
  test('opening a link adds a pane and encodes it in the URL', async ({ page }) => {
    await page.goto(HARNESS)
    await expect(page.locator('[data-pane-root]')).toBeVisible()
    await expect(page.locator('[data-pane-index]')).toHaveCount(0)

    await page.getByRole('link', { name: 'Open an employer' }).click()

    await expect(page.locator('[data-pane-index="0"]')).toBeVisible()
    expect(new URL(page.url()).searchParams.getAll('pane')).toEqual(['employer:org_demo'])
  })

  test('a second link stacks a second pane, rightmost focused', async ({ page }) => {
    await page.goto(HARNESS)
    await page.getByRole('link', { name: 'Open an employer' }).click()
    await page.getByRole('link', { name: 'Open an evidence claim' }).click()

    await expect(page.locator('[data-pane-index]')).toHaveCount(2)
    await expect(page.locator('[data-pane-index="1"]')).toHaveAttribute('data-pane-focused', 'true')
    expect(new URL(page.url()).searchParams.getAll('pane')).toEqual([
      'employer:org_demo',
      'evidence_claim:claim_demo',
    ])
  })

  test('browser Back removes the newest pane; Forward restores it', async ({ page }) => {
    await page.goto(HARNESS)
    await page.getByRole('link', { name: 'Open an employer' }).click()
    await page.getByRole('link', { name: 'Open an evidence claim' }).click()
    await expect(page.locator('[data-pane-index]')).toHaveCount(2)

    await page.goBack()
    await expect(page.locator('[data-pane-index]')).toHaveCount(1)
    expect(new URL(page.url()).searchParams.getAll('pane')).toEqual(['employer:org_demo'])

    await page.goForward()
    await expect(page.locator('[data-pane-index]')).toHaveCount(2)
  })

  test('closing a pane rewrites the URL; refresh restores the remaining stack', async ({ page }) => {
    await page.goto(HARNESS)
    await page.getByRole('link', { name: 'Open an employer' }).click()
    await page.getByRole('link', { name: 'Open an evidence claim' }).click()

    await page.getByRole('button', { name: 'Close Evidence claim pane' }).click()
    await expect(page.locator('[data-pane-index]')).toHaveCount(1)
    expect(new URL(page.url()).searchParams.getAll('pane')).toEqual(['employer:org_demo'])

    await page.reload()
    await expect(page.locator('[data-pane-index]')).toHaveCount(1)
    await expect(page.locator('[data-pane-index="0"]')).toBeVisible()
  })

  test('a deep-linked URL opens the full stack directly', async ({ page }) => {
    await page.goto(`${HARNESS}?pane=employer:org_demo&pane=evidence_claim:claim_demo`)
    await expect(page.locator('[data-pane-index]')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Close Employer pane' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close Evidence claim pane' })).toBeVisible()
  })
})

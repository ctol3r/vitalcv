import { expect, test } from '@playwright/test'

/**
 * RelationshipDrawer e2e (G4). The harness fetches a real demo NPI's evidence
 * graph and renders its bidirectional relationships. Proves end to end: the
 * relationships API is called, and the drawer shows real typed relationships
 * (not a fabricated list) with the Outgoing/Backlinks tabs switching.
 */

const HARNESS = '/dev/page-stack'

test.describe('RelationshipDrawer — real bidirectional relationships', () => {
  test('renders real relationships from the clinician evidence graph', async ({ page }) => {
    const relReq = page.waitForRequest(
      (r) => r.url().includes('/api/entities/clinician/1003000126/relationships'),
      { timeout: 8000 },
    )
    await page.goto(HARNESS)
    await relReq // the drawer fetched real relationships

    const drawer = page.getByRole('region', { name: 'Relationships' })
    await expect(drawer).toBeVisible()

    // Outgoing tab is default and shows real, typed relationships.
    const outgoing = drawer.locator('[data-rel-list="outgoing"] [data-rel-direction="outgoing"]')
    await expect(outgoing.first()).toBeVisible()
    expect(await outgoing.count()).toBeGreaterThan(0)

    // The subject is the root of the evidence graph — every edge flows FROM it,
    // so its Backlinks view is legitimately empty and shows the honest empty
    // state rather than a fabricated connection. Switching proves the tab works.
    await drawer.getByRole('tab', { name: /Backlinks/ }).click()
    await expect(drawer.locator('[data-rel-list="outgoing"]')).toHaveCount(0)
    await expect(drawer.locator('[data-rel-empty="backlinks"]')).toBeVisible()
  })
})

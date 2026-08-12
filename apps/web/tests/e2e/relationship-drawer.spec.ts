import { expect, test } from '@playwright/test'

/**
 * RelationshipDrawer e2e (G4). The harness fetches a demo NPI's evidence graph
 * and renders its bidirectional relationships. Proves end to end: the
 * relationships API is called, and the drawer shows real typed relationships
 * (not a fabricated list) with the Outgoing/Backlinks tabs switching.
 *
 * `DEMO_NPI` must track `app/dev/page-stack/PageStackHarness.tsx`. It was
 * 1003000126 until 2026-08-10 — a real physician — so this spec asserted the
 * drawer against a named person's evidence graph. It is now the synthetic
 * 1558395516 (check-digit invalid, NPPES result_count 0).
 *
 * The assertions below did not need to change, and that is the point: the
 * projection emits the same four typed outgoing edges for ANY well-formed NPI
 * (HAS_IDENTITY, SCREENED_FOR_EXCLUSION, HOLDS_LICENSE, ENROLLED_IN) — what
 * differs is each node's STATE, `unavailable`/`pending` instead of `checked`.
 * The drawer renders unknowns with equal typographic confidence, so it draws
 * them identically. The test therefore proves what it always claimed to prove —
 * the drawer renders the real projection — while no longer depending on a real
 * person's record to do it. Verified live before the swap: 4 outgoing, 0
 * backlinks.
 *
 * If the harness constant and this one drift, the failure is loud and specific:
 * `waitForRequest` times out on a URL nobody requests.
 */

const HARNESS = '/dev/page-stack'
const DEMO_NPI = '1558395516'

test.describe('RelationshipDrawer — real bidirectional relationships', () => {
  test('renders real relationships from the clinician evidence graph', async ({ page }) => {
    const relReq = page.waitForRequest(
      (r) => r.url().includes(`/api/entities/clinician/${DEMO_NPI}/relationships`),
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

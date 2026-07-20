import { expect, test } from '@playwright/test'

/**
 * EntityLink live-preview wiring e2e (G3).
 *
 * The dev harness (/dev/page-stack) links are employer/evidence, which have no
 * server-side preview resolver yet, so no card renders — but the point this
 * proves is the wiring that only a real browser can: a deliberate hover fires
 * exactly one delayed, cancellable request to the preview API, and a plain
 * click still opens the pane. Card rendering with real data is covered by the
 * unit tests (authorized data needs a session the CI browser can't hold).
 */

const HARNESS = '/dev/page-stack'

test.describe('EntityLink — live preview wiring', () => {
  test('a hover fires a single request to the preview API', async ({ page }) => {
    // networkidle ≈ hydration complete: the link is SSR-visible long before
    // React attaches its pointer listeners, and a hover that lands in that
    // window is silently lost (the CI flake this replaces — a one-shot
    // hover + fixed wait had no recovery).
    await page.goto(HARNESS, { waitUntil: 'networkidle' })
    const link = page.getByRole('link', { name: 'Open an employer' })
    await expect(link).toBeVisible()

    const previewReqs: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/entities/employer/org_demo/preview')) previewReqs.push(r.method())
    })
    // Re-hover until the wiring answers: leave the element (resetting the
    // intent gate), hover again, give the 300ms gate headroom, and poll.
    // One successful attempt proves the wiring; exactly-once/lazy/delayed
    // stays asserted deterministically in the jsdom unit test (fake timers).
    await expect
      .poll(
        async () => {
          if (previewReqs.length === 0) {
            await page.mouse.move(0, 0)
            await link.hover()
            await page.waitForTimeout(600) // past the 300ms intent gate
          }
          return previewReqs.length
        },
        { timeout: 15_000, message: 'hover should fire the preview GET after hydration' },
      )
      .toBeGreaterThan(0)
    expect(previewReqs.every((m) => m === 'GET')).toBe(true)
  })

  test('a plain click opens the entity in a pane (preview does not block navigation)', async ({ page }) => {
    await page.goto(HARNESS)
    await page.getByRole('link', { name: 'Open an evidence claim' }).click()
    await expect(page.locator('[data-pane-index="0"]')).toBeVisible()
    expect(new URL(page.url()).searchParams.getAll('pane')).toEqual(['evidence_claim:claim_demo'])
  })
})

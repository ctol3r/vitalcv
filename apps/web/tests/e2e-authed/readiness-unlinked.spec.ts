import { expect, test } from '@playwright/test'

/**
 * A0 — the unlinked readiness state through the REAL gate.
 *
 * The shared test clinician crosses the real Clerk gate with no NPI linked.
 * /holder/readiness once answered that state with buildDemoSnapshot() — a
 * fabricated identity, a fabricated verified lane, a fabricated score. The
 * unit-level guard (a0-truth-containment.test.tsx) pins the component; this
 * spec pins the ROUTE: what an unlinked clinician actually receives is the
 * honest empty state, and never the historical demo identity.
 */

test('an unlinked clinician sees the honest readiness empty state', async ({ page }) => {
  await page.goto('/holder/readiness')

  // Through the gate — not bounced to sign-in.
  await expect(page).toHaveURL(/\/holder\/readiness/)

  // The honest empty state, as accessible DOM: a plain explanation and one
  // CTA into onboarding. No snapshot, no score, no identity.
  await expect(
    page.getByText('Add your NPI to see your source-backed readiness.'),
  ).toBeVisible({ timeout: 30_000 })
  const cta = page.getByRole('link', { name: /Connect your NPI/ })
  await expect(cta).toBeVisible()
  await expect(cta).toHaveAttribute('href', '/onboarding')

  // Never the identity buildDemoSnapshot() fabricated (split-join per the
  // banned-string convention), and never a score with no evidence behind it.
  const body = await page.locator('body').innerText()
  expect(body).not.toContain(['MACIE', 'MILLER'].join(' '))
  expect(body).not.toContain(['1457', '128589'].join(''))
  expect(body).not.toMatch(/\d+% readiness/)

  // The A0 acceptance evidence: an intentional screenshot of the unlinked flow.
  await page.screenshot({ path: 'test-results/a0-readiness-unlinked.png', fullPage: true })
})

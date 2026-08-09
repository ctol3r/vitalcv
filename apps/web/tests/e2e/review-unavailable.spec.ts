/**
 * Review without a hydratable passport — carried forward from the retired
 * 04-launch-wedge spec via npi-truth-engine (itself retired with the film
 * homepage, 2026-08-03): until VitalCV can hydrate a passport record for an
 * entity, /review renders an explicit unavailable state — it never fabricates
 * a decision card. In the e2e environment the backend is down, so the
 * passport fetch fails closed.
 */
import { expect, test } from '@playwright/test';

test.describe('Review without a hydratable passport', () => {
  test('renders the explicit unavailable state instead of a decision card', async ({ page }) => {
    await page.goto('/review/00000000-0000-0000-0000-000000000000?contextId=demo-review', {
      waitUntil: 'networkidle',
    });

    await expect(page.getByText('Employer review unavailable')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(
        'This clinician record is not available for review yet. The clinician may need to run a readiness check first.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to review' })).toBeVisible();
  });

  /**
   * The unavailable state IS the whole page, and it shipped with no document
   * heading at all — `/review/[entityId]` measured h1×0 on production
   * 2026-08-09 (page consistency audit, F4). The card's title is now the h1.
   *
   * Asserted in a real browser rather than as a source grep, because the
   * repo's axe gate scans hand-written fixtures for five other routes and was
   * green through the entire regression.
   */
  test('the unavailable state owns the page h1', async ({ page }) => {
    await page.goto('/review/00000000-0000-0000-0000-000000000000?contextId=demo-review', {
      waitUntil: 'networkidle',
    });

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Employer review unavailable');
  });
});

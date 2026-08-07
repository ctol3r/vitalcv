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
        'This clinician passport is not available for review yet. The clinician may need to run a readiness check first.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to review' })).toBeVisible();
  });
});

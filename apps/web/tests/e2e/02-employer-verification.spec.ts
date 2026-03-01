import { expect, test } from '@playwright/test';

test.describe('Employer Verification Command Center', () => {
  test('selects candidate and runs ZK proof approval', async ({ page }) => {
    await page.goto('/demo/command-center', { waitUntil: 'networkidle' });
    await expect(page.getByText('Live Credential Intake')).toBeVisible({ timeout: 10_000 });

    // Select candidate Dr. Maria Santos from the list.
    await page.getByText('Dr. Maria Santos').click();

    // Assert detail pane shows candidate info (use locator to avoid strict match on list item).
    await expect(page.locator('span', { hasText: 'NPI 1234567890' })).toBeVisible({ timeout: 5_000 });

    // Click Instant Approve to trigger ZK proof.
    await page.getByRole('button', { name: /instant approve/i }).click();

    // Wait for ZK Terminal to render all log lines (~4s at 0.4s intervals).
    await expect(
      page.getByText(/L3 Bundle mathematically proven/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});

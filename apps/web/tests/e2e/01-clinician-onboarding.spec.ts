import { expect, test } from '@playwright/test';

test.describe('Clinician Magic Onboarding', () => {
  test('completes full onboarding flow: upload → scan → review → wallet', async ({ page }) => {
    await page.goto('/demo/magic', { waitUntil: 'networkidle' });
    await expect(page.getByText('Magic Onboarding')).toBeVisible();

    // Click the dropzone to trigger mock document scan.
    const dropzone = page.getByRole('button', {
      name: /upload or drop a medical credential document/i,
    });
    await dropzone.click();

    // Wait for the review phase.
    // Total animation budget: 2.5s processing + 650ms done + AnimatePresence ≈ 3.5s
    await expect(page.getByText('Review Extracted Data')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Dr. Robert Kim')).toBeVisible();
    await expect(page.getByText('CA-98765')).toBeVisible();

    // Confirm and add to wallet
    await page.getByRole('button', { name: /confirm & add to wallet/i }).click();

    // Wait for loading + done states (900ms loading + 700ms callback)
    await expect(page.getByText('Credential Added')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Dr. Robert Kim — CA License')).toBeVisible();

    // Navigate to holder wallet and verify it loads
    await page.goto('/holder');
    await expect(page.getByText('My Credentials')).toBeVisible({ timeout: 10_000 });
  });
});

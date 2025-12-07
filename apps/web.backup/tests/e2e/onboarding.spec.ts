import { test, expect } from '@playwright/test';

test.describe('NPI Onboarding Flow', () => {
  test('should complete NPI onboarding successfully', async ({ page }) => {
    // Visit onboarding wizard
    await page.goto('/onboarding');

    // Enter NPI
    await page.getByLabel('NPI Number').fill('1234567890');
    await page.getByRole('button', { name: /search|verify|next/i }).click();

    // Validate auto-filled fields
    await expect(page.getByLabel('First Name')).not.toBeEmpty();
    await expect(page.getByLabel('Last Name')).not.toBeEmpty();
    // Add more specific checks if known

    // Upload document (stub)
    // Create a dummy file for upload
    await page.setInputFiles('input[type="file"]', {
      name: 'license.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('dummy content')
    });

    // Submit claim
    await page.getByRole('button', { name: /submit|claim/i }).click();

    // Verify success (this depends on the UI feedback, e.g., a toast or redirect)
    await expect(page.getByText(/success|submitted|pending/i)).toBeVisible();
  });
});



















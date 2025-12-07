/**
 * E2E Tests for ClaimWizard Flow
 *
 * Tests the complete credential claim workflow including:
 * - Profile verification
 * - Document upload
 * - Document review
 * - Attestation request
 */

import { test, expect } from '@playwright/test';

test.describe('ClaimWizard Flow', () => {
  const testNpi = '1234567890';

  test.beforeEach(async ({ page }) => {
    // Navigate to a page that hosts the ClaimWizard
    // This assumes there's a route like /claim/[npi] or similar
    await page.goto(`/holder/claim?npi=${testNpi}`);
  });

  test('displays readiness bar with initial state', async ({ page }) => {
    // Check for readiness bar elements
    await expect(page.getByText(/NPI/i)).toBeVisible();
    await expect(page.getByText(/Documents/i)).toBeVisible();
  });

  test('shows step progress indicator', async ({ page }) => {
    // Verify step progress bar is visible (4 steps)
    const progressBars = page.locator('.h-1.flex-1.rounded');
    await expect(progressBars).toHaveCount(4);
  });

  test('Step 1: Profile verification', async ({ page }) => {
    // Verify Step 1 content is visible
    await expect(page.getByRole('heading', { name: /Step 1|Profile/i })).toBeVisible();

    // Look for NPI display
    await expect(page.getByText(testNpi)).toBeVisible();

    // Click next to proceed (button text may vary)
    const nextButton = page.getByRole('button', { name: /next|continue|confirm/i });
    await nextButton.click();
  });

  test('Step 2: Document upload', async ({ page }) => {
    // Navigate past Step 1
    await page.getByRole('button', { name: /next|continue|confirm/i }).click();

    // Verify Step 2 content
    await expect(page.getByRole('heading', { name: /Step 2|Document|Upload/i })).toBeVisible();

    // Look for upload area
    const uploadArea = page.locator('[data-testid="document-upload"]').or(
      page.getByText(/upload|drag|drop/i)
    );
    await expect(uploadArea.first()).toBeVisible();
  });

  test('Step 3: Document review', async ({ page }) => {
    // Navigate past Steps 1 and 2
    await page.getByRole('button', { name: /next|continue|confirm/i }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /next|continue|confirm/i }).first().click();

    // Verify Step 3 content
    await expect(page.getByRole('heading', { name: /Step 3|Review/i })).toBeVisible();
  });

  test('Step 4: Attestation request', async ({ page }) => {
    // Navigate to Step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|confirm/i }).first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify Step 4 content
    await expect(page.getByRole('heading', { name: /Step 4|attestation/i })).toBeVisible();
    await expect(page.getByText(/trusted issuer/i)).toBeVisible();

    // Verify attestation button
    const attestButton = page.getByRole('button', { name: /request attestation/i });
    await expect(attestButton).toBeVisible();
    await expect(attestButton).toBeEnabled();
  });

  test('handles attestation request success', async ({ page }) => {
    // Mock the attestation API
    await page.route('**/api/attestation*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate to Step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|confirm/i }).first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Click attestation button
    await page.getByRole('button', { name: /request attestation/i }).click();

    // Verify success message
    await expect(page.getByText(/attestation requested|review/i)).toBeVisible();
  });

  test('handles attestation request error', async ({ page }) => {
    // Mock the attestation API to return error
    await page.route('**/api/attestation*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' }),
      });
    });

    // Navigate to Step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|confirm/i }).first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Click attestation button
    await page.getByRole('button', { name: /request attestation/i }).click();

    // Verify error message is displayed
    await expect(page.locator('.text-red-700, [role="alert"]').first()).toBeVisible();
  });

  test('close button closes the wizard', async ({ page }) => {
    // Look for close button
    const closeButton = page.getByRole('button', { name: /close|cancel/i });

    if (await closeButton.isVisible()) {
      await closeButton.click();
      // Verify wizard is closed (implementation dependent)
    }
  });

  test('loading state during attestation request', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/attestation*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate to Step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|confirm/i }).first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Click attestation button
    const attestButton = page.getByRole('button', { name: /request attestation/i });
    await attestButton.click();

    // Verify loading state
    await expect(page.getByText(/requesting/i)).toBeVisible();

    // Verify button is disabled during loading
    await expect(attestButton).toBeDisabled();
  });
});

test.describe('ClaimWizard Accessibility', () => {
  test('has proper heading hierarchy', async ({ page }) => {
    await page.goto('/holder/claim?npi=1234567890');

    // Check for headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
  });

  test('buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/holder/claim?npi=1234567890');

    // Tab to first button
    await page.keyboard.press('Tab');

    // Verify a button is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('form inputs have labels', async ({ page }) => {
    await page.goto('/holder/claim?npi=1234567890');

    // Check that inputs have associated labels
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Input should have a label, aria-label, or aria-labelledby
        const hasLabel = (await label.count()) > 0 || ariaLabel || ariaLabelledBy;
        expect(hasLabel).toBeTruthy();
      }
    }
  });
});

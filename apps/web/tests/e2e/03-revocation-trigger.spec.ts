import { expect, test } from '@playwright/test';

// Mock trust-state response so TrustStatePanel renders without a live backend.
const MOCK_TRUST_STATE = {
  recognized: true,
  accepted: false,
  started: false,
  start_ready: false,
  crs: { score: 85, band: 'GREEN', factors: {} },
  blocking_reasons: [],
  blocking_reason_messages: [],
  timeline_preview: [
    {
      id: 'mock-verify-1',
      type: 'VERIFICATION_COMPLETED',
      label: 'State license verified via NPPES',
      timestamp: new Date().toISOString(),
      employer: null,
      facility: null,
      metadata: { lane: 'PUBLIC', verification_check: 'CA State License' },
    },
  ],
  recognitionId: 'rec-mock-001',
};

test.describe('Revocation Webhook Simulation', () => {
  test('triggers revocation and asserts suspended state with CRS drop', async ({ page }) => {
    // Intercept trust-state API call with regex for robust URL matching.
    await page.route(/\/trust-state/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRUST_STATE),
      });
    });

    await page.goto('/demo/verifier-portal', { waitUntil: 'networkidle' });
    await expect(page.getByText('Verifier Portal')).toBeVisible({ timeout: 10_000 });

    // Wait for TrustStatePanel to render with the mocked data.
    await expect(page.locator('[data-slot="crs-ring"]')).toBeVisible({ timeout: 10_000 });

    // Trigger revocation
    await page.getByRole('button', { name: /simulate state board revocation/i }).click();

    // Assert revocation state
    await expect(page.getByText('Revocation active')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Suspended: Do Not Schedule')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-slot="crs-ring"][data-band="RED"]')).toBeVisible();

    // Reset revocation and verify return to normal
    await page.getByRole('button', { name: 'Reset Revocation' }).click();
    await expect(page.getByText('Revocation active')).not.toBeVisible({ timeout: 5_000 });
  });
});

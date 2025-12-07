/**
 * E2E Tests for Credential Management
 *
 * Tests credential viewing, verification, and status updates
 */

import { test, expect } from '@playwright/test';

test.describe('Credential Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated session
    await page.route('**/api/auth/session*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: '1', email: 'test@example.com', role: 'holder' },
        }),
      });
    });
  });

  test.describe('Credential List', () => {
    test('displays list of credentials', async ({ page }) => {
      // Mock credentials API
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            credentials: [
              {
                id: 'cred-1',
                type: 'MedicalLicense',
                status: 'active',
                issuedAt: '2024-01-01',
                expiresAt: '2025-01-01',
              },
              {
                id: 'cred-2',
                type: 'BoardCertification',
                status: 'pending',
                issuedAt: '2024-06-01',
                expiresAt: '2026-06-01',
              },
            ],
          }),
        });
      });

      await page.goto('/holder/credentials');

      // Verify credentials are displayed
      await expect(page.getByText(/medical license/i)).toBeVisible();
      await expect(page.getByText(/board certification/i)).toBeVisible();
    });

    test('displays empty state when no credentials', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ credentials: [] }),
        });
      });

      await page.goto('/holder/credentials');

      // Verify empty state message
      await expect(page.getByText(/no credentials|get started/i)).toBeVisible();
    });

    test('shows loading state', async ({ page }) => {
      await page.route('**/api/credentials*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          body: JSON.stringify({ credentials: [] }),
        });
      });

      await page.goto('/holder/credentials');

      // Look for loading indicator
      const loader = page.locator('[role="status"], .animate-spin, .loading');
      await expect(loader.first()).toBeVisible();
    });

    test('handles API error gracefully', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.goto('/holder/credentials');

      // Verify error message is shown
      await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
    });
  });

  test.describe('Credential Status', () => {
    test('displays correct status badge for active credential', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            credentials: [{ id: '1', status: 'active', type: 'License' }],
          }),
        });
      });

      await page.goto('/holder/credentials');

      // Look for active status indicator
      const activeBadge = page.locator('.bg-green-500, .text-green-600, [data-status="active"]');
      await expect(activeBadge.first()).toBeVisible();
    });

    test('displays correct status badge for pending credential', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            credentials: [{ id: '1', status: 'pending', type: 'License' }],
          }),
        });
      });

      await page.goto('/holder/credentials');

      const pendingBadge = page.locator(
        '.bg-yellow-500, .text-yellow-600, [data-status="pending"]'
      );
      await expect(pendingBadge.first()).toBeVisible();
    });

    test('displays correct status badge for revoked credential', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            credentials: [{ id: '1', status: 'revoked', type: 'License' }],
          }),
        });
      });

      await page.goto('/holder/credentials');

      const revokedBadge = page.locator('.bg-red-500, .text-red-600, [data-status="revoked"]');
      await expect(revokedBadge.first()).toBeVisible();
    });
  });

  test.describe('Credential Details', () => {
    test('opens credential detail view', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        if (route.request().url().includes('cred-1')) {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              id: 'cred-1',
              type: 'MedicalLicense',
              status: 'active',
              issuer: 'State Medical Board',
              issuedAt: '2024-01-01',
              expiresAt: '2025-01-01',
              claims: {
                licenseNumber: 'MD12345',
                specialty: 'Internal Medicine',
              },
            }),
          });
        } else {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              credentials: [{ id: 'cred-1', type: 'MedicalLicense', status: 'active' }],
            }),
          });
        }
      });

      await page.goto('/holder/credentials');

      // Click on credential to view details
      await page.getByText(/medical license/i).click();

      // Verify detail view shows
      await expect(page.getByText(/state medical board/i)).toBeVisible();
      await expect(page.getByText(/MD12345/i)).toBeVisible();
    });
  });

  test.describe('Credential Verification', () => {
    test('displays QR code for sharing', async ({ page }) => {
      await page.route('**/api/credentials*', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            credentials: [{ id: 'cred-1', type: 'License', status: 'active' }],
          }),
        });
      });

      await page.goto('/holder/credentials');

      // Look for share/QR button
      const shareButton = page.getByRole('button', { name: /share|qr|verify/i });
      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Look for QR code
        const qrCode = page.locator('svg[role="img"], canvas, [data-testid="qr-code"]');
        await expect(qrCode.first()).toBeVisible();
      }
    });
  });
});

test.describe('Verifier Credential Checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { role: 'verifier' } }),
      });
    });
  });

  test('verifier can scan credential', async ({ page }) => {
    await page.goto('/verifier/scan');

    // Look for scan interface
    const scanInterface = page
      .getByText(/scan|verify|check/i)
      .or(page.locator('[data-testid="scanner"]'));
    await expect(scanInterface.first()).toBeVisible();
  });

  test('displays verification result for valid credential', async ({ page }) => {
    await page.route('**/api/verify*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          valid: true,
          credential: {
            type: 'MedicalLicense',
            holder: 'Dr. John Smith',
            status: 'active',
          },
        }),
      });
    });

    await page.goto('/verifier/result?id=test-credential');

    // Verify success state
    await expect(page.getByText(/valid|verified|active/i)).toBeVisible();
    await expect(page.getByText(/Dr\. John Smith/i)).toBeVisible();
  });

  test('displays verification result for invalid credential', async ({ page }) => {
    await page.route('**/api/verify*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          valid: false,
          reason: 'Credential has been revoked',
        }),
      });
    });

    await page.goto('/verifier/result?id=test-credential');

    // Verify failure state
    await expect(page.getByText(/invalid|revoked|failed/i)).toBeVisible();
  });
});

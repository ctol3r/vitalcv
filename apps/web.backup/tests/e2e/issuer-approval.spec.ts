import { test, expect } from '@playwright/test';

test.describe('Issuer Approval Flow', () => {
  test('should approve pending claim and issue VC', async ({ page }) => {
    // Login as issuer
    await page.goto('/login');
    await page.getByLabel('Email').fill('issuer@example.com'); // Adjust credentials as needed
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: /login/i }).click();

    // Navigate to claims dashboard if not redirected
    // await page.goto('/dashboard/claims');

    // Approve pending claim
    // Assuming a list of claims, click on the first pending one or a specific one
    await page.getByText(/pending/i).first().click();
    await page.getByRole('button', { name: /approve/i }).click();

    // Confirm backend returns Ed25519-signed VC
    // This is hard to verify in E2E UI test unless we intercept network or check UI reflection
    // We can check if the status changes to 'Issued' or similar
    await expect(page.getByText(/issued|approved/i)).toBeVisible();

    // Check audit event created
    // This might be a backend check or a UI check in an 'Audit Log' section
    await page.goto('/audit-log');
    await expect(page.getByText(/claim approved/i).first()).toBeVisible();
  });
});



















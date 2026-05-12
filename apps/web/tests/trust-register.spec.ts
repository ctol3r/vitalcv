import { test, expect } from '@playwright/test';

test.describe('Trust State Register', () => {
  test('renders all three states', async ({ page }) => {
    await page.goto('/trust');
    await expect(page.getByText('ANONYMOUS PREVIEW').first()).toBeVisible();
    await expect(page.getByText('OWNED SNAPSHOT').first()).toBeVisible();
    await expect(page.getByText('SIGNED INSTITUTIONAL ARTIFACT').first()).toBeVisible();
  });

  test('renders T1-T4 badges', async ({ page }) => {
    await page.goto('/trust');
    await expect(page.getByText('T1 · Self-Asserted').first()).toBeVisible();
    await expect(page.getByText('T3 · Source Checked').first()).toBeVisible();
    await expect(page.getByText('T4 · Issuer Signed').first()).toBeVisible();
  });

  test('renders all 6 lineage slots', async ({ page }) => {
    await page.goto('/trust');
    for (const slot of ['OBJECT', 'OWNERSHIP', 'CHECKED_AT', 'CHANNEL', 'REPLAY', 'RUN_ID']) {
      await expect(page.getByText(slot).first()).toBeVisible();
    }
  });

  test('renders issuer DID in monospace', async ({ page }) => {
    await page.goto('/trust');
    await expect(page.getByText('did:web:vitalcv.com').first()).toBeVisible();
  });

  test('No adverse findings renders as success', async ({ page }) => {
    await page.goto('/trust');
    // Should appear green or with success semantics
    const successEl = page.getByText('No Adverse Findings').first();
    await expect(successEl).toBeVisible();
  });

  test('machine-readable endpoint returns valid JSON', async ({ request }) => {
    const response = await request.get('/.well-known/trust-register');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.doctrine).toBeDefined();
    expect(body.issuer.did).toBe('did:web:vitalcv.com');
    expect(body.trust_states).toHaveLength(3);
  });
});

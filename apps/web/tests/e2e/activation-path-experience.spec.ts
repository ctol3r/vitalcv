import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
  { width: 1728, height: 1117 },
] as const;

async function signOutOnboarding(page: Page) {
  await page.route('**/api/me/workspaces', (route) =>
    route.fulfill({ status: 401, body: '' }),
  );
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('WO-16 activation path', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px keeps /pilot legible and complete`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto('/pilot', { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { level: 1 })).toContainText('Prove the handoff');
      await expect(page.locator('[data-scene="activation_path"]')).toBeVisible();
      await expect(page.locator('[data-activation-path="pilot"] [data-activation-step]')).toHaveCount(5);
      await expect(page.locator('[aria-label="Source states in the pilot"] li')).toHaveCount(4);
      await expect(page.getByTestId('pilot-request-form')).toBeAttached();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

      await testInfo.attach(`pilot-${viewport.width}`, {
        body: await page.screenshot({ animations: 'disabled', fullPage: true }),
        contentType: 'image/png',
      });
    });

    test(`${viewport.width}px keeps /onboarding action and path in bounds`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await signOutOnboarding(page);
      await page.goto('/onboarding', { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Start with your NPI. See where your record can go.',
      );
      await expect(page.locator('#guest-npi-input')).toBeVisible();
      await expect(page.locator('[data-scene="activation_path"]')).toBeVisible();
      await expect(page.locator('[data-activation-path="clinician"] [data-activation-step]')).toHaveCount(4);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

      await testInfo.attach(`onboarding-${viewport.width}`, {
        body: await page.screenshot({ animations: 'disabled', fullPage: true }),
        contentType: 'image/png',
      });
    });
  }

  test('reduced motion keeps both journeys complete and static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/pilot', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-scene="activation_path"] video')).toHaveCount(0);
    await expect(page.locator('[data-activation-path="pilot"] [data-activation-step]')).toHaveCount(5);

    await signOutOnboarding(page);
    await page.goto('/onboarding', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-scene="activation_path"] video')).toHaveCount(0);
    await expect(page.locator('[data-activation-path="clinician"] [data-activation-step]')).toHaveCount(4);
  });

  test('no JavaScript preserves the pilot story and an honest onboarding escape', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/pilot', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Prove the handoff');
    await expect(page.locator('[data-scene="activation_path"] img')).toBeVisible();
    await expect(page.locator('[data-scene-transcript]')).toHaveCount(1);
    await expect(page.locator('[data-activation-path="pilot"] [data-activation-step]')).toHaveCount(5);
    await expect(page.getByTestId('pilot-request-form')).toBeAttached();

    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Checking your workspace');
    await expect(page.getByRole('link', { name: 'Look up an NPI' })).toHaveAttribute('href', '/verify');
    await expect(page.locator('[data-scene="activation_path"] img')).toBeVisible();
    await expect(page.locator('[data-activation-path="clinician"] [data-activation-step]')).toHaveCount(4);

    await context.close();
  });
});
